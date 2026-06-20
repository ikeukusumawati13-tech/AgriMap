/**
 * AgriMap Lite - Spatial Coordinator
 * Integrates IDW interpolation grid rendering, Ordinary Kriging, and suitability layer overlay controls.
 */

import { performIDW } from './interpolation.js';
import { classifyChiliSuitability, classifyCucumberSuitability } from './suitability.js';
import { getPHCategory } from './db.js';
import { runGeostatisticalAnalysis } from './geostatistics.js';
import { ordinaryKrigingSingle, buildKrigingMatrix } from './kriging.js';

// Holds references to active Leaflet Layer groups
let heatmapLayerGroup = null;
let krigingLayerGroup = null;
let krigingErrorLayerGroup = null;
let chiliLayerGroup = null;
let cucumberLayerGroup = null;

// Extracted spatial stats following last calculation
let currentSpatialStats = {
  chiliHighlySuitableHa: 0,
  cucumberHighlySuitableHa: 0,
  suitablePercent: 0,
  unsuitablePercent: 0,
  totalAreaHa: 0,
  avgDolomite: 0,
  maxDolomite: 0,
  minDolomite: 0,
  countNeedDolomite: 0
};

// Global cached geostatistical results
let lastGeostatsResult = null;

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

  if (!krigingLayerGroup) krigingLayerGroup = L.featureGroup();
  else krigingLayerGroup.clearLayers();

  if (!krigingErrorLayerGroup) krigingErrorLayerGroup = L.featureGroup();
  else krigingErrorLayerGroup.clearLayers();

  if (!chiliLayerGroup) chiliLayerGroup = L.featureGroup();
  else chiliLayerGroup.clearLayers();

  if (!cucumberLayerGroup) cucumberLayerGroup = L.featureGroup();
  else cucumberLayerGroup.clearLayers();

  if (!samples || samples.length === 0) {
    resetSpatialStats();
    lastGeostatsResult = null;
    return currentSpatialStats;
  }

  // 1. Run IDW interpolation engine with 42x42 division grid
  const resolution = 42; 
  const { cells, stats } = performIDW(samples, resolution, 2);

  if (cells.length === 0) {
    resetSpatialStats();
    lastGeostatsResult = null;
    return currentSpatialStats;
  }

  // 2. Perform Geostatistical Modeling
  lastGeostatsResult = runGeostatisticalAnalysis(samples);
  let krigingA = null;
  if (lastGeostatsResult && lastGeostatsResult.status === 'success') {
    krigingA = buildKrigingMatrix(lastGeostatsResult.projected, lastGeostatsResult.fittedModel);
  }

  // Pre-calculate projection constants for cell loop
  const sumLat = samples.reduce((acc, s) => acc + s.latitude, 0);
  const sumLng = samples.reduce((acc, s) => acc + s.longitude, 0);
  const originLat = sumLat / samples.length;
  const originLng = sumLng / samples.length;

  const latToMeters = 111320;
  const rad = originLat * (Math.PI / 180);
  const lngToMeters = 111320 * Math.cos(rad);

  const maxErrorBound = lastGeostatsResult?.fittedModel ? Math.sqrt(lastGeostatsResult.fittedModel.sill) : 1;

  // Initialize accumulators for statistical spatial dashboards
  let chiliHighlySuitableHa = 0;
  let cucumberHighlySuitableHa = 0;
  let totalSuitableHa = 0;
  let totalUnsuitableHa = 0;
  let totalCalculatedHa = 0;

  // 3. Map cells into respective Leaflet Grid overlays
  cells.forEach(cell => {
    const { lat1, lng1, lat2, lng2, centerLat, centerLng, ph, areaHa } = cell;

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
    heatmapRect.bindTooltip(`pH Terinterpolasi (IDW): ${ph.toFixed(2)} (${phCat.label})`, { sticky: true, className: 'text-xxs font-mono font-bold' });
    heatmapLayerGroup.addLayer(heatmapRect);

    // --- B. ORDINARY KRIGING PREDICTION ---
    let krigPh = ph;
    let krigVar = 0;
    if (lastGeostatsResult && lastGeostatsResult.status === 'success') {
      const targetX = (centerLng - originLng) * lngToMeters;
      const targetY = (centerLat - originLat) * latToMeters;
      const krigRes = ordinaryKrigingSingle(targetX, targetY, lastGeostatsResult.projected, lastGeostatsResult.fittedModel, krigingA);
      if (krigRes) {
        krigPh = krigRes.prediction;
        krigVar = krigRes.variance;
      }
    }

    const krigCat = getPHCategory(krigPh);
    const krigingRect = L.rectangle([[lat1, lng1], [lat2, lng2]], {
      color: 'transparent',
      fillColor: krigCat.color,
      fillOpacity: 0.45,
      weight: 0,
      interactive: true
    });
    krigingRect.bindTooltip(`pH Estimasi Kriging: ${krigPh.toFixed(2)} (${krigCat.label})<br><span class="text-[9px] text-slate-300 font-semibold">Var Kriging: ${krigVar.toFixed(4)}</span>`, {
      html: true,
      sticky: true,
      className: 'text-xxs font-mono font-bold p-1 bg-slate-900/90 text-white rounded-lg'
    });
    krigingLayerGroup.addLayer(krigingRect);

    // --- C. KRIGING PREDICTION ERROR (UNCERTAINTY) ---
    const stdError = Math.sqrt(krigVar);
    const errorColor = getKrigingErrorColor(stdError, maxErrorBound);
    const krigErrRect = L.rectangle([[lat1, lng1], [lat2, lng2]], {
      color: 'transparent',
      fillColor: errorColor,
      fillOpacity: 0.42,
      weight: 0,
      interactive: true
    });
    
    // Confidence Interval 95% = Prediction +/- 1.96 * StdError
    const ciMin = Math.max(0, krigPh - 1.96 * stdError);
    const ciMax = Math.min(14, krigPh + 1.96 * stdError);

    krigErrRect.bindTooltip(`Deviasi Error (SD): ${stdError.toFixed(3)} pH<br><span class="text-[9px] text-slate-300 font-semibold">95% CI: ${ciMin.toFixed(2)} - ${ciMax.toFixed(2)} pH</span>`, {
      html: true,
      sticky: true,
      className: 'text-xxs p-1 bg-slate-950/95 text-white rounded-lg'
    });
    krigingErrorLayerGroup.addLayer(krigErrRect);

    // --- D. Chili (Cabai) Suitability Layer ---
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

    // --- E. Cucumber (Mentimun) Suitability Layer ---
    const cucumberSuit = classifyCucumberSuitability(ph);
    if (cucumberSuit.isHighlySuitable) cucumberHighlySuitableHa += areaHa;
    
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

  // Calculate dolomite variables
  const dolomiteValues = [];
  cells.forEach(cell => {
    if (cell.ph < 5.5) {
      const need = (6.5 - cell.ph) * 2;
      dolomiteValues.push(need);
    }
  });

  let avgDolomite = 0;
  let maxDolomite = 0;
  let minDolomite = 0;

  if (dolomiteValues.length > 0) {
    const sum = dolomiteValues.reduce((a, b) => a + b, 0);
    avgDolomite = sum / dolomiteValues.length;
    maxDolomite = Math.max(...dolomiteValues);
    minDolomite = Math.min(...dolomiteValues);
  }

  // Calculate final dashboard stats
  const totalArea = totalSuitableHa + totalUnsuitableHa;
  currentSpatialStats = {
    chiliHighlySuitableHa,
    cucumberHighlySuitableHa,
    suitablePercent: totalArea > 0 ? (totalSuitableHa / totalArea) * 100 : 0,
    unsuitablePercent: totalArea > 0 ? (totalUnsuitableHa / totalArea) * 100 : 0,
    totalAreaHa: stats.totalAreaHa,
    avgDolomite,
    maxDolomite,
    minDolomite,
    countNeedDolomite: dolomiteValues.length
  };

  return currentSpatialStats;
}

/**
 * Determines a color scale for Kriging Uncertainty standard error.
 */
function getKrigingErrorColor(stdDev, maxErr) {
  const norm = maxErr > 0 ? stdDev / maxErr : 0;
  if (norm < 0.25) return '#0d9488'; // Emerald/Teal (Very safe prediction)
  if (norm < 0.5) return '#0ea5e9';  // Blue (Safe)
  if (norm < 0.75) return '#f59e0b'; // Amber (Moderate confidence)
  return '#ef4444';                 // Crimson/Red (High uncertainty - far from data points)
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
    totalAreaHa: 0,
    avgDolomite: 0,
    maxDolomite: 0,
    minDolomite: 0,
    countNeedDolomite: 0
  };
}

/**
 * Returns current statistics payload
 */
export function getSpatialStats() {
  return currentSpatialStats;
}

/**
 * Retrieves the latest cached geostatistics result container.
 */
export function getLatestGeostatsResult() {
  return lastGeostatsResult;
}

/**
 * Returns specific Layer instances for dynamic toggling inside app.js
 */
export function getSpatialLayerGroups() {
  return {
    heatmap: heatmapLayerGroup,
    kriging: krigingLayerGroup,
    krigingError: krigingErrorLayerGroup,
    chili: chiliLayerGroup,
    cucumber: cucumberLayerGroup
  };
}
