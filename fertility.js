/**
 * AgriMap Lite - Soil Fertility Classification Engine
 * Classifies Nitrogen (N), Phosphorus (P), Potassium (K), and Organic Carbon (C-Organik) 
 * levels into 5 brackets (Sangat Rendah, Rendah, Sedang, Tinggi, Sangat Tinggi) and maps 
 * them to 3 main color categories (Merah = rendah, Kuning = sedang, Hijau = baik).
 */

const COLOR_MAP = {
  RED: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', type: 'rendah' },
  YELLOW: { color: '#d97706', bg: '#fffbeb', border: '#fef3c7', type: 'sedang' },
  GREEN: { color: '#16a34a', bg: '#f0fdf4', border: '#dcfce7', type: 'baik' }
};

/**
 * Classifies Nitrogen (N) percentage.
 * @param {number} val - N percentage value
 * @returns {Object} { label: string, color: string, bg: string, border: string, statusType: string }
 */
export function classifyNitrogen(val) {
  if (val === null || val === undefined || isNaN(val)) return null;
  let label = '';
  let styleDetails = {};

  if (val < 0.10) {
    label = 'Sangat Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 0.20) {
    label = 'Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 0.50) {
    label = 'Sedang';
    styleDetails = COLOR_MAP.YELLOW;
  } else if (val <= 0.75) {
    label = 'Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  } else {
    label = 'Sangat Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  }

  return { label, ...styleDetails };
}

/**
 * Classifies Phosphorus (P) in ppm.
 * @param {number} val - P ppm value
 * @returns {Object} { label: string, color: string, bg: string, border: string, statusType: string }
 */
export function classifyFosfor(val) {
  if (val === null || val === undefined || isNaN(val)) return null;
  let label = '';
  let styleDetails = {};

  if (val < 10.0) {
    label = 'Sangat Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 20.0) {
    label = 'Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 40.0) {
    label = 'Sedang';
    styleDetails = COLOR_MAP.YELLOW;
  } else if (val <= 60.0) {
    label = 'Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  } else {
    label = 'Sangat Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  }

  return { label, ...styleDetails };
}

/**
 * Classifies Potassium (K) in ppm.
 * @param {number} val - K ppm value
 * @returns {Object} { label: string, color: string, bg: string, border: string, statusType: string }
 */
export function classifyKalium(val) {
  if (val === null || val === undefined || isNaN(val)) return null;
  let label = '';
  let styleDetails = {};

  if (val < 50.0) {
    label = 'Sangat Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 100.0) {
    label = 'Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 200.0) {
    label = 'Sedang';
    styleDetails = COLOR_MAP.YELLOW;
  } else if (val <= 300.0) {
    label = 'Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  } else {
    label = 'Sangat Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  }

  return { label, ...styleDetails };
}

/**
 * Classifies Organic Carbon (C-Organik) percentage.
 * @param {number} val - C-Organik percentage value
 * @returns {Object} { label: string, color: string, bg: string, border: string, statusType: string }
 */
export function classifyCOrganik(val) {
  if (val === null || val === undefined || isNaN(val)) return null;
  let label = '';
  let styleDetails = {};

  if (val < 1.00) {
    label = 'Sangat Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 2.00) {
    label = 'Rendah';
    styleDetails = COLOR_MAP.RED;
  } else if (val <= 3.00) {
    label = 'Sedang';
    styleDetails = COLOR_MAP.YELLOW;
  } else if (val <= 5.00) {
    label = 'Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  } else {
    label = 'Sangat Tinggi';
    styleDetails = COLOR_MAP.GREEN;
  }

  return { label, ...styleDetails };
}

/**
 * Classifies soil pH into Red/Yellow/Green based on optimum growth requirements.
 * Optimum range (pH 6.0 - 7.0) is Green (Baik).
 * Marginal/Sub-optimum (pH 5.5 - 5.9 or pH > 7.0) is Yellow (Sedang).
 * Extremely acidic (pH < 5.5) or strongly alkaline is Red (Rendah).
 * @param {number} val - Soil pH level
 * @returns {Object} { label: string, color: string, bg: string, border: string, statusType: string }
 */
export function classifyPH(val) {
  if (val === null || val === undefined || isNaN(val)) return null;
  let label = '';
  let styleDetails = {};

  if (val < 5.5) {
    label = 'Asam (Rendah)';
    styleDetails = COLOR_MAP.RED;
  } else if (val >= 5.5 && val <= 5.9) {
    label = 'Agak Asam (Sedang)';
    styleDetails = COLOR_MAP.YELLOW;
  } else if (val >= 6.0 && val <= 7.0) {
    label = 'Netral/Ideal (Baik)';
    styleDetails = COLOR_MAP.GREEN;
  } else {
    label = 'Alkali (Sedang)';
    styleDetails = COLOR_MAP.YELLOW;
  }

  return { label, ...styleDetails };
}

/**
 * Normalizes pH to 0-100 scale.
 * Optimal: pH 6.0 - 7.0 (100)
 * Highly Acidic: < 4.0 (0)
 * Highly Alkaline: > 9.0 (0)
 */
export function normalizePH(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const ph = parseFloat(val);
  if (ph < 4.0) return 0;
  if (ph > 9.0) return 0;
  if (ph >= 6.0 && ph <= 7.0) return 100;
  if (ph < 6.0) {
    return ((ph - 4.0) / (6.0 - 4.0)) * 100;
  } else {
    return ((9.0 - ph) / (9.0 - 7.0)) * 100;
  }
}

/**
 * Normalizes Nitrogen (%) to 0-100 scale based on Balittanah categories.
 */
export function normalizeN(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const num = parseFloat(val);
  if (num <= 0) return 0;
  if (num >= 0.75) return 100;
  if (num < 0.10) {
    return (num / 0.10) * 20;
  } else if (num <= 0.20) {
    return 20 + ((num - 0.10) / 0.10) * 20;
  } else if (num <= 0.50) {
    return 40 + ((num - 0.20) / 0.30) * 35;
  } else {
    return 75 + ((num - 0.50) / 0.25) * 25;
  }
}

/**
 * Normalizes Fosfor (ppm) to 0-100 scale based on Balittanah categories.
 */
export function normalizeP(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const num = parseFloat(val);
  if (num <= 0) return 0;
  if (num >= 60.0) return 100;
  if (num < 10.0) {
    return (num / 10.0) * 20;
  } else if (num <= 20.0) {
    return 20 + ((num - 10.0) / 10.0) * 20;
  } else if (num <= 40.0) {
    return 40 + ((num - 20.0) / 20.0) * 35;
  } else {
    return 75 + ((num - 40.0) / 20.0) * 25;
  }
}

/**
 * Normalizes Kalium (ppm) to 0-100 scale based on Balittanah categories.
 */
export function normalizeK(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const num = parseFloat(val);
  if (num <= 0) return 0;
  if (num >= 300.0) return 100;
  if (num < 50.0) {
    return (num / 50.0) * 20;
  } else if (num <= 100.0) {
    return 20 + ((num - 50.0) / 50.0) * 20;
  } else if (num <= 200.0) {
    return 40 + ((num - 100.0) / 100.0) * 35;
  } else {
    return 75 + ((num - 200.0) / 100.0) * 25;
  }
}

/**
 * Normalizes C-Organik (%) to 0-100 scale based on Balittanah categories.
 */
export function normalizeC(val) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const num = parseFloat(val);
  if (num <= 0) return 0;
  if (num >= 5.00) return 100;
  if (num < 1.00) {
    return (num / 1.00) * 20;
  } else if (num <= 2.00) {
    return 20 + ((num - 1.00) / 1.00) * 20;
  } else if (num <= 3.00) {
    return 40 + ((num - 2.00) / 1.00) * 35;
  } else {
    return 75 + ((num - 3.00) / 2.00) * 25;
  }
}

/**
 * Calculates Soil Fertility Index (SFI) based on pH, N, P, K, and C-Organik.
 */
export function calculateSFI(ph, n, p, k, c) {
  let sum = 0;
  let count = 0;

  if (ph !== undefined && ph !== null && ph !== '' && !isNaN(parseFloat(ph))) {
    sum += normalizePH(ph);
    count++;
  }
  if (n !== undefined && n !== null && n !== '' && !isNaN(parseFloat(n))) {
    sum += normalizeN(n);
    count++;
  }
  if (p !== undefined && p !== null && p !== '' && !isNaN(parseFloat(p))) {
    sum += normalizeP(p);
    count++;
  }
  if (k !== undefined && k !== null && k !== '' && !isNaN(parseFloat(k))) {
    sum += normalizeK(k);
    count++;
  }
  if (c !== undefined && c !== null && c !== '' && !isNaN(parseFloat(c))) {
    sum += normalizeC(c);
    count++;
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Classifies Soil Fertility Index (SFI) score into categories.
 * 80-100 = Sangat Subur
 * 60-79 = Subur
 * 40-59 = Sedang
 * 20-39 = Kurang Subur
 * 0-19 = Tidak Subur
 */
export function classifySFI(val) {
  if (val === null || val === undefined || isNaN(val)) return null;
  const score = parseFloat(val);
  let label = '';
  let color = '';
  let bg = '';
  let border = '';
  let level = ''; // 'baik', 'sedang', 'rendah'

  if (score >= 80) {
    label = 'Sangat Subur';
    color = '#16a34a'; // Deep Green
    bg = '#f0fdf4';
    border = '#dcfce7';
    level = 'baik';
  } else if (score >= 60) {
    label = 'Subur';
    color = '#22c55e'; // Green
    bg = '#f1fbf3';
    border = '#def7e6';
    level = 'baik';
  } else if (score >= 40) {
    label = 'Sedang';
    color = '#d97706'; // Amber
    bg = '#fffbeb';
    border = '#fef3c7';
    level = 'sedang';
  } else if (score >= 20) {
    label = 'Kurang Subur';
    color = '#f97316'; // Orange
    bg = '#fff7ed';
    border = '#ffedd5';
    level = 'rendah';
  } else {
    label = 'Tidak Subur';
    color = '#dc2626'; // Red
    bg = '#fef2f2';
    border = '#fecaca';
    level = 'rendah';
  }

  return { label, color, bg, border, level };
}
