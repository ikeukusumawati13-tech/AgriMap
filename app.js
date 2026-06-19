/**
 * AgriMap Lite - Frontend Coordination Engine
 * Main JavaScript controller for forms, tables, database events, GPS, and service workers.
 */

import { 
  addSample, 
  getAllSamples, 
  updateSample, 
  deleteSample, 
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
  getSpatialLayerGroups
} from './spatial.js';

// Global application state
let allSamplesState = [];
let deferredInstallPrompt = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('AgriMap Lite - Memulai inisialisasi aplikasi...');

  // 1. Initialize PWA Service Worker (Offline Capabilities)
  registerServiceWorker();

  // 2. Initialize Leaflet Map
  initMapContainer();

  // 3. Connect Input Form Events (Sync Slider with Number Input, Live Preview)
  setupFormEventListeners();

  // 4. GPS Geolocation Listener
  setupGPSHandler();

  // 5. Setup Action Buttons (Recenter, Seed, Purge, Export, Search, Import)
  setupInteractiveButtons();

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
      if (confirm('Muat 6 data sampel lahan pertanian contoh di Daerah Istimewa Yogyakarta untuk simulasi instan?')) {
        await seedDummyData();
        showToast('Data Contoh Dimuat', 'Sistem berhasil memasukkan 6 data lahan cabai & mentimun.', 'success');
        await reloadAppData();
      }
    });
  }

  // Purge/Reset Button
  const purgeBtn = document.getElementById('btn-purge');
  if (purgeBtn) {
    purgeBtn.addEventListener('click', async () => {
      if (confirm('PERINGATAN! Anda akan menghapus seluruh data titik sampel secara permanen di perangkat ini. Lanjutkan?')) {
        try {
          // Iterate and delete
          for (const sample of allSamplesState) {
            await deleteSample(sample.id);
          }
          showToast('Database Kosong', 'Semua data telah dibersihkan secara luring.', 'warning');
          resetFormInputs();
          await reloadAppData();
        } catch (err) {
          showToast('Gagal Menghapus', err, 'error');
        }
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
  const showChili = document.getElementById('layer-control-chili')?.checked ?? false;
  const showCucumber = document.getElementById('layer-control-cucumber')?.checked ?? false;

  const markerLayer = getMarkerLayerGroup();
  const { heatmap, chili, cucumber } = getSpatialLayerGroups();

  // 1. Toggle Markers
  if (markerLayer) {
    if (showMarker) {
      if (!map.hasLayer(markerLayer)) map.addLayer(markerLayer);
    } else {
      if (map.hasLayer(markerLayer)) map.removeLayer(markerLayer);
    }
  }

  // 2. Toggle Heatmap
  if (heatmap) {
    if (showHeatmap) {
      if (!map.hasLayer(heatmap)) map.addLayer(heatmap);
    } else {
      if (map.hasLayer(heatmap)) map.removeLayer(heatmap);
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
  updateDynamicLegend(showHeatmap, showChili, showCucumber);
}

/**
 * Dynamically changes the floating legend entries and labels based on active checkboxes
 */
function updateDynamicLegend(showHeatmap, showChili, showCucumber) {
  const titleEl = document.getElementById('legend-dynamic-title');
  const itemsEl = document.getElementById('legend-dynamic-items');
  if (!titleEl || !itemsEl) return;

  if (showChili) {
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

  if (!chiliSuitableAreaEl) return;

  if (!stats || stats.totalAreaHa === 0) {
    chiliSuitableAreaEl.textContent = '-';
    cucumberSuitableAreaEl.textContent = '-';
    suitablePercentEl.textContent = '-';
    unsuitablePercentEl.textContent = '-';
    return;
  }

  chiliSuitableAreaEl.textContent = `${stats.chiliHighlySuitableHa.toFixed(2)} Ha`;
  cucumberSuitableAreaEl.textContent = `${stats.cucumberHighlySuitableHa.toFixed(2)} Ha`;
  suitablePercentEl.textContent = `${stats.suitablePercent.toFixed(1)}%`;
  unsuitablePercentEl.textContent = `${stats.unsuitablePercent.toFixed(1)}%`;
}
