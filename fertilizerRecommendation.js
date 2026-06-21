/**
 * AgriMap Lite - Land Actual Fertilizer Recommendation Engine (Sistem Rekomendasi Pemupukan Aktual)
 * Specifically handles calculation of fertilizer dosages based on soil parameters and agricultural land area.
 */

import {
  getPhScore,
  getNitrogenScore,
  getFosforScore,
  getKaliumScore,
  getCOrganikScore
} from './limitingFactors.js';

/**
 * Calculates dynamic fertilizer recommendations for a given land area.
 * @param {number} avgPh - Average soil pH
 * @param {number} avgN - Average soil Nitrogen (%)
 * @param {number} avgP - Average soil Fosfor (ppm)
 * @param {number} avgK - Average soil Kalium (ppm)
 * @param {number} avgC - Average soil C-Organik (%)
 * @param {number} landAreaHa - Land Area in Hectares (Ha)
 * @returns {Object} Enriched calculations per fertilizer type and totals
 */
export function calculateFertilizerRecommendation(avgPh, avgN, avgP, avgK, avgC, landAreaHa) {
  const area = Math.max(0.01, parseFloat(landAreaHa) || 1.0);

  // Get parameter scores
  const scoreN = getNitrogenScore(avgN);
  const scoreP = getFosforScore(avgP);
  const scoreK = getKaliumScore(avgK);
  const scoreC = getCOrganikScore(avgC);

  // 1. Urea (N) Recommendation (kg/Ha)
  let ureaPerHa = 150; // default
  let statusN = 'Sedang';
  if (scoreN <= 2) {
    ureaPerHa = 250;
    statusN = 'Rendah';
  } else if (scoreN === 3) {
    ureaPerHa = 150;
    statusN = 'Sedang';
  } else {
    ureaPerHa = 50;
    statusN = 'Tinggi';
  }

  // 2. SP36 (P) Recommendation (kg/Ha)
  let sp36PerHa = 100; // default
  let statusP = 'Sedang';
  if (scoreP <= 2) {
    sp36PerHa = 200;
    statusP = 'Rendah';
  } else if (scoreP === 3) {
    sp36PerHa = 100;
    statusP = 'Sedang';
  } else {
    sp36PerHa = 50;
    statusP = 'Tinggi';
  }

  // 3. KCl (K) Recommendation (kg/Ha)
  let kclPerHa = 75; // default
  let statusK = 'Sedang';
  if (scoreK <= 2) {
    kclPerHa = 150;
    statusK = 'Rendah';
  } else if (scoreK === 3) {
    kclPerHa = 75;
    statusK = 'Sedang';
  } else {
    kclPerHa = 25;
    statusK = 'Tinggi';
  }

  // 4. Dolomit (pH) Recommendation (kg/Ha)
  let dolomitPerHa = 0;
  let statusPh = 'Optimal / Netral';
  if (avgPh < 5.5) {
    dolomitPerHa = 2000;
    statusPh = 'Sangat Asam (< 5.5)';
  } else if (avgPh >= 5.5 && avgPh <= 6.0) {
    dolomitPerHa = 1000;
    statusPh = 'Agak Asam (5.5 - 6.0)';
  } else {
    dolomitPerHa = 0;
    statusPh = 'Normal / Optimal (> 6.0)';
  }

  // 5. Kompos (C-Organik) Recommendation (kg/Ha)
  let komposPerHa = 2500;
  let statusC = 'Sedang';
  if (scoreC <= 2) {
    komposPerHa = 5000;
    statusC = 'Rendah';
  } else if (scoreC === 3) {
    komposPerHa = 2500;
    statusC = 'Sedang';
  } else {
    komposPerHa = 0;
    statusC = 'Tinggi';
  }

  // Compute final totals based on area
  const ureaTotal = ureaPerHa * area;
  const sp36Total = sp36PerHa * area;
  const kclTotal = kclPerHa * area;
  const dolomitTotal = dolomitPerHa * area;
  const komposTotal = komposPerHa * area;

  const totalFertilizerKg = ureaTotal + sp36Total + kclTotal + dolomitTotal + komposTotal;

  // Formatting helper
  const makeFertObject = (perHa, total, name, unitIcon) => {
    const totalTon = total / 1000;
    const totalZak = total / 50;
    return {
      name,
      icon: unitIcon,
      perHa,
      totalKg: total,
      totalTon,
      totalZak,
      valStrKg: `${total.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg`,
      valStrTon: `${totalTon.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ton`,
      valStrZak: `${totalZak.toLocaleString('id-ID', { maximumFractionDigits: 1 })} zak (50 kg)`
    };
  };

  return {
    area,
    urea: makeFertObject(ureaPerHa, ureaTotal, 'Pupuk Urea', '🌾'),
    sp36: makeFertObject(sp36PerHa, sp36Total, 'Pupuk SP-36', '🧪'),
    kcl: makeFertObject(kclPerHa, kclTotal, 'Pupuk KCl', '⚡'),
    dolomit: makeFertObject(dolomitPerHa, dolomitTotal, 'Kapur Dolomit', '🪨'),
    kompos: makeFertObject(komposPerHa, komposTotal, 'Bahan Organik / Kompos', '🌱'),
    totals: {
      kg: totalFertilizerKg,
      ton: totalFertilizerKg / 1000,
      zak: totalFertilizerKg / 50,
      valStrKg: `${totalFertilizerKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg`,
      valStrTon: `${(totalFertilizerKg / 1000).toLocaleString('id-ID', { maximumFractionDigits: 3 })} ton`,
      valStrZak: `${(totalFertilizerKg / 50).toLocaleString('id-ID', { maximumFractionDigits: 1 })} zak`
    },
    statuses: {
      ph: statusPh,
      nitrogen: statusN,
      fosfor: statusP,
      kalium: statusK,
      cOrganik: statusC
    }
  };
}
