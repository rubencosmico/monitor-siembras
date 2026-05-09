import pandas as pd
import matplotlib.pyplot as plt
import glob
import os

# Set style
plt.style.use('ggplot')
colors = ['#2a9d8f', '#e76f51', '#f4a261', '#e9c46a', '#264653']

# Load all CSVs
files = glob.glob('/home/ruben/dev/monitor-siembras/doc/*.csv')
dfs = []
for f in files:
    try:
        df = pd.read_csv(f)
        dfs.append(df)
    except Exception as e:
        print(f"Error reading {f}: {e}")

all_data = pd.concat(dfs, ignore_index=True)

# Clean data
all_data['Lat'] = pd.to_numeric(all_data['Lat'], errors='coerce')
all_data['Lng'] = pd.to_numeric(all_data['Lng'], errors='coerce')
all_data['Golpes'] = pd.to_numeric(all_data['Golpes'], errors='coerce').fillna(1)
all_data['Semillas/Hoyo'] = pd.to_numeric(all_data['Semillas/Hoyo'], errors='coerce').fillna(1)

# Ensure output directory exists
out_dir = '/home/ruben/.gemini/antigravity/brain/0d0c52f3-6a44-4da3-b5fd-ec5b2c16f153/scratch/'
os.makedirs(out_dir, exist_ok=True)

# 1. Species Distribution (Pie Chart)
plt.figure(figsize=(8, 6))
species_counts = all_data['Especie'].value_counts()
species_counts.plot(kind='pie', autopct='%1.1f%%', colors=colors, startangle=140, textprops={'fontsize': 12})
plt.title('Distribución de Especies Sembradas', fontsize=16)
plt.ylabel('')
plt.tight_layout()
plt.savefig(os.path.join(out_dir, 'especies.png'), dpi=300)
plt.close()

# 2. Treatments (Bar Chart)
plt.figure(figsize=(10, 6))
treatment_counts = all_data['Tratamiento'].value_counts()
treatment_counts.plot(kind='bar', color=colors[0])
plt.title('Tratamientos de Semillas Aplicados', fontsize=16)
plt.ylabel('Cantidad de Registros', fontsize=12)
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.savefig(os.path.join(out_dir, 'tratamientos.png'), dpi=300)
plt.close()

# 3. Microsites and Orientations (Bar Chart)
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
all_data['Micrositio'].value_counts().plot(kind='bar', ax=ax1, color=colors[1])
ax1.set_title('Estrategias de Micrositio', fontsize=14)
ax1.set_ylabel('Frecuencia')
ax1.tick_params(axis='x', rotation=45)

all_data['Orientación'].value_counts().plot(kind='bar', ax=ax2, color=colors[2])
ax2.set_title('Orientaciones de Siembra', fontsize=14)
ax2.set_ylabel('Frecuencia')
ax2.tick_params(axis='x', rotation=45)

plt.tight_layout()
plt.savefig(os.path.join(out_dir, 'estrategias.png'), dpi=300)
plt.close()

# 4. Map of Sowing Zones (Scatter plot)
plt.figure(figsize=(10, 8))
valid_coords = all_data.dropna(subset=['Lat', 'Lng'])
scatter = plt.scatter(valid_coords['Lng'], valid_coords['Lat'], c=colors[0], alpha=0.6, s=50, edgecolors='k')
plt.title('Mapa de Zonas de Siembra (Coordenadas GPS)', fontsize=16)
plt.xlabel('Longitud', fontsize=12)
plt.ylabel('Latitud', fontsize=12)
plt.grid(True, linestyle='--', alpha=0.7)
plt.tight_layout()
plt.savefig(os.path.join(out_dir, 'mapa.png'), dpi=300)
plt.close()

# Compute totals
total_records = len(all_data)
total_golpes = int(all_data['Golpes'].sum())
total_semillas = int((all_data['Golpes'] * all_data['Semillas/Hoyo']).sum())
total_especies = len(species_counts)

stats = f"""
Estadísticas Totales:
- Registros Totales: {total_records}
- Especies Sembradas: {total_especies}
- Total Golpes de Siembra: {total_golpes}
- Total Semillas Estimadas: {total_semillas}
"""
with open(os.path.join(out_dir, 'stats.txt'), 'w') as f:
    f.write(stats)

print("Images generated successfully!")
