/**
 * AgriMap Lite - IndexedDB Database Management
 * Handles offline local storage for field soil pH records.
 */

const DB_NAME = 'AgriMapLiteDB';
const DB_VERSION = 1;
const STORE_NAME = 'soil_samples';

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // We use an auto-incrementing keypath 'id'
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        // Create indexes for efficient querying if needed
        store.createIndex('nama', 'nama', { unique: false });
        store.createIndex('ph', 'ph', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(`Database error: ${event.target.error?.message || 'Unknown error'}`);
    };
  });
}

/**
 * Adds a new soil sample to the database.
 * @param {Object} sample The soil sample object
 * @returns {Promise<number>} Resolves with the generated auto-increment ID
 */
export function addSample(sample) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Ensure data types are correct
      const cleanedSample = {
        nama: sample.nama || 'Titik Tanpa Nama',
        latitude: parseFloat(sample.latitude),
        longitude: parseFloat(sample.longitude),
        ph: parseFloat(sample.ph),
        timestamp: sample.timestamp || Date.now(),
        catatan: sample.catatan || ''
      };

      const request = store.add(cleanedSample);

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        reject(`Gagal menyimpan sampel: ${event.target.error?.message}`);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves all soil samples.
 * @returns {Promise<Array>} A list of soil samples
 */
export function getAllSamples() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event) => {
        // Sort by timestamp descending so newest is on top
        const results = event.target.result || [];
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };

      request.onerror = (event) => {
        reject(`Gagal mengambil data: ${event.target.error?.message}`);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Updates an existing soil sample.
 * @param {number} id The ID of the sample to update
 * @param {Object} sample The updated sample object
 * @returns {Promise<void>}
 */
export function updateSample(id, sample) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const cleanedSample = {
        id: Number(id),
        nama: sample.nama || 'Titik Tanpa Nama',
        latitude: parseFloat(sample.latitude),
        longitude: parseFloat(sample.longitude),
        ph: parseFloat(sample.ph),
        timestamp: sample.timestamp || Date.now(),
        catatan: sample.catatan || ''
      };

      const request = store.put(cleanedSample);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(`Gagal memperbarui sampel: ${event.target.error?.message}`);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes a soil sample.
 * @param {number} id The ID of the sample to delete
 * @returns {Promise<void>}
 */
export function deleteSample(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(Number(id));

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(`Gagal menghapus sampel: ${event.target.error?.message}`);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper to analyze the pH categories based on the requirements:
 * < 5.5 = Masam
 * 5.5 - 6.5 = Agak Masam
 * 6.5 - 7.5 = Netral
 * > 7.5 = Basa
 * @param {number} ph
 * @returns {Object} Category info (label, color, description)
 */
export function getPHCategory(ph) {
  if (ph < 5.5) {
    return {
      label: 'Masam',
      color: '#ef4444', // red-500
      bgClass: 'bg-red-50 text-red-700 border-red-200',
      fillColor: '#fecaca', // red-200
      badgeColor: 'bg-red-100 text-red-800'
    };
  } else if (ph >= 5.5 && ph <= 6.5) {
    return {
      label: 'Agak Masam',
      color: '#eab308', // yellow-500
      bgClass: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      fillColor: '#fef9c3', // yellow-200
      badgeColor: 'bg-yellow-100 text-yellow-800'
    };
  } else if (ph > 6.5 && ph <= 7.5) {
    return {
      label: 'Netral',
      color: '#10b981', // emerald-500
      bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      fillColor: '#a7f3d0', // emerald-200
      badgeColor: 'bg-emerald-100 text-emerald-800'
    };
  } else {
    return {
      label: 'Basa',
      color: '#3b82f6', // blue-500
      bgClass: 'bg-blue-50 text-blue-700 border-blue-200',
      fillColor: '#bfdbfe', // blue-200
      badgeColor: 'bg-blue-100 text-blue-800'
    };
  }
}

/**
 * Seed databases with helpful sample data centered around agricultural regions in Indonesia.
 * Helps the user immediately see a populated map and summary statistics.
 */
export async function seedDummyData() {
  const dummySamples = [
    { nama: 'Lahan Cabai - Sleman Barat', latitude: -7.7212, longitude: 110.3125, ph: 5.8, catatan: 'Pertumbuhan cabai sedang, sebagian daun menguning. Perlu tambahan pupuk organik.' },
    { nama: 'Lahan Mentimun - Piyungan', latitude: -7.8344, longitude: 110.4567, ph: 6.8, catatan: 'Kualitas tanaman sangat subur. Hasil buah melimpah dan renyah.' },
    { nama: 'Lahan Cabai - Pakem Tinggi', latitude: -7.6652, longitude: 110.4182, ph: 4.8, catatan: 'Tanah terlalu asam karena intensitas hujan tinggi. Direkomendasikan menambah kapur dolomit 2 ton/ha.' },
    { nama: 'Kebun Penelitian - Kalasan', latitude: -7.7719, longitude: 110.4902, ph: 6.3, catatan: 'Cocok sekali untuk tanaman cabai maupun mentimun.' },
    { nama: 'Lahan Pasir Pantai - Bantul', latitude: -7.9942, longitude: 110.3341, ph: 7.8, catatan: 'Tanah berkapur pantai cenderung basa. Memerlukan penyesuaian pH dengan amonium sulfat.' },
    { nama: 'Hortikultura - Wonosari', latitude: -7.9621, longitude: 110.6012, ph: 7.1, catatan: 'Kondisi tanah netral, sangat seimbang.' }
  ];

  for (const sample of dummySamples) {
    await addSample(sample);
  }
}
