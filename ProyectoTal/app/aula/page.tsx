import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AnswerKey, PrintButton } from "@/components/classroom/ClassTools";
import { RadarDetective, type Round } from "@/components/classroom/RadarDetective";
import { getDataProvider } from "@/data/providers";
import type { EventDetail } from "@/data/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Aula — El planeta que se mueve | Dancing with the SARs",
  description:
    "Una clase lista para usar en República Dominicana: radar satelital, inundaciones, sequías y terremotos con imágenes reales del satélite NISAR, un experimento con linterna y un juego.",
};

/** The rounds of the game: real cases, from home first, then the world. */
const ROUNDS: Array<{ id: string; answer: Round["answer"]; clue: string; reveal: string }> = [
  {
    id: "san-pedro-flood",
    answer: "Inundación",
    clue: "Busquen zonas que se vuelven muy oscuras: el agua en calma es como un espejo para el radar.",
    reveal:
      "Inundación en San Pedro de Macorís. El agua tranquila refleja el pulso del radar lejos del satélite, por eso se ve negra. Donde el agua cubrió árboles y caña, el pulso rebota dos veces (agua y tallos) y se ve más brillante.",
  },
  {
    id: "cibao-wind",
    answer: "Viento fuerte",
    clue: "El verde son plantas de pie. ¿Qué le pasa a un campo si el viento lo tumba?",
    reveal:
      "Daño por viento en el Cibao. Las plantas de pie (plátano, maíz) devuelven mucho eco y salen verdes. Cuando el viento las tumba, pierden esa estructura y el eco baja.",
  },
  {
    id: "noroeste-heat",
    answer: "Sequía y calor",
    clue: "El radar no mide temperatura. Mide el agua que hay en el suelo y en las plantas.",
    reveal:
      "Calor y sequía en la Línea Noroeste. El agua hace que el suelo brille para el radar (tiene una constante dieléctrica alta). Cuando el suelo y el pasto se secan, el eco se debilita. El radar ve lo que el calor le hace a la tierra.",
  },
  {
    id: "venezuela-quake",
    answer: "Terremoto",
    clue: "Los anillos de colores aparecen cuando el suelo se mueve unos centímetros entre dos visitas.",
    reveal:
      "Terremoto en Venezuela (USGS: magnitud 7.5, 24 de junio de 2026). Cada vuelta completa de colores equivale a unos 12 cm de movimiento del suelo hacia el satélite o en sentido contrario.",
  },
  {
    id: "punjab-burning",
    answer: "Quema o cosecha",
    clue: "Son campos con formas rectas. ¿Qué hacen los agricultores después de cosechar?",
    reveal:
      "Quema de rastrojo en Punjab, India. Después de la cosecha se quema la paja que queda. Los campos pasan de tener plantas altas a suelo desnudo, y el eco del radar cae parcela por parcela.",
  },
  {
    id: "jakobshavn-glacier",
    answer: "Glaciar",
    clue: "Es un lugar muy frío, donde todo es blanco y no hay campos ni ciudades.",
    reveal:
      "El glaciar Jakobshavn, en Groenlandia. El radar reconoce las mismas grietas en dos visitas y mide cuántos metros avanzó el hielo por día. El hielo que llega al mar sube el nivel del océano, también en el Caribe.",
  },
];

function imagesOf(d: EventDetail): Round["images"] {
  const x = d.extra;
  if (!x) {
    const a = d.analyses[0];
    return [
      { src: a.images.pre, caption: `Antes · ${formatDate(a.pre.date.slice(0, 10))}` },
      { src: a.images.post, caption: `Después · ${formatDate(a.post.date.slice(0, 10))}` },
    ];
  }
  if (x.kind === "agriculture" || x.kind === "change") {
    const f = x.orbits[0].frames;
    return [
      { src: f[0].src, caption: `Antes · ${formatDate(f[0].date)}` },
      { src: f[f.length - 1].src, caption: `Después · ${formatDate(f[f.length - 1].date)}` },
    ];
  }
  if (x.kind === "displacement") return [{ src: x.pairs[0].images.fringes, caption: `${formatDate(x.pairs[0].ref)} → ${formatDate(x.pairs[0].sec)}` }];
  return [{ src: x.groups[0].map, caption: "Velocidad del hielo" }];
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-10 print:hidden">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{kicker}</p>
      <h2 id={id} className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.03] p-4">
      <p className="font-medium text-ink">{title}</p>
      <div className="mt-1.5 text-sm leading-relaxed text-ink/80">{children}</div>
    </div>
  );
}

const STATIONS = [
  { id: "capotillo-flood", title: "Estación 1 · Agua en la ciudad", ask: "¿Por qué una inundación pequeña en Capotillo puede afectar a tantas familias?" },
  { id: "cibao-wind", title: "Estación 2 · El viento y la comida", ask: "¿Qué cultivos del Cibao conoces? ¿Qué pasa con el precio si se pierden?" },
  { id: "noroeste-heat", title: "Estación 3 · La tierra con sed", ask: "¿Cómo ve el radar el calor si no puede medir la temperatura?" },
  { id: "los-cacaos-landslide", title: "Estación 4 · Laderas que se mueven", ask: "¿Qué señales en una loma avisan que puede haber un deslizamiento?" },
];

const WORKSHEET = [
  "El radar del satélite NISAR funciona de noche y con nubes porque…",
  "El agua en calma se ve ________ en una imagen de radar, porque actúa como un ________.",
  "Escribe dos cosas que el radar puede ver después de una tormenta o un huracán.",
  "Si el radar no mide la temperatura, ¿cómo puede mostrar los efectos de una sequía?",
  "Cada anillo de colores de un terremoto equivale a unos ____ cm de movimiento del suelo.",
  "Nombra un lugar de tu provincia que pueda inundarse. ¿Qué podrían hacer las autoridades con imágenes como estas?",
  "¿Qué es más útil para una familia en riesgo: saber dónde pasó el agua o saber por qué pasó? Explica.",
];

const ANSWERS = [
  "Porque produce su propia energía (microondas) y las microondas atraviesan las nubes y el humo.",
  "Oscura; espejo (refleja el pulso lejos del satélite).",
  "Por ejemplo: zonas inundadas, cultivos y árboles derribados, deslizamientos de tierra.",
  "Porque el suelo y las plantas secas tienen menos agua y devuelven un eco más débil.",
  "12 cm (la mitad de la longitud de onda de unos 24 cm).",
  "Respuesta abierta: por ejemplo, decidir dónde enviar ayuda, dónde no construir o qué calles limpiar.",
  "Respuesta abierta: las dos cosas; el dónde orienta la ayuda y el porqué ayuda a prevenir.",
];

export default async function AulaPage() {
  const provider = getDataProvider();
  const details = await Promise.all(ROUNDS.map((r) => provider.getEventById(r.id)));
  const rounds: Round[] = ROUNDS.flatMap((r, i) => {
    const d = details[i];
    return d ? [{ ...r, place: `${d.region}, ${d.country === "Dominican Republic" ? "República Dominicana" : d.country}`, images: imagesOf(d) }] : [];
  });

  return (
    <main lang="es" className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12 print:max-w-none print:p-0 print:text-black">
      <nav aria-label="Sitio" className="print:hidden">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-accent/60 hover:text-ink">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Volver al globo
        </Link>
      </nav>

      <header className="pb-10 pt-10 print:hidden">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Aula · República Dominicana</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
          El planeta que se <em>mueve</em>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Una clase de 50 minutos para secundaria. El alumnado aprende cómo un satélite de radar ve las inundaciones,
          la sequía, el viento y los terremotos, con imágenes reales de su propio país.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card title="Para quién">Secundaria. Conecta con Ciencias de la Naturaleza y con Ciencias Sociales (gestión de riesgos).</Card>
          <Card title="Qué hace falta">Un proyector o algunos celulares con internet. Para el experimento: una linterna, un espejo y papel de aluminio.</Card>
          <Card title="Qué aprenden">Qué es un radar, por qué el agua se ve oscura y cómo los datos del espacio ayudan a proteger a las comunidades.</Card>
        </div>
      </header>

      <div className="space-y-12">
        <Section id="plan" kicker="01 · La clase paso a paso" title="Plan de 50 minutos">
          <ol className="space-y-3">
            {[
              ["Inicio · 5 min", "Pregunta al grupo: «Si hay un huracán de noche y el cielo está tapado de nubes, ¿cómo podría un satélite ver qué zonas se inundaron?». Anota las ideas en la pizarra."],
              ["Experimento · 10 min", "El espejo y el papel arrugado (abajo). Descubren por qué el agua se ve oscura y los árboles brillan."],
              ["Detective de radar · 15 min", "El juego de abajo, en grupos. Cada grupo vota antes de revelar la respuesta."],
              ["Estaciones · 15 min", "Cada grupo abre una historia de un lugar dominicano en el globo y responde su pregunta."],
              ["Cierre · 5 min", "Cada grupo comparte una idea: ¿para qué le serviría esto a su comunidad?"],
            ].map(([t, b]) => (
              <li key={t} className="rounded-xl border border-line bg-white/[0.03] px-4 py-3">
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent">{t}</p>
                <p className="mt-1">{b}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="experimento" kicker="02 · Experimento" title="El espejo y el papel arrugado">
          <p>Este experimento muestra con una linterna lo que hace el radar del satélite.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Oscurece un poco el aula. Coloca un espejo sobre la mesa: será el <b className="text-ink">agua en calma</b>.</li>
            <li>Al lado, coloca papel de aluminio bien arrugado: será un <b className="text-ink">bosque o una ciudad</b>.</li>
            <li>Una persona (el «satélite») apunta la linterna en ángulo, desde un lado, como hace el radar.</li>
            <li>Otra persona mira desde la posición de la linterna. ¿Qué superficie le devuelve más luz?</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="Lo que verán">El espejo refleja la luz hacia el otro lado: desde el «satélite» se ve oscuro. El aluminio arrugado dispersa la luz en todas direcciones y una parte vuelve: se ve brillante.</Card>
            <Card title="La explicación">Eso es exactamente lo que pasa con el radar: el agua tranquila se ve negra y las superficies rugosas (árboles, casas) se ven claras. Así se detecta una inundación.</Card>
          </div>
          <p className="text-sm text-muted">
            Extra: mojen una hoja de papel y comparen con una seca bajo la linterna. El agua cambia cómo se refleja la energía; el
            radar lo usa para saber si el suelo está húmedo o seco.
          </p>
        </Section>

        <section aria-labelledby="detective" className="border-t border-line pt-10 print:hidden">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">03 · Juego</p>
          <h2 id="detective" className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Detective de radar
          </h2>
          <p className="mb-5 mt-3 text-[15px] leading-relaxed text-ink/85">
            Imágenes reales del satélite NISAR. Observen, discutan en grupo y elijan qué pasó en cada lugar.
          </p>
          <RadarDetective rounds={rounds} />
        </section>

        <Section id="estaciones" kicker="04 · Estaciones" title="Historias de nuestro país">
          <p>Cada grupo abre una historia en el globo (se cuenta sola, paso a paso) y responde su pregunta.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {STATIONS.map((s) => (
              <li key={s.id} className="rounded-2xl border border-line bg-white/[0.03] p-4">
                <p className="font-medium text-ink">{s.title}</p>
                <p className="mt-1.5 text-sm text-ink/80">{s.ask}</p>
                <Link href={`/?story=${s.id}`} className="ge-link mt-3 inline-block text-sm">
                  Abrir la historia →
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="comunidad" kicker="05 · Mi comunidad" title="Del satélite a mi barrio">
          <p>
            Pide a cada estudiante que dibuje un mapa sencillo de su barrio o comunidad y marque: dónde se acumula el agua
            cuando llueve, qué lomas o cañadas hay cerca, y qué cultivos se siembran alrededor.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="Para conversar">¿Qué lugares del mapa serían los primeros en verse en una imagen de radar después de una tormenta? ¿Quiénes viven allí?</Card>
            <Card title="Antes de una inundación">Ten un plan familiar y una mochila con documentos, agua y linterna. Sigue los avisos del COE y de la Defensa Civil. No cruces ríos ni cañadas crecidas. En una emergencia llama al 911.</Card>
          </div>
        </Section>

        <Section id="futuro" kicker="06 · El futuro" title="¿Qué más podrá hacer NISAR?">
          <ul className="grid gap-3 sm:grid-cols-2">
            <Card title="Avisar antes">Ver cómo se humedece el suelo en las lomas para anticipar deslizamientos.</Card>
            <Card title="Proteger cosechas">Seguir la humedad del suelo y el crecimiento de los cultivos para planificar el riego y prever la producción.</Card>
            <Card title="Cuidar presas y puentes">Medir hundimientos de milímetros en obras grandes antes de que se vean a simple vista.</Card>
            <Card title="Seguir el nivel del mar">Medir cómo se mueven los glaciares y el hielo, que deciden cuánto subirá el mar en nuestras costas.</Card>
          </ul>
        </Section>

        <section aria-labelledby="hoja" className="border-t border-line pt-10 print:border-0 print:pt-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent print:text-black">07 · Hoja de trabajo</p>
          <h2 id="hoja" className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl print:text-black">
            El planeta que se mueve
          </h2>
          <p className="mt-2 hidden text-sm print:block">Nombre: ______________________ Curso: ________ Fecha: __________</p>
          <ol className="mt-5 list-decimal space-y-5 pl-5 text-[15px] text-ink/90 print:text-black">
            {WORKSHEET.map((q) => (
              <li key={q}>
                {q}
                <span className="mt-2 block h-10 border-b border-dashed border-line print:border-gray-400" aria-hidden="true" />
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <PrintButton />
            <AnswerKey answers={ANSWERS} />
          </div>
        </section>

        <Section id="glosario" kicker="08 · Glosario" title="Palabras clave">
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["Radar", "Instrumento que envía ondas (microondas) y escucha el eco que vuelve."],
              ["SAR", "Radar de apertura sintética: combina muchos ecos tomados en movimiento para ver detalles pequeños."],
              ["NISAR", "Satélite de la NASA y la agencia espacial de la India (ISRO). Vuelve a ver el mismo lugar cada 12 días."],
              ["Eco o retrodispersión", "La parte de la energía que rebota y vuelve al satélite."],
              ["Polarización", "La orientación de la onda. Las plantas la «giran», el agua y el suelo casi no."],
              ["Interferometría", "Comparar dos visitas para medir si el suelo se movió unos centímetros."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-white/[0.03] px-4 py-3">
                <dt className="font-medium text-ink">{t}</dt>
                <dd className="mt-1 text-sm text-ink/80">{d}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <footer className="mt-14 border-t border-line pt-6 text-sm text-muted print:hidden">
        <p>
          Imágenes: satélite NISAR (NASA–ISRO), analizadas por nuestro equipo; no verificadas en terreno. Clima: ERA5 vía
          Open-Meteo. Terremotos: USGS. Material libre para uso educativo.
        </p>
      </footer>
    </main>
  );
}
