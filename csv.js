/**
 * AgriMap Lite - CSV Parser & Exporter Module
 * Handles importing and exporting specialized research data files.
 */

import { classifyChiliSuitability, classifyCucumberSuitability } from './suitability.js';

/**
 * Parses seed or imported research CSV content.
 * Accepts format: nama,latitude,longitude,ph
 * 
 * @param {string} text - Raw CSV content
 * @returns {Array<Object>} List of valid parsed sample objects
 */
export function parseResearchCSV(text) {
  if (!text) return { validSamples: [], successCount: 0, failCount: 0 };

  const lines = text.split(/\r?\n/);
  const validSamples = [];
  let successCount = 0;
  let failCount = 0;

  let isHeaderParsed = false;
  let headersMap = { nama: 0, latitude: 1, longitude: 2, ph: 3 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty rows

    // Simple robust CSV tokenizer splitting by commas not inside quotes (if any)
    const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => {
      let cleaned = c.trim();
      // Strip outer quotes if present
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
      }
      return cleaned;
    });

    // Check if the current line is the header
    if (!isHeaderParsed) {
      const lowerCols = columns.map(col => col.toLowerCase());
      // Detect indices if header is present
      const hasNama = lowerCols.includes('nama') || lowerCols.includes('name');
      const hasLat = lowerCols.includes('latitude') || lowerCols.includes('lat');
      const hasLng = lowerCols.includes('longitude') || lowerCols.includes('lng');
      const hasPh = lowerCols.includes('ph') || lowerCols.includes('phvalue');

      if (hasNama || hasLat || hasLng || hasPh) {
        // Map headers dynamically
        headersMap.nama = Math.max(0, lowerCols.findIndex(c => c === 'nama' || c === 'name'));
        headersMap.latitude = Math.max(0, lowerCols.findIndex(c => c === 'latitude' || c === 'lat'));
        headersMap.longitude = Math.max(0, lowerCols.findIndex(c => c === 'longitude' || c === 'lng'));
        headersMap.ph = Math.max(0, lowerCols.findIndex(c => c === 'ph' || c === 'phvalue'));
        isHeaderParsed = true;
        continue;
      }
      
      // If no valid headers are found, assume it is direct data mapping to our default indices
      isHeaderParsed = true; 
    }

    // Ensure we have enough columns
    if (columns.length < 4) {
      failCount++;
      continue;
    }

    const name = columns[headersMap.nama];
    const rawLat = columns[headersMap.latitude];
    const rawLng = columns[headersMap.longitude];
    const rawPh = columns[headersMap.ph];

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
        catatan: `Impor CSV Penelitian (${new Date().toLocaleDateString('id')})`,
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
 * Downloads a specialized research CSV dataset
 * Format: nama,latitude,longitude,ph,kategori cabai,kategori mentimun
 * 
 * @param {Array<Object>} samples - All database samples
 */
export function exportResearchDataCSV(samples) {
  if (!samples || samples.length === 0) return false;

  const headers = ['nama', 'latitude', 'longitude', 'ph', 'kategori cabai', 'kategori mentimun'];
  const rows = [headers.join(',')];

  samples.forEach(s => {
    const chiliClass = classifyChiliSuitability(s.ph);
    const cucumberClass = classifyCucumberSuitability(s.ph);

    // Escape values containing commas or quotes
    const escape = (val) => {
      const str = String(val === undefined || val === null ? '' : val);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const row = [
      escape(s.nama),
      s.latitude.toFixed(6),
      s.longitude.toFixed(6),
      s.ph.toFixed(2),
      escape(chiliClass.status),
      escape(cucumberClass.status)
    ];

    rows.push(row.join(','));
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(rows.join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', `agrimap_data_penelitian_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return true;
}
