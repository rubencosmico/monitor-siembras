// js/store.js
// Manejo de persistencia local con localForage
const Store = {
    async init() {
        localforage.config({
            name: 'MonitorSiembras',
            storeName: 'auditorias'
        });
    },

    async saveSeedState(seedId, data) {
        try {
            await localforage.setItem(seedId, data);
            return true;
        } catch (err) {
            console.error('Error guardando semilla:', err);
            return false;
        }
    },

    async getSeedState(seedId) {
        try {
            return await localforage.getItem(seedId);
        } catch (err) {
            console.error('Error obteniendo semilla:', err);
            return null;
        }
    },

    async getAllAuditedSeeds() {
        const audited = {};
        try {
            await localforage.iterate((value, key) => {
                audited[key] = value;
            });
        } catch (err) {
            console.error('Error obteniendo todas las semillas:', err);
        }
        return audited;
    },

    async clearAll() {
        await localforage.clear();
    },

    generateCSV(originalData, auditedData) {
        // Enriquecer originalData con auditedData
        const enrichedData = originalData.map((row, index) => {
            const seedId = \`seed_\${index}\`; // Asumimos un ID basado en índice si no hay uno único
            const audit = auditedData[seedId];
            if (audit) {
                return {
                    ...row,
                    'Estado': audit.status,
                    'Fecha_Revision': audit.date,
                    'Notas_Auditoria': audit.notes || '',
                    'Foto': audit.photo || ''
                };
            }
            return {
                ...row,
                'Estado': '',
                'Fecha_Revision': '',
                'Notas_Auditoria': '',
                'Foto': ''
            };
        });

        return Papa.unparse(enrichedData);
    },

    downloadCSV(csvString, filename = 'auditoria_siembras.csv') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

window.Store = Store;
