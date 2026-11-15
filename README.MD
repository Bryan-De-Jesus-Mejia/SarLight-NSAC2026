# Dancing with the SARs

**NASA Space Apps Challenge 2026 · "Dancing with the SARs"**

An interactive globe that turns real radar data from the NASA–ISRO **NISAR** satellite into stories anyone can follow:
floods that take homes, wind that flattens a harvest, heat that dries the land, slopes that slide, earthquakes that move
the ground by tens of centimetres, and glaciers sliding into the sea. Built from the Dominican Republic out to the world.

## What you can do

| For | What |
|---|---|
| Everyone | A **simple view** in plain words, a **story mode** that tells each case step by step on the globe, a **radar lens** (the day as a camera saw it, the radar inside a circle), the **12-day dance** of ~15,000 real NISAR scenes |
| Scientists | A **technical view** with every number and method: thresholds, polarisations (HH/HV, VV/VH), L-band vs C-band, per-pixel baselines, land cover of the change, downloads (JSON, GeoJSON, images) |

Every case has a **"Why it happened"** chain: cause → what happens on the ground → what the radar measured → what people
live through. Where the world left a record, the cause comes with evidence: rain, heat and wind from the ERA5 reanalysis,
earthquakes from the USGS catalogue.

## The cases (29)

- **Dominican Republic (13):** floods in Capotillo, Santo Domingo Norte (Ozama), San Pedro de Macorís, San José de Ocoa,
  Azua and Monte Plata; wind damage in the Cibao and Valverde; heat and drought on the Línea Noroeste; landslide watch in
  Los Cacaos and Miches; fire analyses in Sierra de Bahoruco and Pelempito.
- **World (16):** earthquakes in Venezuela, Mexico, Indonesia and Panama; the Langtang collapse in Nepal; glaciers
  (Jakobshavn, Hubbard, Pine Island); harvests, rice flooding, crop burning and forest clearing in the US, Canada, Ukraine,
  Egypt, Vietnam, India and Brazil.

## Honesty

Every figure comes from real radar scenes processed by our own pipeline. Nothing is simulated. A flagged change is a
**lead, not a verdict**: nothing has been verified on the ground, and the app says so next to the numbers. The assistant
chat gives guided, offline answers; it is not an AI model.

## Run it

```bash
cd ProyectoTal
npm install
npm run dev        # http://localhost:3000
```

Deploying on Vercel: set **Root Directory** to `ProyectoTal`.

## Reproduce the data

```bash
# 1. Radar analyses (Python, see DataAnalytics/requirements.txt and DataAnalytics/cloud/trabajos.txt)
cd DataAnalytics && pip install -r requirements.txt
python pipeline/bulk_fetch.py --name <case> --bbox ... --start ... --end ...   # needs a free NASA Earthdata login
python pipeline/analisis_temporal.py --collection data/collections/<case> --mode inundacion|cambio|cosecha

# 2. Export for the app
cd ../ProyectoTal
python ../DataAnalytics/pipeline/export_web.py     # change maps
node scripts/export-extra.mjs                      # floods over time, wind, heat, landslides, quakes, glaciers, farming
node scripts/export-context.mjs                    # weather (Open-Meteo/ERA5) and earthquakes (USGS)
python ../DataAnalytics/pipeline/export_passes.py  # the 12-day dance
```

## Data and credits

- **NISAR** L2 GCOV and GUNW products, NASA/JPL and ISRO, distributed by the Alaska Satellite Facility DAAC.
- **Sentinel-1** RTC backscatter (OPERA, NASA), contains Copernicus Sentinel data.
- **Weather:** Open-Meteo historical weather API, ERA5 reanalysis, CC BY 4.0.
- **Earthquakes:** USGS earthquake catalogue, public domain.
- **Land cover:** ESA WorldCover 2021 v200, CC BY 4.0.
- **Imagery:** NASA GIBS (NOAA-20 VIIRS, NISAR, OPERA layers); Sentinel-2 cloudless by EOX (contains modified Copernicus Sentinel data 2021).

## Known limits

- Most analyses compare a handful of passes; NISAR data are public only since mid-2026.
- Weather comes from a ~25 km grid at the centre of each area.
- `DataAnalytics/data/analisis` is large (about 1 GB); consider publishing it as a release instead of keeping it in git.

## License

Code: MIT (see `LICENSE`). Data keep the licences of their sources listed above.
