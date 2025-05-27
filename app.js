
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
  const address = document.getElementById("address").value;
  const resultBox = document.getElementById("result");
  if (!address) {
    resultBox.innerText = "Inserisci un indirizzo valido.";
    return;
  }

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
  resultBox.innerText += "\\n⚠️ Nessun percorso trovato.";
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
            window.prezzoSpedizione = parseFloat(prezzo.toString().replace(",", ".").replace("€", ""));
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
    function chiediDatiCliente() {
  if (window.nomeCliente && window.telefonoCliente) return apriMenu();

  const nome = prompt("Inserisci il nome del cliente:");
  const telefono = prompt("Inserisci il numero di telefono:");

  if (!nome || !telefono) return alert("Nome e telefono sono obbligatori.");

  window.nomeCliente = nome;
  window.telefonoCliente = telefono;
  apriMenu();
}
  function apriMenu() {
  const menu = JSON.parse(localStorage.getItem("menuTemp"));
  const container = document.getElementById("menuContainer");
  container.innerHTML = '';

  for (const categoria in menu) {
    const sezione = document.createElement("div");
    sezione.classList.add("menu-section");

    const titolo = document.createElement("h2");
    titolo.textContent = categoria.replaceAll("_", " ").toUpperCase();
    sezione.appendChild(titolo);

    menu[categoria].forEach((prodotto, index) => {
      const item = document.createElement("div");
      item.classList.add("menu-item-block");

      const nome = document.createElement("strong");
      if (categoria === "pizzette_clasicas") {
      nome.textContent = `${index + 1}. ${prodotto.nome}`;
      } else if (categoria === "pizzette_especiales") {
      nome.textContent = `${index + 23}. ${prodotto.nome}`;
      } else {
      nome.textContent = prodotto.nome;
      }


      const prezzo = document.createElement("span");
      prezzo.textContent = prodotto.prezzo.toFixed(2) + " €";

      const quantityControl = document.createElement("div");
      quantityControl.classList.add("quantity-control");

      const minusBtn = document.createElement("button");
      minusBtn.textContent = "-";

      const quantityInput = document.createElement("input");
      quantityInput.type = "number";
      quantityInput.value = 0;
      quantityInput.min = 0;
      quantityInput.addEventListener("change", aggiornaRiepilogo);

      const plusBtn = document.createElement("button");
      plusBtn.textContent = "+";

      plusBtn.addEventListener("click", () => {
        quantityInput.value = parseInt(quantityInput.value) + 1;
        aggiornaRiepilogo();
      });

      minusBtn.addEventListener("click", () => {
        if (parseInt(quantityInput.value) > 0) {
          quantityInput.value = parseInt(quantityInput.value) - 1;
          aggiornaRiepilogo();
        }
      });

      quantityControl.appendChild(minusBtn);
      quantityControl.appendChild(quantityInput);
      quantityControl.appendChild(plusBtn);

      item.appendChild(nome);
      item.appendChild(prezzo);
      item.appendChild(quantityControl);

      sezione.appendChild(item);
    });

    container.appendChild(sezione);
  }

  container.style.display = "block";
  aggiornaRiepilogo();
}
