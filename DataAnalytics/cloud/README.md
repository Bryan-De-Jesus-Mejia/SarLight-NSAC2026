# Correr el pipeline en la nube (GitHub Codespaces)

La PC local baja de ASF a ~1 MB/s. En un Codespace la descarga es mucho más rápida, así que allí se
baja y se analiza todo, y a casa solo viene un `.tar.gz` con el análisis (los datos crudos se quedan en la nube).

Plan gratis de GitHub: 120 horas-núcleo/mes (60 h en la máquina de 2 núcleos) y 15 GB de disco.

## Automático (sin tocar nada): GitHub Actions

`.github/workflows/procesar-eventos.yml` procesa solo los trabajos de `cloud/trabajos.txt` que aún no tienen
análisis (no hay `resumen*.json` en `data/analisis/<tipo>/<trabajo>/`) y sube **solo `data/analisis/`**,
un commit por trabajo. Se dispara:
- al subir un cambio a `cloud/trabajos.txt` → **añadir un evento = añadir su línea y hacer push**;
- cada 30 minutos (reintenta lo que falló);
- a mano: pestaña **Actions → Procesar eventos SAR → Run workflow**.

Si se acerca el límite de 6 h de GitHub, deja de empezar trabajos y se relanza solo para seguir.
Cuando un trabajo falla, la ejecución sale en rojo (GitHub te avisa por correo) y el log queda como
artefacto `logs` en esa ejecución. Para reprocesar algo ya hecho, borra su carpeta de `data/analisis` y haz push.

Configuración (una vez): repo → **Settings → Secrets and variables → Actions → New repository secret**:
`EARTHDATA_USERNAME` y `EARTHDATA_PASSWORD` (son distintos de los secrets de Codespaces).
Coste: repo privado = minutos de Actions del plan (2,000/mes en GitHub Free).

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
2. En la terminal del Codespace (**Ctrl+`**), desde `/workspaces/Nasa-space-apps-2026/DataAnalytics`:
   ```bash
   cloud/correr.sh embalse_sabaneta lago_enriquillo
   ```
   Hace `git pull`, descarga y analiza esos trabajos, y hace commit + push **solo de `data/analisis/`**
   (nunca los datos crudos ni los logs; archivos de más de 95 MB se saltan con un aviso).
   - Nombres completos o prefijos: `cloud/correr.sh embalse_` corre todos los embalses.
   - Un bloque entero de `cloud/trabajos.txt`: `cloud/correr.sh --grupo meteo_rd`
     (`meteo_rd` = 15 incidencias en RD, `agricultura` = 10, `eventos_globales` = terremotos y glaciares).
   - Sin argumentos lista los grupos y trabajos disponibles.
   - Para un evento nuevo, añade su línea a `cloud/trabajos.txt` (en tu PC o en el Codespace) y córrelo por nombre.
3. En la PC local: `git pull`. Los análisis quedan en `data/analisis/<tipo>/<colección>/`.
4. Para no gastar horas: en github.com/codespaces → **Stop** (los datos crudos se conservan).

Si `git pull` en el Codespace se queja de archivos de `data/analisis` que "would be overwritten" (análisis
generados allí antes de que estuvieran en git), bórralos y repite: `rm -rf DataAnalytics/data/analisis`.

Sin `--commit` se crea en su lugar `resultados/resultados_<fecha>.tar.gz` para descargar a mano
(clic derecho → Download) y descomprimir con `tar -xzf <archivo> -C DataAnalytics`.

## Estructura de data/analisis

`data/analisis/<tipo>/<colección>/`, con el tipo según el prefijo del nombre de la colección:
`agricola_` → agricultura, `colapso_` → deslizamientos, `glaciar_` → glaciares, `incendio_` → incendios,
`inundacion_` → inundaciones, `terremoto_` → terremotos, `deslizamiento_` → deslizamientos, `viento_` → vientos,
`calor_` → calor_extremo, `sequia_` → sequias, `embalse_`/`lago_` → embalses_y_lagos
(otro prefijo → otros, o `--tipo` en el análisis).

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
