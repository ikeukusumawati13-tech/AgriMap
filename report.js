/**
 * AgriMap Lite - Scientific Reporting Coordinator
 * Coordinates dolomite calculations, reporting paragraphs, and print-ready metadata.
 */

import { generatePDFReport } from './pdf.js';
import { parseResearchCSV, exportResearchDataCSV } from './csv.js';

/**
 * Calculates detailed dolomite stats based on continuous spatial IDW cells.
 * Runs: (6.5 - pH) * 2 for any cells with pH < 5.5
 * 
 * @param {Array<Object>} cells - Interpolated IDW cells
 * @returns {Object} { avgDolomite, maxDolomite, minDolomite, totalTonsNeeded }
 */
export function calculateDolomiteNeeds(cells) {
  if (!cells || cells.length === 0) {
    return { avgDolomite: 0, maxDolomite: 0, minDolomite: 0, count: 0 };
  }

  const dolomiteValues = [];
  cells.forEach(cell => {
    if (cell.ph < 5.5) {
      const need = (6.5 - cell.ph) * 2; // (Target pH 6.5 - Aktual pH) * 2 ton/ha
      dolomiteValues.push(need);
    }
  });

  if (dolomiteValues.length === 0) {
    return { avgDolomite: 0, maxDolomite: 0, minDolomite: 0, count: 0 };
  }

  const sum = dolomiteValues.reduce((acc, val) => acc + val, 0);
  const avgDolomite = sum / dolomiteValues.length;
  const maxDolomite = Math.max(...dolomiteValues);
  const minDolomite = Math.min(...dolomiteValues);

  return {
    avgDolomite,
    maxDolomite,
    minDolomite,
    count: dolomiteValues.length
  };
}

/**
 * Formulates a rich, text-wrapped agronomic recommendation paragraph based on spatial analysis
 * @param {Object} stats - Spatial statistics containing dolomite levels
 * @returns {string} Fully readable recommendation text in Indonesian
 */
export function generateDolomiteReportText(stats) {
  if (!stats || stats.avgDolomite === 0) {
    return "Analisis Spasial Netral: Kondisi pH rata-rata lahan di atas ambang masam kritis (> 5.5). Tidak membutuhkan asupan kapur pertanian dolomit mendesak. Jagung, mentimun dan cabai dapat langsung dibudidayakan dengan pengolahan pupuk dasar normal.";
  }

  return `Berdasarkan modeling spasial Inverse Distance Weighting (IDW), terdeteksi adanya zona asam makro (pH < 5.5) yang berisiko meracuni pertumbuhan vegetatif. Rata-rata kebutuhan dolomit di area tersebut adalah ${stats.avgDolomite.toFixed(2)} Ton/Ha (Toleransi batas bawah: ${stats.minDolomite.toFixed(2)} Ton/Ha, batas atas kritis: ${stats.maxDolomite.toFixed(2)} Ton/Ha). Gunakan dolomit murni secara merata pada zona berwarna merah/kuning sebelum tanam.`;
}

export {
  generatePDFReport,
  parseResearchCSV,
  exportResearchDataCSV
};
