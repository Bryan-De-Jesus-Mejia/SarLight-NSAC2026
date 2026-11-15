import { useChatStore, useChatStream } from "@/store/useChatStore";

/**
 * A stand-in for the real assistant: it picks a canned answer by keyword and
 * "types" it out. Replace `replyFor` with a call to the real service; the
 * panel and the stores do not change.
 */

export const MAX_LENGTH = 1000;

type Lang = "en" | "es";
interface Intent {
  test: RegExp;
  en: string;
  es: string;
}

const INTENTS: Intent[] = [
  {
    test: /^(hi|hello|hey|hola|buenas|buenos)\b/,
    en: "Hi! I can explain what you are looking at on this map: the NISAR radar satellite, how radar sees the ground, and the cases we analysed. What would you like to know?",
    es: "¡Hola! Puedo explicarte lo que ves en este mapa: el satélite radar NISAR, cómo ve el suelo un radar y los casos que analizamos. ¿Qué quieres saber?",
  },
  {
    test: /nisar|satelit|satellit/,
    en: "NISAR is a satellite built by NASA and ISRO, India's space agency. Its radar images almost all land and ice on Earth about every 12 days, by day or night and through clouds. That regular rhythm is what lets us compare the same place on different dates.",
    es: "NISAR es un satélite construido por la NASA y la ISRO, la agencia espacial de India. Su radar fotografía casi toda la tierra y el hielo del planeta cada 12 días aproximadamente, de día o de noche y a través de las nubes. Ese ritmo regular permite comparar el mismo lugar en fechas distintas.",
  },
  {
    test: /color|colour|green|verde|blue|azul|red\b|rojo|orange|naranja|polariz/,
    en: "The radar colours are a false-colour mix, not what a camera sees. NASA describes them like this: green is usually vegetation, orange or yellow is urban or sparsely vegetated ground, blue is calm water, dry sand or frozen ground, and red can be rough water. Different land covers can look alike, so it helps to compare with the camera view.",
    es: "Los colores del radar son una mezcla en falso color, no lo que vería una cámara. La NASA los describe así: el verde suele ser vegetación, el naranja o amarillo es zona urbana o suelo con poca vegetación, el azul es agua en calma, arena seca o suelo helado, y el rojo puede ser agua agitada. Distintos terrenos pueden verse parecidos, así que conviene comparar con la vista de cámara.",
  },
  {
    test: /water|agua|dark|oscur|flood|inund/,
    en: "Calm water acts like a mirror for radar: the pulse bounces away from the satellite instead of back to it, so the water looks dark. Rough ground or vegetation scatter the pulse in many directions and send some back, so they look brighter. That is why a flood can show up as a patch that turns dark between two dates.",
    es: "El agua en calma actúa como un espejo para el radar: el pulso rebota lejos del satélite en vez de volver a él, así que el agua se ve oscura. El suelo rugoso o la vegetación dispersan el pulso en muchas direcciones y devuelven una parte, por eso se ven más claros. Por eso una inundación puede aparecer como una mancha que se oscurece entre dos fechas.",
  },
  {
    test: /enriquillo|azua|\bcase\b|\bcasos?\b/,
    en: "Each case on the map compares NISAR passes over one place. The Azua case, for example, subtracts two passes twelve days apart, pixel by pixel, to look for changes. These figures come from our own comparisons and have not been verified on the ground yet, so treat them as a first look, not a final measurement.",
    es: "Cada caso del mapa compara pasadas de NISAR sobre un mismo lugar. El caso de Azua, por ejemplo, resta dos pasadas separadas doce días, píxel por píxel, para buscar cambios. Estas cifras salen de nuestras propias comparaciones y aún no se han verificado en el terreno, así que tómalas como una primera mirada, no como una medición final.",
  },
  {
    test: /radar|\bsar\b|how does|como funciona|funciona|work/,
    en: "A radar sends its own microwave pulses toward the ground and listens for the echo. Because it brings its own \"light\", it works at night, and microwaves pass through clouds and smoke. How strong the echo is tells us about the surface: smooth, wet, rough, or covered in plants.",
    es: "Un radar envía sus propios pulsos de microondas hacia el suelo y escucha el eco. Como lleva su propia «luz», funciona de noche, y las microondas atraviesan nubes y humo. La fuerza del eco nos dice cómo es la superficie: lisa, mojada, rugosa o cubierta de plantas.",
  },
  {
    test: /how (do|can) i|\buse\b|usar|navigate|navegar|button|boton|botón|layer|capa|timeline|demo|zoom/,
    en: "Drag the globe to rotate it and scroll to zoom. Click a province to fly there, or a marker to open a case. The buttons at the bottom left open the signals legend, the real data layers (radar, water, before/after curtain) and the timeline. The play button at the top starts a guided demo.",
    es: "Arrastra el globo para girarlo y usa la rueda para acercar. Haz clic en una provincia para volar hasta ella, o en un marcador para abrir un caso. Los botones de abajo a la izquierda abren la leyenda de señales, las capas de datos reales (radar, agua, cortina antes/después) y la línea de tiempo. El botón de reproducir arriba inicia una demo guiada.",
  },
];

const FALLBACK: Record<Lang, string> = {
  en: "I can help with NISAR, how radar works, what the colours mean, why water looks dark or how to use the map. Try one of those.",
  es: "Puedo ayudarte con NISAR, cómo funciona el radar, qué significan los colores, por qué el agua se ve oscura o cómo usar el mapa. Prueba con una de esas.",
};

export const SUGGESTIONS: Record<Lang, string[]> = {
  en: ["What is NISAR?", "Why does water look dark in radar?", "What do the colours mean?", "How do I use this map?"],
  es: ["¿Qué es NISAR?", "¿Por qué el agua se ve oscura en el radar?", "¿Qué significan los colores?", "¿Cómo uso este mapa?"],
};

const normalise = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function languageOf(text: string): Lang {
  return /[¿¡áéíóúñ]|\b(que|como|cuando|donde|por que|para que|cual|cuales|hola|gracias|el|los|las|una|del)\b/i.test(text)
    ? "es"
    : "en";
}

export function replyFor(question: string): string {
  const lang = languageOf(question);
  const q = normalise(question);
  const hit = INTENTS.find((intent) => intent.test.test(q));
  return hit ? hit[lang] : FALLBACK[lang];
}

/* -------------------------------------------------------------------------- */
/* Typing it out                                                              */
/* -------------------------------------------------------------------------- */

let timer: ReturnType<typeof setTimeout> | undefined;
let current: { chatId: string; answer: string } | null = null;

const idle = () => useChatStream.setState({ chatId: null, phase: "idle", text: "" });

/** Stop the reply in progress. What was already typed is kept as the answer. */
export function stopReply(options: { keepPartial?: boolean } = { keepPartial: true }): void {
  clearTimeout(timer);
  const { chatId, text } = useChatStream.getState();
  if (options.keepPartial && chatId && text.trim()) {
    useChatStore.getState().addMessage(chatId, "assistant", `${text.trimEnd()} …`);
  }
  current = null;
  idle();
}

/** Throw away the reply in progress when its chat is deleted. */
export function dropReplyFor(chatId: string): void {
  if (current?.chatId === chatId) stopReply({ keepPartial: false });
}

function typeOut(chatId: string, answer: string): void {
  const pieces = answer.split(/(\s+)/);
  let shown = 0;
  useChatStream.setState({ chatId, phase: "typing", text: "" });

  const tick = () => {
    shown = Math.min(pieces.length, shown + 3);
    useChatStream.setState({ text: pieces.slice(0, shown).join("") });
    if (shown < pieces.length) {
      timer = setTimeout(tick, 28);
      return;
    }
    useChatStore.getState().addMessage(chatId, "assistant", answer);
    current = null;
    idle();
  };
  tick();
}

/** Send a message in the active chat (starting one if needed) and "answer" it. */
export function sendMessage(raw: string): void {
  const text = raw.trim().slice(0, MAX_LENGTH);
  if (!text || useChatStream.getState().phase !== "idle") return;

  const chats = useChatStore.getState();
  const hasActive = chats.chats.some((c) => c.id === chats.activeId);
  const chatId = hasActive && chats.activeId ? chats.activeId : chats.newChat();
  chats.addMessage(chatId, "user", text);

  const answer = replyFor(text);
  current = { chatId, answer };
  useChatStream.setState({ chatId, phase: "thinking", text: "" });
  timer = setTimeout(() => typeOut(chatId, answer), 650 + Math.random() * 500);
}
