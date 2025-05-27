
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
}
function chiediDatiCliente() {
  const container = document.createElement("div");
  container.id = "formCliente";
  container.style.position = "fixed";
  container.style.top = "20%";
  container.style.left = "50%";
  container.style.transform = "translateX(-50%)";
  container.style.background = "white";
  container.style.padding = "20px";
  container.style.borderRadius = "10px";
  container.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
  container.style.zIndex = 9999;

  container.innerHTML = `
    <label>Nome: <input id="nomeCliente" type="text"></label><br><br>
    <button onclick="proseguiTelefono()">Avanti</button>
  `;

  document.body.appendChild(container);
}

function proseguiTelefono() {
  const nome = document.getElementById("nomeCliente").value.trim();
  if (!nome) {
    alert("Inserisci il nome.");
    return;
  }
  window.nomeCliente = nome;

  const container = document.getElementById("formCliente");
  container.innerHTML = `
    <label>Telefono: <input id="telefonoCliente" type="text"></label><br><br>
    <button onclick="finalizzaDatiCliente()">Avanti</button>
  `;
}

function finalizzaDatiCliente() {
  const telefono = document.getElementById("telefonoCliente").value.trim();
  if (!telefono) {
    alert("Inserisci il telefono.");
    return;
  }
  window.telefonoCliente = telefono;

  const container = document.getElementById("formCliente");
  container.remove();

  document.getElementById("mappa").style.height = "300px";
  document.getElementById("menuContainer").style.display = "block";

  apriMenu();
}


function mostraMenu() {
  const nome = document.getElementById("nomeCliente").value.trim();
  const telefono = document.getElementById("telefonoCliente").value.trim();
  if (!nome || !telefono) {
    alert("Inserisci nome e telefono.");
    return;
  }

  window.nomeCliente = nome;
  window.telefonoCliente = telefono;

  document.getElementById("mappa").style.height = "300px";
  document.getElementById("menuContainer").style.display = "block";

  apriMenu(); // se hai già questa funzione, si attiverà il menu
}



