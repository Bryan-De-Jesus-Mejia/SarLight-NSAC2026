"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { LanguageSelect } from "@/components/LanguageSelect";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType } from "@/data/types";
import { msg, useT } from "@/i18n/core";
import { formatDate } from "@/lib/format";

/**
 * What the weather events leave behind for people: first by kind of event,
 * then the stories behind our Dominican Republic cases, told from news
 * reports and official bulletins (COE, Indrhi, PAHO). The radar shows where
 * the land changed; the human consequences here come from those reports.
 */

interface Kind {
  type: ChangeType;
  title: string;
  intro: string;
  effects: string[];
  helps: string;
}

const KINDS: readonly Kind[] = [
  {
    type: "flood",
    title: msg("Floods"),
    intro: msg("Water rises faster than the ground and the drains can take it."),
    effects: [
      msg("Homes and belongings: water and mud get into houses, ruin furniture, appliances and papers, and leave walls damp for weeks."),
      msg("Cut-off communities: rivers cover fords and bridges, and whole villages are left with no way in or out."),
      msg("Drinking water: aqueducts are switched off when rivers carry mud, and taps can stay dry for days."),
      msg("Health: still water and damp homes bring diarrhoea, skin infections, leptospirosis and the mosquitoes that carry dengue."),
      msg("Work and school: roads close, classes are suspended and a day's pay is lost."),
    ],
    helps: msg("Clean drains and gullies before the rainy season, and build away from riverbanks."),
  },
  {
    type: "landslide",
    title: msg("Landslides"),
    intro: msg("Soaked hillsides give way, sometimes hours after the rain has stopped."),
    effects: [
      msg("Roads blocked by earth and rocks, sometimes for days, isolating mountain communities."),
      msg("Homes on or below a slope cracked, buried or left unsafe to live in."),
      msg("Power poles and water pipes knocked down on the way."),
    ],
    helps: msg("Do not cut into steep slopes to build, and keep the trees on hillsides."),
  },
  {
    type: "storm",
    title: msg("Wind and storms"),
    intro: msg("A few minutes of strong wind can undo a whole season of work."),
    effects: [
      msg("Crops flattened: plantain and banana plants snap easily, and a farmer can lose the whole harvest in one afternoon."),
      msg("Roofs torn off, above all light zinc roofs."),
      msg("Fallen trees and power lines: blackouts, blocked streets and the danger of live cables."),
    ],
    helps: msg("Tie down roofs and prune the trees near homes and cables before the storm season."),
  },
  {
    type: "drought",
    title: msg("Extreme heat"),
    intro: msg("Heat is the quietest hazard: it leaves no ruins, but it can kill."),
    effects: [
      msg("Heat exhaustion and heat stroke, most dangerous for children, people over 65, pregnant women and people with heart or kidney disease."),
      msg("People who work outdoors, such as farmers, builders and street vendors, are exposed all day."),
      msg("Plants wilt and the soil dries, so crops and pastures suffer."),
    ],
    helps: msg("Drink water often, avoid hard work at midday and check on older neighbours."),
  },
  {
    type: "wetland",
    title: msg("Drought and low reservoirs"),
    intro: msg("When the rain fails for weeks, rivers and reservoirs shrink."),
    effects: [
      msg("Less water for irrigation: fields go thirsty, harvests shrink and food gets more expensive."),
      msg("Water rationing in towns whose aqueducts depend on the reservoirs."),
      msg("Less electricity from hydroelectric dams."),
      msg("Dry pastures and thirsty animals for livestock farmers."),
    ],
    helps: msg("Save water at home, fix leaks and irrigate early or late in the day."),
  },
];

interface Source {
  outlet: string;
  date: string;
  url: string;
}

interface Story {
  id: string;
  type: ChangeType;
  when: string;
  title: string;
  paragraphs: string[];
  facts?: Array<{ value: string; label: string }>;
  /** Our cases about this event: id and the case name, as the app shows it. */
  cases: Array<{ id: string; name: string }>;
  sources: Source[];
}

const STORIES: readonly Story[] = [
  {
    id: "october-trough",
    type: "flood",
    when: msg("22–29 October 2026"),
    title: msg("A week of rain that flooded the country from north to south"),
    paragraphs: [
      msg("In late October a trough, a long band of low pressure with very humid air, settled over the island. It rained almost without pause for a week, and the forecast warned of more than 200 mm in the southwest."),
      msg("It started in the north. On 22 October the streets of Los Callejones, Boca Nueva, La Cañita, El Javillar and La Unión, in Puerto Plata and Sosúa, filled with water. In Santiago, about 100 homes were affected in Hoya de Caimito and about 50 more in the Francisco del Rosario Sánchez sector."),
      msg("Over the weekend the rain moved south and east. In Santo Domingo Norte the Ozama River flooded about 500 homes in Coordinadores, La Cucaracha, Acapulco, Caliche and Majagua. In Capotillo, water got into 16 homes and 11 people had to leave theirs. In Tamayo, Bahoruco, neighbours waded through knee-deep water and mud to save their things, and blamed an old drainage system the town has asked to replace for years."),
      msg("In the south the water reached the countryside: 86 homes flooded in Punta de Garza and 29 in Guayacanal, in Azua; 147 in Palmar de Ocoa; and 19 in Matanzas, Baní. San José de Ocoa was one of the four provinces on yellow alert, with traffic restricted and villages cut off by swollen rivers and streams. In Cambita, San Cristóbal, a gully overflowed and a landslide damaged a road. In Los Cacaos another landslide brought down a power pole and blocked the roads to several mountain communities. On the Miches–El Seibo road, earth covered kilometre 12 until Public Works cleared it."),
      msg("In Monte Plata the Yabacao River rose until it closed the Bayaguana–Guerra road and the Juan Pablo II motorway near the El Naranjo toll, and it left Mata de los Indios cut off."),
      msg("The hardest blow could not be seen from the street: with the rivers full of mud, 67 aqueducts had to stop, and close to a million users were left without running water. Classes were suspended in the most vulnerable areas. No deaths were reported."),
    ],
    facts: [
      { value: "2,675", label: msg("people affected") },
      { value: "535", label: msg("homes flooded") },
      { value: "51", label: msg("communities cut off") },
      { value: "67", label: msg("aqueducts out of service") },
    ],
    cases: [
      { id: "puerto-plata-flood", name: "Puerto Plata flooding" },
      { id: "hoya-caimito-flood", name: "Hoya de Caimito urban flooding" },
      { id: "ozama-flood", name: "Ozama riverside flooding" },
      { id: "capotillo-flood", name: "Capotillo urban flooding" },
      { id: "tamayo-flood", name: "Tamayo urban flooding" },
      { id: "azua-flood", name: "Azua flood analysis" },
      { id: "ocoa-flood", name: "San José de Ocoa flooding" },
      { id: "matanzas-flood", name: "Matanzas flooding" },
      { id: "cambita-flood", name: "Cambita Garabitos flooding" },
      { id: "los-cacaos-landslide", name: "Los Cacaos landslide watch" },
      { id: "miches-landslide", name: "Miches landslide watch" },
      { id: "monte-plata-flood", name: "Monte Plata flood analysis" },
    ],
    sources: [
      { outlet: "Revista Mercado", date: "2026-10-22", url: "https://revistamercado.do/actualidad/puerto-plata-en-alerta-amarilla-por-la-vaguada-el-coe-suma-22-provincias-y-pide-no-cruzar-rios/" },
      { outlet: "El Caribe", date: "2026-10-27", url: "https://www.elcaribe.com.do/panorama/pais/lluvias-inundan-las-calles-de-tamayo-en-bahoruco/" },
      { outlet: "Diario Libre", date: "2026-10-28", url: "https://www.diariolibre.com/planeta/clima/2026/10/28/lluvias-en-republica-dominicana-causan-danos-significativos/3703575" },
      { outlet: "El Caribe", date: "2026-10-28", url: "https://www.elcaribe.com.do/panorama/pais/lluvias-dejan-32-comunidades-incomunicadas-y-534-viviendas-afectadas/" },
      { outlet: "PAHO", date: "2026-10-29", url: "https://www.paho.org/es/monitoreo-amenazas-naturales/monitoreo-amenazas-naturales-29-octubre-2026" },
      { outlet: "N Digital (COE)", date: "2026-10-29", url: "https://n.com.do/2026/10/29/lluvias-dejan-2675-personas-afectadas-y-535-viviendas-anegadas-segun-informe-del-coe/" },
    ],
  },
  {
    id: "dolly",
    type: "storm",
    when: msg("31 August – 1 September 2026"),
    title: msg("What was left of Tropical Storm Dolly"),
    paragraphs: [
      msg("Tropical Storm Dolly had weakened by the time it reached the island, but its rain and wind still did damage. In San Pedro de Macorís, street flooding reached about 100 houses, and 12 more in Los Alcarrizos. In Valverde, trees and power lines came down, and on the beaches of Puerto Plata some businesses were partly damaged. The COE kept 21 provinces on alert. No deaths or injuries were reported."),
    ],
    cases: [
      { id: "san-pedro-flood", name: "San Pedro de Macorís flooding" },
      { id: "valverde-wind", name: "Valverde wind damage" },
    ],
    sources: [{ outlet: "PAHO", date: "2026-09-01", url: "https://www.paho.org/en/natural-hazards-monitoring/natural-hazards-monitoring-1-september-2026" }],
  },
  {
    id: "cibao-wind",
    type: "storm",
    when: msg("2 August 2026"),
    title: msg("A few minutes of wind, a season of plantain lost"),
    paragraphs: [
      msg("On the afternoon of Sunday 2 August a violent gust swept through Las Lagunas and Los Aguacatales, in Moca, and through Salcedo and Tenares. It lasted only a few minutes. Large plantain fields were flattened, several homes lost their roofs, trees and signs fell, the power went out and, in Hermanas Mirabal, it even hailed."),
      msg("A farmer from Moca told Diario Libre that everything he had planted was gone, and that he had not seen wind like that in a long time. Dozens of families who live from those fields were hit, and the Ministry of Agriculture sent technicians to count the losses."),
    ],
    cases: [{ id: "cibao-wind", name: "Cibao wind damage" }],
    sources: [{ outlet: "Diario Libre", date: "2026-08-03", url: "https://www.diariolibre.com/actualidad/sucesos/2026/08/03/ventarron-causa-danos-en-cultivos-y-viviendas-en-el-cibao/3618498" }],
  },
  {
    id: "heat",
    type: "drought",
    when: msg("Late June 2026"),
    title: msg("The hottest day of the year so far"),
    paragraphs: [
      msg("On Monday 29 June the thermometer in Sabaneta, Santiago Rodríguez, reached 39.9 °C, the highest of 2026 until then. Days later the US Climate Prediction Center put the Dominican Republic in its highest heat-risk category for the first week of July."),
      msg("Doctors asked people to drink water without waiting to feel thirsty, to avoid hard work in the middle of the day, never to leave anyone in a closed car, and to check twice a day on older people and on anyone living alone. Our radar watched the fields of the Northwest Line through those weeks, to see the land dry out."),
    ],
    cases: [{ id: "noroeste-heat", name: "Northwest Line heat and drought" }],
    sources: [{ outlet: "Diario Libre", date: "2026-07-02", url: "https://diariolibre.com/planeta/clima/2026/07/02/clima-en-rd-colocan-a-rd-en-alerta-maxima-por-calor-extremo/3587017" }],
  },
  {
    id: "fires",
    type: "wildfire",
    when: msg("June–September 2026"),
    title: msg("A dry year for the pines of the Sierra de Bahoruco"),
    paragraphs: [
      msg("The drought of 2026 also reached the pine forests of the Sierra de Bahoruco national park, in Pedernales. In late June and early July two fires burned 86.5 km² in barely two weeks, close to 8% of the park. The first burned pine forest and part of the Sabana de Peblique; the second, started by lightning, entered an area where the pines were growing back after a fire in 2017."),
      msg("Strong winds, very dry air and steep mountains made the work hard. 110 forest firefighters fought the flames, many of them carried in by helicopter, and they opened new firebreaks. The creole pine was the tree that suffered most."),
      msg("In September the fire came back. On 13 September a fire started in Aceitillar, beside the Hoyo de Pelempito, and burned more than 5 km² of pine forest and rare plants that are home to many animals, and its smoke covered the town. The authorities blamed lightning. According to a column in Acento, it was under control by the 19th, helped by the rain."),
    ],
    facts: [
      { value: "86.5 km²", label: msg("burned in two fires, June–July") },
      { value: "≈ 8%", label: msg("of the national park") },
      { value: "110", label: msg("forest firefighters") },
    ],
    cases: [
      { id: "bahoruco-fire", name: "Sierra de Bahoruco fire analysis" },
      { id: "pelempito-fire", name: "Pelempito fire analysis" },
    ],
    sources: [
      { outlet: "Diario Libre", date: "2026-07-02", url: "https://diariolibre.com/planeta/medioambiente/2026/07/02/incendio-avanza-sobre-zona-regenerada-de-sierra-de-bahoruco/3587384" },
      { outlet: "Diario Libre", date: "2026-07-07", url: "https://diariolibre.com/planeta/medioambiente/2026/07/07/casi-el-8--de-sierra-de-bahoruco-fue-impactado-por-incendios/3591423" },
      { outlet: "Acento", date: "2026-09-19", url: "https://acento.com.do/opinion/fuego-en-parque-nacional-desnuda-al-gobierno-9755505.html" },
    ],
  },
  {
    id: "drought",
    type: "wetland",
    when: msg("June–October 2026"),
    title: msg("A dry summer and the reservoirs of the south"),
    paragraphs: [
      msg("Between June and August it rained 20 to 45% less than normal in much of the country, and the south and southwest had the biggest deficit, according to the Indrhi. Rivers such as the Yaque del Sur, which reaches the San Juan Valley through the Sabana Yegua dam, ran low."),
      msg("The reservoirs kept falling. Sabana Yegua went from 55.8% of its capacity on 10 August to 43.3% in mid-October, and Jigüey from 70.3% to 46.6%. Monte Grande stayed between 41 and 46%, the lowest of the large dams. In October the Indrhi started a preventive protocol for the drought linked to El Niño, and explained its order of priorities if water ran short: drinking water first, then farming, then electricity."),
      msg("The late-October rains brought relief: the national reserve rose to 62.1%, and Sabaneta, in San Juan, climbed from 62% in August to 90.7%."),
      msg("We found no 2026 news about Lake Enriquillo. There, the radar is our only record of how its water changed through the year."),
    ],
    facts: [
      { value: "20–45%", label: msg("less rain than normal, June to August") },
      { value: "43.3%", label: msg("Sabana Yegua in mid-October") },
      { value: "90.7%", label: msg("Sabaneta after the October rains") },
    ],
    cases: [
      { id: "sabana-yegua-reservoir", name: "Sabana Yegua reservoir" },
      { id: "jiguey-reservoir", name: "Jigüey reservoir" },
      { id: "monte-grande-reservoir", name: "Monte Grande reservoir" },
      { id: "sabaneta-reservoir", name: "Sabaneta reservoir" },
      { id: "san-juan-drought", name: "San Juan Valley drought" },
      { id: "enriquillo-lake", name: "Lake Enriquillo" },
    ],
    sources: [
      { outlet: "Diario Libre", date: "2026-08-11", url: "https://www.diariolibre.com/planeta/clima/2026/08/11/45--menos-lluvias-estas-son-las-condiciones-de-las-presas-y-rios/3625695" },
      { outlet: "El Seis", date: "2026-10-13", url: "https://elseis.do/noticias/embalses-de-rd-estan-en-59-20-y-el-indrhi-opera-presas-con-cautela" },
      { outlet: "Diario Digital RD", date: "2026-10-28", url: "https://diariodigitalrd.com/2026/10/28/presas-dominicanas-almacenan-el-62-07-de-su-capacidad-tras-recientes-lluvias.html" },
    ],
  },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export function ImpactsContent() {
  const t = useT();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
      <nav aria-label={t("Site")} className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-accent/60 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {t("Back to the globe")}
        </Link>
        <LanguageSelect />
      </nav>

      <header className="pb-10 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{t("Consequences")}</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.02] text-ink sm:text-6xl">{t("What the weather leaves behind")}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          {t(
            "The radar shows where the land changed. This page is about what that means for the people who live there: first by kind of event, then the stories behind our cases in the Dominican Republic.",
          )}
        </p>
      </header>

      <div className="space-y-12">
        <Section id="kinds" eyebrow={t("01 · By kind of event")} title={t("What each kind of event does to people")}>
          <ul className="grid gap-3">
            {KINDS.map((kind) => (
              <li key={kind.title} className="rounded-2xl border border-line bg-white/[0.03] p-5">
                <h3 className="flex items-center gap-2.5 font-display text-2xl text-ink">
                  <span style={{ color: CHANGE_TYPES[kind.type].color }}>
                    <ChangeTypeIcon type={kind.type} size={20} />
                  </span>
                  {t(kind.title)}
                </h3>
                <p className="mt-1 text-sm text-muted">{t(kind.intro)}</p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/85 marker:text-muted">
                  {kind.effects.map((effect) => (
                    <li key={effect}>{t(effect)}</li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line pt-2.5 text-xs text-muted">{t("What helps: {advice}", { advice: t(kind.helps) })}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="dr" eyebrow={t("02 · Close to home")} title={t("What happened in the Dominican Republic")}>
          <p>
            {t(
              "Our main study area is the Dominican Republic. These are the events behind our cases there, told from the news and the official reports of those days.",
            )}
          </p>
          <div className="space-y-8 pt-2">
            {STORIES.map((story) => (
              <article key={story.id} aria-labelledby={`story-${story.id}`} className="rounded-2xl border border-line bg-white/[0.03] p-5 sm:p-6">
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  <span style={{ color: CHANGE_TYPES[story.type].color }}>
                    <ChangeTypeIcon type={story.type} size={15} />
                  </span>
                  {t(story.when)}
                </p>
                <h3 id={`story-${story.id}`} className="mt-2 font-display text-2xl leading-tight text-ink">
                  {t(story.title)}
                </h3>
                <div className="mt-3 space-y-3">
                  {story.paragraphs.map((p) => (
                    <p key={p}>{t(p)}</p>
                  ))}
                </div>
                {story.facts && (
                  <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {story.facts.map((fact) => (
                      <div key={fact.label} className="rounded-xl border border-line px-3 py-2.5">
                        <dt className="sr-only">{t(fact.label)}</dt>
                        <dd className="text-xl font-medium text-ink">{fact.value}</dd>
                        <dd className="text-[11px] leading-snug text-muted">{t(fact.label)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{t("See it on the globe")}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {story.cases.map((c) => (
                      <Link
                        key={c.id}
                        href={`/?case=${c.id}`}
                        className="rounded-full border border-line px-2.5 py-1 text-xs text-ink/85 transition-colors hover:border-accent/60 hover:text-ink"
                      >
                        {t(c.name)}
                      </Link>
                    ))}
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted">
                  {t("Sources:")}{" "}
                  {story.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && " · "}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-ink">
                        {s.outlet}, {formatDate(s.date)}
                      </a>
                    </span>
                  ))}
                </p>
              </article>
            ))}
          </div>
        </Section>

        <p className="border-t border-line pt-6 text-xs leading-relaxed text-muted">
          {t(
            "The figures in these stories come from news reports and official bulletins (COE, Indrhi, PAHO), not from the radar. The radar maps show where the land changed; they do not count homes or people.",
          )}
        </p>
      </div>
    </main>
  );
}
