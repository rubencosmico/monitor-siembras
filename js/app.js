// js/app.js
document.addEventListener('DOMContentLoaded', async () => {
    await Store.init();

    // Map Initialization
    const map = L.map('map', { zoomControl: false }).setView([38.285, -0.758], 15);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
    }).addTo(map);

    let userMarker = null;
    let userCircle = null;
    let userLatLng = null;
    let watchId = null;
    let isTracking = true;
    let compassInitialized = false;

    // Clustering Layer
    const markersLayer = L.markerClusterGroup({
        disableClusteringAtZoom: 18,
        spiderfyOnMaxZoom: false,
        maxClusterRadius: 40
    });
    map.addLayer(markersLayer);

    // Radar & Selection State
    let selectedSeedId = null;
    let radarPolyline = null;
    let radarInterval = null;
    let originalCSVData = [];

    // UI Elements
    const gpsDot = document.getElementById('gps-dot');
    const gpsText = document.getElementById('gps-text');
    const btnLocation = document.getElementById('btnLocation');
    const radarUI = document.getElementById('radar-ui');
    const radarDist = document.getElementById('radar-dist');
    const bottomSheet = document.getElementById('bottom-sheet');
    const sheetTitle = document.getElementById('sheet-title');
    const btnCloseSheet = document.getElementById('btn-close-sheet');
    const statusBtns = document.querySelectorAll('.btn-status');
    const noteInput = document.getElementById('audit-note');
    const btnMic = document.getElementById('btn-mic');
    const btnCamera = document.getElementById('btn-camera');
    const cameraInput = document.getElementById('camera-input');
    const btnExport = document.getElementById('btnExport');

    function updateGpsStatus(status, message) {
        gpsDot.className = 'status-dot ' + status;
        gpsText.innerText = message;
    }

    map.on('dragstart', () => {
        isTracking = false;
        btnLocation.classList.add('inactive');
    });

    function initCompass() {
        if (compassInitialized) return;
        const handleOrientation = (e) => {
            let heading = null;
            if (e.webkitCompassHeading) heading = e.webkitCompassHeading;
            else if (e.absolute && e.alpha !== null) heading = 360 - e.alpha;

            if (heading !== null) {
                const rotContainer = document.getElementById('user-rotation-container');
                const dirElement = document.getElementById('user-direction');
                if (rotContainer) rotContainer.style.transform = `rotate(${heading}deg)`;
                if (dirElement && dirElement.style.display !== 'block') dirElement.style.display = 'block';
            }
        };

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                        compassInitialized = true;
                    }
                }).catch(console.error);
        } else {
            window.addEventListener('deviceorientationabsolute', handleOrientation);
            window.addEventListener('deviceorientation', handleOrientation);
            compassInitialized = true;
        }
    }

    function updateRadar() {
        if (!selectedSeedId || !userLatLng) {
            if (radarPolyline) { map.removeLayer(radarPolyline); radarPolyline = null; }
            radarUI.style.display = 'none';
            return;
        }

        // Find marker
        let targetLatLng = null;
        markersLayer.eachLayer(layer => {
            if (layer.options.seedId === selectedSeedId) targetLatLng = layer.getLatLng();
        });

        if (targetLatLng) {
            const dist = userLatLng.distanceTo(targetLatLng);
            radarUI.style.display = 'block';
            radarDist.innerText = Math.round(dist);

            if (radarPolyline) {
                radarPolyline.setLatLngs([userLatLng, targetLatLng]);
            } else {
                radarPolyline = L.polyline([userLatLng, targetLatLng], { color: '#ffeb3b', weight: 3, dashArray: '5, 10' }).addTo(map);
            }

            // Haptic feedback if close
            if (dist < 2 && navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        }
    }

    function startTracking() {
        if ("geolocation" in navigator) {
            updateGpsStatus('pending', 'Conectando con GPS...');
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    updateGpsStatus('active', `GPS Activo (±${Math.round(position.coords.accuracy)}m)`);
                    userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
                    const accuracy = position.coords.accuracy;

                    if (!userMarker) {
                        const userIcon = L.divIcon({
                            className: 'custom-user-icon-wrapper',
                            html: `
                                <div id="user-rotation-container" style="width: 60px; height: 60px; position: relative; transition: transform 0.1s ease-out;">
                                    <div class="user-direction" id="user-direction"></div>
                                    <div class="user-marker"></div>
                                </div>
                            `,
                            iconSize: [60, 60],
                            iconAnchor: [30, 30]
                        });
                        userMarker = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
                        userCircle = L.circle(userLatLng, { radius: accuracy, color: '#2196F3', weight: 1, fillColor: '#2196F3', fillOpacity: 0.2 }).addTo(map);
                        if (isTracking) map.setView(userLatLng, 18);
                    } else {
                        userMarker.setLatLng(userLatLng);
                        userCircle.setLatLng(userLatLng);
                        userCircle.setRadius(accuracy);
                        if (isTracking) map.setView(userLatLng, map.getZoom());
                    }
                    updateRadar();
                },
                (error) => {
                    updateGpsStatus('error', 'Error GPS: ' + error.message);
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
            );
        } else {
            updateGpsStatus('error', 'Sin soporte GPS');
        }
    }

    btnLocation.addEventListener('click', () => {
        isTracking = true;
        btnLocation.classList.remove('inactive');
        if (userMarker) map.setView(userMarker.getLatLng(), Math.max(18, map.getZoom()));
        else startTracking();
        initCompass();
    });

    startTracking();

    // Bottom Sheet Logic
    function openBottomSheet(seedId, rowData, existingAudit) {
        selectedSeedId = seedId;
        sheetTitle.innerText = `${rowData['Especie']} - ${rowData['Micrositio']}`;
        bottomSheet.classList.add('open');
        
        // Reset inputs
        noteInput.value = existingAudit ? existingAudit.notes : '';
        statusBtns.forEach(b => b.classList.remove('selected'));
        if (existingAudit && existingAudit.status) {
            document.querySelector(`.btn-${existingAudit.status}`).classList.add('selected');
        }
        updateRadar();
    }

    btnCloseSheet.addEventListener('click', () => {
        bottomSheet.classList.remove('open');
        selectedSeedId = null;
        updateRadar();
    });

    // Handle Status change
    statusBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!selectedSeedId) return;
            statusBtns.forEach(b => b.classList.remove('selected'));
            const status = e.target.dataset.status;
            e.target.classList.add('selected');

            // Save to Store
            const currentAudit = await Store.getSeedState(selectedSeedId) || {};
            currentAudit.status = status;
            currentAudit.date = new Date().toISOString();
            currentAudit.notes = noteInput.value;
            await Store.saveSeedState(selectedSeedId, currentAudit);

            // Update marker color
            markersLayer.eachLayer(layer => {
                if (layer.options.seedId === selectedSeedId) {
                    const el = layer.getElement().querySelector('div');
                    el.className = '';
                    el.style.cssText = `background-color:var(--status-${status});width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);`;
                }
            });
        });
    });

    noteInput.addEventListener('change', async () => {
        if (!selectedSeedId) return;
        const currentAudit = await Store.getSeedState(selectedSeedId) || {};
        currentAudit.notes = noteInput.value;
        await Store.saveSeedState(selectedSeedId, currentAudit);
    });

    // Voice Dictation
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;

        btnMic.addEventListener('click', () => {
            recognition.start();
            btnMic.style.color = '#f44336';
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            noteInput.value += (noteInput.value ? ' ' : '') + transcript;
            btnMic.style.color = 'white';
            noteInput.dispatchEvent(new Event('change'));
        };
        
        recognition.onerror = () => btnMic.style.color = 'white';
        recognition.onend = () => btnMic.style.color = 'white';
    } else {
        btnMic.style.display = 'none';
    }

    // Camera Compression
    btnCamera.addEventListener('click', () => cameraInput.click());
    cameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !selectedSeedId) return;

        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const max_size = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > max_size) { height *= max_size / width; width = max_size; }
                } else {
                    if (height > max_size) { width *= max_size / height; height = max_size; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality

                const currentAudit = await Store.getSeedState(selectedSeedId) || {};
                currentAudit.photo = dataUrl;
                await Store.saveSeedState(selectedSeedId, currentAudit);
                alert('Foto guardada correctamente.');
            };
            img.src = readerEvent.target.result;
        };
        reader.readAsDataURL(file);
    });

    // CSV Loading
    document.getElementById('csvFileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                markersLayer.clearLayers();
                originalCSVData = results.data;
                const auditedData = await Store.getAllAuditedSeeds();
                
                originalCSVData.forEach((row, index) => {
                    const lat = parseFloat(row['Lat']);
                    const lng = parseFloat(row['Lng']);
                    if (isNaN(lat) || isNaN(lng)) return;

                    const seedId = `seed_${index}`;
                    const audit = auditedData[seedId];
                    const statusClass = audit && audit.status ? `seed-icon-${audit.status}` : 'seed-icon-pending';
                    const color = audit && audit.status ? `var(--status-${audit.status})` : '#9e9e9e';

                    const icon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div class="${statusClass}" style="background-color:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    });

                    const marker = L.marker([lat, lng], { icon: icon, seedId: seedId });
                    marker.on('click', () => {
                        openBottomSheet(seedId, row, audit);
                    });
                    
                    markersLayer.addLayer(marker);
                });

                if (markersLayer.getLayers().length > 0) {
                    map.fitBounds(markersLayer.getBounds(), { padding: [50, 50] });
                }
            }
        });
    });

    btnExport.addEventListener('click', async () => {
        if (originalCSVData.length === 0) {
            alert('Carga un CSV primero.');
            return;
        }
        const auditedData = await Store.getAllAuditedSeeds();
        const csvString = Store.generateCSV(originalCSVData, auditedData);
        Store.downloadCSV(csvString);
    });
});
