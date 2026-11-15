# Dancing with the SARs

**NASA Space Apps Challenge 2026 · "Dancing with the SARs"**

An interactive globe that turns real radar data from the NASA–ISRO **NISAR** satellite into stories anyone can follow:
floods that take homes, wind that flattens a harvest, heat that dries the land, slopes that slide, earthquakes that move
the ground by tens of centimetres, and glaciers sliding into the sea. Built from the Dominican Republic out to the world.

## What you can do

| For | What |
|---|---|
| Everyone | A **simple view** in plain words, a **story mode** that tells each case step by step on the globe, with **"Why?" cards** that explain the science behind each step, a **cloud lens** (the day as a camera saw it, the ground under the clouds inside a circle), the **12-day dance** of ~15,000 real NISAR scenes |
| Communities | **"Is my community at risk?"**: pick a place and see what our radar found nearby. Every case has a **"For people"** card: how many people live on the land that changed, a **field watch** for those who farm (crop loss, drying, flooded fields, normal harvest) and **what to do**, with 9-1-1, COE and Defensa Civil in the Dominican Republic |
| Scientists | A **technical view** with every number and method: thresholds, polarisations (HH/HV, VV/VH), L-band vs C-band, per-pixel baselines, land cover of the change, downloads (JSON, GeoJSON, images) |

Every case has a **"Why it happened"** chain: cause → what happens on the ground → what the radar measured → what people
live through. Where the world left a record, the cause comes with evidence: rain, heat and wind from the ERA5 reanalysis,
earthquakes from the USGS catalogue.

## The cases (82)

- **Dominican Republic (24):** floods in Capotillo, Santo Domingo Norte (Ozama), San Pedro de Macorís, San José de Ocoa,
  Azua, Monte Plata, Puerto Plata, Hoya de Caimito (Santiago), Tamayo, Matanzas and Cambita Garabitos; wind damage in the
  Cibao and Valverde; heat and drought on the Línea Noroeste and in the San Juan Valley; landslide watch in Los Cacaos and
  Miches; fire analyses in Sierra de Bahoruco and Pelempito; the water of the Sabana Yegua, Monte Grande, Jigüey and
  Sabaneta reservoirs and of Lake Enriquillo.
- **World (58):** floods in Haiti, Honduras, Panama, Colombia, Ecuador, Argentina, Paraguay, Mexico, the US, India and Nepal;
  landslide watch in Guatemala and Honduras; a windstorm in southern Brazil; reservoirs and lakes in Mexico, Ecuador,
  Colombia and El Salvador; earthquakes in Venezuela, Mexico, Indonesia and Panama; the Langtang collapse in Nepal;
  glaciers (Jakobshavn, Hubbard, Pine Island); harvests, rice flooding, crop burning and forest clearing in the US, Canada,
  Ukraine, Egypt, Vietnam, Bangladesh, India, Indonesia and Brazil.

## Honesty

Every figure comes from real radar scenes processed by our own pipeline. Nothing is simulated. A flagged change is a
**lead, not a verdict**: nothing has been verified on the ground, and the app says so next to the numbers. The assistant
chat is a free language model that answers only from these analyses (see below); when it is unavailable, the chat falls
back to built-in answers.

## Run it

```bash
cd ProyectoTal
npm install
npm run dev        # http://localhost:3000
```

Deploying on Vercel: the `vercel.json` at the repository root builds `ProyectoTal`.

### The assistant (free tiers)

`/api/chat` sends each question, with a summary of every case by kind and country, one line per case of the kinds and
countries it names, and the full facts of the cases it is about (the open one and the ones it names), to **Groq** first and to the free models of **OpenRouter** when Groq is
out of quota. The prompt stays under about 4,000 tokens however many cases there are. Both keys are free and need no card:

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |
| `GROQ_MODEL` (optional) | default `openai/gpt-oss-120b` |
| `OPENROUTER_MODELS` (optional) | comma-separated, tried in order; default `google/gemma-4-31b-it:free,nvidia/nemotron-3.5-super-vl:free` |

Put them in `ProyectoTal/.env.local` for `npm run dev`, and in Vercel → Settings → Environment Variables for the site.
Without keys, or when every provider fails, the chat answers from its built-in replies.

## Reproduce the data

```bash
# 1. Radar analyses (Python, see DataAnalytics/requirements.txt and DataAnalytics/cloud/trabajos.txt)
cd DataAnalytics && pip install -r requirements.txt
python pipeline/bulk_fetch.py --name <case> --bbox ... --start ... --end ...   # needs a free NASA Earthdata login
python pipeline/analisis_temporal.py --collection data/collections/<case> --mode inundacion|cambio|cosecha

# 2. Export for the app
cd ../ProyectoTal
python ../DataAnalytics/pipeline/export_web.py     # change maps
node scripts/export-extra.mjs                      # floods over time, wind, heat, drought, landslides, reservoirs, quakes, glaciers, farming
node scripts/export-context.mjs                    # weather (Open-Meteo/ERA5) and earthquakes (USGS)
python ../DataAnalytics/pipeline/export_people.py  # people on the changed land (GHSL population grid)
python ../DataAnalytics/pipeline/export_passes.py  # the 12-day dance
```

## Data and credits

- **NISAR** L2 GCOV and GUNW products, NASA/JPL and ISRO, distributed by the Alaska Satellite Facility DAAC.
- **Sentinel-1** RTC backscatter (OPERA, NASA), contains Copernicus Sentinel data.
- **Weather:** Open-Meteo historical weather API, ERA5 reanalysis, CC BY 4.0.
- **Earthquakes:** USGS earthquake catalogue, public domain.
- **Population:** GHS-POP R2023A (epoch 2025, 30 arc-seconds), European Commission JRC, CC BY 4.0.
- **Land cover:** ESA WorldCover 2021 v200, CC BY 4.0.
- **Imagery:** NASA GIBS (NOAA-20 VIIRS, NISAR, OPERA layers); Sentinel-2 cloudless by EOX (contains modified Copernicus Sentinel data 2021).

## Known limits

- Most analyses compare a handful of passes; NISAR data are public only since mid-2026.
- Weather comes from a ~25 km grid at the centre of each area.
- `DataAnalytics/data/analisis` is large (about 1 GB); consider publishing it as a release instead of keeping it in git.

## License

Code: MIT (see `LICENSE`). Data keep the licences of their sources listed above.

