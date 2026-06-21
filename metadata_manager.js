/**
 * AgriMap Lite - Research Metadata Management Module
 * Handles loading, saving, and auto-synced storage of research metadata in localStorage.
 */

const STORAGE_KEY = 'agrimap_research_metadata';

/**
 * @typedef {Object} ResearchMetadata
 * @property {string} judulPenelitian
 * @property {string} namaPeneliti
 * @property {string} instansi
 * @property {string} lokasiPenelitian
 * @property {string} komoditasUtama
 * @property {string} tahunPenelitian
 */

/**
 * Returns default metadata values
 * @returns {ResearchMetadata}
 */
export function getDefaultMetadata() {
  return {
    judulPenelitian: '',
    namaPeneliti: '',
    instansi: '',
    lokasiPenelitian: '',
    komoditasUtama: '',
    tahunPenelitian: new Date().getFullYear().toString(),
    luasLahan: 1.0
  };
}

/**
 * Loads research metadata from localStorage
 * @returns {ResearchMetadata}
 */
export function loadResearchMetadata() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all fields are initialized properly
      return {
        ...getDefaultMetadata(),
        ...parsed
      };
    }
  } catch (error) {
    console.error('Failed to load research metadata from localStorage:', error);
  }
  return getDefaultMetadata();
}

/**
 * Saves research metadata to localStorage
 * @param {ResearchMetadata} metadata 
 * @returns {boolean} True if successfully saved, false otherwise
 */
export function saveResearchMetadata(metadata) {
  try {
    if (!metadata) return false;
    const cleaned = {
      judulPenelitian: String(metadata.judulPenelitian || '').trim(),
      namaPeneliti: String(metadata.namaPeneliti || '').trim(),
      instansi: String(metadata.instansi || '').trim(),
      lokasiPenelitian: String(metadata.lokasiPenelitian || '').trim(),
      komoditasUtama: String(metadata.komoditasUtama || '').trim(),
      tahunPenelitian: String(metadata.tahunPenelitian || '').trim(),
      luasLahan: Math.max(0.01, parseFloat(metadata.luasLahan) || 1.0)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    return true;
  } catch (error) {
    console.error('Failed to save research metadata to localStorage:', error);
    return false;
  }
}
