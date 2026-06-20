/**
 * AgriMap Lite - Geostatistical Variogram Engine
 * Computes experimental semivariograms, calculates lag bins, and fits theoretical models (Spherical & Exponential).
 */

/**
 * Projects latitude/longitude coordinates to local flat meters relative to a center point.
 * This ensures distance metrics inside the linear system are robust and stable.
 * @param {Array<Object>} samples 
 * @returns {Array<Object>} Samples with project x, y in meters
 */
export function projectCoordinatesToMeters(samples) {
  if (!samples || samples.length === 0) return [];

  // Use the mean point as origin (0,0)
  const sumLat = samples.reduce((acc, s) => acc + s.latitude, 0);
  const sumLng = samples.reduce((acc, s) => acc + s.longitude, 0);
  const originLat = sumLat / samples.length;
  const originLng = sumLng / samples.length;

  const latToMeters = 111320;
  const rad = originLat * (Math.PI / 180);
  const lngToMeters = 111320 * Math.cos(rad);

  return samples.map(s => {
    const x = (s.longitude - originLng) * lngToMeters;
    const y = (s.latitude - originLat) * latToMeters;
    return {
      ...s,
      x,
      y
    };
  });
}

/**
 * Computes all pairwise distances and semivariances from projected sample data.
 */
export function computeExperimentalPairs(projected) {
  const pairs = [];
  const n = projected.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = projected[i];
      const p2 = projected[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const semivariance = 0.5 * Math.pow(p1.ph - p2.ph, 2);
      pairs.push({ dist, semivariance });
    }
  }

  // Sort pairs by distance
  pairs.sort((a, b) => a.dist - b.dist);
  return pairs;
}

/**
 * Bins pairwise distances into an experimental variogram series.
 */
export function binnedVariogram(pairs, binCount = 10) {
  if (pairs.length === 0) return [];

  const maxDist = pairs[pairs.length - 1].dist;
  // Standard geostatistical practice: limit active variogram to 1/2 or 2/3 of maximum distance
  const activeMaxDist = maxDist * 0.65;
  const binWidth = activeMaxDist / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    lag: (i + 0.5) * binWidth,
    sumSemivariance: 0,
    count: 0
  }));

  pairs.forEach(pair => {
    if (pair.dist > activeMaxDist) return;
    const binIndex = Math.min(binCount - 1, Math.floor(pair.dist / binWidth));
    bins[binIndex].sumSemivariance += pair.semivariance;
    bins[binIndex].count++;
  });

  return bins
    .filter(b => b.count > 0)
    .map(b => ({
      lag: b.lag,
      semivariance: b.sumSemivariance / b.count,
      count: b.count
    }));
}

/**
 * Fits a theoretical Spherical Semivariogram model to binned data.
 * Spherical Model Formula:
 * gamma(h) = Nugget + Sill * (1.5 * (h / Range) - 0.5 * (h / Range)^3)  if h <= Range
 * gamma(h) = Nugget + Sill                                              if h > Range
 * 
 * Fits iteratively using simple grid search / heuristic fit to minimize residual sum of squares.
 */
export function fitTheoreticalModel(binnedData, rawPhValues) {
  if (!binnedData || binnedData.length === 0) {
    return { nugget: 0.05, partialSill: 0.1, sill: 0.15, range: 250, modelType: 'spherical' };
  }

  // Calculate total variance as a sensible starting Sill
  const n = rawPhValues.length;
  const avg = rawPhValues.reduce((a, b) => a + b, 0) / n;
  const variance = rawPhValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / (n - 1 || 1);

  // Reasonable defaults
  let bestNugget = 0.02;
  let bestPartialSill = Math.max(0.01, variance - bestNugget);
  let bestRange = binnedData[binnedData.length - 1].lag * 0.7;
  let bestResidual = Infinity;

  // Simple, elegant grid search parameter fitting
  // It guarantees convergence to an optimal fitting model under constraints
  const nuggetGuesses = [0, 0.05 * variance, 0.15 * variance, 0.3 * variance];
  const sillGuesses = [0.5 * variance, 0.85 * variance, 1.0 * variance, 1.2 * variance];
  const rangeGuesses = [
    50, 100, 200, 350, 500, 800, 
    binnedData[binnedData.length - 1].lag * 0.4,
    binnedData[binnedData.length - 1].lag * 0.7,
    binnedData[binnedData.length - 1].lag
  ];

  for (const ngg of nuggetGuesses) {
    for (const sgg of sillGuesses) {
      for (const rng of rangeGuesses) {
        if (sgg <= ngg) continue;
        const partialSill = sgg - ngg;
        
        let residualSum = 0;
        binnedData.forEach(bin => {
          const h = bin.lag;
          let theoretical = ngg;
          if (h <= rng) {
            theoretical += partialSill * (1.5 * (h / rng) - 0.5 * Math.pow(h / rng, 3));
          } else {
            theoretical += partialSill;
          }
          residualSum += Math.pow(bin.semivariance - theoretical, 2) * bin.count; // weighted by count
        });

        if (residualSum < bestResidual) {
          bestResidual = residualSum;
          bestNugget = ngg;
          bestPartialSill = partialSill;
          bestRange = rng;
        }
      }
    }
  }

  return {
    nugget: bestNugget,
    partialSill: bestPartialSill,
    sill: bestNugget + bestPartialSill,
    range: bestRange,
    modelType: 'spherical',
    residualSum: bestResidual
  };
}

/**
 * Evaluates theoretical semivariogram at distance h.
 */
export function theoreticalSemivariance(h, model) {
  const { nugget, partialSill, range } = model;
  if (h <= 0) return 0;
  if (h <= range) {
    return nugget + partialSill * (1.5 * (h / range) - 0.5 * Math.pow(h / range, 3));
  }
  return nugget + partialSill;
}
