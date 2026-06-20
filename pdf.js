/**
 * AgriMap Lite - Scientific PDF Report Generator
 * Uses jsPDF to produce pixel-perfect precision agriculture analysis documents.
 */

import { classifyChiliSuitability, classifyCucumberSuitability } from './suitability.js';
import { getPHCategory } from './db.js';
import { loadResearchMetadata } from './metadata_manager.js';

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

  // --- PAGE 2: DATA TABLE INVENTORY ---
  doc.addPage();
  y = 20;

  doc.setFillColor(27, 67, 50); // GREEN_DARK
  doc.rect(0, 0, 210, 15, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. LAMPIRAN DAFTAR INVENTARIS LOG TITIK SAMPEL PH TANAH', 15, 9.5);

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
    // Pagination check
    if (y > 275) {
      doc.addPage();
      // Draw sub-header on new page
      doc.setFillColor(27, 67, 50);
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('4. LAMPIRAN DAFTAR INVENTARIS LOG TITIK SAMPEL PH TANAH (LANJUTAN)', 15, 9.5);

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
      doc.rect(15, y - 4, 180, 5.5, 'F');
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
  doc.text('5. LAMPIRAN DOKUMENTASI FOTO LAPANGAN TITIK SAMPEL', 15, 9.5);

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
      doc.text('5. LAMPIRAN DOKUMENTASI FOTO LAPANGAN TITIK SAMPEL (LANJUTAN)', 15, 9.5);

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
