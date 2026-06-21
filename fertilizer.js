/**
 * AgriMap Lite - Automatic Fertilizer Recommendation Engine
 * Based on Indonesian Ministry of Agriculture (Balittanah/Kementan) standards.
 */

import {
  classifyPH,
  classifyNitrogen,
  classifyFosfor,
  classifyKalium,
  classifyCOrganik,
  normalizePH,
  normalizeN,
  normalizeP,
  normalizeK,
  normalizeC
} from './fertility.js';

/**
 * Calculates detailed fertilizer recommendations based on average metrics or single sample.
 * 
 * @param {number} ph - Soil pH
 * @param {number} n - Nitrogen (%)
 * @param {number} p - Phosphorus (ppm)
 * @param {number} k - Potassium (ppm)
 * @param {number} c - Organic Carbon (%)
 * @returns {Object} Full recommendation payload
 */
export function getFertilizerRecommendation(ph, n, p, k, c) {
  // Parse inputs safely
  const vPh = parseFloat(ph) || 6.5;
  const vN = (n !== undefined && n !== null && n !== '') ? parseFloat(n) : 0.25;
  const vP = (p !== undefined && p !== null && p !== '') ? parseFloat(p) : 25.0;
  const vK = (k !== undefined && k !== null && k !== '') ? parseFloat(k) : 125.0;
  const vC = (c !== undefined && c !== null && c !== '') ? parseFloat(c) : 1.8;

  // 1. Get classifications
  const cPh = classifyPH(vPh) || { label: 'Sedang', level: 'sedang', color: '#d97706' };
  const cN = classifyNitrogen(vN) || { label: 'Sedang', level: 'sedang', color: '#d97706' };
  const cP = classifyFosfor(vP) || { label: 'Sedang', level: 'sedang', color: '#d97706' };
  const cK = classifyKalium(vK) || { label: 'Sedang', level: 'sedang', color: '#d97706' };
  const cC = classifyCOrganik(vC) || { label: 'Sedang', level: 'sedang', color: '#d97706' };

  // 2. Normalizations (to find limiting factor)
  const scorePh = normalizePH(vPh);
  const scoreN = normalizeN(vN);
  const scoreP = normalizeP(vP);
  const scoreK = normalizeK(vK);
  const scoreC = normalizeC(vC);

  // 3. Dosages calculations (agronomic step-by-step guidelines)
  // --- Dolomit (Ton/Ha) ---
  let doseDolomit = 0;
  let reasonDolomit = '';
  if (vPh < 5.5) {
    doseDolomit = (6.0 - vPh) * 2.5; // (Target pH 6.0 - Aktual pH) * 2.5 Ton/Ha
    reasonDolomit = `Keasaman tinggi (pH ${vPh.toFixed(1)} < 5.5). Perlu pengapuran tanah masam agar penyerapan pupuk kimia utama NPK berlangsung optimal.`;
  } else if (vPh >= 5.5 && vPh < 6.0) {
    doseDolomit = (6.0 - vPh) * 1.5;
    reasonDolomit = `Kondisi agak asam (pH ${vPh.toFixed(1)}). Dianjurkan pengapuran preventif ringan untuk meningkatkan pH tanah ke tingkat ideal (6.0-7.0).`;
  } else if (vPh > 7.0) {
    doseDolomit = 0;
    reasonDolomit = `Tanah cenderung basa/alkali (pH ${vPh.toFixed(1)}). Tidak memerlukan dolomit. Tambahkan pembenah organik masam jika perlu menurunkan pH.`;
  } else {
    doseDolomit = 0;
    reasonDolomit = `Kondisi pH tanah ideal (${vPh.toFixed(1)}) mendominasi lahan. Tidak membutuhkan tambahan dolomit.`;
  }

  // --- Urea (kg/Ha) ---
  let doseUrea = 0;
  let reasonUrea = '';
  if (vN < 0.10) {
    doseUrea = 260;
    reasonUrea = `Defisiensi Nitrogen kritis (N % < 0.10). Memerlukan asupan Urea dosis tinggi untuk merangsang pertumbuhan klorofil dan anakan tanaman.`;
  } else if (vN <= 0.20) {
    doseUrea = 200;
    reasonUrea = `Kondisi Nitrogen sedang-rendah. Diperlukan penambahan Urea standar guna menjaga laju pertumbuhan vegetatif tetap stabil.`;
  } else if (vN <= 0.50) {
    doseUrea = 140;
    reasonUrea = `Nitrogen cukup memadai. Urea diberikan dengan porsi pemeliharaan agar tidak terjadi keguguran bunga akibat kelebihan N vegetatif.`;
  } else {
    doseUrea = 75;
    reasonUrea = `Nitrogen sangat melimpah (N % > 0.50). Kurangi dosis Urea ke tingkat minimal (maintenance) guna mencegah penimbunan hama/penyakit.`;
  }

  // --- SP-36 (kg/Ha) ---
  let doseSP = 0;
  let reasonSP = '';
  if (vP < 10.0) {
    doseSP = 160;
    reasonSP = `Ketersediaan Fosfor sangat rendah (P < 10 ppm). Dibutuhkan SP-36 dosis penuh untuk merangsang inisiasi akar kuat dan anakan bunga.`;
  } else if (vP <= 20.0) {
    doseSP = 120;
    reasonSP = `Fosfor rendah. Berikan asupan SP-36 yang cukup untuk memfasilitasi transfer energi tanaman dan pembentukan biji/buah.`;
  } else if (vP <= 40.0) {
    doseSP = 80;
    reasonSP = `Fosfor sedang. Penambahan pupuk fosfat dalam jumlah sedang dianjurkan demi menopang kestabilan metabolisme pembungaan.`;
  } else {
    doseSP = 40;
    reasonSP = `Lahan kaya akan Fosfor aktif. Berikan porsi minimal sekadar menggantikan unsur hara yang terangkut saat panen raya.`;
  }

  // --- KCl (kg/Ha) ---
  let doseKCl = 0;
  let reasonKCl = '';
  if (vK < 50.0) {
    doseKCl = 130;
    reasonKCl = `Kandungan Kalium kritis (< 50 ppm). Butuh KCl intensif untuk membangun sistem transportasi gula dan ketahanan turgor sel tanaman.`;
  } else if (vK <= 100.0) {
    doseKCl = 100;
    reasonKCl = `Kalium rendah. Penambahan KCl direkomendasikan untuk menunjang kekebalan tanaman terhadap penyakit layu dan kekeringan.`;
  } else if (vK <= 200.0) {
    doseKCl = 70;
    reasonKCl = `Kalium sedang. Cukup berikan dosis KCl secara moderat demi meningkatkan bobot panen dan kualitas rasa sayuran.`;
  } else {
    doseKCl = 35;
    reasonKCl = `Status Kalium sangat kaya. Pengaplikasian KCl dosis rendah dilakukan secara berkala demi keberlanjutan kualitas buah sayur.`;
  }

  // --- Pupuk Organik (Ton/Ha) ---
  let doseOrganik = 0;
  let reasonOrganik = '';
  if (vC < 1.00) {
    doseOrganik = 15;
    reasonOrganik = `Kadar C-Organik sangat kritis. Mutlak butuh pupuk organik/kompos matang melimpah untuk memulihkan kapasitas tukar kation tanah.`;
  } else if (vC <= 2.00) {
    doseOrganik = 10;
    reasonOrganik = `Bahan organik rendah. Berikan kompos matang agar struktur fisik tanah lebih gembur dan mampu mengikat air lebih lama.`;
  } else if (vC <= 3.00) {
    doseOrganik = 5;
    reasonOrganik = `C-Organik moderat. Berikan kompos pemeliharaan untuk menyehatkan populasi mikroorganisme tanah yang menguntungkan.`;
  } else {
    doseOrganik = 2;
    reasonOrganik = `Lahan memiliki humus tanah subur. Penambahan bahan organik minimalis bertujuan menjaga konsistensi ekosistem biologis tanah.`;
  }

  // 4. Determine Lowest Parameter to find "Parameter Terendah"
  const elements = [
    { name: 'pH (Keasaman)', score: scorePh, valStr: `${vPh.toFixed(1)}`, label: cPh.label, color: cPh.color },
    { name: 'Nitrogen (N)', score: scoreN, valStr: `${vN.toFixed(2)}%`, label: cN.label, color: cN.color },
    { name: 'Fosfor (P)', score: scoreP, valStr: `${vP.toFixed(1)} ppm`, label: cP.label, color: cP.color },
    { name: 'Kalium (K)', score: scoreK, valStr: `${vK.toFixed(1)} ppm`, label: cK.label, color: cK.color },
    { name: 'C-Organik', score: scoreC, valStr: `${vC.toFixed(2)}%`, label: cC.label, color: cC.color }
  ];

  // Sort by normalized score ascending
  const sortedElements = [...elements].sort((a, b) => a.score - b.score);
  const lowestParam = sortedElements[0];

  // 5. Determine primary limiting factor
  let primaryLimitText = '';
  let detailLimitDesc = '';
  switch (lowestParam.name) {
    case 'pH (Keasaman)':
      primaryLimitText = 'Keasaman Ekstrem Tanah (pH masam)';
      detailLimitDesc = 'Keasaman tanah mengunci ketersediaan unsur hara vital di dalam tanah. Unsur hara N, P, dan K menjadi tidak diserap oleh tanaman meskipun pupuk ditabur banyak.';
      break;
    case 'Nitrogen (N)':
      primaryLimitText = 'Defisiensi Unsur Nitrogen Bebas';
      detailLimitDesc = 'Rendahnya Nitrogen membatasi sintesis protein tanaman, menyebabkan daun menguning (klorosis), kerdil, dan metabolisme terhambat pada fase vegetatif.';
      break;
    case 'Fosfor (P)':
      primaryLimitText = 'Keterikatan Rendah/Kekurangan Fosfor Aktif';
      detailLimitDesc = 'Kurangnya Fosfor membatasi perkembangan struktur perakaran akar serabut, transfer energi seluler (ATP), dan inisiasi organ pembungaan.';
      break;
    case 'Kalium (K)':
      primaryLimitText = 'Defisit Unsur Kalium Asimilasi';
      detailLimitDesc = 'Ketiadaan Kalium menurunkan regulasi stomata, memperlemah turgor tanaman, serta mengurangi ketahanan dari hama, penyakit, dan dehidrasi kering.';
      break;
    case 'C-Organik':
      primaryLimitText = 'Kandungan Bahan Organik Humus Rendah';
      detailLimitDesc = 'Struktur fisik tanah padat, aktivitas biologis mikroba tanah mati, serta daya ikat kation pupuk rendah dikarenakan degradasi humus aktif.';
      break;
  }

  // 6. Action items compilation list
  const actionsList = [];
  if (vPh < 5.5) {
    actionsList.push({
      step: '1',
      title: 'Aplikasi Kapur Pertanian (Dolomit)',
      sub: 'Netralisasi Masam Lahan',
      desc: `Aplikasikan dolomit murni sebesar ${doseDolomit.toFixed(1)} Ton/Ha saat olahan tanah pertama (tabur rata, bajak) atau minimal 14 hari sebelum tanam berjalan.`
    });
  }
  if (vC < 2.0) {
    actionsList.push({
      step: actionsList.length + 1 + '',
      title: 'Pemberian Pembenah Lahan Organik',
      sub: 'Restorasi Humas Tanah',
      desc: `Campurkan ${doseOrganik.toFixed(0)} Ton/Ha kompos/pupuk kandang matang secara merata di dalam bedengan tanam demi memperkuat granulasi tanah.`
    });
  }
  
  // N, P, K fertilizers schedules
  actionsList.push({
    step: actionsList.length + 1 + '',
    title: 'Pemberian SP-36 (Pupuk Dasar Tunggal)',
    sub: 'Penguatan Akar Dini',
    desc: `Aplikasikan SP-36 dengan takaran ${doseSP.toFixed(0)} kg/Ha secara melingkar atau tugal bersamaan dengan pupuk dasar sebelum benih atau bibit ditanam.`
  });

  actionsList.push({
    step: actionsList.length + 1 + '',
    title: 'Aplikasi Urea & KCl Berkala (Pupuk Susulan)',
    sub: 'Pertumbuhan Vegetatif & Pengisian Buah',
    desc: `Dosis Urea ${doseUrea.toFixed(0)} kg/Ha dan KCl ${doseKCl.toFixed(0)} kg/Ha dibagi dalam dua periode: Susulan I (10-15 HST) dan Susulan II (30-35 HST) dengan teknik tugal berjarak 5-10 cm dari pangkal batang.`
  });

  return {
    inputs: { ph: vPh, n: vN, p: vP, k: vK, c: vC },
    classifications: { ph: cPh, n: cN, p: cP, k: cK, c: cC },
    dosages: {
      dolomit: { val: doseDolomit, unit: 'Ton/Ha', reason: reasonDolomit },
      urea: { val: doseUrea, unit: 'kg/Ha', reason: reasonUrea },
      sp36: { val: doseSP, unit: 'kg/Ha', reason: reasonSP },
      kcl: { val: doseKCl, unit: 'kg/Ha', reason: reasonKCl },
      organik: { val: doseOrganik, unit: 'Ton/Ha', reason: reasonOrganik }
    },
    limitingFactor: {
      name: lowestParam.name,
      value: lowestParam.valStr,
      label: lowestParam.label,
      color: lowestParam.color,
      title: primaryLimitText,
      desc: detailLimitDesc
    },
    lowestParam,
    actionsList
  };
}

/**
 * Agronomic recommendation rules used for reporting transparency
 */
export const RECOMMEND_RULES_EXPLANATION = [
  {
    parameter: 'pH Tanah',
    recommendation: 'Dolomit (Kapur Pertanian)',
    rules: 'Jika pH < 5.5 (Asam), berikan dolomit dengan formulasi: (6.0 - pH) * 2.5 Ton/Ha. Jika pH 5.5 - 5.9 (Agak masam), berikan dolomit dengan formulasi: (6.0 - pH) * 1.5 Ton/Ha. Berguna menaikkan kelarutan unsur hara makro.',
    priority: 'Sangat Tinggi (Paling Utama)'
  },
  {
    parameter: 'Nitrogen (%)',
    recommendation: 'Urea (Pemasok Utama N)',
    rules: 'N < 0.10%: 260 kg/Ha; 0.10-0.20%: 200 kg/Ha; 0.21-0.50%: 140 kg/Ha; > 0.50%: 75 kg/Ha (Dosis pemeliharaan).',
    priority: 'Tinggi (Vegetatif)'
  },
  {
    parameter: 'Fosfor (ppm)',
    recommendation: 'SP-36 (Super Phosphate)',
    rules: 'P < 10 ppm: 160 kg/Ha; 10-20 ppm: 120 kg/Ha; 21-40 ppm: 80 kg/Ha; > 40 ppm: 40 kg/Ha (Dosis pemeliharaan).',
    priority: 'Tinggi (Akar/Generatif)'
  },
  {
    parameter: 'Kalium (ppm)',
    recommendation: 'KCl (Kalium Klorida)',
    rules: 'K < 50 ppm: 130 kg/Ha; 50-100 ppm: 100 kg/Ha; 101-200 ppm: 70 kg/Ha; > 200 ppm: 35 kg/Ha (Dosis pemeliharaan).',
    priority: 'Tinggi (Kekebalan & Kualitas Buah)'
  },
  {
    parameter: 'C-Organik (%)',
    recommendation: 'Pupuk Organik / Kompos',
    rules: 'C < 1.0%: 15 Ton/Ha; 1.0-2.0%: 10 Ton/Ha; 2.1-3.0%: 5 Ton/Ha; > 3.0%: 2 Ton/Ha. Berfungsi memulihkan agregat fisik dan mengikat kapasitas tukar kation tanah.',
    priority: 'Medium-Tinggi'
  }
];
