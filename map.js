/**
 * AgriMap Lite - Leaflet.js Mapping Engine
 * Manages spatial data visualization and geographic coordination.
 */

import { getPHCategory } from './db.js';

let mapInstance = null;
let markerLayerGroup = null;

/**
 * Returns the active map instance
 */
export function getMapInstance() {
  return mapInstance;
}

/**
 * Returns the marker layer group
 */
export function getMarkerLayerGroup() {
  return markerLayerGroup;
}

/**
 * Initializes the map inside the specified element.
 * @param {string} elementId - The ID of the container element
 * @param {Function} onMapClick - Callback when user clicks on map (returns {lat, lng})
 * @returns {Object} Leaflet Map instance
 */
export function initMap(elementId, onMapClick) {
  // If map already exists, return it
  if (mapInstance) {
    return mapInstance;
  }

  // Default coordinate: Yogyakarta/Java Agricultural Hub (-7.8012, 110.37)
  const defaultLat = -7.8012;
  const defaultLng = 110.3700;
  const defaultZoom = 10;

  // Initialize Leaflet map
  // Note: We use L from the global scope (since it's loaded from CDN)
  if (typeof L === 'undefined') {
    console.error('Leaflet is not loaded yet.');
    return null;
  }

  mapInstance = L.map(elementId, {
    zoomControl: true,
    maxZoom: 18,
    minZoom: 3
  }).setView([defaultLat, defaultLng], defaultZoom);

  // Use a beautiful, eye-friendly, high-contrast OpenStreetMap style
  // Standard OSM: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  // Humanitarian layout: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png' (great green/earthy tones)
  L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors, ODBL'
  }).addTo(mapInstance);

  // Initialize a layer group for markers so we can easily clear them
  markerLayerGroup = L.layerGroup().addTo(mapInstance);

  // Register map click listener to retrieve coords
  if (onMapClick) {
    mapInstance.on('click', (event) => {
      const { lat, lng } = event.latlng;
      // Precision to 6 decimal places is plenty for precise field work
      onMapClick({
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6))
      });
    });
  }

  return mapInstance;
}

/**
 * Updates markers plotted on the map.
 * @param {Array} samples - List of soil records
 * @param {Function} onMarkerSelect - Callback when a marker's action is clicked
 */
export function updateMapMarkers(samples, onMarkerSelect) {
  if (!mapInstance || !markerLayerGroup) return;

  // Clear existing markers
  markerLayerGroup.clearLayers();

  if (samples.length === 0) return;

  const bounds = [];

  samples.forEach((sample) => {
    const { id, nama, latitude, longitude, ph, catatan } = sample;
    if (isNaN(latitude) || isNaN(longitude)) return;

    const catInfo = getPHCategory(ph);
    bounds.push([latitude, longitude]);

    // Create a beautiful, custom vector circle marker
    const marker = L.circleMarker([latitude, longitude], {
      radius: 12,
      fillColor: catInfo.color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85
    });

    // Create a rich popup containing information and crop suitability metrics
    const eligibility = evaluateCropCompatibility(ph);

    const popupContent = `
      <div class="p-1 font-sans">
        <h4 class="text-sm font-bold text-gray-900 border-b pb-1 mb-1.5">${nama}</h4>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-2">
          <span class="text-gray-500">Nilai pH:</span>
          <span class="font-bold flex items-center gap-1">
            <span class="w-2 h-2 inline-block rounded-full" style="background-color: ${catInfo.color}"></span>
            ${ph.toFixed(1)} (${catInfo.label})
          </span>
          <span class="text-gray-500">Koordinat:</span>
          <span class="font-mono text-gray-700 font-semibold">${latitude.toFixed(4)}, ${longitude.toFixed(4)}</span>
        </div>
        
        <div class="bg-gray-50 p-1.5 rounded border border-gray-100 text-xxs mb-2 leading-relaxed">
          <p class="font-bold text-gray-800 mb-0.5">Kesesuaian Tanaman:</p>
          <div class="flex flex-col gap-0.5">
            <div class="flex justify-between">
              <span>Cabai Merah:</span>
              <span class="font-semibold ${eligibility.chili.suitable ? 'text-emerald-700' : 'text-red-600'}">${eligibility.chili.status}</span>
            </div>
            <div class="flex justify-between">
              <span>Mentimun:</span>
              <span class="font-semibold ${eligibility.cucumber.suitable ? 'text-emerald-700' : 'text-red-600'}">${eligibility.cucumber.status}</span>
            </div>
          </div>
        </div>

        ${catatan ? `<p class="text-xxs text-gray-600 italic border-l-2 border-emerald-300 pl-1 mb-2.5 max-w-[200px] truncate-3-lines">${catatan}</p>` : ''}

        <div class="flex items-center justify-end gap-1.5 pt-1.5 border-t">
          <button onclick="window.dispatchMapEdit(${id})" class="bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 text-xxs font-medium transition cursor-pointer">
            Edit Titik
          </button>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 260,
      className: 'custom-leaflet-popup'
    });

    // Store sample id inside marker for programmatic selectors
    marker.sampleId = id;
    
    // Add to layer group
    markerLayerGroup.addLayer(marker);
  });

  // Automatically zoom and fit elements if there are markers on map
  if (bounds.length > 0) {
    mapInstance.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15
    });
  }
}

/**
 * Focuses map view on specific coordinate
 */
export function focusOnCoords(lat, lng, zoom = 14) {
  if (mapInstance) {
    mapInstance.setView([lat, lng], zoom, {
      animate: true,
      duration: 1
    });
  }
}

/**
 * Calculates compatibility for Cabai and Mentimun:
 * - Cabai: pH 5.6 - 6.8 (ideal). 5.0 - 5.5 / 6.9 - 7.5 (Bisa tumbuh dengan penyesuaian). Lainnya (Tidak cocok).
 * - Mentimun: pH 5.5 - 6.8 (ideal). 5.0 - 5.4 / 6.9 - 7.2 (Bisa tumbuh). Lainnya (Tidak cocok).
 */
export function evaluateCropCompatibility(ph) {
  const result = {
    chili: { suitable: false, status: '', note: '' },
    cucumber: { suitable: false, status: '', note: '' }
  };

  // Chili (Cabai) evaluation
  if (ph >= 5.6 && ph <= 6.8) {
    result.chili.suitable = true;
    result.chili.status = 'Sangat Ideal';
    result.chili.note = 'Kondisi optimum untuk perakaran dan penyerapan hara cabai.';
  } else if (ph >= 5.0 && ph < 5.6) {
    result.chili.suitable = true;
    result.chili.status = 'Agak Sesuai';
    result.chili.note = 'Tambahkan sedikit dolomit/kapur pertanian untuk mencapai hasil maksimal.';
  } else if (ph > 6.8 && ph <= 7.5) {
    result.chili.suitable = true;
    result.chili.status = 'Agak Sesuai';
    result.chili.note = 'Sedikit alkali. Rendam tanah dengan pupuk organik asam atau amonium sulfat.';
  } else {
    result.chili.suitable = false;
    result.chili.status = 'Tidak Cocok';
    result.chili.note = ph < 5.0 ? 'Terlalu masam! Sangat beracun aluminium untuk akar cabai.' : 'Terlalu basa! Defisiensi zat besi sengit.';
  }

  // Cucumber (Mentimun) evaluation
  if (ph >= 5.5 && ph <= 6.8) {
    result.cucumber.suitable = true;
    result.cucumber.status = 'Sangat Ideal';
    result.cucumber.note = 'Mentimun menyukai pH produktif sedang ini. Penyerapan Ca sangat bagus.';
  } else if (ph >= 5.0 && ph < 5.5) {
    result.cucumber.suitable = true;
    result.cucumber.status = 'Cukup Sesuai';
    result.cucumber.note = 'Bisa tumbuh, namun rentan layu bakteri. Direkomendasikan naikkan pH ke 6.0.';
  } else if (ph > 6.8 && ph <= 7.5) {
    result.cucumber.suitable = true;
    result.cucumber.status = 'Cukup Sesuai';
    result.cucumber.note = 'Alkali ringan. Menguntungkan bagi ketahanan embun tepung tapi hara besi terikat.';
  } else {
    result.cucumber.suitable = false;
    result.cucumber.status = 'Tidak Cocok';
    result.cucumber.note = ph < 5.0 ? 'Kemasaman ekstrem merusak tunas mentimun.' : 'Tanah basa menghambat pembuahan mentimun.';
  }

  return result;
}
