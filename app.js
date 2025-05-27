
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
  const esistente = document.getElementById("datiClienteOverlay");
  if (esistente) return;

  const overlay = document.createElement("div");
  overlay.id = "datiClienteOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "1000";

  const box = document.createElement("div");
  box.style.background = "#fff";
  box.style.padding = "30px";
  box.style.borderRadius = "16px";
  box.style.boxShadow = "0 2px 12px rgba(0,0,0,0.2)";
  box.style.textAlign = "center";
  box.style.minWidth = "300px";
  box.style.maxWidth = "80%";

  box.innerHTML = 
    <h3>Inserisci il tuo nome</h3>
    <input id="stepNomeCliente" type="text" placeholder="Nome" style="padding:10px;width:90%;margin-bottom:10px"><br>
    <button onclick="stepTelefonoCliente()" style="padding:10px 20px;border:none;background:#007bff;color:white;border-radius:8px">Avanti</button>
  ;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function stepTelefonoCliente() {
  const nome = document.getElementById("stepNomeCliente").value.trim();
  if (!nome) return alert("Inserisci il nome.");

  window.nomeCliente = nome;

  const box = document.querySelector("#datiClienteOverlay div");
  box.innerHTML = 
    <h3>Inserisci il tuo telefono</h3>
    <input id="stepTelefonoCliente" type="text" placeholder="Telefono" style="padding:10px;width:90%;margin-bottom:10px"><br>
    <button onclick="confermaDatiCliente()" style="padding:10px 20px;border:none;background:#28a745;color:white;border-radius:8px">Avanti</button>
  ;
}

function confermaDatiCliente() {
  const telefono = document.getElementById("stepTelefonoCliente").value.trim();
  if (!telefono) return alert("Inserisci il numero di telefono.");

  window.telefonoCliente = telefono;

  const overlay = document.getElementById("datiClienteOverlay");
  if (overlay) overlay.remove();

  apriMenu();
}
