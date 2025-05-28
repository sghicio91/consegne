const map = L.map("map").setView([28.4636, -16.2518], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

let puntoPartenza = [28.466315, -16.259363];
let lineaPercorso = null;

fetch("zone_consegne_finale.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: f => ({
        color: f.properties.colore || "#3388ff",
        fillColor: f.properties.colore || "#3388ff",
        fillOpacity: f.properties["fill-opacity"] || 0.3,
        weight: 2
      }),
      onEachFeature: (_, layer) => drawnItems.addLayer(layer)
    });
  });

function searchAddress() {
  const nome = document.getElementById("nomeCliente").value.trim();
  const telefono = document.getElementById("telefonoCliente").value.trim();
  const address = document.getElementById("address").value;
  const resultBox = document.getElementById("result");

  if (!nome || !telefono) {
    alert("Inserisci nome e telefono prima di cercare un indirizzo.");
    return;
  }

  if (!address) {
    resultBox.innerText = "Inserisci un indirizzo valido.";
    return;
  }

  window.nomeCliente = nome;
  window.telefonoCliente = telefono;

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Santa Cruz de Tenerife')}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) {
        resultBox.innerText = "Indirizzo non trovato.";
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const puntoDestinazione = [lat, lon];
      const point = turf.point([lon, lat]);

      map.setView([lat, lon], 15);
      L.marker(puntoDestinazione).addTo(map).bindPopup("Indirizzo trovato").openPopup();

      if (lineaPercorso) map.removeLayer(lineaPercorso);

      fetch("https://ors-proxy-consegne.onrender.com/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coordinates: [
            [puntoPartenza[1], puntoPartenza[0]],
            [puntoDestinazione[1], puntoDestinazione[0]]
          ]
        })
      })
      .then(res => res.json())
      .then(routeData => {
        if (!routeData || !routeData.features || !routeData.features.length) {
          resultBox.innerText += "\n⚠️ Nessun percorso trovato.";
          return;
        }

        const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
        const summary = routeData.features[0].properties.summary;

        lineaPercorso = L.polyline(coords, { color: 'blue' }).addTo(map);

        const durataMinuti = Math.round(summary.duration / 60);
        const distanzaKm = (summary.distance / 1000).toFixed(1);
        resultBox.innerText = `Zona trovata.\nDistanza: ${distanzaKm} km - Tempo: ${durataMinuti} minuti`;

        let zona = null, prezzo = null;
        drawnItems.eachLayer(layer => {
          const feature = layer.toGeoJSON();
          if (turf.booleanPointInPolygon(point, feature)) {
            zona = feature.properties.name || "Senza nome";
            prezzo = feature.properties.prezzo || "0";
            window.prezzoSpedizione = parseFloat(prezzo.toString().replace(",", ".").replace("\u20ac", ""));
          }
        });

        window.indirizzoCliente = address;
        window.noteCliente = document.getElementById("note")?.value || "";

        if (!zona) {
          resultBox.innerText += "\n⚠️ Fuori zona di consegna.";
          document.getElementById("proseguiOrdineBtn").style.display = "none";
        } else {
          resultBox.innerText += `\nZona: ${zona} - Prezzo: ${prezzo}`;
          document.getElementById("proseguiOrdineBtn").style.display = "inline-block";
        }
      });
    });
}
async function apriMenu() {
  const response = await fetch("menu.json");
  const menu = await response.json();
  const container = document.getElementById("menuContainer");
  container.innerHTML = "";

  for (const categoria in menu) {
    const sezione = document.createElement("div");
    sezione.classList.add("menu-section");

    const titolo = document.createElement("h2");
    titolo.textContent = categoria.replaceAll("_", " ").toUpperCase();
    sezione.appendChild(titolo);

    menu[categoria].forEach(prodotto => {
      const riga = document.createElement("div");
      riga.classList.add("menu-item");

      const nome = document.createElement("span");
      nome.textContent = prodotto.nome;

      const prezzo = document.createElement("span");
      prezzo.textContent = `${prodotto.prezzo.toFixed(2)} €`;

      const quantitaInput = document.createElement("input");
      quantitaInput.type = "number";
      quantitaInput.min = 0;
      quantitaInput.value = carrello[prodotto.nome]?.quantita || 0;
      quantitaInput.addEventListener("change", () => {
        const q = parseInt(quantitaInput.value);
        if (q > 0) {
          carrello[prodotto.nome] = {
            prezzo: prodotto.prezzo,
            quantita: q
          };
        } else {
          delete carrello[prodotto.nome];
        }
        aggiornaRiepilogo();
      });

      const meno = document.createElement("button");
      meno.textContent = "−";
      meno.onclick = () => {
        if (quantitaInput.value > 0) {
          quantitaInput.value--;
          quantitaInput.dispatchEvent(new Event("change"));
        }
      };

      const piu = document.createElement("button");
      piu.textContent = "+";
      piu.onclick = () => {
        quantitaInput.value++;
        quantitaInput.dispatchEvent(new Event("change"));
      };

      const controls = document.createElement("div");
      controls.className = "quantity-control";
      controls.appendChild(meno);
      controls.appendChild(quantitaInput);
      controls.appendChild(piu);

      riga.appendChild(nome);
      riga.appendChild(prezzo);
      riga.appendChild(controls);

      sezione.appendChild(riga);
    });

    container.appendChild(sezione);
  }

  container.style.display = "block";
}




const carrello = {};

function aggiornaCarrello(nome, prezzo, quantita) {
  if (quantita > 0) {
    carrello[nome] = { prezzo: parseFloat(prezzo), quantita };
  } else {
    delete carrello[nome];
  }

  aggiornaRiepilogo();
}

function aggiornaRiepilogo() {
  const riepilogoProdotti = document.getElementById("riepilogoProdotti");
  const totaleQuantita = document.getElementById("totaleQuantita");
  const totalePrezzo = document.getElementById("totalePrezzo");

  riepilogoProdotti.innerHTML = "<h3>Prodotti selezionati:</h3>";

  let quantitaTotale = 0;
  let prezzoTotale = 0;

  for (const nome in carrello) {
    const item = carrello[nome];
    const div = document.createElement("div");
    div.className = "prodotto";

    const nomeEl = document.createElement("div");
    nomeEl.className = "nome";
    nomeEl.textContent = nome;

    const prezzoEl = document.createElement("div");
    prezzoEl.className = "prezzo";
    prezzoEl.textContent = `${(item.prezzo * item.quantita).toFixed(2)} €`;

    div.appendChild(nomeEl);
    div.appendChild(prezzoEl);
    riepilogoProdotti.appendChild(div);

    quantitaTotale += item.quantita;
    prezzoTotale += item.prezzo * item.quantita;
  }

  totaleQuantita.textContent = quantitaTotale;
  totalePrezzo.textContent = prezzoTotale.toFixed(2) + " €";

  const spedizione = window.prezzoSpedizione || 0;
  document.getElementById("costoSpedizione").textContent = `Spedizione: ${spedizione.toFixed(2)} €`;
  document.getElementById("totaleFinale").textContent = `Totale: ${(prezzoTotale + spedizione).toFixed(2)} €`;
}
