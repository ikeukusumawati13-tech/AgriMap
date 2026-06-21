/**
 * AgriMap Lite - Scientific PDF Report Generator
 * Uses jsPDF to produce pixel-perfect precision agriculture analysis documents.
 */

import { classifyChiliSuitability, classifyCucumberSuitability } from './suitability.js';
import { getPHCategory } from './db.js';
import { loadResearchMetadata } from './metadata_manager.js';
import { getFertilizerRecommendation } from './fertilizer.js';
import { calculateFertilizerRecommendation } from './fertilizerRecommendation.js';

/**
 * Generates and downloads the PDF Research Report.
 * 
 * @param {Array<Object>} samples - All recorded soil sample points
 * @param {Object} spatialStats - Current IDW spatial analysis stats (containing areas, percentages, dolomites)
 */
export function generatePDFReport(samples, spatialStats) {
  if (!window.jspdf) {
    alert('Maaf, pustaka jsPDF belum selesai dimuat. Harap periksa koneksi internet Anda.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Color Palette Constants
  const GREEN_DARK = '#1B4332'; // Deep Forest Green
  const GREEN_PRIMARY = '#2D6A4F'; // Emerald Accent
  const SLATE_DARK = '#1E293B'; // Charcoal text
  const SLATE_LIGHT = '#64748B'; // Muted labels
  const BG_LIGHT = '#F8FAFC'; // Light card fill

  // Helper values
  const dateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate generic numeric statistics from raw samples
  let minPh = 14, maxPh = 0, sumPh = 0;
  samples.forEach(s => {
    if (s.ph < minPh) minPh = s.ph;
    if (s.ph > maxPh) maxPh = s.ph;
    sumPh += s.ph;
  });
  const avgPh = samples.length > 0 ? sumPh / samples.length : 0;
  if (samples.length === 0) {
    minPh = 0;
    maxPh = 0;
  }

  // --- PAGE 1: Header Block & Cover Aesthetics ---
  // Deep emerald structural banner
  doc.setFillColor(27, 67, 50); // GREEN_DARK
  doc.rect(0, 0, 210, 42, 'F');

  // Title Text inside Banner
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('LAPORAN PENELITIAN TANAH', 15, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(149, 213, 178); // Soft green tint
  doc.text('AgriMap Lite — Sistem Informasi Geografis & Analisis Spasial Kompatibilitas Lahan', 15, 25);
  doc.text(`Dicetak pada: ${dateStr} • Operasional Offline-First PWA`, 15, 30);

  // Decorative border lines
  doc.setFillColor(82, 183, 136); // Emerald highlight
  doc.rect(0, 42, 210, 2.5, 'F');

  // --- SECTION A: INFORMASI PENELITIAN & METADATA ---
  let y = 58;
  doc.setTextColor(SLATE_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('1. METADATA PENELITIAN & STATISTIK SAMPEL', 15, y);
  
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.line(15, y + 2, 195, y + 2);
  
  y += 10;
  
  // Render Metadata Layout Table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_LIGHT);
  doc.text('Parameter Penelitian', 16, y);
  doc.text('Nilai Evaluasi Lapangan', 110, y);
  doc.line(15, y + 2.5, 195, y + 2.5);

  const metadata = loadResearchMetadata();
  const metaRows = [
    ['Judul Penelitian', metadata.judulPenelitian || 'Kajian Spasial Kualitas pH Lahan Pertanian'],
    ['Nama Peneliti', metadata.namaPeneliti || 'Penyuluh / Peneliti Lapangan'],
    ['Instansi', metadata.instansi || 'BPP Sleman / Lembaga Mitra'],
    ['Lokasi Penelitian', metadata.lokasiPenelitian || 'Daerah Istimewa Yogyakarta'],
    ['Komoditas', metadata.komoditasUtama || 'Cabai & Mentimun'],
    ['Tahun Penelitian', metadata.tahunPenelitian || new Date().getFullYear().toString()],
    ['Tanggal Cetak Laporan', dateStr],
    ['Jumlah Sampel', `${samples.length} Titik Sampel Terdaftar`],
    ['Nilai pH Minimum', `${minPh.toFixed(2)} (${classifyChiliSuitability(minPh).status})`],
    ['Nilai pH Maksimum', `${maxPh.toFixed(2)} (${classifyChiliSuitability(maxPh).status})`],
    ['Nilai pH Rata-rata', `${avgPh.toFixed(2)} (${getPHCategory(avgPh).label})`],
    ['Estimasi Luas Area Studi (IDW)', `${(spatialStats?.totalAreaHa || 0).toFixed(2)} Hektar (Ha)`]
  ];

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(SLATE_DARK);
  metaRows.forEach((row, idx) => {
    // Zebra banding background
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 4.5, 180, 6, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.text(row[0], 18, y);
    doc.setFont('helvetica', 'normal');
    
    // Dynamic text truncation for very long fields like title
    let valText = String(row[1]);
    if (valText.length > 55) {
      valText = valText.substring(0, 52) + '...';
    }
    doc.text(valText, 112, y);
    y += 6;
  });

  // --- SECTION B: SPATIAL ANALYSIS MODELING (IDW GEOGRAPHY) ---
  y += 4;
  doc.setTextColor(SLATE_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('2. MODELING INTERPOLASI SPASIAL & ZONASI LAHAN', 15, y);
  doc.line(15, y + 2, 195, y + 2);
  
  y += 10;

  // Draw elegant dynamic metrics cards in a 2x2 grid style
  doc.setFillColor(248, 250, 252); // Card BG
  doc.setDrawColor(226, 232, 240);
  
  // Card 1: Chili
  doc.rect(15, y - 3, 86, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(SLATE_LIGHT);
  doc.text('SANGAT SESUAI CABAI (CHILI)', 20, y + 2);
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50); // Dark Green
  doc.text(`${(spatialStats?.chiliHighlySuitableHa || 0).toFixed(2)} Ha`, 20, y + 9);

  // Card 2: Cucumber
  doc.rect(109, y - 3, 86, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(SLATE_LIGHT);
  doc.text('SANGAT SESUAI MENTIMUN (CUCUMBER)', 114, y + 2);
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text(`${(spatialStats?.cucumberHighlySuitableHa || 0).toFixed(2)} Ha`, 114, y + 9);

  y += 21;

  // Card 3: Suitable Percent
  doc.rect(15, y - 3, 86, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(SLATE_LIGHT);
  doc.text('PERSENTASE LAHAN LAYAK TANAM', 20, y + 2);
  doc.setFontSize(12);
  doc.setTextColor(21, 128, 61); // Green-700
  doc.text(`${(spatialStats?.suitablePercent || 0).toFixed(1)}%`, 20, y + 9);

  // Card 4: Unsuitable Percent
  doc.rect(109, y - 3, 86, 18, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(SLATE_LIGHT);
  doc.text('LAHAN TIDAK SESUAI (ASAM EKSTREM)', 114, y + 2);
  doc.setFontSize(12);
  doc.setTextColor(225, 29, 72); // Rose-600
  doc.text(`${(spatialStats?.unsuitablePercent || 0).toFixed(1)}%`, 114, y + 9);

  // --- SECTION C: REKOMENDASI SPASIAL PENGAPURAN (DOLOMIT) ---
  y += 24;
  doc.setTextColor(SLATE_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('3. FORMULASI DOSIS SPASIAL KAPUR DOLOMIT', 15, y);
  doc.line(15, y + 2, 195, y + 2);

  y += 10;
  
  // Calculate dolomite variables
  const hasAcidZone = (spatialStats?.avgDolomite || 0) > 0;
  const avgDolomite = spatialStats?.avgDolomite || 0;
  const maxDolomite = spatialStats?.maxDolomite || 0;
  const minDolomite = spatialStats?.minDolomite || 0;

  doc.setFillColor(hasAcidZone ? 254 : 240, hasAcidZone ? 242 : 253, hasAcidZone ? 242 : 244); // Warm amber tints if acidic, else soft emerald congrats tint
  doc.setDrawColor(hasAcidZone ? 254 : 220, hasAcidZone ? 215 : 252, hasAcidZone ? 170 : 231);
  doc.rect(15, y - 3, 180, 26, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(hasAcidZone ? 180 : 31, hasAcidZone ? 83 : 135, hasAcidZone ? 9 : 85);
  doc.text(hasAcidZone ? '⚠️ PERINGATAN: TERDETEKSI REKAYASA SPASIAL ASAM EKSTREM' : '✅ STATUS SPASIAL OPTIMAL: TIDAK PERLU REKAYASA ASAM EKSTREM', 20, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(SLATE_DARK);
  doc.setFontSize(8);

  if (hasAcidZone) {
    doc.text(`Rata-rata Kebutuhan Lahan Asam: ${avgDolomite.toFixed(2)} Ton/Ha`, 20, y + 8);
    doc.text(`Batas Kebutuhan Minimum: ${minDolomite.toFixed(2)} Ton/Ha`, 20, y + 13);
    doc.text(`Batas Kebutuhan Maksimum (Kritis): ${maxDolomite.toFixed(2)} Ton/Ha`, 20, y + 18);

    // Right-aligned callout recommendation
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(153, 27, 27); // Dark red recommendation text
    doc.text('Rekomendasi Agronomis:', 110, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_DARK);
    
    // Multi-line word wrap text for recommendations
    const txt = 'Aplikasikan segera kapur dolomit murni (CaMg(CO3)2) sesuai dosis di setiap sel peta yang menguning/merah. Taburkan merata dan bajak sedalam 20cm, diamkan selama 2-3 minggu sebelum tanam untuk menetralisir toksisitas aluminium.';
    const splitLines = doc.splitTextToSize(txt, 80);
    doc.text(splitLines, 110, y + 12);
  } else {
    doc.text(`Rata-rata Kebutuhan Lahan Asam: 0.00 Ton/Ha`, 20, y + 8);
    doc.text(`Status spasial pH tanah rata-rata optimal berada di zona netral dan cukup sesuai.`, 20, y + 13);
    doc.text(`Kandungan Aluminium (Al) bebas aktif relatif aman dan fosfor tersedia untuk tanaman.`, 20, y + 18);
  }

  // --- PAGE 2: AUTOMATIC FERTILIZER RECOMMENDATIONS ---
  doc.addPage();
  
  // Calculate nutrient averages for recommendations
  let nSum = 0, nCount = 0;
  let pSum = 0, pCount = 0;
  let kSum = 0, kCount = 0;
  let cSum = 0, cCount = 0;

  samples.forEach((s) => {
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

  const avgN = nCount > 0 ? nSum / nCount : 0.25;
  const avgP = pCount > 0 ? pSum / pCount : 25.0;
  const avgK = kCount > 0 ? kSum / kCount : 125.0;
  const avgC = cCount > 0 ? cSum / cCount : 1.8;

  const rec = getFertilizerRecommendation(avgPh, avgN, avgP, avgK, avgC);
  const landAreaHa = metadata.luasLahan !== undefined ? metadata.luasLahan : 1.0;
  const actualRec = calculateFertilizerRecommendation(avgPh, avgN, avgP, avgK, avgC, landAreaHa);

  // Top header block for Page 2
  doc.setFillColor(27, 67, 50); // GREEN_DARK
  doc.rect(0, 0, 210, 15, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. REKOMENDASI PEMUPUKAN & TINDAKAN AGRONOMIS OTOMATIS PRESISI', 15, 9.5);

  let py = 25;

  // 1. Limiting Factor & Lowest Parameter Combined Card
  doc.setFillColor(254, 243, 199); // light amber bg
  doc.setDrawColor(252, 211, 77); // amber border
  doc.rect(15, py, 180, 27, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('FAKTOR PEMBATAS UTAMA & PARAMETER TERENDAH', 20, py + 5.5);

  doc.setFontSize(9);
  doc.setTextColor(SLATE_DARK);
  doc.text(`Kategori Terendah: ${rec.lowestParam.name} = ${rec.lowestParam.valStr} (${rec.lowestParam.label})`, 20, py + 11.5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const splitLimitText = doc.splitTextToSize(rec.limitingFactor.desc, 170);
  doc.text(splitLimitText, 20, py + 16.5);

  py += 33;

  // 2. Takaran Pupuk Rekomendasi Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(SLATE_DARK);
  doc.text(`RENCANA PEMUPUKAN AKTUAL (LUAS LAHAN: ${landAreaHa.toFixed(2)} Ha)`, 15, py);
  doc.line(15, py + 2, 195, py + 2);

  py += 8;

  // Let's print out the 5 fertilizer types using our actual calculated recommendations
  const fertData = [
    { 
      name: 'Urea (Pemasok N)', 
      val: `${actualRec.urea.perHa} kg/Ha`, 
      desc: `Kebutuhan Total: ${actualRec.urea.valStrKg} (${actualRec.urea.valStrTon} / ${Math.ceil(actualRec.urea.totalZak)} zak)\nStatus Nitrogen di lapangan: ${actualRec.statuses.nitrogen}`, 
      color: [21, 128, 61] 
    },
    { 
      name: 'SP-36 (Pemasok P)', 
      val: `${actualRec.sp36.perHa} kg/Ha`, 
      desc: `Kebutuhan Total: ${actualRec.sp36.valStrKg} (${actualRec.sp36.valStrTon} / ${Math.ceil(actualRec.sp36.totalZak)} zak)\nStatus Fosfor di lapangan: ${actualRec.statuses.fosfor}`, 
      color: [14, 116, 144] 
    },
    { 
      name: 'KCl (Pemasok K)', 
      val: `${actualRec.kcl.perHa} kg/Ha`, 
      desc: `Kebutuhan Total: ${actualRec.kcl.valStrKg} (${actualRec.kcl.valStrTon} / ${Math.ceil(actualRec.kcl.totalZak)} zak)\nStatus Kalium di lapangan: ${actualRec.statuses.kalium}`, 
      color: [180, 83, 9] 
    },
    { 
      name: 'Kapur Dolomit', 
      val: `${actualRec.dolomit.perHa} kg/Ha`, 
      desc: `Kebutuhan Total: ${actualRec.dolomit.valStrKg} (${actualRec.dolomit.valStrTon} / ${Math.ceil(actualRec.dolomit.totalZak)} zak)\nStatus Reaksi pH keasaman: ${actualRec.statuses.ph}`, 
      color: [109, 40, 217] 
    },
    { 
      name: 'Pupuk Kompos / Bahan Organik', 
      val: `${actualRec.kompos.perHa} kg/Ha`, 
      desc: `Kebutuhan Total: ${actualRec.kompos.valStrKg} (${actualRec.kompos.valStrTon} / ${Math.ceil(actualRec.kompos.totalZak)} zak)\nStatus Humus C-Organik: ${actualRec.statuses.cOrganik}`, 
      color: [4, 120, 87] 
    }
  ];

  fertData.forEach((fert) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, py, 180, 13, 'FD');

    // Colored bullet
    doc.setFillColor(fert.color[0], fert.color[1], fert.color[2]);
    doc.rect(17, py + 4.5, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(SLATE_DARK);
    doc.text(fert.name, 23, py + 7);
    
    doc.setFontSize(9.5);
    doc.setTextColor(fert.color[0], fert.color[1], fert.color[2]);
    doc.text(fert.val, 72, py + 7.5, { align: 'left' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(SLATE_LIGHT);
    const splitDesc = doc.splitTextToSize(fert.desc, 95);
    doc.text(splitDesc, 98, py + 4.5);

    py += 15;
  });

  // Dynamic Total Requirement Callout box
  doc.setFillColor(236, 253, 245); // light emerald-50 bg
  doc.setDrawColor(16, 185, 129); // emerald-500 border
  doc.rect(15, py, 180, 15, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`KARTU TOTAL KEBUTUHAN LAHAN (${actualRec.area.toFixed(2)} Ha)`, 20, py + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(SLATE_DARK);
  doc.text(`Total Seluruh Pupuk & Amelioran: ${actualRec.totals.valStrKg}  |  ${actualRec.totals.valStrTon}  |  Ekuivalen: ${Math.ceil(actualRec.totals.zak)} zak (kemasan 50 kg)`, 20, py + 10);

  py += 21;

  py += 2;

  // 3. Step Roadmap Priority
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(SLATE_DARK);
  doc.text('URUTAN PRIORITAS TINDAKAN LAPANGAN', 15, py);
  doc.line(15, py + 2, 195, py + 2);

  py += 8;

  rec.actionsList.forEach((action) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(241, 245, 249);
    doc.rect(15, py - 1, 180, 11.5, 'FD');

    // Circle Badge
    doc.setFillColor(27, 67, 50); // GREEN_DARK
    doc.rect(17, py + 1.5, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(action.step, 19.5, py + 5);

    doc.setFontSize(8.5);
    doc.setTextColor(SLATE_DARK);
    doc.text(action.title, 26, py + 3.5);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_LIGHT);
    doc.text(`(${action.sub})`, 26, py + 7.5);

    doc.setFontSize(7.5);
    doc.setTextColor(SLATE_DARK);
    const splitActDesc = doc.splitTextToSize(action.desc, 105);
    doc.text(splitActDesc, 85, py + 4);

    py += 14;
  });

  // 4. Transparency Box
  py = 222;
  doc.setFillColor(241, 245, 249); // light grey
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(15, py, 180, 24, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(SLATE_DARK);
  doc.text('TRANSPARANSI METODOLOGI AGRONOMIS (STANDAR BALITTANAH)', 20, py + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(SLATE_LIGHT);
  const ruleTxt = 'Aturan rekayasa dosis dikalkulasi dinamis: (1) Kapur dolomit diaktifkan jika pH di bawah 6.0 dengan rasio kebutuhan (6.0 - pH) x 1.5 - 2.5 t/ha. (2) Urea, SP-36 dan KCl ditakar presisi berdasarkan lima kurva hara (sangat rendah, rendah, sedang, tinggi, sangat tinggi) yang diposisikan guna meminimalisir kejenuhan pupuk kimia berlebih. (3) Humus C-Organik diawasi ketat di bawah batas kritis 2.0% dengan memicu anjuran amelioran murni mulsa organik 10-15 Ton/Ha.';
  const splitRuleTxt = doc.splitTextToSize(ruleTxt, 170);
  doc.text(splitRuleTxt, 20, py + 10);

  // --- PAGE 3: DATA TABLE INVENTORY ---
  doc.addPage();
  y = 20;

  doc.setFillColor(27, 67, 50); // GREEN_DARK
  doc.rect(0, 0, 210, 15, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('5. LAMPIRAN INVENTARIS LOG TITIK SAMPEL & NUTRISI TANAH', 15, 9.5);

  y = 25;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_LIGHT);
  doc.text('Nama Titik Lokasi', 16, y);
  doc.text('Koordinat (Lat, Lng)', 75, y);
  doc.text('pH', 115, y);
  doc.text('Kategori pH', 128, y);
  doc.text('Kesesuaian Cabai', 152, y);
  doc.text('Kesesuaian Mentimun', 176, y);
  doc.line(15, y + 2, 195, y + 2);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(SLATE_DARK);

  samples.forEach((sample, index) => {
    const hasNutrisi = (sample.nitrogen !== undefined && sample.nitrogen !== null && sample.nitrogen !== '') ||
                       (sample.fosfor !== undefined && sample.fosfor !== null && sample.fosfor !== '') ||
                       (sample.kalium !== undefined && sample.kalium !== null && sample.kalium !== '') ||
                       (sample.cOrganik !== undefined && sample.cOrganik !== null && sample.cOrganik !== '');
    const rowHeight = hasNutrisi ? 10 : 5.5;

    // Pagination check
    if (y + rowHeight > 282) {
      doc.addPage();
      // Draw sub-header on new page
      doc.setFillColor(27, 67, 50);
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('5. LAMPIRAN INVENTARIS LOG TITIK SAMPEL & NUTRISI TANAH (LANJUTAN)', 15, 9.5);

      y = 25;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(SLATE_LIGHT);
      doc.text('Nama Titik Lokasi', 16, y);
      doc.text('Koordinat (Lat, Lng)', 75, y);
      doc.text('pH', 115, y);
      doc.text('Kategori pH', 128, y);
      doc.text('Kesesuaian Cabai', 152, y);
      doc.text('Kesesuaian Mentimun', 176, y);
      doc.line(15, y + 2, 195, y + 2);

      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(SLATE_DARK);
    }

    // Zebra striping
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 4, 180, rowHeight, 'F');
    }

    const chiliS = classifyChiliSuitability(sample.ph);
    const cucumberS = classifyCucumberSuitability(sample.ph);
    const phCat = getPHCategory(sample.ph);

    doc.setFont('helvetica', 'bold');
    doc.text(sample.nama.length > 32 ? sample.nama.substring(0, 30) + '..' : sample.nama, 17, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`, 75, y);
    doc.setFont('helvetica', 'bold');
    doc.text(sample.ph.toFixed(2), 115, y);
    doc.setFont('helvetica', 'normal');
    doc.text(phCat.label, 128, y);
    doc.text(chiliS.status, 152, y);
    doc.text(cucumberS.status, 176, y);

    if (hasNutrisi) {
      y += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139); // SLATE_LIGHT-ish
      const nStr = (sample.nitrogen !== undefined && sample.nitrogen !== null && sample.nitrogen !== '') ? `${parseFloat(sample.nitrogen).toFixed(2)} %` : '-';
      const pStr = (sample.fosfor !== undefined && sample.fosfor !== null && sample.fosfor !== '') ? `${parseFloat(sample.fosfor).toFixed(1)} ppm` : '-';
      const kStr = (sample.kalium !== undefined && sample.kalium !== null && sample.kalium !== '') ? `${parseFloat(sample.kalium).toFixed(1)} ppm` : '-';
      const cStr = (sample.cOrganik !== undefined && sample.cOrganik !== null && sample.cOrganik !== '') ? `${parseFloat(sample.cOrganik).toFixed(2)} %` : '-';
      doc.text(`   ↳ Analisis Kesuburan: [ N: ${nStr}  |  P: ${pStr}  |  K: ${kStr}  |  C-Org: ${cStr} ]`, 17, y);
      doc.setFontSize(8);
      doc.setTextColor(SLATE_DARK);
    }

    y += 5.5;
  });

  // --- SECTION 5: APPENDIX - PHOTO DOCUMENTATION ---
  doc.addPage();
  y = 25;

  // Draw section header bar on the new page
  doc.setFillColor(27, 67, 50); // GREEN_DARK
  doc.rect(0, 0, 210, 15, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('6. LAMPIRAN DOKUMENTASI FOTO LAPANGAN TITIK SAMPEL', 15, 9.5);

  samples.forEach((sample) => {
    const hasPhotos = !!(sample.fotoLokasi || sample.fotoTanaman || sample.fotoTanah);
    const neededHeight = hasPhotos ? 52 : 16;

    // Check if we need a new page
    if (y + neededHeight > 275) {
      doc.addPage();
      
      // Header for running continuation page
      doc.setFillColor(27, 67, 50);
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('6. LAMPIRAN DOKUMENTASI FOTO LAPANGAN TITIK SAMPEL (LANJUTAN)', 15, 9.5);

      y = 25;
    }

    // Card background & border
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y - 3, 180, neededHeight, 'FD');

    // Title Row
    const displayNama = sample.nama.length > 35 ? sample.nama.substring(0, 32) + '...' : sample.nama;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(SLATE_DARK);
    doc.text(`Titik: ${displayNama}`, 18, y + 2.5);

    // Coordinates middle info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(SLATE_LIGHT);
    doc.text(`Koordinat: ${sample.latitude.toFixed(5)}, ${sample.longitude.toFixed(5)}`, 90, y + 2.5);

    // pH & suitability on the right
    const phCat = getPHCategory(sample.ph);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GREEN_PRIMARY);
    doc.text(`pH: ${sample.ph.toFixed(2)} (${phCat.label})`, 192, y + 2.5, { align: 'right' });

    if (hasPhotos) {
      // Loop through photo types
      const photoTypes = [
        { key: 'fotoLokasi', label: 'Foto Lokasi', xVal: 20 },
        { key: 'fotoTanaman', label: 'Foto Tanaman', xVal: 80 },
        { key: 'fotoTanah', label: 'Foto Tanah', xVal: 140 }
      ];

      photoTypes.forEach((photoType) => {
        const base64Data = sample[photoType.key];
        const xPos = photoType.xVal;
        const yPos = y + 6;
        const w = 50;
        const h = 37.5;

        // Draw outer photo frame placeholder
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(241, 245, 249);
        doc.rect(xPos, yPos, w, h, 'FD');

        if (base64Data) {
          try {
            // Draw image
            doc.addImage(base64Data, 'JPEG', xPos, yPos, w, h);
            
            // Draw overlay bottom caption bar
            doc.setFillColor(241, 245, 249);
            doc.rect(xPos, yPos + h - 5, w, 5, 'F');
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(GREEN_PRIMARY);
            doc.text(photoType.label, xPos + w / 2, yPos + h - 1.5, { align: 'center' });
          } catch (err) {
            console.error("Gagal memuat foto pada PDF:", err);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(SLATE_LIGHT);
            doc.text('Format gambar tidak cocok', xPos + w / 2, yPos + h / 2, { align: 'center' });
          }
        } else {
          // Empty slot placeholder
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(SLATE_LIGHT);
          doc.text(`(Tidak ada ${photoType.label.toLowerCase()})`, xPos + w / 2, yPos + h / 2 + 1, { align: 'center' });
        }
      });
    } else {
      // Draw a clean placeholder for "No photo documentation"
      doc.setFillColor(241, 245, 249);
      doc.rect(18, y + 5, 174, 6, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(SLATE_LIGHT);
      doc.text('Tidak ada dokumentasi foto', 18 + 87, y + 9, { align: 'center' });
    }

    y += neededHeight + 5; // advance y for next sample item card
  });

  // Footer / Page Numbers on both pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(SLATE_LIGHT);
    doc.text(`Halaman ${i} dari ${pageCount}`, 195 - 15, 287, { align: 'right' });
    doc.text('AgriMap Lite Spasial • Laporan Ilmiah Hasil Analisis Precision Agriculture', 15, 287);
  }

  // Save/Download Action
  doc.save(`agrimap_laporan_pH_${new Date().toISOString().slice(0, 10)}.pdf`);
}
