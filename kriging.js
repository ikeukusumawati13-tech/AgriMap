/**
 * AgriMap Lite - Ordinary Kriging Linear Solver
 * Solves the Ordinary Kriging dual matrix system using Gaussian Elimination with partial pivoting.
 */

import { theoreticalSemivariance } from './variogram.js';

/**
 * Solves a system of linear equations Ax = B using Gaussian Elimination with Partial Pivoting.
 * 
 * @param {Array<Array<number>>} A - Left hand matrix of size (N+1) x (N+1)
 * @param {Array<number>} B - Right hand vector of size (N+1)
 * @returns {Array<number>} x - Solution vector of size (N+1)
 */
export function solveLinearSystem(A, B) {
  const n = B.length;
  // Deep copy A and B
  const M = A.map((row, i) => [...row, B[i]]);

  for (let i = 0; i < n; i++) {
    // Find pivot row
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) {
      // Near singular matrix, fallback to generic state
      return null;
    }

    // Normalize current row
    for (let j = i; j <= n; j++) {
      M[i][j] /= pivot;
    }

    // Subtract row from remaining rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  // Extract solution vector
  return M.map(row => row[n]);
}

/**
 * Builds the Kriging LHS matrix A (size (N+1) x (N+1))
 */
export function buildKrigingMatrix(projectedSamples, semivariogramModel) {
  const n = projectedSamples.length;
  const A = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        A[i][j] = theoreticalSemivariance(0, semivariogramModel);
      } else {
        const dx = projectedSamples[i].x - projectedSamples[j].x;
        const dy = projectedSamples[i].y - projectedSamples[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        A[i][j] = theoreticalSemivariance(dist, semivariogramModel);
      }
    }
    A[i][n] = 1;
    A[n][i] = 1;
  }
  A[n][n] = 0;

  return A;
}

/**
 * Runs Ordinary Kriging at a single target coordinate.
 * 
 * @param {number} targetX - Target projected meters X
 * @param {number} targetY - Target projected meters Y
 * @param {Array<Object>} projectedSamples - Origin samples with .x, .y, .ph
 * @param {object} semivariogramModel - Fitted model metadata
 * @param {Array<Array<number>>} cacheA - Optional pre-built LHS matrix for speed
 * @returns {object|null} prediction and variance (standard error squared)
 */
export function ordinaryKrigingSingle(targetX, targetY, projectedSamples, semivariogramModel, cacheA = null) {
  const n = projectedSamples.length;
  if (n === 0) return null;

  // Build RHS vector B
  const B = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    const dx = targetX - projectedSamples[i].x;
    const dy = targetY - projectedSamples[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    B[i] = theoreticalSemivariance(dist, semivariogramModel);
  }
  B[n] = 1;

  // Build or compute LHS matrix A
  const A = cacheA || buildKrigingMatrix(projectedSamples, semivariogramModel);
  
  // Solve for weights
  const weights = solveLinearSystem(A, B);
  if (!weights) {
    // If matrix is singular, fallback to an IDW or simple mean calculation
    let wSum = 0;
    let phSum = 0;
    for (let i = 0; i < n; i++) {
      const dx = targetX - projectedSamples[i].x;
      const dy = targetY - projectedSamples[i].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-3;
      const w = 1 / (d * d);
      wSum += w;
      phSum += projectedSamples[i].ph * w;
    }
    return {
      prediction: phSum / wSum,
      variance: semivariogramModel.sill
    };
  }

  // Calculate prediction and kriging variance
  let prediction = 0;
  for (let i = 0; i < n; i++) {
    prediction += weights[i] * projectedSamples[i].ph;
  }

  // Kriging Variance: sigma^2 = sum_i (w_i * gamma(dist_i_target)) + mu
  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += weights[i] * B[i];
  }
  variance += weights[n]; // Add Lagrange multiplier (weights[n] is mu)

  // Ensure variance is non-negative and bound it
  variance = Math.max(0, Math.min(semivariogramModel.sill, variance));

  return {
    prediction: Math.max(0, Math.min(14, prediction)),
    variance
  };
}
