# Correr el pipeline en la nube (GitHub Codespaces)

La PC local baja de ASF a ~1 MB/s. En un Codespace la descarga es mucho más rápida, así que allí se
baja y se analiza todo, y a casa solo viene un `.tar.gz` con los resultados.

Plan gratis de GitHub: 120 horas-núcleo/mes (60 h en la máquina de 2 núcleos) y 15 GB de disco.

## Una sola vez

1. **Secretos de Earthdata** (en la nube no se usa `.env`):
   github.com → foto de perfil → Settings → Codespaces → *Secrets* → **New secret**
   - `EARTHDATA_USERNAME` = tu usuario de urs.earthdata.nasa.gov
   - `EARTHDATA_PASSWORD` = tu contraseña
   - En *Repository access* elige `Nasa-space-apps-2026`.
2. En esa misma página, **Default idle timeout → 240 minutos**. Si no, el Codespace se apaga a los
   30 min sin tocar el teclado aunque haya una descarga corriendo.

## Cada vez

1. En el repo en GitHub: **Code → Codespaces → Create codespace** (en la rama que tenga este código).
   La primera vez instala las dependencias solo (2-3 min).
2. En la terminal del Codespace:
   ```bash
   cd "Data analytics"
   python cloud/run_jobs.py
   ```
   Corre los trabajos de `cloud/trabajos.txt`, 3 a la vez, y cada minuto imprime en qué va cada uno.
   Solo algunos: `python cloud/run_jobs.py --solo glaciar_jakobshavn colapso_langtang`
3. Al terminar crea `Data analytics/resultados/resultados_<fecha>.tar.gz`.
   En el explorador de archivos de VS Code: clic derecho sobre el `.tar.gz` → **Download**.
4. En la PC local, desde la carpeta del proyecto:
   ```bash
   tar -xzf ~/Downloads/resultados_<fecha>.tar.gz -C "Data analytics"
   ```
   Los resultados quedan en `data/analisis/` y `data/collections/` como si se hubieran generado en local.
5. Para no gastar horas: en github.com/codespaces → **Stop** (o Delete si ya no lo necesitas).

## Qué trae el paquete

- `data/analisis/<colección>/`: mapas PNG, `estadisticas.json`, GeoTIFF de resultados.
- `catalog.csv`, `manifest.json` y `errors.log` de cada colección.
- Datos crudos solo de las colecciones sin análisis (hoy: glaciares). Para forzar otras:
  `python cloud/run_jobs.py --incluir-datos terremoto_indonesia`
- `cloud/logs/<trabajo>.log`.

## Añadir trabajos

Una línea por trabajo en `cloud/trabajos.txt`: `nombre: comando && comando`. Los comandos son los mismos
que en local; añade `--workers 4` a `fetch_quake.py` / `fetch_glacier.py` para bajar 4 pares a la vez.
Si se corta, vuelve a lanzarlo: lo ya descargado se salta.
