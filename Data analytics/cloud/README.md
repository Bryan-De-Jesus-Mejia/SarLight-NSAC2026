# Correr el pipeline en la nube (GitHub Codespaces)

La PC local baja de ASF a ~1 MB/s. En un Codespace la descarga es mucho más rápida, así que allí se
baja y se analiza todo, y a casa solo viene un `.tar.gz` con el análisis (los datos crudos se quedan en la nube).

Plan gratis de GitHub: 120 horas-núcleo/mes (60 h en la máquina de 2 núcleos) y 15 GB de disco.

## Una sola vez

1. **Secretos de Earthdata** (en la nube no se usa `.env`):
   github.com → foto de perfil → Settings → Codespaces → *Secrets* → **New secret**
   - `EARTHDATA_USERNAME` = tu usuario de urs.earthdata.nasa.gov
   - `EARTHDATA_PASSWORD` = tu contraseña
   - En *Repository access* elige `Nasa-space-apps-2026`.
2. En esa misma página, **Default idle timeout → 240 minutos**. Si no, el Codespace se apaga a los
   30 min sin tocar el teclado aunque haya una descarga corriendo.

## Cada vez (un solo comando)

1. En el repo en GitHub: **Code → Codespaces** → abre tu Codespace (o **Create codespace on main**).
2. En la terminal del Codespace (**Ctrl+`**):
   ```bash
   cd /workspaces/Nasa-space-apps-2026 && git pull && cd "Data analytics" && python cloud/run_jobs.py --solo agricola_ --commit
   ```
   - `--solo agricola_` corre solo los trabajos cuyo nombre empieza así (también `glaciar_`, `terremoto_`,
     o nombres completos). Sin `--solo` corre todo `cloud/trabajos.txt`.
   - `--commit` hace commit + push **solo de `data/analisis/`** (nunca los datos crudos ni los logs;
     archivos de más de 95 MB se saltan con un aviso).
3. En la PC local: `git pull`. Los análisis quedan en `data/analisis/<tipo>/<colección>/`.
4. Para no gastar horas: en github.com/codespaces → **Stop** (los datos crudos se conservan).

Si `git pull` en el Codespace se queja de archivos de `data/analisis` que "would be overwritten" (análisis
generados allí antes de que estuvieran en git), bórralos y repite: `rm -rf "Data analytics/data/analisis"`.

Sin `--commit` se crea en su lugar `resultados/resultados_<fecha>.tar.gz` para descargar a mano
(clic derecho → Download) y descomprimir con `tar -xzf <archivo> -C "Data analytics"`.

## Estructura de data/analisis

`data/analisis/<tipo>/<colección>/`, con el tipo según el prefijo del nombre de la colección:
`agricola_` → agricultura, `colapso_` → deslizamientos, `glaciar_` → glaciares, `incendio_` → incendios,
`inundacion_` → inundaciones, `terremoto_` → terremotos (otro prefijo → otros, o `--tipo` en el análisis).

## Qué trae el paquete (modo sin --commit)

- `data/analisis/<colección>/`: mapas PNG, `estadisticas.json`, GeoTIFF de resultados.
- `catalog.csv`, `manifest.json` y `errors.log` de cada colección.
- Nunca los datos crudos, salvo que los pidas: `python cloud/run_jobs.py --solo-empaquetar --incluir-datos glaciar_jakobshavn`
- Si una colección se bajó pero no tiene análisis, el empaquetado lo avisa (falta el `&& python pipeline/analisis_...`).
- `cloud/logs/<trabajo>.log`.

## Añadir trabajos

Una línea por trabajo en `cloud/trabajos.txt`: `nombre: comando && comando`. Los comandos son los mismos
que en local; añade `--workers 4` a `fetch_quake.py` / `fetch_glacier.py` para bajar 4 pares a la vez.
Si se corta, vuelve a lanzarlo: lo ya descargado se salta.
