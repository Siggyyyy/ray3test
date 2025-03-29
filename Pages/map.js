// === Map Initialization ===
const mapOptions = {
  center: [53.383331, -1.466667],
  zoom: 6,
};

const map = new L.map("map-container", mapOptions);
const tileLayer = new L.TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
map.addLayer(tileLayer);

// === Drawing Setup ===
const drawnPolygons = [];
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const activePolygons = [];
const polygonLayerGroup = L.layerGroup().addTo(map);
let regionLayer;

// === Drawing Controls ===
const drawControl = new L.Control.Draw({
  draw: {
    polygon: {
      allowIntersection: false,
      showArea: true,
      shapeOptions: { color: "blue" },
    },
    polyline: {
      shapeOptions: { color: "red" },
    },
    rectangle: {
      shapeOptions: { color: "green" },
    },
    circle: {
      shapeOptions: { color: "purple" },
    },
    marker: true,
    circlemarker: true,
  },
  edit: {
    featureGroup: drawnItems,
    edit: true,
    remove: true,
  }
});
map.addControl(drawControl);

// === Color Gradient Scale ===
function getColorByCount(count) {
  if (count >= 10) return "#4d0019";
  if (count === 9) return "#800026";
  if (count === 8) return "#bd0026";
  if (count === 7) return "#e31a1c";
  if (count === 6) return "#fc4e2a";
  if (count === 5) return "#fd8d3c";
  if (count === 4) return "#feb24c";
  if (count === 3) return "#fed976";
  if (count === 2) return "#ffeda0";
  if (count === 1) return "#ffffcc";
  return "#d3d3d3";
}

// === Render Region Layer with Color ===
function renderRegionCoverage() {
  if (regionLayer) map.removeLayer(regionLayer);

  fetch('regions.geojson')
    .then(res => res.json())
    .then(geojsonData => {
      regionLayer = L.geoJSON(geojsonData, {
        style: feature => {
          const region = feature.geometry;
          let count = 0;

          for (const poly of activePolygons) {
            const mission = poly.toGeoJSON().geometry;
            if (turf.intersect(region, mission)) count++;
          }

          return {
            color: "black",
            weight: 1,
            fillColor: getColorByCount(count),
            fillOpacity: 0.6,
          };
        },
      }).addTo(map);

      console.log("✅ Region layer rendered");
    })
    .catch(err => console.error("❌ Error rendering regions:", err));
}

// === Draw Events ===
map.on("draw:created", (e) => {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  if (e.layerType === "polygon") {
    const geojsonShape = layer.toGeoJSON();
    const shapeArea = turf.area(geojsonShape);
    let totalCoverage = 0;

    for (const poly of activePolygons) {
      try {
        const intersection = turf.intersect(geojsonShape, poly.toGeoJSON());
        if (intersection) {
          const intersectionArea = turf.area(intersection);
          totalCoverage += (intersectionArea / shapeArea) * 100;
        }
      } catch (err) {
        console.warn("Intersection error:", err);
      }
    }

    drawnPolygons.push({
      id: drawnPolygons.length + 1,
      area: (shapeArea / 1e6).toFixed(2),
      type: e.layerType,
      coverage: totalCoverage.toFixed(4),
    });

    updatePolygonTable();
  }
});

map.on("draw:deleted", () => {
  drawnPolygons.length = 0;
  updatePolygonTable();
});

function updatePolygonTable() {
  const tableBody = document.querySelector("#polygon-table tbody");
  tableBody.innerHTML = drawnPolygons.map(polygon =>
    `<tr>
      <td>${polygon.id}</td>
      <td>${polygon.type}</td>
      <td>${polygon.area} km²</td>
      <td>${polygon.coverage}%</td>
    </tr>`).join("");
}

// === Marker Clustering ===
const markersCluster = L.markerClusterGroup({
  disableClusteringAtZoom: 10,
  chunkedLoading: true,
  maxClusterRadius: 50,
  iconCreateFunction: cluster => new L.DivIcon({
    html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
    className: "custom-cluster-icon",
    iconSize: new L.Point(40, 40),
  }),
});
map.addLayer(markersCluster);

function addMarkersToMap(markerData) {
  markersCluster.clearLayers();
  polygonLayerGroup.clearLayers();
  activePolygons.length = 0;

  const markerObjects = markerData.map(({ lat, lng, productId, coordinates }) => {
    const marker = L.marker([lat, lng]).bindPopup(`
      <strong>Product ID:</strong> ${productId}<br>
      <span style="color:green;">Auto-loaded polygon</span>
    `);

    if (coordinates && coordinates.length) {
      const polygon = L.polygon(coordinates, { color: "blue" });
      const area = turf.area(polygon.toGeoJSON());

      if (area < 1e9) {
        polygonLayerGroup.addLayer(polygon);
        activePolygons.push(polygon);
      } else {
        console.warn(`⚠️ Skipped large polygon (${(area / 1e6).toFixed(2)} km²) for Product ID: ${productId}`);
      }
    }

    return marker;
  });

  markersCluster.addLayers(markerObjects);
  renderRegionCoverage();
  handlePolygonVisibility();
}

async function fetchAccessToken() {
  try {
    const res = await fetch("https://hallam.sci-toolset.com/api/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic c2NpLXRvb2xzZXQ6c3Q="
      },
      body: new URLSearchParams({
        grant_type: "password",
        username: "hallam2",
        password: "2513@5De"
      })
    });

    const { access_token } = await res.json();
    if (access_token) fetchProducts(access_token);
  } catch (err) {
    console.error("❌ Token fetch error:", err);
  }
}

async function fetchProducts(token) {
  try {
    const res = await fetch("https://ray3-backend.onrender.com/fetch-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token })
    });

    const result = await res.json();
    const productIds = result.results?.searchresults?.map(p => p.id) || [];
    if (productIds.length > 0) fetchProductInfo(token, productIds);
  } catch (err) {
    console.error("❌ Error fetching products:", err);
  }
}

async function fetchProductInfo(token, productIds) {
  try {
    const res = await fetch("https://ray3-backend.onrender.com/fetch-product-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: token, productIds })
    });

    const productData = await res.json();
    const validProducts = productData.filter(p =>
      p.centre && p.footprint && p.footprint.coordinates && !p.error
    );

    const markers = validProducts.map(({ productId, centre, footprint }) => {
      const [lat, lng] = centre.split(',').map(Number);
      const coordinates = footprint.coordinates[0].map(coord => [coord[1], coord[0]]);
      return { lat, lng, productId, coordinates };
    });

    addMarkersToMap(markers);
  } catch (err) {
    console.error("❌ Error fetching product info:", err);
  }
}

const polygonVisibilityZoomThreshold = 9;

function handlePolygonVisibility() {
  if (map.getZoom() >= polygonVisibilityZoomThreshold) {
    map.addLayer(polygonLayerGroup);
  } else {
    map.removeLayer(polygonLayerGroup);
  }
}

map.on("zoomend", handlePolygonVisibility);

// === Add Color Legend ===
function addColorLegend() {
  const legend = L.control({ position: "bottomright" });

  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    div.innerHTML = `
      <h4>Regional Key</h4>
      <div class="legend-gradient"></div>
      <div class="legend-labels">
        <span>0</span>
        <span>10+</span>
      </div>
    `;
    return div;
  };

  legend.addTo(map);
}

fetchAccessToken();
addColorLegend();

// === Inject Custom Styles ===
const style = document.createElement("style");
style.innerHTML = `
  .custom-cluster-icon {
    background-color: #42A5F5;
    color: white;
    border-radius: 50%;
    text-align: center;
    font-size: 14px;
    line-height: 40px;
  }
  .legend {
    background: rgba(255, 255, 255, 0.9);
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.4;
    color: #333;
    border-radius: 6px;
    box-shadow: 0 0 6px rgba(0,0,0,0.3);
  }
  .legend h4 {
    margin: 0 0 5px;
    font-size: 13px;
    text-align: center;
  }
  .legend-gradient {
    width: 100px;
    height: 10px;
    background: linear-gradient(to right, #d3d3d3, #ffffcc, #ffeda0, #fed976, #feb24c, #fd8d3c, #fc4e2a, #e31a1c, #bd0026, #800026, #4d0019);
    border: 1px solid #999;
    margin-bottom: 5px;
  }
  .legend-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }
`;
document.head.appendChild(style);

// === Raytheon Base Marker ===
L.marker([51.5074, -0.1278], {
  icon: L.icon({
    iconUrl: '../Assets/Images/Raytheon Logo.svg',
    iconSize: [100, 100],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25]
  })
}).addTo(map).bindPopup('Our main base in London!');
