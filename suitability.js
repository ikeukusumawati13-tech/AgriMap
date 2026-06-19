/**
 * AgriMap Lite - Agronomic Suitability Classification Engine
 * Evaluates land suitability zones for Chili (cabai) and Cucumber (mentimun) crops based on pH levels.
 */

/**
 * Classifies soil pH suitability for Cabai (Chili Peppers).
 * Klasifikasi:
 * - Tidak Sesuai: pH < 5.5
 * - Cukup Sesuai: pH 5.5 - 6.0
 * - Sangat Sesuai: pH 6.0 - 6.8
 * - Kurang Sesuai: pH > 6.8
 * 
 * @param {number} ph - Soil acidity level
 * @returns {Object} { status: string, color: string, isHighlySuitable: boolean, isSuitable: boolean }
 */
export function classifyChiliSuitability(ph) {
  if (ph < 5.5) {
    return {
      status: 'Tidak Sesuai',
      color: '#ef4444', // Red-500
      colorHex: '#ef4444',
      isHighlySuitable: false,
      isSuitable: false,
      description: 'Pertumbuhan terhambat. Risiko toksisitas Aluminium dan Defisiensi Fosfor tinggi.'
    };
  } else if (ph >= 5.5 && ph <= 6.0) {
    return {
      status: 'Cukup Sesuai',
      color: '#fbbf24', // Amber-400
      colorHex: '#fbbf24',
      isHighlySuitable: false,
      isSuitable: true,
      description: 'Lahan marginal produktif. Berikan pupuk nitrogen perlahan untuk merangsang akar.'
    };
  } else if (ph > 6.0 && ph <= 6.8) {
    return {
      status: 'Sangat Sesuai',
      color: '#2d6a4f', // Clean Minimalism primary green
      colorHex: '#2d6a4f',
      isHighlySuitable: true,
      isSuitable: true,
      description: 'Sangat prima! Penyerapan kalsium (Ca), magnesium (Mg) dan hara nitrogen optimum.'
    };
  } else {
    // Kurang Sesuai (> 6.8)
    return {
      status: 'Kurang Sesuai',
      color: '#f97316', // Orange-500
      colorHex: '#f97316',
      isHighlySuitable: false,
      isSuitable: true,
      description: 'Sedikit alkali. Unsur hara mikro seng dan besi cenderung terikat erat.'
    };
  }
}

/**
 * Classifies soil pH suitability for Mentimun (Cucumber).
 * Klasifikasi:
 * - Tidak Sesuai: pH < 5.5
 * - Cukup Sesuai: pH 5.5 - 6.0
 * - Sangat Sesuai: pH 6.0 - 7.0
 * - Kurang Sesuai: pH > 7.0
 * 
 * @param {number} ph - Soil acidity level
 * @returns {Object} { status: string, color: string, isHighlySuitable: boolean, isSuitable: boolean }
 */
export function classifyCucumberSuitability(ph) {
  if (ph < 5.5) {
    return {
      status: 'Tidak Sesuai',
      color: '#ef4444', // Red-500
      colorHex: '#ef4444',
      isHighlySuitable: false,
      isSuitable: false,
      description: 'Sangat rawan layu bakteri dan tanaman kerdil.'
    };
  } else if (ph >= 5.5 && ph <= 6.0) {
    return {
      status: 'Cukup Sesuai',
      color: '#fbbf24', // Amber-400
      colorHex: '#fbbf24',
      isHighlySuitable: false,
      isSuitable: true,
      description: 'Tanaman tumbuh cukup teratur, pertahankan tata Kelola air mikro.'
    };
  } else if (ph > 6.0 && ph <= 7.0) {
    return {
      status: 'Sangat Sesuai',
      color: '#10b981', // Solid emerald-500
      colorHex: '#10b981',
      isHighlySuitable: true,
      isSuitable: true,
      description: 'Zonasi tanah netral terbaik untuk buah mentimun yang kokoh.'
    };
  } else {
    // Kurang Sesuai (> 7.0)
    return {
      status: 'Kurang Sesuai',
      color: '#3b82f6', // Blue-500 (representing alkaline/lime heavy soil)
      colorHex: '#3b82f6',
      isHighlySuitable: false,
      isSuitable: true,
      description: 'Kadar zat kapur terlalu tinggi, campur pupuk organik dengan baik.'
    };
  }
}
