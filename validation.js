/**
 * AgriMap Lite - Geostatistical Cross-Validation
 * Performs Leave-One-Out Cross Validation (LOOCV) and computes Root Mean Squared Error (RMSE).
 */

import { ordinaryKrigingSingle } from './kriging.js';

/**
 * Performs Leave-One-Out Cross Validation (LOOCV) on the dataset.
 * For each sample, it predicts the pH value using all other samples and calculates the error.
 * 
 * @param {Array<Object>} projectedSamples - Point layer with .x, .y, and .ph
 * @param {Object} semivariogramModel - Fitted theoretical model parameters
 * @returns {Object} Result of LOOCV: { rmse, details: Array<{ id, actual, predicted, residual, variance }> }
 */
export function runLOOCV(projectedSamples, semivariogramModel) {
  const n = projectedSamples.length;
  if (n < 3) {
    return {
      rmse: 0,
      details: [],
      error: 'Data minimal 3 titik sampel dibutuhkan untuk mengevaluasi cross-validation.'
    };
  }

  const details = [];
  let sqSum = 0;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    const target = projectedSamples[i];
    
    // Extract N-1 training samples
    const training = projectedSamples.filter((_, idx) => idx !== i);

    // Predict using ordinary kriging
    const res = ordinaryKrigingSingle(target.x, target.y, training, semivariogramModel);

    if (res) {
      const residual = target.ph - res.prediction;
      sqSum += residual * residual;
      validCount++;

      details.push({
        nama: target.nama,
        actual: target.ph,
        predicted: res.prediction,
        residual: residual,
        variance: res.variance,
        errorPercentage: (Math.abs(residual) / target.ph) * 100
      });
    }
  }

  const rmse = validCount > 0 ? Math.sqrt(sqSum / validCount) : 0;

  return {
    rmse,
    details,
    count: validCount
  };
}
