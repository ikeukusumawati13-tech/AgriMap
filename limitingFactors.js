/**
 * AgriMap Lite - Land Limiting Factor Analysis Engine (Sistem Analisis Faktor Pembatas Lahan)
 * Specifically designed to empower farmers and agribusiness buyers to identify soil productivity bottlenecks.
 */

// Define agronomic repair priority for sorting tie scores
// Lower number means higher priority to repair first
const REPAIR_PRIORITY = {
  'pH': 1,
  'C-Organik': 2,
  'Nitrogen': 3,
  'Fosfor': 4,
  'Kalium': 5
};

/**
 * Calculates score (1 to 5) for pH level.
 * @param {number} val - Soil pH
 * @returns {number} Score from 1 (Sangat Rendah) to 5 (Sangat Tinggi / Optimal)
 */
export function getPhScore(val) {
  if (val === null || val === undefined || isNaN(val)) return 3; // Default to Sedang
  const v = parseFloat(val);
  if (v < 5.0) return 1; // Sangat Rendah (Sangat Asam)
  if (v < 5.5) return 2; // Rendah (Asam)
  if (v < 6.0) return 3; // Sedang (Agak Asam)
  if (v >= 6.0 && v <= 7.0) return 5; // Sangat Tinggi / Ideal (Optimal)
  if (v <= 8.0) return 4; // Tinggi (Alkali Ringan)
  return 3; // Sedang (Sangat Alkali)
}

/**
 * Calculates score (1 to 5) for Nitrogen.
 * @param {number} val - N (%)
 * @returns {number}
 */
export function getNitrogenScore(val) {
  if (val === null || val === undefined || isNaN(val)) return 3;
  const v = parseFloat(val);
  if (v < 0.10) return 1;
  if (v <= 0.20) return 2;
  if (v <= 0.50) return 3;
  if (v <= 0.75) return 4;
  return 5;
}

/**
 * Calculates score (1 to 5) for Fosfor.
 * @param {number} val - P (ppm)
 * @returns {number}
 */
export function getFosforScore(val) {
  if (val === null || val === undefined || isNaN(val)) return 3;
  const v = parseFloat(val);
  if (v < 10.0) return 1;
  if (v <= 20.0) return 2;
  if (v <= 40.0) return 3;
  if (v <= 60.0) return 4;
  return 5;
}

/**
 * Calculates score (1 to 5) for Kalium.
 * @param {number} val - K (ppm)
 * @returns {number}
 */
export function getKaliumScore(val) {
  if (val === null || val === undefined || isNaN(val)) return 3;
  const v = parseFloat(val);
  if (v < 50.0) return 1;
  if (v <= 100.0) return 2;
  if (v <= 200.0) return 3;
  if (v <= 300.0) return 4;
  return 5;
}

/**
 * Calculates score (1 to 5) for C-Organik.
 * @param {number} val - C-Organik (%)
 * @returns {number}
 */
export function getCOrganikScore(val) {
  if (val === null || val === undefined || isNaN(val)) return 3;
  const v = parseFloat(val);
  if (v < 1.00) return 1;
  if (v <= 2.00) return 2;
  if (v <= 3.00) return 3;
  if (v <= 5.00) return 4;
  return 5;
}

/**
 * Map score to its Indonesian textual label
 * @param {number} score 
 * @returns {string} Label
 */
export function getScoreLabel(score) {
  switch (score) {
    case 1: return 'Sangat Rendah';
    case 2: return 'Rendah';
    case 3: return 'Sedang';
    case 4: return 'Tinggi';
    case 5: return 'Sangat Tinggi';
    default: return 'Sedang';
  }
}

/**
 * Formulate automatic friendly suggestions based on factor keys
 */
export function getRecommendationMessage(key, score) {
  if (score >= 4) {
    return 'Kondisi unsur ini sudah sangat baik dan optimal untuk menunjang tumbuh kembang tanaman Anda.';
  }
  
  switch (key) {
    case 'pH':
      return 'Prioritaskan pengapuran (aplikasi Kapur Dolomit) secara merata pada lahan untuk menetralkan pH tanah yang asam agar penyerapan unsur pupuk kimia lainnya dapat berjalan optimal.';
    case 'Nitrogen':
      return 'Tambahkan pupuk Urea atau ZA guna memasok unsur Nitrogen yang sangat dibutuhkan untuk pertumbuhan daun, batang, dan tunas baru tanaman Anda.';
    case 'C-Organik':
      return 'Tambahkan kompos murni, pupuk kandang matang, atau mulsa organik hijau untuk meningkatkan kadar humus serta memperbaiki struktur fisik aerasi tanah Anda.';
    case 'Fosfor':
      return 'Tambahkan pupuk SP-36, TSP, atau Rock Phosphate guna memasok unsur Fosfor yang penting dalam merangsang pertumbuhan akar kuat dan inisiasi pembungaan.';
    case 'Kalium':
      return 'Tambahkan pupuk KCl atau ZK guna memasok unsur Kalium yang dibutuhkan untuk memperkokoh batang, meningkatkan ketahanan penyakit, serta memaksimalkan rasa manis dan bobot buah.';
    default:
      return 'Lakukan pemupukan berimbang secara teratur.';
  }
}

/**
 * Analyzes soil samples and returns sorted list of limiting factors, land status, and recommendations.
 * @param {Array} samples - List of soil sample data points
 * @returns {Object} { factors: Array, landStatus: Object }
 */
export function analyzeLimitingFactors(samples) {
  if (!samples || samples.length === 0) {
    return {
      factors: [],
      landStatus: {
        code: 'BELUM_ADA_DATA',
        label: 'Dibutuhkan Data',
        color: '#64748b',
        bg: '#f8fafc',
        border: '#e2e8f0',
        desc: 'Silakan masukkan data sampel tanah terlebih dahulu untuk mendiagnosis faktor pembatas lahan.'
      }
    };
  }

  // Calculate overall averages
  let phSum = 0, phCount = 0;
  let nSum = 0, nCount = 0;
  let pSum = 0, pCount = 0;
  let kSum = 0, kCount = 0;
  let cSum = 0, cCount = 0;

  samples.forEach(s => {
    if (s.ph !== undefined && s.ph !== null && s.ph !== '' && !isNaN(parseFloat(s.ph))) {
      phSum += parseFloat(s.ph);
      phCount++;
    }
    if (s.nitrogen !== undefined && s.nitrogen !== null && s.nitrogen !== '' && !isNaN(parseFloat(s.nitrogen))) {
      nSum += parseFloat(s.nitrogen);
      nCount++;
    }
    if (s.fosfor !== undefined && s.fosfor !== null && s.fosfor !== '' && !isNaN(parseFloat(s.fosfor))) {
      pSum += parseFloat(s.fosfor);
      pCount++;
    }
    if (s.kalium !== undefined && s.kalium !== null && s.kalium !== '' && !isNaN(parseFloat(s.kalium))) {
      kSum += parseFloat(s.kalium);
      kCount++;
    }
    if (s.cOrganik !== undefined && s.cOrganik !== null && s.cOrganik !== '' && !isNaN(parseFloat(s.cOrganik))) {
      cSum += parseFloat(s.cOrganik);
      cCount++;
    }
  });

  const avgPh = phCount > 0 ? phSum / phCount : 6.0;
  const avgN = nCount > 0 ? nSum / nCount : 0.20;
  const avgP = pCount > 0 ? pSum / pCount : 25.0;
  const avgK = kCount > 0 ? kSum / kCount : 120.0;
  const avgC = cCount > 0 ? cSum / cCount : 2.0;

  // Calculate scores
  const scorePh = getPhScore(avgPh);
  const scoreN = getNitrogenScore(avgN);
  const scoreP = getFosforScore(avgP);
  const scoreK = getKaliumScore(avgK);
  const scoreC = getCOrganikScore(avgC);

  // Raw array of factors
  const factorList = [
    { name: 'pH', value: avgPh, score: scorePh, unit: '' },
    { name: 'Nitrogen', value: avgN, score: scoreN, unit: '%' },
    { name: 'Fosfor', value: avgP, score: scoreP, unit: ' ppm' },
    { name: 'Kalium', value: avgK, score: scoreK, unit: ' ppm' },
    { name: 'C-Organik', value: avgC, score: scoreC, unit: '%' }
  ];

  // Sort: Primary by Score Ascending (lowest score is the worst limiting factor)
  // Tie-breaker: Agronomic Repair Priority Ascending (smaller priority number is more important/first)
  factorList.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    return REPAIR_PRIORITY[a.name] - REPAIR_PRIORITY[b.name];
  });

  // Determine Land Status (Status Lahan)
  // 🔴 Bermasalah: If any factor has a score of 1 (Sangat Rendah) or 2 (Rendah)
  // 🟡 Perlu Perbaikan: If no factors are 1 or 2, but at least one factor is 3 (Sedang)
  // 🟢 Baik: If all factors are 4 (Tinggi) or 5 (Sangat Tinggi)
  let landStatusCode = 'BAIK';
  let landStatusLabel = 'Baik';
  let landStatusColor = '#16a34a'; // emerald-600
  let landStatusBg = '#f0fdf4';
  let landStatusBorder = '#dcfce7';
  let landStatusDesc = 'Kondisi hara lahan Anda prima, subur secara menyeluruh dan siap ditanami komoditas tanpa kendala pembatas serius.';

  const hasHighlyCritical = factorList.some(f => f.score === 1);
  const hasCritical = factorList.some(f => f.score === 2);
  const hasMild = factorList.some(f => f.score === 3);

  if (hasHighlyCritical || hasCritical) {
    landStatusCode = 'BERMASALAH';
    landStatusLabel = 'Bermasalah';
    landStatusColor = '#dc2626'; // red-600
    landStatusBg = '#fef2f2';
    landStatusBorder = '#fecaca';
    landStatusDesc = 'Terdapat hara kritis utama di bawah ambang aman yang berperan sebagai faktor penghambat besar bagi produktivitas tanaman.';
  } else if (hasMild) {
    landStatusCode = 'PERLU_PERBAIKAN';
    landStatusLabel = 'Perlu Perbaikan';
    landStatusColor = '#d97706'; // amber-600
    landStatusBg = '#fffbeb';
    landStatusBorder = '#fef3c7';
    landStatusDesc = 'Nutrisi tanah berada di rentang rata-rata/sedang. Lahan membutuhkan sedikit sentuhan pupuk pemeliharaan agar mencapai potensi penuh.';
  }

  // Populate formatted list with labels and automated farmer suggestions
  const enrichedFactors = factorList.map((f, index) => {
    let rankEmoji = '🔹';
    if (index === 0) rankEmoji = '🥇';
    else if (index === 1) rankEmoji = '🥈';
    else if (index === 2) rankEmoji = '🥉';

    // Formatted value string
    let valStr = '';
    if (f.name === 'pH') {
      valStr = `${f.value.toFixed(2)}`;
    } else if (f.name === 'Nitrogen' || f.name === 'C-Organik') {
      valStr = `${f.value.toFixed(2)} ${f.unit}`;
    } else {
      valStr = `${f.value.toFixed(1)} ${f.unit}`;
    }

    return {
      name: f.name,
      value: f.value,
      valStr: valStr,
      score: f.score,
      label: getScoreLabel(f.score),
      rankEmoji: rankEmoji,
      recommendation: getRecommendationMessage(f.name, f.score)
    };
  });

  return {
    factors: enrichedFactors,
    landStatus: {
      code: landStatusCode,
      label: landStatusLabel,
      color: landStatusColor,
      bg: landStatusBg,
      border: landStatusBorder,
      desc: landStatusDesc
    }
  };
}
