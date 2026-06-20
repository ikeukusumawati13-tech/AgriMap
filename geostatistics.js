/**
 * AgriMap Lite - Unified Geostatistical Orchestrator
 * Integrates Coordinate Projection, Experimental Variogen, Model Fitting, Ordinary Kriging, and LOOCV Validation.
 */

import {
  projectCoordinatesToMeters,
  computeExperimentalPairs,
  binnedVariogram,
  fitTheoreticalModel
} from './variogram.js';
import { runLOOCV } from './validation.js';

/**
 * Runs a complete geostatistical computation loop on active soil samples.
 * 
 * @param {Array<Object>} samples - Clean list of active sample records from DB
 * @returns {Object} Full spatial modeling specs, statistical indices, and performance validation indices
 */
export function runGeostatisticalAnalysis(samples) {
  if (!samples || samples.length === 0) {
    return {
      status: 'empty',
      message: 'Tidak ada sampel data untuk dianalisis.'
    };
  }

  // 1. Projection
  const projected = projectCoordinatesToMeters(samples);

  // 2. Experimental pairing
  const pairs = computeExperimentalPairs(projected);

  // 3. Binning of variogram
  const binned = binnedVariogram(pairs, 12);

  // 4. Fitting theoretical model
  const rawPhList = samples.map(s => s.ph);
  const fittedModel = fitTheoreticalModel(binned, rawPhList);

  // 5. Validation LOOCV
  const validation = runLOOCV(projected, fittedModel);

  return {
    status: 'success',
    projected,
    pairsCount: pairs.length,
    binned,
    fittedModel,
    validation,
    timestamp: Date.now()
  };
}
