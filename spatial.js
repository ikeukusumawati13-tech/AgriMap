/**
 * AgriMap Lite - Spatial Coordinator
 * Integrates IDW interpolation grid rendering and suitability layer overlay controls.
 */

import { performIDW } from './interpolation.js';
import { classifyChiliSuitability, classifyCucumberSuitability } from './suitability.js';
import { getPHCategory } from './db.js';

// Holds references to active Leaflet Layer groups
let heatmapLayerGroup = null;
let chiliLayerGroup = null;
let cucumberLayerGroup = null;

// Extracted spatial stats following last calculation
let currentSpatialStats = {
  chiliHighlySuitableHa: 0,
  cucumberHighlySuitableHa: 0,
  suitablePercent: 0,
  unsuitablePercent: 0,
  totalAreaHa: 0
};

/**
 * Executes full spatial pipe, recalculating interpolation and recreating Leaflet overlay frames.
 * @param {Object} mapInstance - Leaflet map instance
 * @param {Array} samples - Entire soil database
 */
export function recalculateSpatialLayers(mapInstance, samples) {
  if (!mapInstance) return null;

  // Initialize or clear layer groups
  if (!heatmapLayerGroup) heatmapLayerGroup = L.featureGroup();
  else heatmapLayerGroup.clearLayers();

  if (!chiliLayerGroup) chiliLayerGroup = L.featureGroup();
  else chiliLayerGroup.clearLayers();

  if (!cucumberLayerGroup) cucumberLayerGroup = L.featureGroup();
  else cucumberLayerGroup.clearLayers();

  if (!samples || samples.length === 0) {
    resetSpatialStats();
    return currentSpatialStats;
  }

  // 1. Run IDW interpolation engine with 40x40 division grid
  const resolution = 42; // Perfect balance between fidelity and lightning performance
  const { cells, stats } = performIDW(samples, resolution, 2);

  if (cells.length === 0) {
    resetSpatialStats();
    return currentSpatialStats;
  }

  // Initialize accumulators for statistical spatial dashboards
  let chiliHighlySuitableHa = 0;
  let cucumberHighlySuitableHa = 0;
  let totalSuitableHa = 0;
  let totalUnsuitableHa = 0;
  let totalCalculatedHa = 0;

  // 2. Map cells into respective Leaflet Grid overlays
  cells.forEach(cell => {
    const { lat1, lng1, lat2, lng2, ph, areaHa } = cell;

    totalCalculatedHa += areaHa;

    // --- A. Normal pH Heatmap (Legenda Standard) ---
    const phCat = getPHCategory(ph);
    const heatmapRect = L.rectangle([[lat1, lng1], [lat2, lng2]], {
      color: 'transparent',
      fillColor: phCat.color,
      fillOpacity: 0.42,
      weight: 0,
      interactive: true
    });
    heatmapRect.bindTooltip(`pH Terinterpolasi: ${ph.toFixed(2)} (${phCat.label})`, { sticky: true, className: 'text-xxs font-mono font-bold' });
    heatmapLayerGroup.addLayer(heatmapRect);

    // --- B. Chili (Cabai) Suitability Layer ---
    const chiliSuit = classifyChiliSuitability(ph);
    if (chiliSuit.isHighlySuitable) chiliHighlySuitableHa += areaHa;
    if (chiliClassIsGenerallySuitable(chiliSuit.status)) totalSuitableHa += areaHa;
    else totalUnsuitableHa += areaHa;

    const chiliRect = L.rectangle([[lat1, lng1], [lat2, lng2]], {
      color: 'transparent',
      fillColor: chiliSuit.color,
      fillOpacity: 0.46,
      weight: 0,
      interactive: true
    });
    chiliRect.bindTooltip(`Kesesuaian Cabai: ${chiliSuit.status} (pH ${ph.toFixed(2)})<br><span class="text-xxs text-slate-300 font-normal shadow-sm">${chiliSuit.description}</span>`, { 
      html: true, 
      sticky: true, 
      className: 'text-xxs font-bold p-1 bg-slate-900/90 text-white border-none rounded-lg' 
    });
    chiliLayerGroup.addLayer(chiliRect);

    // --- C. Cucumber (Mentimun) Suitability Layer ---
    const cucumberSuit = classifyCucumberSuitability(ph);
    if (cucumberSuit.isHighlySuitable) cucumberHighlySuitableHa += areaHa;
    // (Total suitable percentage considers average of both, or just general suitability thresholds)
    
    const cucumberRect = L.rectangle([[lat1, lng1], [lat2, lng2]], {
      color: 'transparent',
      fillColor: cucumberSuit.color,
      fillOpacity: 0.46,
      weight: 0,
      interactive: true
    });
    cucumberRect.bindTooltip(`Kesesuaian Mentimun: ${cucumberSuit.status} (pH ${ph.toFixed(2)})`, { sticky: true, className: 'text-xxs font-bold' });
    cucumberLayerGroup.addLayer(cucumberRect);
  });

  // Calculate final dashboard stats
  const totalArea = totalSuitableHa + totalUnsuitableHa;
  currentSpatialStats = {
    chiliHighlySuitableHa,
    cucumberHighlySuitableHa,
    suitablePercent: totalArea > 0 ? (totalSuitableHa / totalArea) * 100 : 0,
    unsuitablePercent: totalArea > 0 ? (totalUnsuitableHa / totalArea) * 100 : 0,
    totalAreaHa: stats.totalAreaHa
  };

  return currentSpatialStats;
}

/**
 * Check if the label counts as geographically suitable for generic percentages
 */
function chiliClassIsGenerallySuitable(status) {
  return status !== 'Tidak Sesuai';
}

function resetSpatialStats() {
  currentSpatialStats = {
    chiliHighlySuitableHa: 0,
    cucumberHighlySuitableHa: 0,
    suitablePercent: 0,
    unsuitablePercent: 0,
    totalAreaHa: 0
  };
}

/**
 * Returns current statistics payload
 */
export function getSpatialStats() {
  return currentSpatialStats;
}

/**
 * Returns specific Layer instances for dynamic toggling inside app.js
 */
export function getSpatialLayerGroups() {
  return {
    heatmap: heatmapLayerGroup,
    chili: chiliLayerGroup,
    cucumber: cucumberLayerGroup
  };
}
