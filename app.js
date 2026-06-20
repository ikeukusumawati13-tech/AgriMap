/**
 * AgriMap Lite - Frontend Coordination Engine
 * Main JavaScript controller for forms, tables, database events, GPS, and service workers.
 */

import { 
  addSample, 
  getAllSamples, 
  updateSample, 
  deleteSample, 
  clearAllSamples,
  getPHCategory, 
  seedDummyData 
} from './db.js';

import { 
  initMap, 
  updateMapMarkers, 
  focusOnCoords, 
  evaluateCropCompatibility,
  getMapInstance,
  getMarkerLayerGroup
} from './map.js';

import {
  recalculateSpatialLayers,
  getSpatialStats,
  getSpatialLayerGroups,
  getLatestGeostatsResult
} from './spatial.js';

import {
  generatePDFReport,
  parseResearchCSV,
  exportResearchDataCSV
} from './report.js';

import {
  downloadExcelTemplate,
  parseExcelData,
  exportResearchDataExcel
} from './excel.js';

import {
  loadResearchMetadata,
  saveResearchMetadata
} from './metadata_manager.js';

import { exportMapToPNG } from './mapExport.js';

// Global application state
let allSamplesState = [];
let deferredInstallPrompt = null;

// Photo storage buffers (Base64 downscaled strings)
let currentFotoLokasi = '';
let currentFotoTanaman = '';
let currentFotoTanah = '';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('AgriMap Lite - Memulai inisialisasi aplikasi...');

  // 1. Initialize PWA Service Worker (Offline Capabilities)
  registerServiceWorker();

  // 2. Initialize Leaflet Map
  initMapContainer();

  // 3. Connect Input Form Events (Sync Slider with Number Input, Live Preview)
  setupFormEventListeners();

  // 3b. Setup Soil Sample Photo Triggers
  setupPhotoHandlers();

  // 4. GPS Geolocation Listener
  setupGPSHandler();

  // 5. Setup Action Buttons (Recenter, Seed, Purge, Export, Search, Import)
  setupInteractiveButtons();

  // 5b. Setup Research Metadata Panel (Auto-saves and persists)
  setupResearchMetadata();

  // 6. Refresh statistics, table grid, map pins from database
  await reloadAppData();
});

/* -------------------------------------------------------------
   PWA SERVICE WORKER HANDLER
   ------------------------------------------------------------- */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker terdaftar sukses dengan scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker gagal terdaftar:', error);
        });
    });
  }

  // Monitor Connection Status dynamically
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // Sniff PWA installability
  window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent the mini-infobar from appearing on mobile
    event.preventDefault();
    // Stash the event so it can be triggered later.
    deferredInstallPrompt = event;
    // Show download button
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
      installBtn.classList.remove('hidden');
    }
  });
}

function updateNetworkStatus() {
  const badge = document.getElementById('network-badge');
  const dot = document.getElementById('network-dot');
  const text = document.getElementById('network-text');

  if (!badge) return;

  if (navigator.onLine) {
    badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-800/80 border border-emerald-600 text-emerald-100';
    dot.className = 'w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse';
    text.textContent = 'Terhubung (Online)';
  } else {
    badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-900 border border-rose-700 text-rose-100';
    dot.className = 'w-2.5 h-2.5 bg-rose-400 rounded-full';
    text.textContent = 'Mode Luring (Offline)';
    showToast('Mode Luring Aktif', 'Aplikasi beroperasi penuh tanpa koneksi internet.', 'warning');
  }
}

/* -------------------------------------------------------------
   LEAFLET MAP INITIALIZATION
   ------------------------------------------------------------- */
function initMapContainer() {
  initMap('map', (coords) => {
    // Populate form fields upon Map Click
    document.getElementById('sample-lat').value = coords.lat;
    document.getElementById('sample-lng').value = coords.lng;
    showToast('Koordinat Dipilih', `Berhasil memplot koordinat: ${coords.lat}, ${coords.lng}`, 'info');
  });
}

/* -------------------------------------------------------------
   FORM HANDLERS & REAL-TIME PREVIEW
   ------------------------------------------------------------- */
function setupFormEventListeners() {
  const phInput = document.getElementById('sample-ph');
  const phSlider = document.getElementById('sample-ph-slider');
  const form = document.getElementById('form-sample');

  if (!phInput || !phSlider || !form) return;

  // Sync Input Text with Slider
  phInput.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    if (val < 0) val = 0;
    if (val > 14) val = 14;
    phSlider.value = val;
    updateLiveCropPreview(val);
  });

  // Sync Slider with Input Text
  phSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    phInput.value = val.toFixed(1);
    updateLiveCropPreview(val);
  });

  // Submit action (Handles Save & Updates)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const idVal = document.getElementById('sample-id').value;
    const nameVal = document.getElementById('sample-nama').value.trim();
    const latVal = parseFloat(document.getElementById('sample-lat').value);
    const lngVal = parseFloat(document.getElementById('sample-lng').value);
    const phVal = parseFloat(phInput.value);
    const notesVal = document.getElementById('sample-catatan').value.trim();

    // Standard GIS Range Validations
    if (isNaN(latVal) || latVal < -90 || latVal > 90) {
      showToast('Error', 'Latitude harus berada dalam rentang -90 hingga 90 derajat.', 'error');
      return;
    }
    if (isNaN(lngVal) || lngVal < -185 || lngVal > 185) {
      showToast('Error', 'Longitude harus berada dalam rentang -180 hingga 180 derajat.', 'error');
      return;
    }
    if (isNaN(phVal) || phVal < 0 || phVal > 14) {
      showToast('Error', 'Nilai pH tanah berkisar antara 0 - 14.', 'error');
      return;
    }

    const sampleData = {
      nama: nameVal,
      latitude: latVal,
      longitude: lngVal,
      ph: phVal,
      catatan: notesVal,
      fotoLokasi: currentFotoLokasi,
      fotoTanaman: currentFotoTanaman,
      fotoTanah: currentFotoTanah,
      timestamp: Date.now()
    };

    try {
      if (idVal) {
        // Edit mode
        await updateSample(idVal, sampleData);
        showToast('Berhasil Diperbarui', `Sampel "${nameVal}" berhasil diperbarui di memori lokal.`, 'success');
      } else {
        // New record
        await addSample(sampleData);
        showToast('Tersimpan', `Sampel "${nameVal}" berhasil disimpan ke IndexedDB.`, 'success');
      }
      
      resetFormInputs();
      await reloadAppData();
    } catch (err) {
      showToast('Kesalahan Simpan', err, 'error');
    }
  });

  // Cancel edit mode
  const cancelBtn = document.getElementById('btn-cancel-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      resetFormInputs();
    });
  }

  // Pre-trigger standard green neutrality on default load
  updateLiveCropPreview(6.5);
}

// Live crop previews based on agriculture benchmarks inside form
function updateLiveCropPreview(ph) {
  const catInfo = getPHCategory(ph);
  const eligibility = evaluateCropCompatibility(ph);

  // Update HTML previews
  const categoryLabel = document.getElementById('ph-helper-category');
  const chiliLabel = document.getElementById('ph-helper-chili');
  const cucumberLabel = document.getElementById('ph-helper-cucumber');
  const helperBox = document.getElementById('ph-helper-box');

  if (categoryLabel) {
    categoryLabel.textContent = catInfo.label;
    // Set color matching Category
    categoryLabel.style.color = catInfo.color;
  }

  if (chiliLabel) {
    chiliLabel.textContent = eligibility.chili.status;
    chiliLabel.className = `font-bold ${eligibility.chili.suitable ? 'text-emerald-600' : 'text-red-500'}`;
  }

  if (cucumberLabel) {
    cucumberLabel.textContent = eligibility.cucumber.status;
    cucumberLabel.className = `font-bold ${eligibility.cucumber.suitable ? 'text-emerald-600' : 'text-red-500'}`;
  }

  if (helperBox) {
    // Setup light background color representing acidity category
    helperBox.style.borderColor = catInfo.color + '40'; // 25% opacity border
  }
}

function resetFormInputs() {
  document.getElementById('form-sample').reset();
  document.getElementById('sample-id').value = '';
  document.getElementById('sample-ph').value = '6.5';
  document.getElementById('sample-ph-slider').value = '6.5';
  updateLiveCropPreview(6.5);

  // Reset active photo states
  currentFotoLokasi = '';
  currentFotoTanaman = '';
  currentFotoTanah = '';
  if (window.updatePhotoUI) {
    window.updatePhotoUI('lokasi', '');
    window.updatePhotoUI('tanaman', '');
    window.updatePhotoUI('tanah', '');
  }

  // Restore Title
  document.getElementById('form-title').textContent = 'Rekam Titik Baru';
  document.getElementById('btn-submit').textContent = 'Simpan Titik Sampel';
  document.getElementById('btn-cancel-edit').classList.add('hidden');
}

/* -------------------------------------------------------------
   GPS SENSOR MANAGEMENT (GEOLOCATION API)
   ------------------------------------------------------------- */
function setupGPSHandler() {
  const gpsBtn = document.getElementById('btn-gps');
  if (!gpsBtn) return;

  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('GPS Tidak Didukung', 'Browser Anda tidak mendukung Geolocation API.', 'error');
      return;
    }

    const gpsIcon = document.getElementById('gps-icon');
    const gpsSpinner = document.getElementById('gps-spinner');
    const gpsText = document.getElementById('gps-text');

    // Enter loading state
    gpsIcon.classList.add('hidden');
    gpsSpinner.classList.remove('hidden');
    gpsText.textContent = 'Mencari Satelit GPS...';
    gpsBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));

        document.getElementById('sample-lat').value = lat;
        document.getElementById('sample-lng').value = lng;

        // Restore GPS button State
        gpsIcon.classList.remove('hidden');
        gpsSpinner.classList.add('hidden');
        gpsText.textContent = 'Dapatkan GPS Saat Ini';
        gpsBtn.disabled = false;

        showToast('Lokasi Ditemukan', `Akurasi hingga ${position.coords.accuracy.toFixed(1)} meter`, 'success');
        
        // Relocate map focus
        focusOnCoords(lat, lng);
      },
      (error) => {
        gpsIcon.classList.remove('hidden');
        gpsSpinner.classList.add('hidden');
        gpsText.textContent = 'Dapatkan GPS Saat Ini';
        gpsBtn.disabled = false;

        let errorMsg = 'Gagal mengakses GPS.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Akses lokasi ditolak pengguna. Pastikan izin GPS aktif.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Sinyal GPS satelit tidak tersedia.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Waktu pencarian satelit GPS habis.';
            break;
        }
        showToast('Kesalahan Lokasi', errorMsg, 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

/* -------------------------------------------------------------
   RESEARCH METADATA MANAGEMENT COUPLER
   ------------------------------------------------------------- */
function setupResearchMetadata() {
  const metaJudul = document.getElementById('meta-judul');
  const metaPeneliti = document.getElementById('meta-peneliti');
  const metaInstansi = document.getElementById('meta-instansi');
  const metaLokasi = document.getElementById('meta-lokasi');
  const metaKomoditas = document.getElementById('meta-komoditas');
  const metaTahun = document.getElementById('meta-tahun');
  const saveBtn = document.getElementById('btn-save-metadata');

  // Load existing metadata from local storage
  const currentMeta = loadResearchMetadata();
  if (metaJudul) metaJudul.value = currentMeta.judulPenelitian || '';
  if (metaPeneliti) metaPeneliti.value = currentMeta.namaPeneliti || '';
  if (metaInstansi) metaInstansi.value = currentMeta.instansi || '';
  if (metaLokasi) metaLokasi.value = currentMeta.lokasiPenelitian || '';
  if (metaKomoditas) metaKomoditas.value = currentMeta.komoditasUtama || '';
  if (metaTahun) metaTahun.value = currentMeta.tahunPenelitian || new Date().getFullYear().toString();

  // Helper function to bundle current values
  function getCurrentMetaValues() {
    return {
      judulPenelitian: metaJudul ? metaJudul.value : '',
      namaPeneliti: metaPeneliti ? metaPeneliti.value : '',
      instansi: metaInstansi ? metaInstansi.value : '',
      lokasiPenelitian: metaLokasi ? metaLokasi.value : '',
      komoditasUtama: metaKomoditas ? metaKomoditas.value : '',
      tahunPenelitian: metaTahun ? metaTahun.value : ''
    };
  }

  // Auto-save on input value changes / blur so user has seamless local synchronization
  const fields = [metaJudul, metaPeneliti, metaInstansi, metaLokasi, metaKomoditas, metaTahun];
  fields.forEach(field => {
    if (field) {
      field.addEventListener('input', () => {
        const data = getCurrentMetaValues();
        saveResearchMetadata(data);
      });
    }
  });

  // Explicit save button trigger
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const data = getCurrentMetaValues();
      const success = saveResearchMetadata(data);
      if (success) {
        showToast('Metadata Tersimpan', 'Informasi riset berhasil disimpan secara permanen di database lokal Anda.', 'success');
      } else {
        showToast('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan data metadata.', 'error');
      }
    });
  }
}

/* -------------------------------------------------------------
   SOIL SAMPLE PHOTO HANDLERS
   ------------------------------------------------------------- */
function setupPhotoHandlers() {
  const containerLokasi = document.getElementById('preview-lokasi-container');
  const inputLokasi = document.getElementById('input-foto-lokasi');
  const imgLokasi = document.getElementById('img-preview-lokasi');
  const placeholderLokasi = document.getElementById('placeholder-lokasi');
  const btnClearLokasi = document.getElementById('btn-clear-lokasi');

  const containerTanaman = document.getElementById('preview-tanaman-container');
  const inputTanaman = document.getElementById('input-foto-tanaman');
  const imgTanaman = document.getElementById('img-preview-tanaman');
  const placeholderTanaman = document.getElementById('placeholder-tanaman');
  const btnClearTanaman = document.getElementById('btn-clear-tanaman');

  const containerTanah = document.getElementById('preview-tanah-container');
  const inputTanah = document.getElementById('input-foto-tanah');
  const imgTanah = document.getElementById('img-preview-tanah');
  const placeholderTanah = document.getElementById('placeholder-tanah');
  const btnClearTanah = document.getElementById('btn-clear-tanah');

  // Utility to update active preview elements
  window.updatePhotoUI = (type, base64Data) => {
    if (type === 'lokasi') {
      currentFotoLokasi = base64Data || '';
      if (currentFotoLokasi) {
        imgLokasi.src = currentFotoLokasi;
        imgLokasi.classList.remove('hidden');
        placeholderLokasi.classList.add('hidden');
        btnClearLokasi.classList.remove('hidden');
      } else {
        imgLokasi.src = '';
        imgLokasi.classList.add('hidden');
        placeholderLokasi.classList.remove('hidden');
        btnClearLokasi.classList.add('hidden');
        if (inputLokasi) inputLokasi.value = '';
      }
    } else if (type === 'tanaman') {
      currentFotoTanaman = base64Data || '';
      if (currentFotoTanaman) {
        imgTanaman.src = currentFotoTanaman;
        imgTanaman.classList.remove('hidden');
        placeholderTanaman.classList.add('hidden');
        btnClearTanaman.classList.remove('hidden');
      } else {
        imgTanaman.src = '';
        imgTanaman.classList.add('hidden');
        placeholderTanaman.classList.remove('hidden');
        btnClearTanaman.classList.add('hidden');
        if (inputTanaman) inputTanaman.value = '';
      }
    } else if (type === 'tanah') {
      currentFotoTanah = base64Data || '';
      if (currentFotoTanah) {
        imgTanah.src = currentFotoTanah;
        imgTanah.classList.remove('hidden');
        placeholderTanah.classList.add('hidden');
        btnClearTanah.classList.remove('hidden');
      } else {
        imgTanah.src = '';
        imgTanah.classList.add('hidden');
        placeholderTanah.classList.remove('hidden');
        btnClearTanah.classList.add('hidden');
        if (inputTanah) inputTanah.value = '';
      }
    }
  };

  // Helper compression to downscale image
  function resizeImage(file, maxSide = 640) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSide) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            }
          } else {
            if (height > maxSide) {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // 0.7 quality to downsize greatly
          } else {
            resolve(event.target.result);
          }
        };
        img.onerror = () => resolve(event.target.result);
      };
      reader.onerror = () => resolve('');
    });
  }

  // Set listeners for Clicking containers -> triggers file inputs
  if (containerLokasi && inputLokasi) {
    containerLokasi.addEventListener('click', (e) => {
      if (e.target !== btnClearLokasi) inputLokasi.click();
    });
    inputLokasi.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        showToast('Memuat Gambar', 'Mempersiapkan pratinjau foto lokasi...', 'info');
        const compressed = await resizeImage(file);
        window.updatePhotoUI('lokasi', compressed);
      }
    });
    btnClearLokasi.addEventListener('click', (e) => {
      e.stopPropagation();
      window.updatePhotoUI('lokasi', '');
    });
  }

  if (containerTanaman && inputTanaman) {
    containerTanaman.addEventListener('click', (e) => {
      if (e.target !== btnClearTanaman) inputTanaman.click();
    });
    inputTanaman.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        showToast('Memuat Gambar', 'Mempersiapkan pratinjau foto tanaman...', 'info');
        const compressed = await resizeImage(file);
        window.updatePhotoUI('tanaman', compressed);
      }
    });
    btnClearTanaman.addEventListener('click', (e) => {
      e.stopPropagation();
      window.updatePhotoUI('tanaman', '');
    });
  }

  if (containerTanah && inputTanah) {
    containerTanah.addEventListener('click', (e) => {
      if (e.target !== btnClearTanah) inputTanah.click();
    });
    inputTanah.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        showToast('Memuat Gambar', 'Mempersiapkan pratinjau foto tanah...', 'info');
        const compressed = await resizeImage(file);
        window.updatePhotoUI('tanah', compressed);
      }
    });
    btnClearTanah.addEventListener('click', (e) => {
      e.stopPropagation();
      window.updatePhotoUI('tanah', '');
    });
  }

  // Wire up Modal Lightbox Close Actions
  const photoModal = document.getElementById('photo-modal');
  const btnClosePhotoModal = document.getElementById('btn-close-photo-modal');
  const btnDownloadPhotoModal = document.getElementById('btn-download-photo-modal');
  const modalImg = document.getElementById('photo-modal-img');
  const modalTitle = document.getElementById('photo-modal-title');

  window.viewPhotoInModal = (base64Data, title) => {
    if (!photoModal || !modalImg || !modalTitle) return;
    modalImg.src = base64Data;
    modalTitle.textContent = title || 'Pratinjau Foto Dokumentasi';
    photoModal.classList.remove('hidden');
    
    // Wire up download button
    if (btnDownloadPhotoModal) {
      // Re-bind click
      btnDownloadPhotoModal.onclick = () => {
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = `${title.replace(/\s+/g, '_')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Unduhan Berhasil', 'Mengekspor gambar seutuhnya ke file lokal.', 'success');
      };
    }
  };

  if (btnClosePhotoModal && photoModal) {
    const closeModal = () => {
      photoModal.classList.add('hidden');
      if (modalImg) modalImg.src = '';
    };
    btnClosePhotoModal.addEventListener('click', closeModal);
    photoModal.addEventListener('click', (e) => {
      if (e.target === photoModal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !photoModal.classList.contains('hidden')) {
        closeModal();
      }
    });
  }
}

/* -------------------------------------------------------------
   INTERACTIVE GENERAL CONTROLS
   ------------------------------------------------------------- */
function setupInteractiveButtons() {
  // PWA programatic click trigger
  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      // Show the install prompt
      deferredInstallPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log(`User response to PWA install: ${outcome}`);
      deferredInstallPrompt = null;
      installBtn.classList.add('hidden');
    });
  }

  // Recenter map button
  const recenterBtn = document.getElementById('btn-recenter');
  if (recenterBtn) {
    recenterBtn.addEventListener('click', () => {
      if (allSamplesState.length > 0) {
        updateMapMarkers(allSamplesState);
        showToast('Diorientasikan Ulang', 'Peta dipusatkan kembali pada cakupan semua sampel.', 'info');
      } else {
        // Fallback default Yogyakarta
        focusOnCoords(-7.8012, 110.3700, 10);
        showToast('Map Reset', 'Kembali ke koordinat default DIY.', 'info');
      }
    });
  }

  // Seed Button
  const seedBtn = document.getElementById('btn-seed');
  if (seedBtn) {
    seedBtn.addEventListener('click', async () => {
      console.log("LOAD SAMPLE CLICKED");
      await seedDummyData();
      showToast('Data Contoh Dimuat', 'Sistem berhasil memasukkan 6 data lahan cabai & mentimun.', 'success');
      await reloadAppData();
    });
  }

  // Purge/Reset Button
  console.log("APP STARTED");
  const purgeBtn = document.getElementById('btn-purge');
  console.log("PURGE BUTTON =", purgeBtn);

  if (purgeBtn) {
    purgeBtn.addEventListener('click', async () => {
      console.log("PURGE CLICKED - executing clearAllSamples directly without confirm modals");
      try {
        // Clear all samples atomically from IndexedDB
        await clearAllSamples();
        showToast('Database Kosong', 'Semua data telah dibersihkan secara luring.', 'warning');
        resetFormInputs();
        await reloadAppData();
      } catch (err) {
        showToast('Gagal Menghapus', err, 'error');
      }
    });
  }

  // Search Filter
  const searchInput = document.getElementById('input-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTableFiltered();
    });
  }

  // Category Selector Filter
  const filterCat = document.getElementById('filter-category');
  if (filterCat) {
    filterCat.addEventListener('change', () => {
      renderTableFiltered();
    });
  }

  // Export CSV Button
  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (allSamplesState.length === 0) {
        showToast('Tidak Ada Data', 'Tidak ada titik sampel yang terdaftar untuk diekspor.', 'warning');
        return;
      }
      exportDatabaseToCSV();
    });
  }

  // Import JSON File Trigger
  const importInput = document.getElementById('input-import');
  if (importInput) {
    importInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          
          let successCount = 0;
          let failCount = 0;

          // Support both a single object or an array of objects
          const dataList = Array.isArray(importedData) ? importedData : [importedData];

          for (const rawSample of dataList) {
            try {
              if (!rawSample || typeof rawSample !== 'object') {
                failCount++;
                continue;
              }

              // Resolve flexible name field
              const name = rawSample.nama !== undefined ? rawSample.nama : rawSample.name;
              
              // Resolve flexible latitude field
              const latVal = rawSample.latitude !== undefined ? rawSample.latitude : rawSample.lat;
              
              // Resolve flexible longitude field
              const lngVal = rawSample.longitude !== undefined ? rawSample.longitude : rawSample.lng;
              
              // Resolve flexible pH field
              const phVal = rawSample.ph !== undefined ? rawSample.ph : rawSample.phValue;

              const parsedLat = parseFloat(latVal);
              const parsedLng = parseFloat(lngVal);
              const parsedPh = parseFloat(phVal);

              const hasValidName = name !== undefined && name !== null && String(name).trim() !== '';
              const hasValidLat = !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90;
              const hasValidLng = !isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180;
              const hasValidPh = !isNaN(parsedPh) && parsedPh >= 0 && parsedPh <= 14;

              if (hasValidName && hasValidLat && hasValidLng && hasValidPh) {
                await addSample({
                  nama: String(name).trim(),
                  latitude: parsedLat,
                  longitude: parsedLng,
                  ph: parsedPh,
                  catatan: rawSample.catatan || '',
                  timestamp: rawSample.timestamp || Date.now()
                });
                successCount++;
              } else {
                failCount++;
              }
            } catch (err) {
              failCount++;
            }
          }

          if (successCount === 0 && failCount > 0) {
            showToast('Gagal Impor', `Tidak ada data yang berhasil diimpor. Semua (${failCount}) data tidak valid.`, 'error');
          } else if (failCount > 0) {
            showToast('Impor Selesai dengan Catatan', `Berhasil mengimpor ${successCount} data sampel, sedangkan ${failCount} data memiliki format tidak valid dan dilewati.`, 'warning');
          } else {
            showToast('Impor Sukses', `Berhasil mengimpor seluruh ${successCount} data sampel tanpa ada kesalahan ke database lokal.`, 'success');
          }

          // Clear file input
          importInput.value = '';
          await reloadAppData();

        } catch (error) {
          showToast('Gagal Impor', `Gagal membaca isi file: ${error.message}`, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // 5. Connect Layer Switch Selectors for dynamic mapping and legends
  const layerIds = [
    'layer-control-marker',
    'layer-control-heatmap',
    'layer-control-kriging',
    'layer-control-kriging-err',
    'layer-control-chili',
    'layer-control-cucumber'
  ];

  layerIds.forEach(layerId => {
    const selector = document.getElementById(layerId);
    if (selector) {
      selector.addEventListener('change', () => {
        applySpatialLayersToMap();
      });
    }
  });

  // Export PDF Report Button
  const exportPdfBtn = document.getElementById('btn-export-pdf');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      if (allSamplesState.length === 0) {
        showToast('Tidak Ada Data', 'Tidak ada titik sampel yang terdaftar untuk mencetak laporan.', 'warning');
        return;
      }
      const spatialStats = getSpatialStats();
      generatePDFReport(allSamplesState, spatialStats);
      showToast('Cetak Sukses', 'Dokumen PDF Laporan Analisis pH Tanah berhasil dibuat.', 'success');
    });
  }

  // Export Research Data (Excel .xlsx)
  const exportResearchBtn = document.getElementById('btn-export-research');
  if (exportResearchBtn) {
    exportResearchBtn.addEventListener('click', () => {
      if (allSamplesState.length === 0) {
        showToast('Tidak Ada Data', 'Tidak ada titik sampel yang terdaftar untuk diekspor.', 'warning');
        return;
      }
      try {
        const spatialStats = getSpatialStats();
        exportResearchDataExcel(allSamplesState, spatialStats);
        showToast('Ekspor Sukses', 'Berhasil mengekspor Laporan Riset Spasial Multi-Sheet (.xlsx) ke berkas unduhan Anda.', 'success');
      } catch (error) {
        showToast('Gagal Ekspor', `Kesalahan mengekspor berkas Excel: ${error.message}`, 'error');
      }
    });
  }

  // --- HIGH RES MAP PNG EXPORTS HANDLERS ---
  
  // A. Dropdown Menu Toggle Action
  const triggerMapExportBtn = document.getElementById('btn-trigger-map-export');
  const mapExportMenu = document.getElementById('map-export-menu');
  
  if (triggerMapExportBtn && mapExportMenu) {
    triggerMapExportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mapExportMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!mapExportMenu.contains(e.target) && e.target !== triggerMapExportBtn) {
        mapExportMenu.classList.add('hidden');
      }
    });
  }

  // Helper trigger to verify state and run export
  async function triggerMapExport(layerType) {
    if (allSamplesState.length === 0) {
      showToast('Tidak Ada Data', 'Tidak ada titik sampel yang terdaftar untuk membuat visualisasi peta.', 'warning');
      return;
    }
    showToast('Memproses Peta', 'Sedang memproyeksikan data kartografi beresolusi tinggi...', 'info');
    try {
      await exportMapToPNG(layerType, allSamplesState);
      showToast('Unduh Peta Sukses', `Peta berhasil diekspor ke resolusi tinggi PNG.`, 'success');
    } catch (err) {
      showToast('Gagal Ekspor Peta', `Kesalahan: ${err.message}`, 'error');
    }
    if (mapExportMenu) {
      mapExportMenu.classList.add('hidden');
    }
  }

  // B. Dropdown Menu Items Click Bindings
  const menuExportSebaran = document.getElementById('btn-menu-export-sebaran');
  const menuExportCabai = document.getElementById('btn-menu-export-cabai');
  const menuExportMentimun = document.getElementById('btn-menu-export-mentimun');
  const menuExportKriging = document.getElementById('btn-menu-export-kriging');

  if (menuExportSebaran) menuExportSebaran.addEventListener('click', () => triggerMapExport('sebaran'));
  if (menuExportCabai) menuExportCabai.addEventListener('click', () => triggerMapExport('cabai'));
  if (menuExportMentimun) menuExportMentimun.addEventListener('click', () => triggerMapExport('mentimun'));
  if (menuExportKriging) menuExportKriging.addEventListener('click', () => triggerMapExport('kriging'));

  // C. Floating Layer panel Button Click Bindings
  const panelExportSebaran = document.getElementById('btn-export-map-sebaran');
  const panelExportCabai = document.getElementById('btn-export-map-cabai');
  const panelExportMentimun = document.getElementById('btn-export-map-mentimun');
  const panelExportKriging = document.getElementById('btn-export-map-kriging');

  if (panelExportSebaran) panelExportSebaran.addEventListener('click', () => triggerMapExport('sebaran'));
  if (panelExportCabai) panelExportCabai.addEventListener('click', () => triggerMapExport('cabai'));
  if (panelExportMentimun) panelExportMentimun.addEventListener('click', () => triggerMapExport('mentimun'));
  if (panelExportKriging) panelExportKriging.addEventListener('click', () => triggerMapExport('kriging'));

  // Import CSV File Trigger
  const importCSVInput = document.getElementById('input-import-csv');
  if (importCSVInput) {
    importCSVInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const { validSamples, successCount, failCount } = parseResearchCSV(e.target.result);

          if (validSamples.length > 0) {
            for (const s of validSamples) {
              await addSample(s);
            }
          }

          if (successCount === 0 && failCount > 0) {
            showToast('Gagal Impor CSV', `Tidak ada data yang berhasil diimpor. Semua (${failCount}) baris data tidak valid.`, 'error');
          } else if (failCount > 0) {
            showToast('Impor CSV Selesai dengan Catatan', `Berhasil mengimpor ${successCount} data sampel penelitian, sedangkan ${failCount} koordinat/pH mengalami kesalahan format.`, 'warning');
          } else {
            showToast('Impor CSV Sukses', `Berhasil mengimpor seluruh ${successCount} baris data penelitian secara sukses ke database lokal IndexedDB.`, 'success');
          }

          importCSVInput.value = '';
          await reloadAppData();
        } catch (error) {
          showToast('Gagal Impor CSV', `Gagal memproses file CSV: ${error.message}`, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // 5c. Download Excel Template Button Handler
  const downloadTemplateBtn = document.getElementById('btn-download-template');
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener('click', () => {
      try {
        downloadExcelTemplate();
        showToast('Unduh Sukses', 'Berkas template Excel berhasil diunduh. Silakan isi data lewat program spreadsheet Anda.', 'success');
      } catch (error) {
        showToast('Gagal Unduh', `Tidak dapat membuat template Excel: ${error.message}`, 'error');
      }
    });
  }

  // 5d. Import Excel (.xlsx) File Trigger Handler
  const importXlsxInput = document.getElementById('input-import-xlsx');
  if (importXlsxInput) {
    importXlsxInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const { validSamples, successCount, failCount } = await parseExcelData(arrayBuffer);

          if (validSamples.length > 0) {
            for (const s of validSamples) {
              await addSample(s);
            }
          }

          if (successCount === 0 && failCount > 0) {
            showToast('Gagal Impor Excel', `Tidak ada data yang berhasil diimpor. Semua (${failCount}) baris data tidak valid.`, 'error');
          } else if (failCount > 0) {
            showToast('Impor Excel Selesai dengan Catatan', `Berhasil mengimpor ${successCount} data sampel dari Excel, sedangkan ${failCount} baris memiliki format tidak lengkap/salah.`, 'warning');
          } else {
            showToast('Impor Excel Sukses', `Berhasil mengimpor seluruh ${successCount} baris data dari Excel berkas ke database lokal.`, 'success');
          }

          importXlsxInput.value = '';
          await reloadAppData();
        } catch (error) {
          showToast('Gagal Impor Excel', `Gagal memproses file Excel: ${error.message}`, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Print Mode Layout Toggler
  const printModeSelector = document.getElementById('layer-control-print-mode');
  if (printModeSelector) {
    printModeSelector.addEventListener('change', () => {
      const isChecked = printModeSelector.checked;
      const overlay = document.getElementById('print-map-overlay');
      if (overlay) {
        if (isChecked) {
          overlay.classList.remove('hidden');
          // Update details dynamically inside overlay
          const dateEl = document.getElementById('print-map-date');
          if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
          const scaleEl = document.getElementById('print-map-scale-text');
          if (scaleEl) {
            const mapInstance = getMapInstance();
            if (mapInstance) {
              const zoom = mapInstance.getZoom();
              scaleEl.textContent = `Zoom Level ${zoom} (Dinamis)`;
            }
          }
          showToast('Mode Siap Cetak', 'Layout kartografi siap cetak diaktifkan. Gunakan Ctrl+P untuk mencetak peta secara presisi.', 'info');
        } else {
          overlay.classList.add('hidden');
        }
      }
    });
  }
}

/* -------------------------------------------------------------
   DATA RELOAD & RENDERING PROCESSES
   ------------------------------------------------------------- */
async function reloadAppData() {
  try {
    // 1. Fetch from IndexedDB
    allSamplesState = await getAllSamples();

    // 2. Plot Markers dynamically on Map
    updateMapMarkers(allSamplesState);

    // 3. Compute Summary Statistics on Dashboard Cards
    computeSummaryStatistics();

    // 4. Recalculate and generate spatial analysis models (IDW)
    const map = getMapInstance();
    const spatialStats = recalculateSpatialLayers(map, allSamplesState);

    // 5. Update active map layer overlays and indicators
    applySpatialLayersToMap();

    // 6. Push stats to new Spatial Analytics Dashboard
    updateSpatialDashboard(spatialStats);

    // 6.5. Render Geostatistics and Kriging diagnostics dashboard
    renderGeostatisticsDashboard();

    // 7. Populate table grid with searches
    renderTableFiltered();

    // Hide or show seed bar depending on database counts
    const seedBar = document.getElementById('seed-bar-action');
    if (seedBar) {
      if (allSamplesState.length === 0) {
        seedBar.classList.remove('hidden');
      } else {
        seedBar.classList.add('hidden');
      }
    }

  } catch (error) {
    showToast('Kesalahan Memuat', error, 'error');
  }
}

function computeSummaryStatistics() {
  const totalEl = document.getElementById('stats-total');
  const avgEl = document.getElementById('stats-avg');
  const avgBadgeEl = document.getElementById('stats-avg-badge');
  const minEl = document.getElementById('stats-min');
  const minNameEl = document.getElementById('stats-min-name');
  const maxEl = document.getElementById('stats-max');
  const maxNameEl = document.getElementById('stats-max-name');
  const tableCountEl = document.getElementById('table-total-count');

  if (!totalEl) return;

  const count = allSamplesState.length;
  totalEl.textContent = count;
  if (tableCountEl) {
    tableCountEl.textContent = count;
  }

  if (count === 0) {
    avgEl.textContent = '-';
    avgBadgeEl.textContent = '-';
    avgBadgeEl.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700';
    minEl.textContent = '-';
    minNameEl.textContent = 'Tidak ada data';
    maxEl.textContent = '-';
    maxNameEl.textContent = 'Tidak ada data';
    
    // Set global agronomy advice
    document.getElementById('analysis-remedy-text').textContent = 
      'Silakan rekam beberapa titik sampel tanah di atas. AgriMap Lite akan menganalisis profil keasaman tanah makro dan merekomendasikan takaran pemupukan, pemberian dolomit kalkulasi, atau tata air (drainase) secara langsung dan real-time di sini.';
    document.getElementById('recom-chili-index').textContent = '-';
    document.getElementById('recom-cucumber-index').textContent = '-';
    return;
  }

  // Perform statistical formulas
  let sum = 0;
  let minVal = 999;
  let maxVal = -999;
  let minObj = null;
  let maxObj = null;

  allSamplesState.forEach((s) => {
    const val = s.ph;
    sum += val;
    if (val < minVal) {
      minVal = val;
      minObj = s;
    }
    if (val > maxVal) {
      maxVal = val;
      maxObj = s;
    }
  });

  const avgValue = sum / count;
  
  // Render Average
  avgEl.textContent = avgValue.toFixed(1);
  const avgCat = getPHCategory(avgValue);
  avgBadgeEl.textContent = avgCat.label;
  
  // Match style with pH indicator color scheme
  avgBadgeEl.style.backgroundColor = avgCat.color + '20'; // 12% opacity background
  avgBadgeEl.style.color = avgCat.color;

  // Render Min and Max
  minEl.textContent = minVal.toFixed(1);
  minNameEl.textContent = minObj ? minObj.nama : 'Tidak diketahui';

  maxEl.textContent = maxVal.toFixed(1);
  maxNameEl.textContent = maxObj ? maxObj.nama : 'Tidak diketahui';

  // Compute agronomy remediation advice
  computeAgronomyFarmingAdvice(avgValue);
}

/**
 * Calculates remedial requirements and percentages for the agricultural region
 */
function computeAgronomyFarmingAdvice(avgPH) {
  const remedyTextEl = document.getElementById('analysis-remedy-text');
  const recomChiliEl = document.getElementById('recom-chili-index');
  const recomCucumberEl = document.getElementById('recom-cucumber-index');

  const overallChili = evaluateCropCompatibility(avgPH).chili;
  const overallCuc = evaluateCropCompatibility(avgPH).cucumber;

  recomChiliEl.textContent = overallChili.status;
  recomChiliEl.className = `text-[13px] font-black tracking-tight px-2 py-0.5 rounded-md mt-1 border border-white/25 text-center ${overallChili.suitable ? 'bg-emerald-600/80 text-emerald-100' : 'bg-rose-600/90 text-rose-100'}`;

  recomCucumberEl.textContent = overallCuc.status;
  recomCucumberEl.className = `text-[13px] font-black tracking-tight px-2 py-0.5 rounded-md mt-1 border border-white/25 text-center ${overallCuc.suitable ? 'bg-emerald-600/80 text-emerald-100' : 'bg-rose-600/90 text-rose-100'}`;

  let adviceHTML = '';
  if (avgPH < 5.5) {
    adviceHTML = `Aktivitas rata-rata lahan menunjukkan <strong>Kemasaman Tinggi (pH ${avgPH.toFixed(1)})</strong>. Kondisi ekstrem bagi cabai &amp; mentimun karena kelarutan Fe dan Al tinggi yang meracuni akar. <strong>Rekomendasi tindakan</strong>: Lakukan pengapuran tanah dengan Dolomit (CaMg(CO3)2) sekitar 1.5 - 2.5 ton/hektar untuk menaikkan pH menuju target ideal ~6.0 sebelum pemupukan mikro NPK.`;
  } else if (avgPH >= 5.5 && avgPH <= 6.5) {
    adviceHTML = `Tanah berimbang di kategori <strong>Agak Masam yang Sehat (pH ${avgPH.toFixed(1)})</strong>. Sangat menguntungkan bagi penyerapan nitrogen dan kalium. Cabai Merah tumbuh dengan performa prima, sementara Mentimun di range optimal. Pertahankan kondisi ini dengan memprioritaskan pemupukan kompos kandang organik agar kelembaban mikro tanah serasi.`;
  } else if (avgPH > 6.5 && avgPH <= 7.5) {
    adviceHTML = `Kondisi tanah berada di zona <strong>Netral yang Sempurna (pH ${avgPH.toFixed(1)})</strong>. pH optimum tertinggi di mana semua biota mikroorganisme tanah penyubur bekerja maksimal. Baik cabai maupun mentimun dapat langsung menyerap herbisida, kalsium, fosfor bebas, dan kalium seimbang. Tidak memerlukan pengapuran atau asidifikasi tambahan.`;
  } else {
    adviceHTML = `Kondisi tanah menunjukkan indikasi <strong>Alkali/Basa berkapur (pH ${avgPH.toFixed(1)})</strong>. Berisiko menyebabkan klorosis daun karena defisiensi unsur Zinc (Zn) dan Besi (Fe) yang mengendap. <strong>Rekomendasi tindakan</strong>: Tambahkan pupuk fisiologis asam seperti ZA (Amonium Sulfat) secara bertahap atau suplai mikoriza tanah untuk membantu perakaran mentimun memecah zat fosfat murni.`;
  }
  
  remedyTextEl.innerHTML = adviceHTML;
}

function renderSamplePhotosColumn(sample) {
  const { fotoLokasi, fotoTanaman, fotoTanah } = sample;
  if (!fotoLokasi && !fotoTanaman && !fotoTanah) {
    return `<span class="text-slate-300 italic text-[10px]">-</span>`;
  }
  
  let html = `<div class="flex items-center justify-center gap-1.5 flex-wrap">`;
  if (fotoLokasi) {
    html += `<img src="${fotoLokasi}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 cursor-zoom-in hover:scale-125 hover:border-slate-300 transition-all shadow-xs" title="Foto Lokasi (Klik)" onclick="window.viewPhotoInModal('${fotoLokasi.replace(/'/g, "\\'")}', 'Foto Lokasi - ${sample.nama.replace(/'/g, "\\'")}')" referrerPolicy="no-referrer" />`;
  }
  if (fotoTanaman) {
    html += `<img src="${fotoTanaman}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 cursor-zoom-in hover:scale-125 hover:border-slate-300 transition-all shadow-xs" title="Foto Tanaman (Klik)" onclick="window.viewPhotoInModal('${fotoTanaman.replace(/'/g, "\\'")}', 'Foto Tanaman - ${sample.nama.replace(/'/g, "\\'")}')" referrerPolicy="no-referrer" />`;
  }
  if (fotoTanah) {
    html += `<img src="${fotoTanah}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 cursor-zoom-in hover:scale-125 hover:border-slate-300 transition-all shadow-xs" title="Foto Tanah (Klik)" onclick="window.viewPhotoInModal('${fotoTanah.replace(/'/g, "\\'")}', 'Foto Tanah - ${sample.nama.replace(/'/g, "\\'")}')" referrerPolicy="no-referrer" />`;
  }
  html += `</div>`;
  return html;
}

function renderTableFiltered() {
  const tableBody = document.getElementById('table-body');
  const emptyState = document.getElementById('table-empty-state');
  const searchInput = document.getElementById('input-search');
  const filterCat = document.getElementById('filter-category');

  if (!tableBody) return;

  const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterVal = filterCat ? filterCat.value : 'ALL';

  // Apply filters in pipeline
  const filtered = allSamplesState.filter((s) => {
    // Search query matches nama
    const matchSearch = s.nama.toLowerCase().includes(searchQuery);
    
    // Category matches select option
    if (filterVal === 'ALL') {
      return matchSearch;
    } else {
      const cat = getPHCategory(s.ph);
      return matchSearch && (cat.label === filterVal);
    }
  });

  // Render
  tableBody.innerHTML = '';
  
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');

  filtered.forEach((sample) => {
    const { id, nama, latitude, longitude, ph, catatan } = sample;
    const cat = getPHCategory(ph);
    
    const tr = document.createElement('tr');
    tr.id = `sample-row-${id}`;
    tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100 align-middle';

    tr.innerHTML = `
      <td class="px-6 py-4">
        <div class="flex flex-col">
          <span class="font-bold text-slate-800 text-sm">${nama}</span>
          <span class="text-[9px] text-slate-400 font-mono mt-0.5">ID: ${id}</span>
        </div>
      </td>
      <td class="px-6 py-4 font-mono text-slate-600 font-semibold text-xxs">
        ${latitude.toFixed(5)}, ${longitude.toFixed(5)}
      </td>
      <td class="px-6 py-4 text-center">
        ${renderSamplePhotosColumn(sample)}
      </td>
      <td class="px-6 py-4 text-center font-bold text-sm text-slate-900 font-mono">
        ${ph.toFixed(1)}
      </td>
      <td class="px-6 py-4 text-center">
        <span class="inline-flex px-2.5 py-1 rounded-full text-xxs font-black ${cat.badgeColor}">
          ${cat.label}
        </span>
      </td>
      <td class="px-6 py-4 max-w-[220px]">
        <p class="text-xxs-plus text-slate-500 leading-relaxed truncate-2-lines" title="${catatan || '-'}">
          ${catatan ? catatan : '<span class="text-slate-300 italic">Tidak ada catatan</span>'}
        </p>
      </td>
      <td class="px-6 py-4 text-center">
        <div class="inline-flex items-center gap-1.5 justify-center">
          <!-- Button focus coords -->
          <button onclick="window.dispatchMapFocus(${latitude}, ${longitude})" title="Fokuskan Peta" class="p-1 px-2 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 rounded-lg transition cursor-pointer">
            📍 Intip
          </button>
          
          <button onclick="window.dispatchMapEdit(${id})" title="Kustomisasi Titik" class="p-1 px-2 text-[10px] font-bold text-amber-800 hover:bg-amber-100 rounded-lg transition cursor-pointer">
            ✏️ Edit
          </button>
          
          <button onclick="window.dispatchMapDelete(${id}, '${nama.replace(/'/g, "\\'")}')" title="Hapus Sampel luring" class="p-1 px-2 text-[10px] font-bold text-rose-700 hover:bg-rose-100 rounded-lg transition cursor-pointer">
            ❌ Hapus
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

/**
 * Converted IndexedDB list records into a standardized downloadable Comma Separated CSV sheet
 */
function exportDatabaseToCSV() {
  const headers = ['ID', 'Nama Titik', 'Latitude', 'Longitude', 'Nilai pH', 'Kategori pH', 'Catatan/Rekomendasi', 'Tanggal Rekam'];
  
  const csvRows = [headers.join(',')];

  allSamplesState.forEach((s) => {
    const cat = getPHCategory(s.ph);
    const dateFormatted = new Date(s.timestamp).toLocaleString('id-ID');
    
    // Clean fields from comma collisions
    const cols = [
      s.id,
      `"${s.nama.replace(/"/g, '""')}"`,
      s.latitude,
      s.longitude,
      s.ph,
      cat.label,
      `"${(s.catatan || '').replace(/"/g, '""')}"`,
      `"${dateFormatted}"`
    ];
    csvRows.push(cols.join(','));
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Make temporary click anchor
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `agrimap_lite_ph_export_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Ekspor Berhasil', 'File CSV berhasil dibuat dan diunduh.', 'success');
}

/* -------------------------------------------------------------
   DISPATCH SYSTEM WRAPPERS (EXPOSED TO WINDOW FOR ONCLICK)
   ------------------------------------------------------------- */
window.dispatchMapFocus = (lat, lng) => {
  focusOnCoords(lat, lng, 15);
  showToast('Peta Fokus', `Membidik koordinat ${lat}, ${lng}`, 'info');
  // Dynamic smooth scroll to map element on mobile
  const mapEl = document.getElementById('map');
  if (mapEl && window.innerWidth < 1024) {
    mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

window.dispatchMapEdit = (id) => {
  const sample = allSamplesState.find((s) => s.id === Number(id));
  if (!sample) return;

  // Fill forms
  document.getElementById('sample-id').value = sample.id;
  document.getElementById('sample-nama').value = sample.nama;
  document.getElementById('sample-lat').value = sample.latitude;
  document.getElementById('sample-lng').value = sample.longitude;
  document.getElementById('sample-ph').value = sample.ph.toFixed(1);
  document.getElementById('sample-ph-slider').value = sample.ph;
  document.getElementById('sample-catatan').value = sample.catatan || '';

  // Restore photos to local buffer and UI preview
  currentFotoLokasi = sample.fotoLokasi || '';
  currentFotoTanaman = sample.fotoTanaman || '';
  currentFotoTanah = sample.fotoTanah || '';
  if (window.updatePhotoUI) {
    window.updatePhotoUI('lokasi', currentFotoLokasi);
    window.updatePhotoUI('tanaman', currentFotoTanaman);
    window.updatePhotoUI('tanah', currentFotoTanah);
  }

  updateLiveCropPreview(sample.ph);

  // Focus and rename title
  document.getElementById('form-title').textContent = 'Kustomisasi Sampel';
  document.getElementById('btn-submit').textContent = 'Perbarui Titik Sampel';
  document.getElementById('btn-cancel-edit').classList.remove('hidden');

  // Relocate map focus
  focusOnCoords(sample.latitude, sample.longitude);
  
  // Smooth scroll up to form on mobile devices
  const formEl = document.getElementById('form-sample');
  if (formEl) {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Mode Edit', `Mengubah data titik: "${sample.nama}"`, 'info');
  }
};

window.dispatchMapDelete = async (id, nama) => {
  if (confirm(`Apakah Anda yakin ingin menghapus titik sampel "${nama}" dari perangkat offline Anda?`)) {
    try {
      await deleteSample(id);
      showToast('Terhapus', `Sampel "${nama}" dihapus dari database luring.`, 'warning');
      
      const currentEditingId = document.getElementById('sample-id').value;
      if (currentEditingId && Number(currentEditingId) === id) {
        resetFormInputs();
      }
      
      await reloadAppData();
    } catch (err) {
      showToast('Error Hapus', err, 'error');
    }
  }
};

/* -------------------------------------------------------------
   UX TOAST ALERTS MODULE
   ------------------------------------------------------------- */
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  
  // Choose styles
  let borderBorder = 'border-slate-200';
  let bgFill = 'bg-white';
  let sideColor = 'bg-slate-400';
  let iconHTML = 'ℹ️';

  if (type === 'success') {
    borderBorder = 'border-emerald-100';
    bgFill = 'bg-emerald-50/95';
    sideColor = 'bg-emerald-500';
    iconHTML = '✅';
  } else if (type === 'warning') {
    borderBorder = 'border-amber-100';
    bgFill = 'bg-amber-50/95';
    sideColor = 'bg-amber-500';
    iconHTML = '⚠️';
  } else if (type === 'error') {
    borderBorder = 'border-rose-100';
    bgFill = 'bg-rose-50/95';
    sideColor = 'bg-rose-500';
    iconHTML = '🛑';
  } else if (type === 'info') {
    borderBorder = 'border-indigo-100';
    bgFill = 'bg-indigo-50/95';
    sideColor = 'bg-indigo-500';
    iconHTML = '🎯';
  }

  toast.className = `flex gap-3 p-3.5 rounded-2xl border ${borderBorder} ${bgFill} shadow-lg backdrop-blur-md transform transition-all duration-300 ease-out translate-x-12 opacity-0 relative overflow-hidden`;
  
  toast.innerHTML = `
    <div class="absolute left-0 top-0 bottom-0 w-1.5 ${sideColor}"></div>
    <span class="text-base select-none">${iconHTML}</span>
    <div class="flex-1">
      <h5 class="text-xs font-extrabold text-slate-900 border-none m-0 leading-tight">${title}</h5>
      <p class="text-[10px] text-slate-500 mt-1 leading-relaxed">${message}</p>
    </div>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-650 text-[10px] font-bold cursor-pointer hover:bg-slate-100 p-0.5 rounded">
      ✕
    </button>
  `;

  container.appendChild(toast);

  // Trigger animations
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);

  // Self-destruct after 4.5 seconds
  setTimeout(() => {
    toast.style.transform = 'translateY(-12px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4500);
}

/* -------------------------------------------------------------
   SPATIAL INTERPRETATION GIS CONTROLLERS
   ------------------------------------------------------------- */

/**
 * Synchronizes spatial layers on the map based on the checkboxes and updates the dynamic legend panel
 */
function applySpatialLayersToMap() {
  const map = getMapInstance();
  if (!map) return;

  const showMarker = document.getElementById('layer-control-marker')?.checked ?? true;
  const showHeatmap = document.getElementById('layer-control-heatmap')?.checked ?? false;
  const showKriging = document.getElementById('layer-control-kriging')?.checked ?? false;
  const showKrigingErr = document.getElementById('layer-control-kriging-err')?.checked ?? false;
  const showChili = document.getElementById('layer-control-chili')?.checked ?? false;
  const showCucumber = document.getElementById('layer-control-cucumber')?.checked ?? false;

  const markerLayer = getMarkerLayerGroup();
  const { heatmap, kriging, krigingError, chili, cucumber } = getSpatialLayerGroups();

  // 1. Toggle Markers
  if (markerLayer) {
    if (showMarker) {
      if (!map.hasLayer(markerLayer)) map.addLayer(markerLayer);
    } else {
      if (map.hasLayer(markerLayer)) map.removeLayer(markerLayer);
    }
  }

  // 2. Toggle Heatmap IDW
  if (heatmap) {
    if (showHeatmap) {
      if (!map.hasLayer(heatmap)) map.addLayer(heatmap);
    } else {
      if (map.hasLayer(heatmap)) map.removeLayer(heatmap);
    }
  }

  // 2b. Toggle Kriging Prediction
  if (kriging) {
    if (showKriging) {
      if (!map.hasLayer(kriging)) map.addLayer(kriging);
    } else {
      if (map.hasLayer(kriging)) map.removeLayer(kriging);
    }
  }

  // 2c. Toggle Kriging Standard Error
  if (krigingError) {
    if (showKrigingErr) {
      if (!map.hasLayer(krigingError)) map.addLayer(krigingError);
    } else {
      if (map.hasLayer(krigingError)) map.removeLayer(krigingError);
    }
  }

  // 3. Toggle Chili Suitability
  if (chili) {
    if (showChili) {
      if (!map.hasLayer(chili)) map.addLayer(chili);
    } else {
      if (map.hasLayer(chili)) map.removeLayer(chili);
    }
  }

  // 4. Toggle Cucumber Suitability
  if (cucumber) {
    if (showCucumber) {
      if (!map.hasLayer(cucumber)) map.addLayer(cucumber);
    } else {
      if (map.hasLayer(cucumber)) map.removeLayer(cucumber);
    }
  }

  // 5. Update Dynamic Legend content
  updateDynamicLegend(showHeatmap, showChili, showCucumber, showKriging, showKrigingErr);
}

/**
 * Dynamically changes the floating legend entries and labels based on active checkboxes
 */
/**
 * Dynamically changes the floating legend entries and labels based on active checkboxes
 */
function updateDynamicLegend(showHeatmap, showChili, showCucumber, showKriging, showKrigingErr) {
  const titleEl = document.getElementById('legend-dynamic-title');
  const itemsEl = document.getElementById('legend-dynamic-items');
  if (!titleEl || !itemsEl) return;

  if (showKrigingErr) {
    titleEl.textContent = 'Uncertainty Kriging';
    itemsEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#0d9488] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Sangat Presisi (< 0.1 pH)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#0ea5e9] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Presisi Sedang (0.1 - 0.25)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#f59e0b] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Kurang Akurat (0.25 - 0.50)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#ef4444] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Penyimpangan Tinggi (> 0.50)</span>
      </div>
    `;
  } else if (showChili) {
    titleEl.textContent = 'Kesesuaian Cabai';
    itemsEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#2d6a4f] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Sangat Sesuai (pH 6.0 - 6.8)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#fbbf24] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Cukup Sesuai (pH 5.5 - 6.0)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#f97316] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Kurang Sesuai (pH > 6.8)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#ef4444] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Tidak Sesuai (pH < 5.5)</span>
      </div>
    `;
  } else if (showCucumber) {
    titleEl.textContent = 'Kesesuaian Mentimun';
    itemsEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#10b981] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Sangat Sesuai (pH 6.0 - 7.0)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#fbbf24] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Cukup Sesuai (pH 5.5 - 6.0)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#3b82f6] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Kurang Sesuai (pH > 7.0)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#ef4444] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Tidak Sesuai (pH < 5.5)</span>
      </div>
    `;
  } else if (showKriging) {
    titleEl.textContent = 'Estimasi pH Kriging';
    itemsEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#ef4444] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Sangat Masam (< 5.5)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#fbbf24] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Agak Masam (5.5 - 6.5)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#2d6a4f] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Netral (6.5 - 7.5)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#3b82f6] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Basa (> 7.5)</span>
      </div>
    `;
  } else {
    // Default or Heatmap pH
    titleEl.textContent = 'Legenda pH Tanah';
    itemsEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#ef4444] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Masam (< 5.5)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#fbbf24] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Agak Masam (5.5 - 6.5)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#2d6a4f] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Netral (6.5 - 7.5)</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-md inline-block bg-[#3b82f6] border border-white shadow"></span>
        <span class="text-slate-800 font-semibold text-xxs">Basa (> 7.5)</span>
      </div>
    `;
  }
}

/**
 * Updates the new Spatial Dashboard stats
 */
function updateSpatialDashboard(stats) {
  const chiliSuitableAreaEl = document.getElementById('spatial-chili-highly-suitable');
  const cucumberSuitableAreaEl = document.getElementById('spatial-cucumber-highly-suitable');
  const suitablePercentEl = document.getElementById('spatial-suitable-percent');
  const unsuitablePercentEl = document.getElementById('spatial-unsuitable-percent');
  const dolomiteAvgEl = document.getElementById('spatial-dolomite-avg');
  const dolomiteRangeEl = document.getElementById('spatial-dolomite-range');

  if (!chiliSuitableAreaEl) return;

  if (!stats || stats.totalAreaHa === 0) {
    chiliSuitableAreaEl.textContent = '-';
    cucumberSuitableAreaEl.textContent = '-';
    suitablePercentEl.textContent = '-';
    unsuitablePercentEl.textContent = '-';
    if (dolomiteAvgEl) dolomiteAvgEl.textContent = '-';
    if (dolomiteRangeEl) dolomiteRangeEl.textContent = 'Min: - / Max: - t/Ha';
    return;
  }

  chiliSuitableAreaEl.textContent = `${stats.chiliHighlySuitableHa.toFixed(2)} Ha`;
  cucumberSuitableAreaEl.textContent = `${stats.cucumberHighlySuitableHa.toFixed(2)} Ha`;
  suitablePercentEl.textContent = `${stats.suitablePercent.toFixed(1)}%`;
  unsuitablePercentEl.textContent = `${stats.unsuitablePercent.toFixed(1)}%`;

  if (dolomiteAvgEl) {
    dolomiteAvgEl.textContent = `${stats.avgDolomite.toFixed(2)} t/Ha`;
  }
  if (dolomiteRangeEl) {
    dolomiteRangeEl.textContent = `Min: ${stats.minDolomite.toFixed(1)} / Max: ${stats.maxDolomite.toFixed(1)} t/Ha`;
  }
}

/**
 * Renders the Professional Geostatistics Dashboard panel with SVG Variogram curve fitting, LOOCV logs, and RMSE ratings
 */
function renderGeostatisticsDashboard() {
  const geostatsResult = getLatestGeostatsResult();

  // Pick UI elements
  const nuggetEl = document.getElementById('val-nugget');
  const sillEl = document.getElementById('val-sill');
  const rangeEl = document.getElementById('val-range');
  const rmseEl = document.getElementById('val-rmse');
  const rmseBarEl = document.getElementById('rmse-status-bar');
  const rmseQualityEl = document.getElementById('rmse-quality-text');
  const logBodyEl = document.getElementById('loocv-details-body');
  const svgContentG = document.getElementById('svg-variogram-content');

  if (!nuggetEl) return;

  // Reset state if no geostats results exist or points are too few
  if (!geostatsResult || geostatsResult.status !== 'success' || geostatsResult.binned.length === 0) {
    nuggetEl.textContent = '-';
    sillEl.textContent = '-';
    rangeEl.textContent = '-';
    rmseEl.textContent = '-';
    if (rmseBarEl) rmseBarEl.style.width = '0%';
    if (rmseQualityEl) rmseQualityEl.textContent = 'Keandalan spasial: Menunggu kalkulasi...';
    if (logBodyEl) {
      logBodyEl.innerHTML = `
        <tr>
          <td colspan="4" class="p-4 text-center text-slate-400 italic font-semibold">Tebaran titik sampel minim (3 titik) dibutuhkan untuk verifikasi LOOCV.</td>
        </tr>
      `;
    }
    if (svgContentG) {
      svgContentG.innerHTML = `
        <text x="210" y="85" font-size="9" font-weight="bold" fill="#94a3b8" text-anchor="middle" class="animate-pulse">Rekam minimal 3 sampel untuk membangun variogram...</text>
      `;
    }
    return;
  }

  const { fittedModel, binned, validation } = geostatsResult;

  // 1. Populate Numeric Specs
  nuggetEl.textContent = `${fittedModel.nugget.toFixed(4)} pH²`;
  sillEl.textContent = `${fittedModel.sill.toFixed(4)} pH²`;
  rangeEl.textContent = `${fittedModel.range.toFixed(1)} m`;
  rmseEl.textContent = `${validation.rmse.toFixed(3)} pH`;

  // 2. Adjust Progress/Rating bar for prediction RMSE
  if (validation.rmse < 0.25) {
    rmseBarEl.style.width = '100%';
    rmseBarEl.className = 'w-0 h-full bg-emerald-500 transition-all duration-500';
    rmseQualityEl.textContent = 'Keandalan spasial: Sempurna (Sangat Presisi)';
  } else if (validation.rmse < 0.50) {
    rmseBarEl.style.width = '75%';
    rmseBarEl.className = 'w-0 h-full bg-teal-500 transition-all duration-500';
    rmseQualityEl.textContent = 'Keandalan spasial: Baik (Layak Publikasi)';
  } else if (validation.rmse < 0.75) {
    rmseBarEl.style.width = '45%';
    rmseBarEl.className = 'w-0 h-full bg-amber-500 transition-all duration-500';
    rmseQualityEl.textContent = 'Keandalan spasial: Sedang (Perlu Tambah Sampel)';
  } else {
    rmseBarEl.style.width = '20%';
    rmseBarEl.className = 'w-0 h-full bg-rose-500 transition-all duration-500';
    rmseQualityEl.textContent = 'Keandalan spasial: Lemah (Variasi Lokal Tinggi)';
  }

  // 3. Render LOOCV Validation Table Details
  if (logBodyEl) {
    if (validation.details.length === 0) {
      logBodyEl.innerHTML = `
        <tr>
          <td colspan="4" class="p-4 text-center text-slate-400 italic font-semibold">Gagal memproses LOOCV: dataset tunggal atau singular.</td>
        </tr>
      `;
    } else {
      logBodyEl.innerHTML = validation.details.map(item => {
        const errorVal = item.residual;
        const absErr = Math.abs(errorVal);
        let errColorClass = 'text-slate-500';
        if (absErr < 0.15) errColorClass = 'text-emerald-700 font-bold';
        else if (absErr > 0.45) errColorClass = 'text-rose-600 font-bold';

        return `
          <tr class="border-b border-slate-50 hover:bg-slate-50/50">
            <td class="p-2 font-medium text-slate-800 max-w-[80px] truncate" title="${item.nama}">${item.nama}</td>
            <td class="p-2 text-center text-slate-600 font-mono">${item.actual.toFixed(2)}</td>
            <td class="p-2 text-center text-slate-600 font-mono">${item.predicted.toFixed(2)}</td>
            <td class="p-2 text-center font-mono ${errColorClass}">${errorVal >= 0 ? '+' : ''}${errorVal.toFixed(2)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 4. Draw SVG Variogram Plot (Experimental vs Fitted Model)
  if (svgContentG) {
    const maxX = Math.max(...binned.map(b => b.lag)) * 1.15 || 100;
    const maxY = Math.max(...binned.map(b => b.semivariance), fittedModel.sill) * 1.25 || 0.1;

    // Helper functions to translate data coordinates to SVG pixel coordinates
    // SVG width: [40, 380], SVG height: [150, 20] (y goes downwards!)
    const getSvgX = (val) => 40 + (val / maxX) * 340;
    const getSvgY = (val) => 150 - (val / maxY) * 130;

    let svgHtml = '';

    // --- Guide Line: SILL asymptote ---
    const sillY = getSvgY(fittedModel.sill);
    svgHtml += `
      <line x1="40" y1="${sillY}" x2="380" y2="${sillY}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3,3" />
      <text x="375" y="${sillY - 4}" font-size="7" font-weight="bold" fill="#94a3b8" text-anchor="end">Sill max variance (${fittedModel.sill.toFixed(3)})</text>
    `;

    // --- Guide Line: NUGGET intercept ---
    const nuggetY = getSvgY(fittedModel.nugget);
    svgHtml += `
      <line x1="40" y1="${nuggetY}" x2="80" y2="${nuggetY}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2,2" />
      <text x="45" y="${nuggetY + 8}" font-size="7" font-weight="bold" fill="#64748b">Nugget (${fittedModel.nugget.toFixed(3)})</text>
    `;

    // --- Guide Line: Range marker ---
    const rangeX = getSvgX(fittedModel.range);
    svgHtml += `
      <line x1="${rangeX}" y1="150" x2="${rangeX}" y2="${sillY}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${rangeX}" y="145" font-size="7" font-weight="black" fill="#64748b" text-anchor="middle">Range a (${fittedModel.range.toFixed(0)}m)</text>
    `;

    // --- Fitted Theoretical Spherical Model Curve (Polyline or Path) ---
    const theoreticalPoints = [];
    const stepCount = 80;
    for (let i = 0; i <= stepCount; i++) {
      const h = (i / stepCount) * maxX;
      let yVal = fittedModel.nugget;
      if (h <= fittedModel.range) {
        yVal += fittedModel.partialSill * (1.5 * (h / fittedModel.range) - 0.5 * Math.pow(h / fittedModel.range, 3));
      } else {
        yVal += fittedModel.partialSill;
      }
      theoreticalPoints.push(`${getSvgX(h).toFixed(1)},${getSvgY(yVal).toFixed(1)}`);
    }

    svgHtml += `
      <path d="M ${theoreticalPoints.join(' L ')}" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" />
    `;

    // --- Experimental Variogram Dots ---
    binned.forEach(bin => {
      const cx = getSvgX(bin.lag);
      const cy = getSvgY(bin.semivariance);
      svgHtml += `
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="#4f46e5" stroke="#ffffff" stroke-width="1.5" class="cursor-pointer" />
      `;
    });

    svgContentG.innerHTML = svgHtml;
  }
}

