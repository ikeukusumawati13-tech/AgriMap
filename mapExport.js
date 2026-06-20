/**
 * AgriMap Lite - High-Resolution Cartographic PNG Map Export Engine
 * Generates custom printable maps client-side using coordinate geometry.
 */

import { performIDW } from './interpolation.js';
import { classifyChiliSuitability, classifyCucumberSuitability } from './suitability.js';
import { getPHCategory } from './db.js';
import { loadResearchMetadata } from './metadata_manager.js';
import { getLatestGeostatsResult } from './spatial.js';
import { ordinaryKrigingSingle, buildKrigingMatrix } from './kriging.js';

/**
 * Generates and downloads a high-resolution PNG map for the selected layer.
 * @param {string} layerType - 'sebaran' | 'cabai' | 'mentimun' | 'kriging'
 * @param {Array} samples - List of soil samples
 */
export async function exportMapToPNG(layerType, samples) {
  if (!samples || samples.length === 0) {
    alert("Sampel data kosong. Silakan rekam atau tambahkan titik sampel terlebih dahulu.");
    return;
  }

  // 1. Create a high-resolution canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1230;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Fill white canvas background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Load research metadata
  const metadata = loadResearchMetadata();
  const dateStr = new Date().toLocaleString('id-ID');

  // Determine Map Sheet Title & Layers Info
  let mainTitle = "";
  let subtitleText = "";
  let legendTitle = "";
  let legendItems = [];

  // 2. Resolve calculations & labels based on layer selection
  const resolution = 50; // Higher resolution for crisp raster grids on export
  const { cells, stats } = performIDW(samples, resolution, 2);

  if (!stats) return;

  const { minLat, maxLat, minLng, maxLng } = stats;

  // Setup geostatistics fitting models if kriging is required
  let krigingA = null;
  let lastGeostatsResult = null;
  let originLat = 0;
  let originLng = 0;
  let latToMeters = 111320;
  let lngToMeters = 111320;

  if (layerType === 'kriging') {
    lastGeostatsResult = getLatestGeostatsResult();
    if (lastGeostatsResult && lastGeostatsResult.status === 'success') {
      krigingA = buildKrigingMatrix(lastGeostatsResult.projected, lastGeostatsResult.fittedModel);
      
      const sumLat = samples.reduce((acc, s) => acc + s.latitude, 0);
      const sumLng = samples.reduce((acc, s) => acc + s.longitude, 0);
      originLat = sumLat / samples.length;
      originLng = sumLng / samples.length;

      const rad = originLat * (Math.PI / 180);
      lngToMeters = 111320 * Math.cos(rad);
    }
  }

  if (layerType === 'sebaran') {
    mainTitle = "PETA SPASIAL SEBARAN PH TANAH (IDW)";
    subtitleText = "Interpolasi Spasial Kontinu Model Inverse Distance Weighting (IDW)";
    legendTitle = "Klasifikasi Reaksi pH";
    legendItems = [
      { color: '#ef4444', label: "Masam (pH < 5.5)" },
      { color: '#eab308', label: "Agak Masam (pH 5.5 - 6.5)" },
      { color: '#10b981', label: "Netral (pH 6.5 - 7.5)" },
      { color: '#3b82f6', label: "Basa (pH > 7.5)" }
    ];
  } else if (layerType === 'cabai') {
    mainTitle = "PETA KESESUAIAN KIMIAWI LAHAN TANAMAN CABAI MERAH";
    subtitleText = "Rekomendasi Distribusi Spasial Kesesuaian Komoditas Cabai Merah";
    legendTitle = "Tingkat Kesesuaian";
    legendItems = [
      { color: '#2d6a4f', label: "Sangat Sesuai (pH 6.1 - 6.8)" },
      { color: '#fbbf24', label: "Cukup Sesuai (pH 5.5 - 6.0)" },
      { color: '#f97316', label: "Kurang Sesuai (pH > 6.8)" },
      { color: '#ef4444', label: "Tidak Sesuai (pH < 5.5)" }
    ];
  } else if (layerType === 'mentimun') {
    mainTitle = "PETA KESESUAIAN KIMIAWI LAHAN TANAMAN MENTIMUN";
    subtitleText = "Rekomendasi Distribusi Spasial Kesesuaian Komoditas Mentimun";
    legendTitle = "Tingkat Kesesuaian";
    legendItems = [
      { color: '#10b981', label: "Sangat Sesuai (pH 6.1 - 7.0)" },
      { color: '#fbbf24', label: "Cukup Sesuai (pH 5.5 - 6.0)" },
      { color: '#3b82f6', label: "Kurang Sesuai (pH > 7.0)" },
      { color: '#ef4444', label: "Tidak Sesuai (pH < 5.5)" }
    ];
  } else if (layerType === 'kriging') {
    mainTitle = "PETA PREDIKSI ESTIMASI pH TANAH (ORDINARY KRIGING)";
    subtitleText = "Uji Semivariogram Spasial Kontinu Dengan Model Ordinary Kriging";
    legendTitle = "Acuan Estimasi pH";
    legendItems = [
      { color: '#ef4444', label: "Masam (pH < 5.5)" },
      { color: '#eab308', label: "Agak Masam (pH 5.5 - 6.5)" },
      { color: '#10b981', label: "Netral (pH 6.5 - 7.5)" },
      { color: '#3b82f6', label: "Basa (pH > 7.5)" }
    ];
  }

  // 3. DRAW FRAME OUTLINES & BORDERS
  // Outer Border Line
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#1e293b"; // Slate-800
  ctx.strokeRect(30, 30, 1540, 1170);

  // Divide Map (Left) and Sidebar (Right)
  const mapWidthBorderX = 1220;
  ctx.beginPath();
  ctx.moveTo(mapWidthBorderX, 30);
  ctx.lineTo(mapWidthBorderX, 1200);
  ctx.stroke();

  // Divide Header from Map Content Area
  const headerDivideY = 125;
  ctx.beginPath();
  ctx.moveTo(30, headerDivideY);
  ctx.lineTo(mapWidthBorderX, headerDivideY);
  ctx.stroke();

  // Footer Metadata Bottom of Sidebar Divide
  ctx.beginPath();
  ctx.moveTo(mapWidthBorderX, 1140);
  ctx.lineTo(1570, 1140);
  ctx.stroke();


  // 4. DRAW HEADER (Title & Subtitle Field Context)
  ctx.fillStyle = "#1b4332"; // Elegant Forest Green
  ctx.fillRect(32, 32, mapWidthBorderX - 33, headerDivideY - 33);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  
  // Title
  ctx.font = "bold 26px 'Arimo', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(mainTitle, 55, 62);

  // Subtitle
  ctx.font = "italic 14px 'Arimo', Arial, sans-serif";
  ctx.fillStyle = "#a7f3d0"; // emerald-200
  ctx.fillText(subtitleText, 55, 95);


  // 5. MAP COORDINATES PROJECTION LOGIC
  // Frame coordinates viewport boundaries
  const mapXMin = 50;
  const mapYMin = headerDivideY + 25;
  const mapXMax = mapWidthBorderX - 30;
  const mapYMax = 1170;

  const mapW = mapXMax - mapXMin; // 1140
  const mapH = mapYMax - mapYMin; // 1020

  const boundsWidth = maxLng - minLng;
  const boundsHeight = maxLat - minLat;
  const midLatVal = (minLat + maxLat) / 2;
  const cosLatFactor = Math.cos(midLatVal * Math.PI / 180);

  const geoWidthAdjusted = boundsWidth * cosLatFactor;
  const scaleX = mapW / geoWidthAdjusted;
  const scaleY = mapH / boundsHeight;
  const scale = Math.min(scaleX, scaleY) * 0.88; // 88% scale for breathing room margins

  const mapCenterX = mapXMin + mapW / 2;
  const mapCenterY = mapYMin + mapH / 2;
  const geoCenterX = (minLng + maxLng) / 2;
  const geoCenterY = (minLat + maxLat) / 2;

  function toCanvasX(lng) {
    const deltaLng = lng - geoCenterX;
    return mapCenterX + (deltaLng * cosLatFactor * scale);
  }

  function toCanvasY(lat) {
    const deltaLat = lat - geoCenterY;
    return mapCenterY - (deltaLat * scale); // screen inverted
  }

  // Draw grid cells continuously
  cells.forEach(cell => {
    const { lat1, lng1, lat2, lng2, centerLat, centerLng, ph } = cell;

    // Convert coordinates to canvas spaces
    const xLeft = toCanvasX(lng1);
    const yTop = toCanvasY(lat2);
    const xRight = toCanvasX(lng2);
    const yBottom = toCanvasY(lat1);

    // Calculate width and height
    const cellWidth = xRight - xLeft;
    const cellHeight = yBottom - yTop;

    // Get color for corresponding cell
    let activeColor = "#f1f5f9";
    if (layerType === 'sebaran') {
      activeColor = getPHCategory(ph).color;
    } else if (layerType === 'cabai') {
      activeColor = classifyChiliSuitability(ph).color;
    } else if (layerType === 'mentimun') {
      activeColor = classifyCucumberSuitability(ph).color;
    } else if (layerType === 'kriging') {
      let krigPh = ph;
      if (lastGeostatsResult && lastGeostatsResult.status === 'success') {
        const targetX = (centerLng - originLng) * lngToMeters;
        const targetY = (centerLat - originLat) * latToMeters;
        const krigRes = ordinaryKrigingSingle(targetX, targetY, lastGeostatsResult.projected, lastGeostatsResult.fittedModel, krigingA);
        if (krigRes) {
          krigPh = krigRes.prediction;
        }
      }
      activeColor = getPHCategory(krigPh).color;
    }

    ctx.fillStyle = activeColor;
    // Overlap slightly to prevent gaps (antialias raster issue)
    ctx.fillRect(xLeft - 0.5, yTop - 0.5, cellWidth + 1.0, cellHeight + 1.0);
  });

  // 6. DRAW WATERMARK/GRATICULES/GRID LABELS
  ctx.strokeStyle = "rgba(100, 116, 139, 0.25)"; // light grid lines
  ctx.lineWidth = 0.5;
  ctx.fillStyle = "#64748b"; // labels color
  ctx.font = "bold 10px 'JetBrains Mono', Courier, monospace";

  const numGridLines = 5;
  for (let i = 0; i <= numGridLines; i++) {
    // Latitude Lines
    const stepLat = minLat + (boundsHeight * (i / numGridLines));
    const yStep = toCanvasY(stepLat);
    ctx.beginPath();
    ctx.moveTo(mapXMin, yStep);
    ctx.lineTo(mapXMax, yStep);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillText(`${stepLat.toFixed(4)}°S`, mapXMin + 10, yStep - 4);

    // Longitude Lines
    const stepLng = minLng + (boundsWidth * (i / numGridLines));
    const xStep = toCanvasX(stepLng);
    ctx.beginPath();
    ctx.moveTo(xStep, mapYMin);
    ctx.lineTo(xStep, mapYMax);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillText(`${stepLng.toFixed(4)}°E`, xStep, mapYMax - 10);
  }

  // Draw solid map viewport boundary frame
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapXMin, mapYMin, mapW, mapH);


  // 7. PLOT SAMPLE POINTS
  samples.forEach((sample) => {
    const { name, latitude, longitude, ph } = sample;
    const x = toCanvasX(longitude);
    const y = toCanvasY(latitude);

    const cat = getPHCategory(ph);

    // Draw Drop Shadow Circle
    ctx.shadowColor = "rgba(15, 23, 42, 0.4)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    // Draw white background
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, 2 * Math.PI);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw Color Inner Circle
    ctx.fillStyle = cat.color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Draw outer stroke
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw Sample Name text and pH value above point
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 9px 'Arimo', Arial, sans-serif";
    ctx.textAlign = "center";
    
    // Clean name label
    let cleanName = sample.nama || sample.name || "Titik";
    if (cleanName.length > 20) {
      cleanName = cleanName.substring(0, 18) + "...";
    }
    
    ctx.fillText(`${cleanName} (pH ${ph.toFixed(1)})`, x, y - 16);
  });


  // 8. NORTH ARROW
  // Place compass at top-left inside map viewport frame
  const northX = mapXMin + 60;
  const northY = mapYMin + 75;

  // Star symbol / Compass rose drafting
  ctx.save();
  ctx.translate(northX, northY);

  // Black (left/west) Needle
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(-8, 5);
  ctx.lineTo(0, 0);
  ctx.fill();

  // White/Red (right/east) Needle
  ctx.fillStyle = "#ef4444"; // Traditional red compass direction
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(8, 5);
  ctx.lineTo(0, 0);
  ctx.fill();

  // South Dark Point
  ctx.fillStyle = "#64748b";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-6, 5);
  ctx.lineTo(0, 25);
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, 5);
  ctx.lineTo(0, 25);
  ctx.fill();

  // North 'U' (Utara) symbol
  ctx.fillStyle = "#1e293b";
  ctx.font = "black 14px 'Arimo', 'Helvetica Neue', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("U", 0, -38);

  ctx.restore();


  // 9. SCALE BAR
  // Calculate viewport width in meters
  const widthInDegrees = maxLng - minLng;
  const originLatMid = (minLat + maxLat) / 2;
  const degToRad = originLatMid * (Math.PI / 185);
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos(degToRad);

  const realWidthMeters = widthInDegrees * mPerLng;

  // Determine a rounded nice scale division size (e.g., 200m, 500m, 1km, 2km)
  let scaleDistanceMeters = 500;
  let scaleDistanceLabel = "500 m";

  if (realWidthMeters > 15000) {
    scaleDistanceMeters = 5000;
    scaleDistanceLabel = "5 km";
  } else if (realWidthMeters > 6000) {
    scaleDistanceMeters = 2000;
    scaleDistanceLabel = "2 km";
  } else if (realWidthMeters > 3000) {
    scaleDistanceMeters = 1000;
    scaleDistanceLabel = "1 km";
  } else if (realWidthMeters < 800) {
    scaleDistanceMeters = 100;
    scaleDistanceLabel = "100 m";
  } else if (realWidthMeters < 1500) {
    scaleDistanceMeters = 250;
    scaleDistanceLabel = "250 m";
  }

  // Map scale length to canvas screen width proportion
  const scalePercent = scaleDistanceMeters / realWidthMeters;
  const scaleBarWidthPx = mapW * scalePercent;

  // Render Scale Bar at bottom-left inside frame
  const scaleBarX = mapXMin + 30;
  const scaleBarY = mapYMax - 35;

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.5;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 9px 'JetBrains Mono', Courier, monospace";

  // Segment 1 (Black/White checker style)
  ctx.fillStyle = "#000000";
  ctx.fillRect(scaleBarX, scaleBarY, scaleBarWidthPx / 2, 6);
  ctx.fillStyle = "#ffffff";
  ctx.strokeRect(scaleBarX, scaleBarY, scaleBarWidthPx / 2, 6);

  // Segment 2
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(scaleBarX + scaleBarWidthPx / 2, scaleBarY, scaleBarWidthPx / 2, 6);
  ctx.strokeRect(scaleBarX + scaleBarWidthPx / 2, scaleBarY, scaleBarWidthPx / 2, 6);

  // End Lines and Text
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.fillText("0", scaleBarX, scaleBarY - 6);
  ctx.fillText((scaleDistanceMeters / 2) >= 1000 ? `${(scaleDistanceMeters / 2000).toFixed(1)} km` : `${scaleDistanceMeters / 2} m`, scaleBarX + scaleBarWidthPx / 2, scaleBarY - 6);
  ctx.fillText(scaleDistanceLabel, scaleBarX + scaleBarWidthPx, scaleBarY - 6);
  ctx.textAlign = "left";
  ctx.fillText(`Metrik Proyeksi Lokal`, scaleBarX + scaleBarWidthPx + 15, scaleBarY + 5);


  // 10. DRAW RIGHT COLUMN (MAP LEGEND, INSTITUTION, METADATA)
  const sidebarX = mapWidthBorderX + 25;
  let textY = 70;

  // Box 1: LOGO FIELD & INSTITUTION NAME
  ctx.fillStyle = "#2d6a4f"; // Emerald green
  ctx.fillRect(sidebarX, 50, 60, 50);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.fillText("AML", sidebarX + 30, 82);

  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left";
  ctx.font = "bold 13px 'Arimo', Arial, sans-serif";
  ctx.fillText("LAPORAN SPASIAL AGRIMAP", sidebarX + 75, 68);
  ctx.font = "normal 10px Arial, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Sistem Evaluasi Geostatistik Lahan", sidebarX + 75, 88);

  ctx.beginPath();
  ctx.strokeStyle = "#cbd5e1"; // slate-200
  ctx.moveTo(sidebarX, 120);
  ctx.lineTo(1545, 120);
  ctx.stroke();

  // Box 2: IDENTITAS PENELITIAN
  textY = 150;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px 'Arimo', Arial, sans-serif";
  ctx.fillText("I. IDENTITAS PENELITIAN", sidebarX, textY);

  const metaFields = [
    ["Judul Penelitian", metadata.judulPenelitian || "Kajian Kualitas Lahan Pertanian"],
    ["Peneliti", metadata.namaPeneliti || "Penyuluh / Peneliti Lapangan"],
    ["Instansi", metadata.instansi || "BPP Sleman / Lembaga Mitra"],
    ["Lokasi Lahan", metadata.lokasiPenelitian || "Sleman, Yogyakarta"],
    ["Komoditas", metadata.komoditasUtama || "Cabai & Mentimun"],
    ["Tahun", metadata.tahunPenelitian || new Date().getFullYear().toString()]
  ];

  textY += 28;
  metaFields.forEach((field) => {
    ctx.fillStyle = "#475569";
    ctx.font = "bold 10px 'Arimo', Arial, sans-serif";
    ctx.fillText(field[0], sidebarX, textY);

    ctx.fillStyle = "#0f172a";
    ctx.font = "normal 10px Arial, sans-serif";
    
    // Auto-wrap very long title fields in sidebar
    let valueStr = field[1];
    if (valueStr.length > 38) {
      valueStr = valueStr.substring(0, 35) + "...";
    }
    ctx.fillText(valueStr, sidebarX, textY + 15);
    textY += 34;
  });

  ctx.beginPath();
  ctx.strokeStyle = "#cbd5e1";
  ctx.moveTo(sidebarX, textY - 10);
  ctx.lineTo(1545, textY - 10);
  ctx.stroke();

  // Box 3: LEGENDA SPASIAL
  textY += 15;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px 'Arimo', Arial, sans-serif";
  ctx.fillText(`II. LEGENDA: ${legendTitle.toUpperCase()}`, sidebarX, textY);

  textY += 25;
  legendItems.forEach((item) => {
    // Suitability/pH Color Legend Indicator Box
    ctx.fillStyle = item.color;
    ctx.fillRect(sidebarX, textY - 12, 28, 16);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(sidebarX, textY - 12, 28, 16);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.fillText(item.label, sidebarX + 38, textY);
    textY += 28;
  });

  ctx.beginPath();
  ctx.strokeStyle = "#cbd5e1";
  ctx.moveTo(sidebarX, textY - 10);
  ctx.lineTo(1545, textY - 10);
  ctx.stroke();

  // Box 4: RINGKASAN DATA
  textY += 15;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px 'Arimo', Arial, sans-serif";
  ctx.fillText("III. AKURASI & REKAP DATA", sidebarX, textY);

  const phs = samples.map(s => s.ph);
  const minPh = Math.min(...phs);
  const maxPh = Math.max(...phs);
  const avgPh = phs.reduce((a, b) => a + b, 0) / phs.length;

  const statsFields = [
    ["Total Titik Sampel", `${samples.length} Sampel Terdaftar`],
    ["Rentang pH Terbaca", `${minPh.toFixed(1)} - ${maxPh.toFixed(1)}`],
    ["Nilai Rata-Rata pH", `${avgPh.toFixed(2)} (${getPHCategory(avgPh).label})`],
    ["Penyusunan Peta", "Proyeksi Flat Mercator Grid"]
  ];

  textY += 25;
  statsFields.forEach((stat) => {
    ctx.fillStyle = "#475569";
    ctx.font = "normal 10px 'Arimo', Arial, sans-serif";
    ctx.fillText(stat[0], sidebarX, textY);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 10px 'JetBrains Mono', Courier, monospace";
    ctx.fillText(stat[1], sidebarX + 130, textY);
    textY += 22;
  });

  // Box 5: BOTTOM SIDEBAR COPYRIGHT
  const bottomBoxY = 1145;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 10px 'Arimo', Arial, sans-serif";
  ctx.fillText("IV. CETAK & INTEGRITAS", sidebarX, bottomBoxY + 16);

  ctx.fillStyle = "#64748b";
  ctx.font = "normal 9.5px Arial, sans-serif";
  ctx.fillText(`Ekspor: ${dateStr}`, sidebarX, bottomBoxY + 34);
  ctx.fillText("Agrimap Lite - Pemetaan Handal Offline", sidebarX, bottomBoxY + 47);


  // 11. TRIGGER DOWNLOAD ACTION
  try {
    const dataURL = canvas.toDataURL('image/png');
    const filename = `PETA_${layerType.toUpperCase()}_AGRIMAP_${Date.now()}.png`;

    const downloadLink = document.createElement('a');
    downloadLink.href = dataURL;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  } catch (error) {
    console.error("Gagal mendownload peta PNG:", error);
    alert("Terjadi kesalahan teknis saat merender peta beresolusi tinggi ke PNG.");
  }
}
