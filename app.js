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
function apriMenu() {
  const container = document.getElementById("menuContainer");
  container.innerHTML = ''; // Pulisce il contenuto precedente

  return fetch("menu.json") // ✅ aggiunto return
    .then(res => res.json())
    .then(menu => {
      container.style.display = "block";
      let index = 1;

      for (const categoria in menu) {
        const sezione = document.createElement("div");
        sezione.className = "menu-section";

        const titolo = document.createElement("h2");
        titolo.textContent = categoria.replace(/_/g, " ").toUpperCase();
        sezione.appendChild(titolo);

        menu[categoria].forEach(item => {
          const blocco = document.createElement("div");
          blocco.className = "menu-item-block";

          const nome = document.createElement("strong");

          if (categoria.toLowerCase().includes("pizzette_clasicas") || categoria.toLowerCase().includes("pizzette_especiales")) {
            nome.textContent = `${index}. ${item.nome}`;
            index++;
          } else {
            nome.textContent = item.nome;
          }

          const prezzo = document.createElement("span");
          prezzo.textContent = `${item.prezzo} €`;

          const quantitaWrapper = document.createElement("div");
          quantitaWrapper.className = "quantity-control";

          const menoBtn = document.createElement("button");
          menoBtn.textContent = "−";

          const inputQuantita = document.createElement("input");
          inputQuantita.type = "number";
          inputQuantita.value = 0;
          inputQuantita.min = 0;
          inputQuantita.readOnly = true;

          const piuBtn = document.createElement("button");
          piuBtn.textContent = "+";

          quantitaWrapper.appendChild(menoBtn);
          quantitaWrapper.appendChild(inputQuantita);
          quantitaWrapper.appendChild(piuBtn);

          blocco.appendChild(nome);
          blocco.appendChild(prezzo);
          blocco.appendChild(quantitaWrapper);

          sezione.appendChild(blocco);

          piuBtn.addEventListener("click", () => {
            inputQuantita.value = parseInt(inputQuantita.value) + 1;
            aggiornaCarrello(item.nome, item.prezzo, parseInt(inputQuantita.value));
          });

          menoBtn.addEventListener("click", () => {
            const nuovaQuantita = Math.max(0, parseInt(inputQuantita.value) - 1);
            inputQuantita.value = nuovaQuantita;
            aggiornaCarrello(item.nome, item.prezzo, nuovaQuantita);
          });
        });

        container.appendChild(sezione);
      }
    })
    .catch(err => {
      container.innerHTML = "<p>⚠️ Errore nel caricamento del menu.</p>";
      console.error("Errore caricamento menu:", err);
    });
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
