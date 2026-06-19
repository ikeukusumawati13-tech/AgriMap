/**
 * AgriMap Lite - IDW (Inverse Distance Weighting) Interpolation Engine
 * Calculates continuous spatial grids of soil pH across agricultural study areas.
 */

/**
 * Calculates Euclidean distance between two coordinate pairs (approximate local flat grid)
 * @param {number} lat1 
 * @param {number} lng1 
 * @param {number} lat2 
 * @param {number} lng2 
 * @returns {number} Distance metric
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Run IDW algorithm on a set of soil sample points
 * @param {Array} samples - List of soil database records ({latitude, longitude, ph})
 * @param {number} gridResolution - Number of grid cells per axis (e.g. 40 for a 40x40 grid)
 * @param {number} power - IDW weighting exponent (default = 2)
 * @returns {Object} { cells: Array, stats: Object }
 */
export function performIDW(samples, gridResolution = 40, power = 2) {
  if (!samples || samples.length === 0) {
    return { cells: [], stats: null };
  }

  // 1. Determine bounding box with safe padding to frame the surveyed fields
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  samples.forEach(s => {
    if (s.latitude < minLat) minLat = s.latitude;
    if (s.latitude > maxLat) maxLat = s.latitude;
    if (s.longitude < minLng) minLng = s.longitude;
    if (s.longitude > maxLng) maxLng = s.longitude;
  });

  // If there is only 1 point or points are coincident, create a default bounding range
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  const minPadding = 0.015; // roughly 1.6km padding

  if (latRange < 0.0001) {
    minLat -= minPadding;
    maxLat += minPadding;
  } else {
    minLat -= latRange * 0.15;
    maxLat += latRange * 0.15;
  }

  if (lngRange < 0.0001) {
    minLng -= minPadding;
    maxLng += minPadding;
  } else {
    minLng -= lngRange * 0.15;
    maxLng += lngRange * 0.15;
  }

  // Calculate cell size
  const deltaLat = (maxLat - minLat) / gridResolution;
  const deltaLng = (maxLng - minLng) / gridResolution;

  const cells = [];

  // Calculate area coefficient: approximate area of one grid cell in Hectares (Ha)
  // 1 degree Lat = ~111,320m. 1 degree Lng = ~111,320m * cos(midLat)
  const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos(midLatRad);
  
  const cellHeightMeters = deltaLat * metersPerLat;
  const cellWidthMeters = deltaLng * metersPerLng;
  const cellAreaSquareMeters = Math.abs(cellHeightMeters * cellWidthMeters);
  const cellAreaHectare = cellAreaSquareMeters / 10000;

  // 2. Compute interpolation for center of each grid box
  for (let r = 0; r < gridResolution; r++) {
    for (let c = 0; c < gridResolution; c++) {
      const cellMinLat = minLat + r * deltaLat;
      const cellMaxLat = cellMinLat + deltaLat;
      const cellMinLng = minLng + c * deltaLng;
      const cellMaxLng = cellMinLng + deltaLng;

      // Center coordinate of this cell grid node
      const centerLat = cellMinLat + deltaLat / 2;
      const centerLng = cellMinLng + deltaLng / 2;

      let interpolatedPH = 6.5; // neutral fallback
      let exactMatch = false;

      // Check for exact location match to prevent division by zero
      for (const sample of samples) {
        const dist = calculateDistance(centerLat, centerLng, sample.latitude, sample.longitude);
        if (dist === 0) {
          interpolatedPH = sample.ph;
          exactMatch = true;
          break;
        }
      }

      if (!exactMatch) {
        let weightedSum = 0;
        let weightTotal = 0;

        samples.forEach(sample => {
          const dist = calculateDistance(centerLat, centerLng, sample.latitude, sample.longitude);
          const weight = 1 / Math.pow(dist, power);
          weightedSum += sample.ph * weight;
          weightTotal += weight;
        });

        if (weightTotal > 0) {
          interpolatedPH = weightedSum / weightTotal;
        }
      }

      cells.push({
        lat1: cellMinLat,
        lng1: cellMinLng,
        lat2: cellMaxLat,
        lng2: cellMaxLng,
        centerLat,
        centerLng,
        ph: interpolatedPH,
        areaHa: cellAreaHectare
      });
    }
  }

  return {
    cells,
    stats: {
      totalAreaM2: cellAreaSquareMeters * gridResolution * gridResolution,
      totalAreaHa: cellAreaHectare * gridResolution * gridResolution,
      cellAreaHa: cellAreaHectare,
      minLat,
      maxLat,
      minLng,
      maxLng
    }
  };
}
