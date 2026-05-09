/**
 * Arba Siembras - Dashboard Analytics
 * Modernized with Paginated Table and Horizontal Filters
 */

// Estado global del dashboard
const state = {
    allData: typeof window.DATA_SIEMBRAS !== 'undefined' ? window.DATA_SIEMBRAS : [],
    filteredData: [],
    filters: {
        especie: 'all',
        tratamiento: 'all',
        micrositio: 'all',
        orientacion: 'all'
    },
    pagination: {
        currentPage: 1,
        rowsPerPage: 25
    },
    charts: {
        especies: null,
        tratamientos: null,
        micrositios: null
    },
    map: null,
    markerCluster: null
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    if (state.allData.length === 0) {
        console.error('No se han cargado los datos de siembras.');
        return;
    }

    initFilters();
    initMap();
    updateDashboard();
    setupEventListeners();
});

function setupEventListeners() {
    // Filtros
    document.getElementById('filter-especie').addEventListener('change', e => {
        state.filters.especie = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    document.getElementById('filter-tratamiento').addEventListener('change', e => {
        state.filters.tratamiento = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    document.getElementById('filter-micrositio').addEventListener('change', e => {
        state.filters.micrositio = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    document.getElementById('filter-orientacion').addEventListener('change', e => {
        state.filters.orientacion = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });

    // Reset
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        state.filters = { especie: 'all', tratamiento: 'all', micrositio: 'all', orientacion: 'all' };
        state.pagination.currentPage = 1;
        document.querySelectorAll('.horizontal-filters select').forEach(s => s.value = 'all');
        updateDashboard();
    });
}

function initFilters() {
    const especies = [...new Set(state.allData.map(d => d.Especie))].sort();
    const tratamientos = [...new Set(state.allData.map(d => d.Tratamiento))].sort();
    const micrositios = [...new Set(state.allData.map(d => d.Micrositio))].sort();
    const orientaciones = [...new Set(state.allData.map(d => d.Orientación))].sort();

    populateSelect('filter-especie', especies);
    populateSelect('filter-tratamiento', tratamientos);
    populateSelect('filter-micrositio', micrositios);
    populateSelect('filter-orientacion', orientaciones);
}

function populateSelect(id, values) {
    const select = document.getElementById(id);
    values.forEach(v => {
        if (!v) return;
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
    });
}

function updateDashboard() {
    applyFilters();
    updateKPIs();
    renderCharts();
    updateMap();
    renderTable();
}

function applyFilters() {
    state.filteredData = state.allData.filter(d => {
        return (state.filters.especie === 'all' || d.Especie === state.filters.especie) &&
               (state.filters.tratamiento === 'all' || d.Tratamiento === state.filters.tratamiento) &&
               (state.filters.micrositio === 'all' || d.Micrositio === state.filters.micrositio) &&
               (state.filters.orientacion === 'all' || d.Orientación === state.filters.orientacion);
    });
}

function updateKPIs() {
    const totalEspecies = new Set(state.filteredData.map(d => d.Especie)).size;
    const totalGolpes = state.filteredData.reduce((sum, d) => sum + (parseInt(d.Golpes) || 0), 0);
    const totalSemillas = state.filteredData.reduce((sum, d) => {
        const semillasHoyo = parseInt(d['Semillas/Hoyo']) || 0;
        const golpes = parseInt(d.Golpes) || 0;
        return sum + (semillasHoyo * golpes);
    }, 0);

    document.getElementById('kpi-especies').textContent = totalEspecies;
    document.getElementById('kpi-golpes').textContent = totalGolpes;
    document.getElementById('kpi-semillas').textContent = totalSemillas.toLocaleString();
    document.getElementById('kpi-registros').textContent = state.filteredData.length;
}

// #region Charts
function renderCharts() {
    renderSpeciesChart();
    renderTreatmentChart();
    renderMicrositeChart();
}

function renderSpeciesChart() {
    const counts = {};
    state.filteredData.forEach(d => counts[d.Especie] = (counts[d.Especie] || 0) + 1);
    
    const data = Object.entries(counts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 10);

    const ctx = document.getElementById('chartEspecies').getContext('2d');
    if (state.charts.especies) state.charts.especies.destroy();

    state.charts.especies = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d[0]),
            datasets: [{
                label: 'Registros',
                data: data.map(d => d[1]),
                backgroundColor: '#2a9d8f'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderTreatmentChart() {
    const counts = {};
    state.filteredData.forEach(d => counts[d.Tratamiento] = (counts[d.Tratamiento] || 0) + 1);

    const ctx = document.getElementById('chartTratamientos').getContext('2d');
    if (state.charts.tratamientos) state.charts.tratamientos.destroy();

    state.charts.tratamientos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
        }
    });
}

function renderMicrositeChart() {
    const counts = {};
    state.filteredData.forEach(d => counts[d.Micrositio] = (counts[d.Micrositio] || 0) + 1);

    const ctx = document.getElementById('chartMicrositios').getContext('2d');
    if (state.charts.micrositios) state.charts.micrositios.destroy();

    state.charts.micrositios = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
        }
    });
}
// #endregion

// #region Map
function initMap() {
    state.map = L.map('dashboard-map').setView([38.26, -0.70], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map);
    state.markerCluster = L.markerClusterGroup();
    state.map.addLayer(state.markerCluster);
}

function updateMap() {
    state.markerCluster.clearLayers();
    
    state.filteredData.forEach(d => {
        if (!d.Lat || !d.Lng) return;
        const marker = L.marker([d.Lat, d.Lng]);
        marker.bindPopup(`
            <strong>${d.Especie}</strong><br>
            ${d.Golpes} golpes - ${d.Tratamiento}<br>
            <small>${d.Fecha} ${d.Hora}</small>
        `);
        state.markerCluster.addLayer(marker);
    });

    if (state.filteredData.length > 0) {
        state.map.fitBounds(state.markerCluster.getBounds(), { padding: [20, 20] });
    }
}
// #endregion

// #region Table & Pagination
function renderTable() {
    const { currentPage, rowsPerPage } = state.pagination;
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = state.filteredData.slice(start, end);

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    pageData.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.Fecha}</td>
            <td><strong>${d.Especie}</strong></td>
            <td>${d.Golpes}</td>
            <td><span class="badge">${d.Tratamiento}</span></td>
            <td>${d.Micrositio}</td>
            <td>${d.Equipo}</td>
            <td>
                ${d['Foto URL'] ? `
                    <a href="${d['Foto URL']}" target="_blank" class="btn-photo">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        Ver
                    </a>
                ` : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationInfo(start, end);
    renderPaginationControls();
}

function updatePaginationInfo(start, end) {
    const total = state.filteredData.length;
    const actualEnd = Math.min(end, total);
    const info = document.getElementById('pagination-info');
    info.textContent = `Mostrando ${total === 0 ? 0 : start + 1} a ${actualEnd} de ${total} registros`;
}

function renderPaginationControls() {
    const totalPages = Math.ceil(state.filteredData.length / state.pagination.rowsPerPage);
    const containers = [document.getElementById('pagination-top'), document.getElementById('pagination-bottom')];
    
    containers.forEach(container => {
        container.innerHTML = '';
        
        if (totalPages <= 1) return;

        // Prev
        const btnPrev = createPageBtn('←', state.pagination.currentPage - 1, state.pagination.currentPage === 1);
        container.appendChild(btnPrev);

        // Pages (Limited logic for brevity)
        let startPage = Math.max(1, state.pagination.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        for (let i = startPage; i <= endPage; i++) {
            const btn = createPageBtn(i, i, false, i === state.pagination.currentPage);
            container.appendChild(btn);
        }

        // Next
        const btnNext = createPageBtn('→', state.pagination.currentPage + 1, state.pagination.currentPage === totalPages);
        container.appendChild(btnNext);
    });
}

function createPageBtn(text, page, disabled, active = false) {
    const btn = document.createElement('button');
    btn.className = `btn-page ${active ? 'active' : ''}`;
    btn.textContent = text;
    btn.disabled = disabled;
    if (!disabled && !active) {
        btn.onclick = () => {
            state.pagination.currentPage = page;
            renderTable();
            window.scrollTo({ top: document.querySelector('.table-card').offsetTop - 100, behavior: 'smooth' });
        };
    }
    return btn;
}
// #endregion
