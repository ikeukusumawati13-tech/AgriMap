/**
 * AgriMap Lite - Excel Processing Module
 * Handles creation of the user-friendly Excel templates and parses uploaded Excel (.xlsx) files.
 */

import * as XLSX from 'xlsx';
import { loadResearchMetadata } from './metadata_manager.js';
import { getFertilizerRecommendation } from './fertilizer.js';
import { calculateFertilizerRecommendation } from './fertilizerRecommendation.js';

/**
 * Downloads a highly polished Excel Template with interactive instructions
 * targeted for Teachers, Students, Extension workers, and Field researchers.
 */
export function downloadExcelTemplate() {
  // 1. Create columns for DATA_SAMPEL sheet
  const sampleData = [
    { 
      "Nama Titik": "Titik Log 1 - Lahan Cabe A", 
      "Latitude": -7.35100, 
      "Longitude": 108.30100, 
      "pH": 6.5,
      "Nitrogen %": 1.25,
      "Fosfor ppm": 15.60,
      "Kalium ppm": 120.50,
      "C-Organik %": 2.10
    },
    { 
      "Nama Titik": "Titik Log 2 - Tepian Parit", 
      "Latitude": -7.35200, 
      "Longitude": 108.30200, 
      "pH": 5.2,
      "Nitrogen %": 0.45,
      "Fosfor ppm": 8.10,
      "Kalium ppm": 65.00,
      "C-Organik %": 1.15
    },
    { 
      "Nama Titik": "Titik Log 3 - Dekat Sumur", 
      "Latitude": -7.35300, 
      "Longitude": 108.30300, 
      "pH": 7.8,
      "Nitrogen %": 1.85,
      "Fosfor ppm": 38.20,
      "Kalium ppm": 240.00,
      "C-Organik %": 2.80
    }
  ];

  const wsData = XLSX.utils.json_to_sheet(sampleData);

  // Set visual column widths for sample data
  wsData['!cols'] = [
    { wch: 25 }, // Nama Titik
    { wch: 15 }, // Latitude
    { wch: 15 }, // Longitude
    { wch: 10 }, // pH
    { wch: 12 }, // Nitrogen %
    { wch: 12 }, // Fosfor ppm
    { wch: 12 }, // Kalium ppm
    { wch: 15 }  // C-Organik %
  ];

  // 2. Create help sheet (PETUNJUK)
  const instructionsData = [
    ["PANDUAN PENGISIAN TEMPLATE DATA SPASIAL pH TANAH & KESUBURAN KAWASAN (AGRIMAP LITE)"],
    [""],
    ["Target Pengguna:", "Guru, Mahasiswa, Penyuluh Pertanian, & Peneliti Lapangan"],
    ["Dokumen Dibuat:", new Date().toLocaleDateString('id')],
    ["Status Berkas:", "Siap Digunakan (Template Resmi V2)"],
    [""],
    ["KOLOM", "DESKRIPSI", "CONTOH", "SYARAT KEVALIDAN DATA"],
    ["Nama Titik", "Nama identitas unik lokasi pengukuran sampel pH.", "Lahan Utara 01", "Wajib diisi, tidak boleh kosong."],
    ["Latitude", "Koordinat lintang lokasi (garis lintang desimal GPS).", "-7.35123", "Nilai angka desimal antara -90 hingga 90."],
    ["Longitude", "Koordinat bujur lokasi (garis bujur desimal GPS).", "108.30145", "Nilai angka desimal antara -180 hingga 180."],
    ["pH", "Tingkat keasaman tanah hasil uji pH.", "6.2", "Angka desimal/bulat antara 0.0 hingga 14.0."],
    ["Nitrogen %", "Kandungan unsur hara Nitrogen tanah dalam persen (opsional).", "1.25", "Angka desimal positif (opsional)."],
    ["Fosfor ppm", "Kandungan unsur hara Fosfor tanah dalam ppm (opsional).", "15.6", "Angka desimal positif (opsional)."],
    ["Kalium ppm", "Kandungan unsur hara Kalium tanah dalam ppm (opsional).", "120.5", "Angka desimal positif (opsional)."],
    ["C-Organik %", "Kandungan hara C-Organik tanah dalam persen (opsional).", "2.1", "Angka desimal positif (opsional)."],
    [""],
    ["PETUNJUK ALUR INSTALASI DATA:"],
    ["1. Buka Sheet 'DATA_SAMPEL' di bagian bawah Excel ini."],
    ["2. Ganti atau hapus data contoh yang sudah disediakan."],
    ["3. Isi data Anda sesuai dengan kolom yang disediakan."],
    ["4. Gunakan tanda TITIK (.) sebagai pemisah pecahan/desimal (Jangan koma) pada kolom Latitude, Longitude, pH, Nitrogen %, Fosfor ppm, Kalium ppm, dan C-Organik %."],
    ["5. JANGAN mengubah judul kolom pada baris pertama (Nama Titik, Latitude, Longitude, pH, Nitrogen %, Fosfor ppm, Kalium ppm, C-Organik %)!"],
    ["6. Simpan dokumen berkas ini sebagai tipe Excel (.xlsx)."],
    ["7. Gunakan tombol 'Impor Excel' di aplikasi AgriMap untuk mengunggah dan memetakan data secara otomatis."]
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

  // Set width for instructions sheet columns
  wsInstructions['!cols'] = [
    { wch: 18 },
    { wch: 55 },
    { wch: 18 },
    { wch: 35 }
  ];

  // Create workbook and append sheets
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, "DATA_SAMPEL");
  XLSX.utils.book_append_sheet(wb, wsInstructions, "PETUNJUK");

  // Write and trigger download
  XLSX.writeFile(wb, "Template_Data_pH_AgriMap.xlsx");
}

/**
 * Parses raw array buffer from Excel (.xlsx) file and maps to valid samples
 * @param {ArrayBuffer} arrayBuffer - Raw uploaded file data
 * @returns {Promise<Object>} { validSamples, successCount, failCount }
 */
export async function parseExcelData(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });

  // Look for DATA_SAMPEL sheet, fallback to first sheet if absent
  const firstSheetName = workbook.SheetNames.includes("DATA_SAMPEL") 
    ? "DATA_SAMPEL" 
    : workbook.SheetNames[0];

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error("Sheet data tidak ditemukan di dalam berkas Excel.");
  }

  // Parse to raw JSON array of rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet);
  const validSamples = [];
  let successCount = 0;
  let failCount = 0;

  for (const row of rawRows) {
    // Find keys to handle potential slight variations in user-inputted case or spaces
    let nameKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'namatitik' || normalized === 'nama' || normalized === 'name';
    });
    
    let latKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'latitude' || normalized === 'lat';
    });

    let lngKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'longitude' || normalized === 'lng' || normalized === 'long';
    });

    let phKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'ph' || normalized === 'phvalue' || normalized === 'nilaiph' || normalized === 'keasaman';
    });
    
    let nitrogenKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'nitrogen' || normalized === 'n' || normalized === 'nitrogen%';
    });

    let fosforKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'fosfor' || normalized === 'p' || normalized === 'fosforppm' || normalized === 'fosfat';
    });

    let kaliumKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'kalium' || normalized === 'k' || normalized === 'kaliumppm';
    });

    let cOrganikKey = Object.keys(row).find(k => {
      const normalized = k.toLowerCase().replace(/[^a-z]/g, '');
      return normalized === 'corganik' || normalized === 'c' || normalized === 'corganik%' || normalized === 'organik';
    });

    const name = nameKey ? row[nameKey] : undefined;
    const rawLat = latKey ? row[latKey] : undefined;
    const rawLng = lngKey ? row[lngKey] : undefined;
    const rawPh = phKey ? row[phKey] : undefined;
    
    const rawN = nitrogenKey ? row[nitrogenKey] : undefined;
    const rawP = fosforKey ? row[fosforKey] : undefined;
    const rawK = kaliumKey ? row[kaliumKey] : undefined;
    const rawC = cOrganikKey ? row[cOrganikKey] : undefined;

    // Check if there is some data in the row to avoid counting blank template rows as fails
    const hasSomeData = (name !== undefined) || (rawLat !== undefined) || (rawLng !== undefined) || (rawPh !== undefined);
    if (!hasSomeData) {
      continue;
    }

    const parsedLat = parseFloat(rawLat);
    const parsedLng = parseFloat(rawLng);
    const parsedPh = parseFloat(rawPh);

    const parsedN = (rawN !== undefined && rawN !== null && rawN !== '') ? parseFloat(rawN) : null;
    const parsedP = (rawP !== undefined && rawP !== null && rawP !== '') ? parseFloat(rawP) : null;
    const parsedK = (rawK !== undefined && rawK !== null && rawK !== '') ? parseFloat(rawK) : null;
    const parsedC = (rawC !== undefined && rawC !== null && rawC !== '') ? parseFloat(rawC) : null;

    const hasValidName = name !== undefined && name !== null && String(name).trim() !== '';
    const hasValidLat = !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90;
    const hasValidLng = !isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180;
    const hasValidPh = !isNaN(parsedPh) && parsedPh >= 0 && parsedPh <= 14;

    if (hasValidName && hasValidLat && hasValidLng && hasValidPh) {
      const cleanN = (parsedN !== null && !isNaN(parsedN)) ? parsedN : null;
      const cleanP = (parsedP !== null && !isNaN(parsedP)) ? parsedP : null;
      const cleanK = (parsedK !== null && !isNaN(parsedK)) ? parsedK : null;
      const cleanC = (parsedC !== null && !isNaN(parsedC)) ? parsedC : null;

      validSamples.push({
        nama: String(name).trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        ph: parsedPh,
        nitrogen: cleanN,
        fosfor: cleanP,
        kalium: cleanK,
        cOrganik: cleanC,
        catatan: `Impor Excel (${new Date().toLocaleDateString('id')})`,
        timestamp: Date.now()
      });
      successCount++;
    } else {
      failCount++;
    }
  }

  return { validSamples, successCount, failCount };
}

/**
 * Exports currently stored research data into a high-quality multi-sheet Excel (.xlsx) file
 * customized for agricultural students, teachers, researchers and field extension workers.
 *
 * @param {Array<Object>} samples - All registered soil pH samples
 * @param {Object} spatialStats - Extracted spatial analysis indicators
 */
export function exportResearchDataExcel(samples, spatialStats) {
  if (!samples || samples.length === 0) {
    throw new Error("Tidak ada data titik sampel yang tersedia untuk diekspor.");
  }

  // --- Sheet 1: METADATA ---
  const metadata = loadResearchMetadata();
  const dateStr = new Date().toLocaleString('id-ID');

  const sheet0Data = [
    ["METADATA PENELITIAN LAPANGAN (AGRIMAP LITE)"],
    ["Dokumen Sistem Terotomatisasi - Luring Aman"],
    [""],
    ["METADATA FIELD", "INFORMASI PENELITIAN"],
    ["Judul Penelitian", metadata.judulPenelitian || "Kajian Spasial Kualitas pH Lahan Pertanian"],
    ["Nama Peneliti", metadata.namaPeneliti || "Penyuluh / Peneliti Lapangan"],
    ["Instansi", metadata.instansi || "BPP Sleman / Lembaga Mitra"],
    ["Lokasi Penelitian", metadata.lokasiPenelitian || "Daerah Istimewa Yogyakarta"],
    ["Komoditas", metadata.komoditasUtama || "Cabai & Mentimun"],
    ["Tahun Penelitian", metadata.tahunPenelitian || new Date().getFullYear().toString()],
    ["Tanggal Export", dateStr]
  ];

  const ws0 = XLSX.utils.aoa_to_sheet(sheet0Data);
  
  // Set elegant column widths for the METADATA sheet
  ws0['!cols'] = [
    { wch: 24 }, // Metadata Field
    { wch: 65 }  // Informasi Penelitian
  ];

  // --- Sheet 2: DATA_SAMPEL ---
  const sheet1Data = samples.map((sample, idx) => ({
    "No": idx + 1,
    "Nama Titik": sample.nama,
    "Latitude": sample.latitude,
    "Longitude": sample.longitude,
    "pH": sample.ph,
    "Nitrogen %": sample.nitrogen !== undefined && sample.nitrogen !== null ? sample.nitrogen : "",
    "Fosfor ppm": sample.fosfor !== undefined && sample.fosfor !== null ? sample.fosfor : "",
    "Kalium ppm": sample.kalium !== undefined && sample.kalium !== null ? sample.kalium : "",
    "C-Organik %": sample.cOrganik !== undefined && sample.cOrganik !== null ? sample.cOrganik : ""
  }));

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);

  // Set nice column widths for sheet 2
  ws1['!cols'] = [
    { wch: 8 },   // No
    { wch: 32 },  // Nama Titik
    { wch: 18 },  // Latitude
    { wch: 18 },  // Longitude
    { wch: 10 },  // pH
    { wch: 12 },  // Nitrogen %
    { wch: 12 },  // Fosfor ppm
    { wch: 12 },  // Kalium ppm
    { wch: 15 }   // C-Organik %
  ];

  // --- Sheet 3: RINGKASAN ---
  const totalCount = samples.length;
  const phs = samples.map(s => s.ph);
  const minPh = phs.length > 0 ? Math.min(...phs) : 0;
  const maxPh = phs.length > 0 ? Math.max(...phs) : 0;
  const avgPh = phs.length > 0 ? (phs.reduce((a, b) => a + b, 0) / phs.length) : 0;

  const chiliArea = spatialStats?.chiliHighlySuitableHa !== undefined 
    ? `${spatialStats.chiliHighlySuitableHa.toFixed(2)} Ha` 
    : "0.00 Ha";
  const cucumberArea = spatialStats?.cucumberHighlySuitableHa !== undefined 
    ? `${spatialStats.cucumberHighlySuitableHa.toFixed(2)} Ha` 
    : "0.00 Ha";

  const sheet2Data = [
    ["RINGKASAN METROMIK EKOLOGIS DAN KESESUAIAN KIMIAWI LAHAN"],
    ["Dokumen Dihasilkan:", dateStr],
    [""],
    ["IDENTITAS PENELITIAN LAPANGAN"],
    ["Judul Penelitian", metadata.judulPenelitian || "Tidak diisi"],
    ["Nama Peneliti", metadata.namaPeneliti || "Tidak diisi"],
    ["Instansi / Sekolah", metadata.instansi || "Tidak diisi"],
    ["Lokasi Penelitian", metadata.lokasiPenelitian || "Tidak diisi"],
    ["Komoditas Utama", metadata.komoditasUtama || "Tidak diisi"],
    ["Tahun Penelitian", metadata.tahunPenelitian || "Tidak diisi"],
    [""],
    ["METRIK ANALISIS LAHAN", "NILAI TERHITUNG", "SATUAN / KETERANGAN"],
    ["Jumlah Sampel Lapangan", totalCount, "Titik Lokasi Terdaftar"],
    ["pH Minimum Terdeteksi", minPh, "pH"],
    ["pH Maksimum Terdeteksi", maxPh, "pH"],
    ["Rata-rata pH Kawasan", Number(avgPh.toFixed(2)), "pH (Netral Ideal: 6.5 - 7.5)"],
    ["Luas Kelas Sangat Sesuai Cabai", chiliArea, "Hektar (Ha) dari Model Spasial IDW"],
    ["Luas Kelas Sangat Sesuai Mentimun", cucumberArea, "Hektar (Ha) dari Model Spasial IDW"],
    [""],
    ["METODOLOGI SPASIAL"],
    ["Model Interpolasi Peta", "Inverse Distance Weighting (IDW) Radian-2"],
    ["Koreksi Geostatistik", "Ordinary Kriging Gaussian Semivariogram Model"]
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);

  ws2['!cols'] = [
    { wch: 35 }, // Metrik
    { wch: 30 }, // Nilai
    { wch: 35 }  // Satuan
  ];

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

  // Safe helper to convert any dosage element into a guaranteed safe number
  const getSafeDoseVal = (element) => {
    if (element === null || element === undefined) return 0;
    let numeric = 0;
    if (typeof element === 'object') {
      numeric = Number(element.val !== undefined ? element.val : 0);
    } else {
      numeric = Number(element);
    }
    return isNaN(numeric) ? 0 : numeric;
  };

  const safeUreaVal = getSafeDoseVal(rec?.dosages?.urea);
  const safeSP36Val = getSafeDoseVal(rec?.dosages?.sp36);
  const safeKClVal = getSafeDoseVal(rec?.dosages?.kcl);
  const safeDolomitVal = getSafeDoseVal(rec?.dosages?.dolomit);
  const safeOrganikVal = getSafeDoseVal(rec?.dosages?.organik || rec?.dosages?.kompos);

  // --- Sheet 4: REKOMENDASI ---
  let statusLahan = "";
  let dosisDolomit = "";
  let catatanAgronomis = "";

  if (avgPh < 5.5) {
    statusLahan = "Masam Tingkat Tinggi (Kondisi Kritis)";
    const dolNeed = spatialStats?.avgDolomite !== undefined && spatialStats.avgDolomite > 0 
      ? `${spatialStats.avgDolomite.toFixed(2)} Ton/Ha` 
      : "1.5 - 2.5 Ton/Ha";
    dosisDolomit = dolNeed;
    catatanAgronomis = "Tingkat kemasaman tinggi sangat kritis terhadap tanaman hortikultura karena memicu kelarutan racun aluminium (Al) & besi (Fe) yang dapat membakar ujung perakaran. WAJIB melakukan pengapuran dengan Dolomit secara merata sewaktu membajak lahan basah minimal 2 minggu sebelum pemupukan dasar agar pH berangsur naik mendekati 6.0.";
  } else if (avgPh >= 5.5 && avgPh < 6.5) {
    statusLahan = "Agak Masam (Sesuai Marginal)";
    dosisDolomit = "0.5 - 1.0 Ton/Ha (Kebutuhan Ringan)";
    catatanAgronomis = "Kondisi keasaman sedang, tanaman masih bisa tumbuh namun serapan fosfat lambat. Taburkan kapur dolomit murni secukupnya sesuai dosis ringan di lubang tanam atau bedengan guna mencegah ancaman patogen layu bakteri, sembari melengkapi hara Kalsium (Ca) alami.";
  } else if (avgPh >= 6.5 && avgPh <= 7.5) {
    statusLahan = "Netral Seimbang (Sangat Optimal & Sempurna)";
    dosisDolomit = "0 Ton/Ha (Dolomit Tidak Diperlukan)";
    catatanAgronomis = "Kondisi tanah sangat prima dan ideal untuk penyerapan unsur makro NPK oleh brokoli, cabai rawit, cabai merah, dan buah timun. Pertahankan kandungan mikrobioma tanah sehat dengan menambahkan pupuk kompos organik matang atau asam humat tanpa perlu menabur zat dolomit.";
  } else {
    statusLahan = "Basa / Alkalis (Risiko Defisiensi Hara Mikro)";
    dosisDolomit = "0 Ton/Ha (Pemberian Dolomit Dilarang Keras)";
    catatanAgronomis = "Kondisi tanah bersifat basa. Penambahan dolomit akan menyebabkan pH semakin tinggi dan mengunci unsur besi (Fe) dan mangan (Mn). Gunakan sulfur/belerang pertanian atau pupuk bernada asam (seperti ZA) didampingi asam humat organik untuk menetralkan pH berlebih.";
  }

  const sheet3Data = [
    ["PANDUAN OPERASIONAL & TINDAKAN AGRONOMIK DI LAPANGAN"],
    ["Kriteria Status Lahan:", statusLahan],
    ["Kebutuhan Dolomit Rerata:", dosisDolomit],
    [""],
    ["URAIAN TINDAKAN", "PENJELASAN PRAKTIS LAPANGAN"],
    ["Tindakan Utama Lahan", catatanAgronomis],
    ["Rekomendasi Pemupukan Cabai", "Padukan pemupukan NPK dengan asam amino cair guna merangsang pembungaan optimal di tanah dengan kestabilan pH terjaga."],
    ["Rekomendasi Pemupukan Mentimun", "Dukung suplai Nitrogen organik (kompos kotoran unggas) di fase vegetatif guna memaksimalkan kerimbunan daun."]
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);

  ws3['!cols'] = [
    { wch: 32 }, // Uraian
    { wch: 85 }  // Penjelasan
  ];

  // --- Sheet 5: PUPUK_OTOMATIS (New) ---
  const sheet4Data = [
    ["REKOMENDASI PEMUPUKAN OTOMATIS & AMELIORASI TANAH PRESISI"],
    ["Dokumen Dihasilkan:", dateStr],
    [""],
    ["PROFIL PARAMETER TANAH RATA-RATA LAHAN"],
    ["Parameter pH Tanah", Number(avgPh.toFixed(2)), "pH"],
    ["Parameter Kandungan Nitrogen (N)", Number(avgN.toFixed(3)), "%"],
    ["Parameter Kandungan Fosfor (P)", Number(avgP.toFixed(2)), "ppm"],
    ["Parameter Kandungan Kalium (K)", Number(avgK.toFixed(2)), "ppm"],
    ["Parameter Kandungan C-Organik", Number(avgC.toFixed(3)), "%"],
    [""],
    ["IDENTIFIKASI PEMBATAS AGRONOMIS"],
    ["Faktor Pembatas Utama", rec.limitingFactor.name, rec.limitingFactor.title],
    ["Narasi Faktor Pembatas", rec.limitingFactor.desc],
    ["Parameter Terendah", rec.lowestParam.name, `${rec.lowestParam.valStr} (${rec.lowestParam.label})`],
    [""],
    ["REKOMENDASI TAKARAN DOSIS PUPUK"],
    ["Nama Pupuk", "Dosis Rekomendasi", "Kandungan Unsur", "Alasan Agronomis Penggunaan"],
    ["Urea (Pemasok N)", `${safeUreaVal.toFixed(0)} kg/Ha`, "Nitrogen (N) Makro", rec?.dosages?.urea?.reason || ""],
    ["SP-36 (Pemasok P)", `${safeSP36Val.toFixed(0)} kg/Ha`, "Fosfat (P2O5) Makro", rec?.dosages?.sp36?.reason || ""],
    ["KCl (Pemasok K)", `${safeKClVal.toFixed(0)} kg/Ha`, "Kalium (K2O) Makro", rec?.dosages?.kcl?.reason || ""],
    ["Kapur Dolomit", `${safeDolomitVal.toFixed(1)} Ton/Ha`, "CaMg(CO3)2 Kalsium & Mg", rec?.dosages?.dolomit?.reason || ""],
    ["Pupuk Organik", `${safeOrganikVal.toFixed(0)} Ton/Ha`, "Karbon Humus Organik", rec?.dosages?.organik?.reason || rec?.dosages?.kompos?.reason || ""],
    [""],
    ["ROADMAP PRIORITAS TINDAKAN OPERASIONAL DI LAPANGAN"],
    ["Langkah", "Prioritas Tindakan", "Fase Lahan", "Instruksi Penjelasan"],
    ...rec.actionsList.map(a => [
      a.step,
      a.title,
      a.sub,
      a.desc
    ]),
    [""],
    ["METODOLOGI KEPUTUSAN AGRONOMIS (TRANSPARANSI DIAGNOSTIK)"],
    ["Algoritma", "Standar Standardisasi Balitbang Kementerian Pertanian RI"],
    ["Aturan pH & Dolomit", "Dolomit = (6.0 - pH) x 1.5 - 2.5 t/Ha (bila pH dibawah 6.0)"],
    ["Aturan Urea (N)", "Urea = hara sangat rendah: 250 kg/ha, rendah: 200, sedang: 150, tinggi: 100, sangat tinggi: 50 (untuk membatasi kejenuhan)"],
    ["Aturan SP-36 (P)", "SP-36 = hara sangat rendah: 180 kg/ha, rendah: 150, sedang: 120, tinggi: 80, sangat tinggi: 40"],
    ["Aturan KCl (K)", "KCl = hara sangat rendah: 150 kg/ha, rendah: 120, sedang: 90, tinggi: 60, sangat tinggi: 30"],
    ["Aturan Organik (C)", "C-Organik < 2.0% memicu amelioran bahan organik 10-15 Ton/Ha guna memperbaiki kapasitas kation tanah."]
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);
  ws4['!cols'] = [
    { wch: 28 }, // Parameter / Nama Pupuk
    { wch: 25 }, // Dosis / Kategori
    { wch: 25 }, // Keterangan / Unsur
    { wch: 90 }  // Alasan / Instruksi
  ];

  // --- Sheet 6: RENCANA_PEMUPUKAN (New) ---
  const landAreaHa = metadata.luasLahan !== undefined ? metadata.luasLahan : 1.0;
  const actualRec = calculateFertilizerRecommendation(avgPh, avgN, avgP, avgK, avgC, landAreaHa);
  
  const sheet5Data = [
    ["SISTEM REKOMENDASI PEMUPUKAN AKTUAL PRESISI (BAGI PETANI)"],
    ["Dokumen Dihasilkan:", dateStr],
    [""],
    ["INFORMASI LUAS LAHAN HAMPARAN"],
    ["Luas Seluruh Lahan Kelolaan (Ha)", actualRec.area, "Hektar (Ha)"],
    ["Judul Penelitian / Lahan", metadata.judulPenelitian || "Kajian Spasial Lahan Tani"],
    ["Nama Pemilik / Pengelola Lahan", metadata.namaPeneliti || "Nama Petani Mitrabinaan"],
    ["Instansi / Sekolah / Kelompok Tani", metadata.instansi || "Kelompok Tani"],
    [""],
    ["TABEL RENDEMEN LOGISTIK & TAKARAN PEMUPUKAN AKTUAL"],
    ["Bahan Pupuk / Amelioran", "Dosis Rekomendasi (kg/Ha)", "Total Kebutuhan (kg)", "Total Kebutuhan (ton)", "Jumlah Kemasan (zak 50 kg)", "Status Gizi Parameter Lahan"],
    ["🌾 Pupuk Urea", actualRec.urea.perHa, actualRec.urea.totalKg, actualRec.urea.totalTon, Math.ceil(actualRec.urea.totalZak), `Nitrogen (N) ${actualRec.statuses.nitrogen}`],
    ["🧪 Pupuk SP-36", actualRec.sp36.perHa, actualRec.sp36.totalKg, actualRec.sp36.totalTon, Math.ceil(actualRec.sp36.totalZak), `Fosfor (P) ${actualRec.statuses.fosfor}`],
    ["⚡ Pupuk KCl", actualRec.kcl.perHa, actualRec.kcl.totalKg, actualRec.kcl.totalTon, Math.ceil(actualRec.kcl.totalZak), `Kalium (K) ${actualRec.statuses.kalium}`],
    ["🪨 Kapur Dolomit", actualRec.dolomit.perHa, actualRec.dolomit.totalKg, actualRec.dolomit.totalTon, Math.ceil(actualRec.dolomit.totalZak), `${actualRec.statuses.ph}`],
    ["🌱 Pupuk Kompos / Bahan Organik", actualRec.kompos.perHa, actualRec.kompos.totalKg, actualRec.kompos.totalTon, Math.ceil(actualRec.kompos.totalZak), `C-Organik ${actualRec.statuses.cOrganik}`],
    [""],
    ["TOTAL REKAPITULASI KEBUTUHAN KELOMPOK LAHAN"],
    ["Total Seluruh Kebutuhan", "", actualRec.totals.kg, actualRec.totals.ton, Math.ceil(actualRec.totals.zak), "zak berasaskan kemasan standar 50 kg"],
    [""],
    ["PETUNJUK APLIKASI LAPANGAN SEDERHANA UNTUK PETANI:"],
    ["1. Lakukan pengapuran kapur dolomit secara merata ketika pembajakan awal atau minimal 2-3 minggu sebelum pupuk kimia diaplikasikan."],
    ["2. Penaburan pupuk organik (kompos) dikerjakan sewaktu merapikan bedengan untuk memaksimalkan kapasitas tukar kation tanah."],
    ["3. Pupuk anorganik (Urea, SP-36, KCl) ditabur secara teratur dan bertahap disesuaikan dengan fase vegetative dan generative tanaman."]
  ];

  const ws5 = XLSX.utils.aoa_to_sheet(sheet5Data);
  ws5['!cols'] = [
    { wch: 32 }, // Bahan Pupuk
    { wch: 26 }, // Dosis
    { wch: 22 }, // Total Kg
    { wch: 22 }, // Total Ton
    { wch: 26 }, // Jumlah Zak
    { wch: 38 }  // Status Gizi
  ];

  // Create final workbook container
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws0, "METADATA");
  XLSX.utils.book_append_sheet(wb, ws1, "DATA_SAMPEL");
  XLSX.utils.book_append_sheet(wb, ws2, "RINGKASAN");
  XLSX.utils.book_append_sheet(wb, ws3, "REKOMENDASI");
  XLSX.utils.book_append_sheet(wb, ws4, "PUPUK_OTOMATIS");
  XLSX.utils.book_append_sheet(wb, ws5, "RENCANA_PEMUPUKAN");

  // Output file download
  XLSX.writeFile(wb, `Laporan_Riset_pH_AgriMap_${Date.now()}.xlsx`);
}

