document.addEventListener('DOMContentLoaded', () => {
    // Estado global de la aplicación
    const state = {
        allData: [],
        filteredData: [],
        filters: {
            especie: 'all',
            tratamiento: 'all',
            micrositio: 'all',
            orientacion: 'all'
        },
        map: null,
        markerClusterGroup: null,
        charts: {
            especies: null,
            tratamientos: null,
            micrositios: null
        }
    };

    // Paleta de colores para gráficos
    const colors = {
        primary: '#2a9d8f',
        secondary: '#e9c46a',
        accent: '#f4a261',
        danger: '#e76f51',
        dark: '#264653',
        palette: ['#2a9d8f', '#e76f51', '#f4a261', '#e9c46a', '#264653', '#8ab17d', '#b5838d']
    };

    // 1. Inicialización
    async function init() {
        initMap();
        await loadData();
        populateFilters();
        setupEventListeners();
        updateDashboard();
    }

    // 2. Carga de datos
    async function loadData() {
        try {
            // Obtenemos los datos desde el archivo .js local para evitar problemas de CORS
            const data = window.datosConsolidados;
            
            if (!data) throw new Error('Los datos no se han cargado correctamente.');

            // Clean specific data if needed
            state.allData = data.map(row => ({
                ...row,
                Golpes: parseInt(row.Golpes) || 1,
                'Semillas/Hoyo': parseInt(row['Semillas/Hoyo']) || 1
            }));
            
            state.filteredData = [...state.allData];
        } catch (error) {
            console.error('Error loading data:', error);
            alert('No se pudieron cargar los datos de siembra. Verifica que el archivo JSON/JS exista.');
        }
    }

    // 3. Configuración del Mapa
    function initMap() {
        state.map = L.map('dashboard-map').setView([38.286, -0.757], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(state.map);

        state.markerClusterGroup = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50
        });
        state.map.addLayer(state.markerClusterGroup);
    }

    // 4. Rellenar Selects de Filtros
    function populateFilters() {
        const getUnique = (key) => [...new Set(state.allData.map(d => d[key]))].filter(v => v);

        const populateSelect = (id, values) => {
            const select = document.getElementById(id);
            values.sort().forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                select.appendChild(option);
            });
        };

        populateSelect('filter-especie', getUnique('Especie'));
        populateSelect('filter-tratamiento', getUnique('Tratamiento'));
        populateSelect('filter-micrositio', getUnique('Micrositio'));
        populateSelect('filter-orientacion', getUnique('Orientación'));
    }

    // 5. Event Listeners
    function setupEventListeners() {
        const selects = ['especie', 'tratamiento', 'micrositio', 'orientacion'];
        
        selects.forEach(filter => {
            document.getElementById(`filter-${filter}`).addEventListener('change', (e) => {
                state.filters[filter] = e.target.value;
                applyFilters();
            });
        });

        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            selects.forEach(f => {
                state.filters[f] = 'all';
                document.getElementById(`filter-${f}`).value = 'all';
            });
            applyFilters();
        });
    }

    // 6. Aplicar Filtros
    function applyFilters() {
        state.filteredData = state.allData.filter(row => {
            let match = true;
            if (state.filters.especie !== 'all' && row['Especie'] !== state.filters.especie) match = false;
            if (state.filters.tratamiento !== 'all' && row['Tratamiento'] !== state.filters.tratamiento) match = false;
            if (state.filters.micrositio !== 'all' && row['Micrositio'] !== state.filters.micrositio) match = false;
            if (state.filters.orientacion !== 'all' && row['Orientación'] !== state.filters.orientacion) match = false;
            return match;
        });

        updateDashboard();
    }

    // 7. Actualizar Todo el Dashboard
    function updateDashboard() {
        updateKPIs();
        updateMap();
        updateCharts();
    }

    // 8. Actualizar KPIs
    function updateKPIs() {
        const data = state.filteredData;
        
        const uniqueSpecies = new Set(data.map(d => d['Especie']).filter(Boolean)).size;
        const totalGolpes = data.reduce((sum, row) => sum + row.Golpes, 0);
        const totalSemillas = data.reduce((sum, row) => sum + (row.Golpes * row['Semillas/Hoyo']), 0);
        const totalRecords = data.length;

        document.getElementById('kpi-especies').textContent = uniqueSpecies;
        document.getElementById('kpi-golpes').textContent = totalGolpes.toLocaleString();
        document.getElementById('kpi-semillas').textContent = totalSemillas.toLocaleString();
        document.getElementById('kpi-registros').textContent = totalRecords.toLocaleString();
    }

    // 9. Actualizar Mapa
    function updateMap() {
        state.markerClusterGroup.clearLayers();
        
        const validData = state.filteredData.filter(d => !isNaN(d.Lat) && !isNaN(d.Lng));
        
        const markers = validData.map(row => {
            const marker = L.marker([row.Lat, row.Lng]);
            marker.bindPopup(`
                <div class="custom-popup">
                    <h4>${row.Especie || 'Desconocida'}</h4>
                    <p><strong>Micrositio:</strong> ${row.Micrositio || 'N/A'}</p>
                    <p><strong>Tratamiento:</strong> ${row.Tratamiento || 'N/A'}</p>
                    <p><strong>Golpes:</strong> ${row.Golpes} (${row['Semillas/Hoyo']} semillas/hoyo)</p>
                    <p><strong>Equipo:</strong> ${row.Equipo}</p>
                </div>
            `);
            return marker;
        });

        if (markers.length > 0) {
            state.markerClusterGroup.addLayers(markers);
            const group = new L.featureGroup(markers);
            state.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    }

    // 10. Actualizar Gráficos
    function updateCharts() {
        const countBy = (key) => {
            return state.filteredData.reduce((acc, row) => {
                const val = row[key] || 'N/A';
                acc[val] = (acc[val] || 0) + 1;
                return acc;
            }, {});
        };

        const especiesData = countBy('Especie');
        const tratamientosData = countBy('Tratamiento');
        const micrositiosData = countBy('Micrositio');

        // Especies (Pie)
        renderChart('especies', 'pie', Object.keys(especiesData), Object.values(especiesData), colors.palette);
        
        // Tratamientos (Bar)
        renderChart('tratamientos', 'bar', Object.keys(tratamientosData), Object.values(tratamientosData), [colors.primary]);
        
        // Micrositios (Doughnut)
        renderChart('micrositios', 'doughnut', Object.keys(micrositiosData), Object.values(micrositiosData), colors.palette.slice().reverse());
    }

    function renderChart(chartKey, type, labels, data, backgroundColor) {
        const ctx = document.getElementById(`chart${chartKey.charAt(0).toUpperCase() + chartKey.slice(1)}`);
        
        if (state.charts[chartKey]) {
            state.charts[chartKey].destroy();
        }

        state.charts[chartKey] = new Chart(ctx, {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: type === 'bar' ? 'none' : 'right',
                        labels: {
                            font: { family: "'Inter', sans-serif" }
                        }
                    }
                },
                scales: type === 'bar' ? {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                } : {}
            }
        });
    }

    // Arrancar la app
    init();
});
