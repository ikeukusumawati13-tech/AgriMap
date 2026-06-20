/**
 * AgriMap Lite - Excel Processing Module
 * Handles creation of the user-friendly Excel templates and parses uploaded Excel (.xlsx) files.
 */

import * as XLSX from 'xlsx';
import { loadResearchMetadata } from './metadata_manager.js';

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
      "pH": 6.5 
    },
    { 
      "Nama Titik": "Titik Log 2 - Tepian Parit", 
      "Latitude": -7.35200, 
      "Longitude": 108.30200, 
      "pH": 5.2 
    },
    { 
      "Nama Titik": "Titik Log 3 - Dekat Sumur", 
      "Latitude": -7.35300, 
      "Longitude": 108.30300, 
      "pH": 7.8 
    }
  ];

  const wsData = XLSX.utils.json_to_sheet(sampleData);

  // Set visual column widths for sample data
  wsData['!cols'] = [
    { wch: 25 }, // Nama Titik
    { wch: 15 }, // Latitude
    { wch: 15 }, // Longitude
    { wch: 10 }  // pH
  ];

  // 2. Create help sheet (PETUNJUK)
  const instructionsData = [
    ["PANDUAN PENGISIAN TEMPLATE DATA SPASIAL pH TANAH (AGRIMAP LITE)"],
    [""],
    ["Target Pengguna:", "Guru, Mahasiswa, Penyuluh Pertanian, & Peneliti Lapangan"],
    ["Dokumen Dibuat:", new Date().toLocaleDateString('id')],
    ["Status Berkas:", "Siap Digunakan (Template Resmi)"],
    [""],
    ["KOLOM", "DESKRIPSI", "CONTOH", "SYARAT KEVALIDAN DATA"],
    ["Nama Titik", "Nama identitas unik lokasi pengukuran sampel pH.", "Lahan Utara 01", "Wajib diisi, tidak boleh kosong."],
    ["Latitude", "Koordinat lintang lokasi (garis lintang desimal GPS).", "-7.35123", "Nilai angka desimal antara -90 hingga 90."],
    ["Longitude", "Koordinat bujur lokasi (garis bujur desimal GPS).", "108.30145", "Nilai angka desimal antara -180 hingga 180."],
    ["pH", "Tingkat keasaman tanah hasil uji pH.", "6.2", "Angka desimal/bulat antara 0.0 hingga 14.0."],
    [""],
    ["PETUNJUK ALUR INSTALASI DATA:"],
    ["1. Buka Sheet 'DATA_SAMPEL' di bagian bawah Excel ini."],
    ["2. Ganti atau hapus data contoh yang sudah disediakan."],
    ["3. Isi data Anda sesuai dengan kolom yang disediakan."],
    ["4. Gunakan tanda TITIK (.) sebagai pemisah pecahan/desimal (Jangan koma) pada kolom Latitude, Longitude, dan pH."],
    ["5. JANGAN mengubah judul kolom pada baris pertama (Nama Titik, Latitude, Longitude, pH)!"],
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

    const name = nameKey ? row[nameKey] : undefined;
    const rawLat = latKey ? row[latKey] : undefined;
    const rawLng = lngKey ? row[lngKey] : undefined;
    const rawPh = phKey ? row[phKey] : undefined;

    // Check if there is some data in the row to avoid counting blank template rows as fails
    const hasSomeData = (name !== undefined) || (rawLat !== undefined) || (rawLng !== undefined) || (rawPh !== undefined);
    if (!hasSomeData) {
      continue;
    }

    const parsedLat = parseFloat(rawLat);
    const parsedLng = parseFloat(rawLng);
    const parsedPh = parseFloat(rawPh);

    const hasValidName = name !== undefined && name !== null && String(name).trim() !== '';
    const hasValidLat = !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90;
    const hasValidLng = !isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180;
    const hasValidPh = !isNaN(parsedPh) && parsedPh >= 0 && parsedPh <= 14;

    if (hasValidName && hasValidLat && hasValidLng && hasValidPh) {
      validSamples.push({
        nama: String(name).trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        ph: parsedPh,
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
    "pH": sample.ph
  }));

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);

  // Set nice column widths for sheet 2
  ws1['!cols'] = [
    { wch: 8 },   // No
    { wch: 32 },  // Nama Titik
    { wch: 18 },  // Latitude
    { wch: 18 },  // Longitude
    { wch: 10 }   // pH
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

  // Create final workbook container
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws0, "METADATA");
  XLSX.utils.book_append_sheet(wb, ws1, "DATA_SAMPEL");
  XLSX.utils.book_append_sheet(wb, ws2, "RINGKASAN");
  XLSX.utils.book_append_sheet(wb, ws3, "REKOMENDASI");

  // Output file download
  XLSX.writeFile(wb, `Laporan_Riset_pH_AgriMap_${Date.now()}.xlsx`);
}

