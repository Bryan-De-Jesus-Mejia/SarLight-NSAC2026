# Dancing with the SARs — Project specification

NASA Space Apps Challenge 2026 · Challenge: **"Dancing with the SARs"**
Package name: `globalearth`

> **Status: Phase 1 delivered** — project, data layer and 3D globe running on
> simulated data. Everything else in this document is the plan for the next
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

- Any simulated value is **always** labelled "Simulated data" in the interface.
- No invented number is ever presented as a real measurement.
- Drivers and impacts are worded as hypotheses, not findings.
- The label is driven by the data itself (`source: "mock" | "nisar"`), so it
  disappears only when real data is actually connected.

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

```
app/
  layout.tsx            fonts + metadata
  globals.css           tokens, .glass, tooltip, marker, loader
  page.tsx              renders <Explorer />
  api/events/route.ts   GET /api/events
components/
  Explorer.tsx          client: loads data, mounts globe (dynamic, ssr:false), HUD, error, loader
  Hud.tsx               title, "Simulated data" badge, legend
  LoadingScreen.tsx     loading cover
  globe/GlobeScene.tsx  the globe (client)
  icons/ChangeTypeIcon.tsx
data/
  types.ts              types and the DataProvider interface
  changeTypes.ts        colour, glyph and label per change type
  mock/featured.ts      8 featured cases
  mock/generate.ts      320 secondary signals
  providers/index.ts    picks the provider (env DATA_SOURCE)
  providers/mockProvider.ts
  providers/nisarProvider.ts   empty skeleton with TODOs
store/useAppStore.ts    Zustand store
hooks/                  useElementSize, usePrefersReducedMotion
lib/                    prng, starfield, dom
public/textures/        earth-blue-marble.jpg, earth-topology.png
```

### 3.1 Data flow

```
DataProvider (server)  →  GET /api/events  →  Zustand store  →  Globe + HUD
   mock | nisar             the only door        client state
```

- The interface consumes **only** the API route, never a provider directly.
- The list is requested **once**. Filters and the timeline are applied on the
  client, so scrubbing time never hits the network.
- `DATA_SOURCE=nisar` switches the provider; any other value uses the mock.
  The route resolves at request time, so the variable is read from the running
  server.

### 3.2 Data model (`data/types.ts`)

The event type is split in two so the globe stays light:

- **`EventSummary`** — what the globe paints: `id`, `type`, `name`, `region`,
  `country`, `lat`, `lon`, `startDate`, `endDate` (ISO `YYYY-MM-DD`),
  `magnitude` (0–1), `featured`, `significance`, `source`.
- **`EventDetail extends EventSummary`** — what the case panel shows (Phase 2):
  `areaKm2`, `summary` (two sentences), `sar { technique, band, polarizations,
  explanation }`, `drivers`, `impact`, `metric { label, unit, series,
  baselineEndDate }`, `change { value, unit, direction }`,
  `significanceDetail { level, pValue, zScore, method }`, `imagery`
  (`synthetic` seed + style, or `url` before/after).

Supporting types: `ChangeType`, `SignificanceLevel`, `DataSource`,
`SarTechnique`, `Polarization`, `EventFilters`, `TimeRange`, `EventsMeta`,
`EventsResponse`, `ApiErrorResponse`.

```ts
interface DataProvider {
  readonly source: DataSource;
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
`{ error: { code: "DATA_SOURCE_UNAVAILABLE", message } }`.

### 3.4 Connecting real NISAR data (`NisarProvider`)

The skeleton lists the work as TODOs:

1. **Auth** — Earthdata Login token, server-side env only.
2. **Discovery** — NASA CMR and/or ASF DAAC search by collection, area, time.
3. **Products** — GCOV → backscatter change; GUNW → displacement; GOFF → ice
   flow.
4. **Preprocessing** — reduce multi-GB HDF5 granules offline to small JSON/COG.
5. **Mapping** — emit `EventSummary` / `EventDetail` with `source: "nisar"`.
6. **Significance** — from the real variability of each baseline.

---

## 4. Simulated data

All mock data is **deterministic**: `lib/prng.ts` (`mulberry32`, Box–Muller
`gaussian`, `pick`, `clamp`), never `Math.random()`. Mock window:
`2025-10-01 → 2026-10-31`.

### 4.1 Featured cases (8)

Real locations, invented values. Lake Enriquillo is first — the team's home case.

| id                            | type        | place                                   | magnitude | significance |
| ----------------------------- | ----------- | --------------------------------------- | --------- | ------------ |
| `enriquillo-lake-advance`     | wetland     | Lake Enriquillo, Dominican Republic     | 0.86      | high         |
| `jakobshavn-terminus-retreat` | glacier     | Jakobshavn Isbræ, Greenland             | 0.92      | high         |
| `everglades-marsh-loss`       | wetland     | Cape Sable, Florida, United States      | 0.64      | medium       |
| `sierra-foothills-burn-scar`  | wildfire    | El Dorado County, California, United States | 0.78  | high         |
| `atacama-coast-rupture`       | earthquake  | Antofagasta, Chile                      | 0.95      | high         |
| `mekong-delta-subsidence`     | deformation | Cần Thơ, Vietnam                        | 0.72      | medium       |
| `punjab-crop-rotation-shift`  | agriculture | Ludhiana, Punjab, India                 | 0.58      | medium       |
| `rondonia-forest-conversion`  | agriculture | Rondônia, Brazil                        | 0.81      | high         |

### 4.2 Secondary signals (320)

Seed `20261109`. Each signal picks a change type, then a **real cluster** for
that type (e.g. glaciers → West Greenland margin, Karakoram, Svalbard…;
earthquakes → Honshu, East Anatolian Fault, Zagros…), and scatters around it
with a gaussian (σ = the cluster's spread in degrees). Longitude scatter is
corrected by `1 / max(cos(lat), 0.2)`, longitude is wrapped to `[-180, 180]`
and latitude clamped to ±85. This keeps the globe believable: glaciers at high
latitudes, earthquakes on plate boundaries, nothing in the open ocean.

- `magnitude = clamp(0.06 + rand()^2.2 · 0.8, 0, 1)` — skewed to small signals.
- Dates: random start inside the window, duration 12–191 days, end capped.
- `significance`: `score = magnitude + (rand − 0.5) · 0.25`; `> 0.55` high,
  `> 0.28` medium, otherwise low.
- `id` `sig-0001…`, `name` `"<cluster> <type phrase>"`, lat/lon and magnitude
  rounded to 3 decimals.

---

## 5. The seven features

| # | Feature               | Phase | Summary |
| - | --------------------- | ----- | ------- |
| 1 | **3D globe**          | 1 ✅  | All signals as coloured columns (height and radius by magnitude), pulsing rings and focusable markers on the 8 featured cases, tooltip, click-to-fly camera, auto-rotation. |
| 2 | **Case panel**        | 2     | Opens on selection. Before/after slider (synthetic backscatter or interferogram imagery), metric time series with baseline and uncertainty band, change value, significance (p-value, z-score, method), "how radar saw this" explainer, hypothesised drivers and impact. |
| 3 | **Timeline**          | 3     | Scrubber across the data window with play/pause; signals appear and fade by their start/end dates. Client-side only. |
| 4 | **Tour mode**         | 4     | Guided flight through the 8 featured cases, starting at Lake Enriquillo, with narration cards; pausable and skippable. |
| 5 | **Filters & search**  | 5     | Toggle change types from the legend, featured-only switch, significance filter, search by name/region/country. |
| 6 | **Methods page**      | 6     | `/methods`: what SAR and NISAR are, each technique (backscatter, InSAR, coherence, polarimetry), how significance is computed, what is simulated and what is not, data sources. |
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
| Scientific honesty                                   | Significance shown explicitly; simulated data always labelled      |
| Local relevance                                      | Lake Enriquillo (Dominican Republic) as the lead case              |

---

## 9. Roadmap

| Phase | Scope                                             | Status |
| ----- | ------------------------------------------------- | ------ |
| 1     | Project, data layer, globe with simulated data    | ✅ Done |
| 2     | Case panel (`EventDetail`, `/api/events/[id]`, before/after slider, charts) | Next |
| 3     | Timeline with play                                | Planned |
| 4     | Tour mode                                         | Planned |
| 5     | Filters and search                                | Planned |
| 6     | `/methods` page                                   | Planned |
| 7     | Accessible event list, polish, final README       | Planned |

### Out of scope for Phase 1

Case panel, timeline, tour, filters and search, `/methods`,
`/api/events/[id]`, accessible event list, final README.
