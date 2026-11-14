# Dancing with the SARs — Project specification

NASA Space Apps Challenge 2026 · Challenge: **"Dancing with the SARs"**
Package name: `globalearth`

> **Status: Phases 1–3, 5 and 6 delivered** (tour mode skipped by decision) —
> project, data layer, 3D globe, case panel, timeline, filters, search and the
> Methods page. **All simulated data has been removed:** every figure in the app now
> comes from real NISAR and Sentinel-1 radar scenes analysed by our own pipeline
> (`Data analytics/`). Everything else in this document is the plan for the next
> phases. See [Roadmap](#9-roadmap).

---

## 1. Vision

Synthetic Aperture Radar sees the Earth day and night, through cloud and smoke,
and measures change down to millimetres. NISAR (NASA–ISRO) maps almost all land
and ice every 12 days in L-band and S-band. That is an extraordinary record of a
planet that never holds still — and almost nobody outside the radar community
can read it.

**Dancing with the SARs** is an interactive explorer that turns that record into
something a curious person can follow:

1. **See where** the surface is changing, on a globe.
2. **Understand what** changed, with a before/after view and a plain-language
   explanation of how radar saw it.
3. **Judge how sure** we are, with the change plotted against its own baseline
   and an explicit significance statement.
4. **Ask why**, with hypothesised drivers and impacts — always labelled as
   hypotheses.

Six kinds of change are covered: wetlands & water, glaciers & ice, wildfire,
earthquakes, agriculture, and land deformation.

### Honesty rules (non-negotiable)

- Every number shown comes from a real radar scene. Nothing is invented or simulated.
- A flagged change is a **lead**, not a finding: nothing has been verified on the
  ground, and the panel says so ("Real radar data · not verified on the ground").
- Interpretation ("what a change like this can mean") is worded as context; the
  panel computes its own cautions from the data (share of the change over open
  water, very small areas, direction that contradicts the hypothesis, passes from
  different NISAR processing releases).
- Only two passes are compared, so no statistical significance is claimed.

---

## 2. Stack

| Concern    | Choice                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router, Turbopack, `cacheComponents` + `partialPrefetching`) |
| UI         | React 19, TypeScript strict (no `any`)                                   |
| Styling    | Tailwind CSS 4 (`@theme inline` tokens in `app/globals.css`)             |
| Globe      | `react-globe.gl` on `three`                                              |
| State      | Zustand                                                                  |
| Fonts      | Instrument Serif, IBM Plex Sans, IBM Plex Mono via `next/font` (self-hosted at build) |

**Offline at runtime.** Textures are local files copied from the `three-globe`
package, fonts are self-hosted, the star background is drawn on a canvas. No CDN,
no public API, no data download.

---

## 3. Architecture

The app lives in the `ProyectoTal/` folder of the repository (run `npm`
commands there). `.claude/launch.json` stays at the repository root.

**Deploying to Vercel:** the repository root is not the app. In the Vercel
project, set **Settings → Build and Deployment → Root Directory** to
`ProyectoTal` (this cannot be set from `vercel.json`). `ProyectoTal/vercel.json`
then pins the framework and the install/build commands.

```
app/
  layout.tsx            fonts + metadata
  icon.svg              favicon (Earth + radar pulses)
  globals.css           tokens, .glass, tooltip, marker, loader
  page.tsx              renders <Explorer />
  methods/page.tsx      /methods: how a change is measured, limits, sources
  api/events/route.ts   GET /api/events
components/
  Explorer.tsx          client: loads data, mounts globe (dynamic, ssr:false), HUD, error, loader
  Hud.tsx               title, search, Demo / Methods buttons, dock
  Legend.tsx            legend that doubles as the filter (types present in the data)
  Timeline.tsx          date scrubber with play/pause and activity chart
  SearchBox.tsx         search by name, place or type, with a results list
  LoadingScreen.tsx     loading cover
  globe/GlobeScene.tsx  the globe (client)
  panel/CasePanel.tsx   case panel (opens on selection)
  panel/SarViewer.tsx   real before/after, difference and flagged-pixel images
  panel/BackscatterChart.tsx  median backscatter on every pass of the track
  icons/ChangeTypeIcon.tsx
data/
  types.ts              types and the DataProvider interface
  changeTypes.ts        colour, glyph and label per change type
  analysis/cases.json   exported radar analyses (generated, see 4.1)
  providers/index.ts    returns the analysis provider
  providers/analysisProvider.ts  reads cases.json -> EventSummary / EventDetail
store/useAppStore.ts    Zustand store
hooks/                  useElementSize, usePrefersReducedMotion, useVisibleEvents
lib/                    starfield, dom, format, time, search, events, geo, camera, trail, imagery
public/analysis/<case>/ web-sized images of each analysis (generated, see 4.1)
```

### 3.1 Data flow

```
Data analytics/data/analisis  →  pipeline/export_web.py  →  data/analysis/cases.json
                                                         →  public/analysis/**.webp
AnalysisProvider (server)  →  GET /api/events  →  Zustand store  →  Globe + HUD + panel
```

- The interface consumes **only** the API route, never a provider directly.
- The list is requested **once**. Filters, search and the timeline are applied on
  the client (`hooks/useVisibleEvents.ts`).
- `cases.json` is imported at build time, so the deployed app needs no filesystem
  or database. To add or update an analysis, run the exporter and redeploy.

### 3.2 Data model (`data/types.ts`)

- **`EventSummary`** — what the globe paints: `id`, `type` (what the analysis looked
  for: wildfire, flood…), `name`, `region`, `country`, `lat`, `lon`, `startDate`,
  `endDate` (first and last pass compared), `sensors`, `changedAreaKm2`,
  `changedPct`, `footprint` (real outline of the analysed area).
- **`EventDetail extends EventSummary`** — `analyses: SensorAnalysis[]`, one per
  sensor and polarisation (NISAR first). Each holds the two passes, the method
  (threshold, direction, median filter, water threshold), the grid, statistics over
  the whole scene and over **land only**, the image paths and the pass-by-pass series.

```ts
interface DataProvider {
  readonly source: DataSource;           // "analysis"
  getEvents(filters?: EventFilters): Promise<EventSummary[]>;
  getEventById(id: string): Promise<EventDetail | null>;
  getTimeRange(): Promise<TimeRange>;
}
```

### 3.3 API

| Route                  | Phase | Response                                                        |
| ---------------------- | ----- | --------------------------------------------------------------- |
| `GET /api/events`      | 1     | `{ meta: { source, count, timeRange }, events: EventSummary[] }` |
| `GET /api/events/[id]` | 2     | `EventDetail`                                                   |

Provider failure → HTTP 503 with
`{ error: { code: "DATA_SOURCE_UNAVAILABLE", message } }`. Unknown id → HTTP 404
with code `EVENT_NOT_FOUND`.

### 3.4 Live feeds (not built)

Adding live hazard data (earthquakes, fires, storms, floods) means implementing
`DataProvider` for each feed and composing them in `providers/index.ts`. Research
notes: USGS earthquake GeoJSON (no key), NASA FIRMS (free MAP_KEY), NASA EONET v3
(no key), GDACS, NOAA NHC. A live event has no end date, and the per-event label
("Live · USGS") would replace the single "Real radar data" badge.

---

## 4. Real data: radar change analyses

### 4.1 Pipeline

`Data analytics/pipeline/` (Python, run from its `.venv`):

1. `bulk_fetch.py` — finds every NISAR (L2 GCOV) and OPERA RTC-S1 scene over an area
   through ASF, streams only the area of interest and stores it in dB under
   `data/collections/<name>/` with a `catalog.csv` of per-scene statistics.
2. `sar_change_detection.py` — compares two passes of the same track: dB difference
   (after − before), 5×5 median filter, threshold (3 dB). Output goes to
   `data/analisis/<case>/<sensor_pol>/` (`diferencia_db.tif`, `mascara_cambio.tif`,
   `estadisticas.json`, `visualizacion.png`).
3. `export_web.py` — turns those results into web assets: four WebP images per
   analysis (before, after, difference, flagged pixels), the real footprint in
   lon/lat, and `data/analysis/cases.json`. It also derives the **land-only**
   figures by setting aside pixels that were already open water in the before image
   (darker than −17 dB in HH/VV, −22 dB in HV/VH), because wind and waves change
   the echo of the sea. Run it with `python pipeline/export_web.py`.

### 4.2 The analyses in the app

| Case                | What it looked for | Sensors                | Passes compared            |
| ------------------- | ------------------ | ---------------------- | -------------------------- |
| Pelempito           | wildfire (weaker echo) | NISAR HV, Sentinel-1 VH | Sep 2026                   |
| Sierra de Bahoruco  | wildfire (weaker echo) | NISAR HV, Sentinel-1 VH | Jun–Jul 2026               |
| Azua                | flood (both directions) | NISAR HH               | 17 → 29 Oct 2026           |
| Monte Plata         | flood (both directions) | NISAR HH               | 17 → 29 Oct 2026           |

Names and regions of the cases are set in `CASES` inside `export_web.py`; every
number is read from the analysis files.

### 4.3 What the panel shows

Sensor tabs; a viewer with before/after swipe, difference and flagged-pixel views;
changed area on land, weaker/stronger split, mean change and the dates; the median
backscatter of the area on every pass of the same track (with the two compared
passes marked); context on what a change like this can mean; computed cautions;
and a collapsible "how this was computed".

---

## 5. The seven features

| # | Feature               | Phase | Summary |
| - | --------------------- | ----- | ------- |
| 1 | **3D globe**          | 1 ✅  | One marker per analysed area (size from the area that changed, on a log scale), pulsing rings, the real outline of the analysed area, tooltip, click-to-fly camera. |
| 2 | **Case panel**        | 2 ✅  | Opens on selection: real before/after, difference and flagged-pixel images, changed area on land, backscatter on every pass, context and computed cautions (see 4.3). |
| 3 | **Timeline**          | 3 ✅  | Scrubber across the data window with play/pause and a chart of how many signals are active each day. With a date set, the globe shows the signals active on that date (`startDate ≤ date ≤ endDate`); "Show all" returns to the whole period. Client-side only. |
| 4 | **Tour mode**         | Skipped | Guided flight through the 8 featured cases, starting at Lake Enriquillo, with narration cards; pausable and skippable. |
| 5 | **Filters & search**  | 5 ✅  | Multi-select filter by what the analysis looked for (only types present in the data) and a search box over name, region, country and type (accent-insensitive). Picking a result flies to that case. |
| 6 | **Methods page**      | 6 ✅  | `/methods`: what SAR and NISAR are, the techniques, the step-by-step change measurement with a table of every analysis, the limits of the numbers, and the sources. |
| 7 | **Accessible event list & polish** | 7 | A keyboard- and screen-reader-friendly list equivalent to the globe, responsive pass, performance pass, final README. |

---

## 6. Design

**Direction:** a quiet observatory. The Earth is the hero; the interface is a
thin instrument layer over it.

- **Colour tokens** — `void #03050a`, `ink #e9edf5`, `muted #9ba7bb`,
  `line rgb(255 255 255 / .12)`, warm `accent #f2b866`. Dark scheme only.
- **Type** — Instrument Serif (display, with italics for *SARs*), IBM Plex Sans
  (text), IBM Plex Mono (labels, numbers, eyebrow lines).
- **Surfaces** — `.glass`: `rgb(10 14 24 / .62)`, hairline border,
  `blur(14px) saturate(140%)`, deep shadow.
- **Change types** — each has a colour **and** its own glyph; colour is never
  the only signal.

| Type        | Label             | Colour    | Glyph                     |
| ----------- | ----------------- | --------- | ------------------------- |
| wetland     | Wetlands & water  | `#2dd4bf` | three waves               |
| glacier     | Glaciers & ice    | `#7dd3fc` | mountain with snow cap    |
| wildfire    | Wildfire          | `#fb923c` | flame                     |
| earthquake  | Earthquakes       | `#fb7185` | seismic trace             |
| agriculture | Agriculture       | `#a3e635` | sprout with two leaves    |
| deformation | Land deformation  | `#a78bfa` | lines with a down arrow   |

- **Globe** — daytime Blue Marble texture (the night texture makes continents
  unreadable under the signals) with topography bump, `#6ea8ff` atmosphere, a
  canvas-generated starfield, a camera-riding key light and a soft vignette.

---

## 7. Quality

- **TypeScript** strict, no `any`. `npm run lint` and `npm run build` clean.
- **Performance** — globe accessors live at module level with stable identity,
  so unrelated state changes never rebuild a WebGL layer. Marker handlers go
  through a ref so markers are created once. The globe mounts only once its
  container has a size.
- **Accessibility** — a WebGL globe cannot be navigated by keyboard, so the 8
  featured cases are real, focusable buttons with accessible names (Phase 7
  adds a full list). `prefers-reduced-motion` removes rotation, rings, point
  transitions and camera flights. Visible focus ring everywhere. Status and
  alert roles on loading and error states.
- **Resilience** — no WebGL → explanatory card. Data failure → alert card with
  "Try again".
- **Language** — interface, code and comments in English.

---

## 8. Fit to the challenge

| The challenge asks for…                              | The app answers with…                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| An interactive way to explore SAR data               | A globe of change signals, a case panel, a timeline and a tour     |
| Tracking surface change over time                    | Per-case time series against a baseline; a global timeline         |
| Making radar understandable to non-experts           | Plain-language "how radar saw this" per case; a Methods page       |
| Use of NISAR                                         | `DataProvider` seam + `NisarProvider` plan (GCOV / GUNW / GOFF)    |
| Scientific honesty                                   | Real data only; limits and cautions shown next to every number     |
| Local relevance                                      | Four areas of the Dominican Republic analysed with NISAR           |

---

## 9. Roadmap

| Phase | Scope                                             | Status |
| ----- | ------------------------------------------------- | ------ |
| 1     | Project, data layer, globe                        | ✅ Done |
| 2     | Case panel (`EventDetail`, `/api/events/[id]`, before/after slider, charts) | ✅ Done |
| 3     | Timeline with play (+ change-type filters from the legend) | ✅ Done |
| 4     | Tour mode                                         | Skipped (team decision) |
| 5     | Filters and search                                | ✅ Done |
| 6     | `/methods` page                                   | ✅ Done |
| 7     | Accessible event list, polish, final README       | Next |

### Not built yet

Accessible event list, polish, final README. (Tour mode: skipped.) Ideas: drape the
difference image on the globe at its real position; per-pixel baselines from the whole
time series so significance can be measured; cross-checks against independent fire
and flood records; live hazard feeds (see 3.4).
