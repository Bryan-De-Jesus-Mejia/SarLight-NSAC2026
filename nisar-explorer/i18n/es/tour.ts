/** Spanish for the tutorial (lib/tutorial, DemoPlayer), the timeline period, the ranking of the legend and the layers panel. */

export const tour: Record<string, string> = {
  // Tutorial card and entry points (components/DemoPlayer.tsx, CommandMenu.tsx, Welcome.tsx)
  "How to use SarLight": "Cómo usar SarLight",
  "A step-by-step tour of every control": "Un recorrido paso a paso por cada control",
  "Take the tour": "Haz el recorrido",
  "Learn every control in a minute, at your own pace": "Aprende cada control en un minuto, a tu ritmo",
  "{n} of {total}": "{n} de {total}",
  Next: "Siguiente",
  "Start again": "Empezar de nuevo",
  "Close tour": "Cerrar recorrido",

  // Tutorial steps (lib/tutorial.ts)
  "A quick tour of the controls": "Un recorrido rápido por los controles",
  "In a minute you will know what every button does. Go at your own pace with Next and Back, or the arrow keys; Esc closes the tour.":
    "En un minuto sabrás qué hace cada botón. Avanza a tu ritmo con Siguiente y Atrás, o con las flechas; Esc cierra el recorrido.",
  "The globe": "El globo",
  "Drag, zoom, click": "Arrastra, acerca, haz clic",
  "Drag to turn the planet and scroll (or pinch) to zoom. Click a country or a province to fly to it.":
    "Arrastra para girar el planeta y usa la rueda (o pellizca) para acercar. Haz clic en un país o una provincia para volar hasta allí.",
  "The markers": "Los marcadores",
  "Each marker is a place we analysed": "Cada marcador es un lugar que analizamos",
  "Its icon and colour say what changed: water, fire, ice, crops, ground. Click one to open what the radar saw there.":
    "Su icono y su color dicen qué cambió: agua, fuego, hielo, cultivos, suelo. Haz clic en uno para abrir lo que vio el radar ahí.",
  "A case": "Un caso",
  "What happened, in plain words": "Qué pasó, en palabras sencillas",
  "The panel shows the figures, why it happened, who lives there and what to do. Scroll down to read it all; the cross closes it.":
    "El panel muestra las cifras, por qué pasó, quién vive ahí y qué hacer. Baja para leerlo todo; la X lo cierra.",
  Stories: "Historias",
  "Let the case tell itself": "Deja que el caso se cuente solo",
  "Tell me the story walks you through the case on the globe, step by step, with a Why? button that explains the science at each step.":
    "Cuéntame la historia te lleva por el caso sobre el globo, paso a paso, con un botón ¿Por qué? que explica la ciencia en cada paso.",
  "Simple or technical": "Sencilla o técnica",
  "The same data for every reader": "Los mismos datos para cada lector",
  "The simple view uses everyday words. The technical view adds every number and method: thresholds, polarisations, baselines.":
    "La vista sencilla usa palabras de todos los días. La técnica añade cada número y cada método: umbrales, polarizaciones, líneas base.",
  Search: "Búsqueda",
  "Find a place or a kind of change": "Encuentra un lugar o un tipo de cambio",
  "Type a town, a country or a word like flood or glacier, and the globe keeps only what matches.":
    "Escribe un pueblo, un país o una palabra como inundación o glaciar, y el globo deja solo lo que coincide.",
  "Your community": "Tu comunidad",
  "Use your location or tap your place on the globe to see what our radar found nearby, how many people live there and what to do.":
    "Usa tu ubicación o toca tu lugar en el globo para ver qué encontró nuestro radar cerca, cuánta gente vive ahí y qué hacer.",
  "Signals and ranking": "Señales y ranking",
  "Filter, then compare": "Filtra y compara",
  "Pick one or more kinds of change to filter the globe. Below, every place is ranked by how much land changed.":
    "Elige uno o más tipos de cambio para filtrar el globo. Debajo, cada lugar aparece ordenado según cuánta tierra cambió.",
  "See under the clouds": "Mira bajo las nubes",
  "Turn on the lens and move the pointer over the globe: inside the circle the clouds lift and the ground shows, the way NISAR’s radar sees it.":
    "Enciende la lupa y mueve el puntero sobre el globo: dentro del círculo se quitan las nubes y aparece el suelo, como lo ve el radar de NISAR.",
  "Choose a period": "Elige un período",
  "Drag the two handles to mark where the period starts and ends: the globe keeps only what happened inside it. Play runs through it day by day; Show all goes back to the start.":
    "Arrastra las dos barritas para marcar dónde empieza y dónde termina el período: el globo deja solo lo que pasó dentro. Reproducir lo recorre día a día; Ver todo vuelve al inicio.",
  "The menu": "El menú",
  "Everything else lives here": "Aquí está todo lo demás",
  "The assistant chat, the next NISAR pass over a place, the satellite’s 12-day dance, cases for offline use, the methods, the language and this tour.":
    "El chat del asistente, la próxima pasada de NISAR sobre un lugar, el baile de 12 días del satélite, casos para usar sin conexión, los métodos, el idioma y este recorrido.",
  "Your turn": "Tu turno",
  "Start with a place you know. The figures come from real radar images processed by our team, not yet verified on the ground.":
    "Empieza por un lugar que conozcas. Las cifras salen de imágenes de radar reales procesadas por nuestro equipo, aún sin verificar en el terreno.",

  // The assistant button (components/Hud.tsx) and its tutorial step
  "Ask the assistant (AI)": "Pregúntale al asistente (IA)",
  "The assistant": "El asistente",
  "Ask in your own words": "Pregunta con tus palabras",
  "This button opens the AI assistant. Ask about a place, a kind of change or how the radar works, in Spanish or English: its answers come from our analyses. Press it again, or Esc, to close it.":
    "Este botón abre el asistente con IA. Pregunta por un lugar, un tipo de cambio o cómo funciona el radar, en español o en inglés: sus respuestas salen de nuestros análisis. Púlsalo otra vez, o Esc, para cerrarlo.",
  "The satellite’s 12-day dance, cases for offline use, study mode, the methods, the language and this tour.":
    "El baile de 12 días del satélite, casos para usar sin conexión, el modo estudio, los métodos, el idioma y este recorrido.",

  // Voice in the chat (components/chat/ChatPanel.tsx, hooks/useVoice.ts)
  "Ask by voice": "Preguntar por voz",
  "Stop listening": "Dejar de escuchar",
  "Listening… speak now, then check the text and send it.": "Escuchando… habla ahora y luego revisa el texto y envíalo.",
  "The microphone is blocked. Allow it in the browser to ask by voice.": "El micrófono está bloqueado. Permítelo en el navegador para preguntar por voz.",
  "I didn't hear anything. Try again closer to the microphone.": "No escuché nada. Inténtalo de nuevo más cerca del micrófono.",
  "Voice is not available right now. You can type instead.": "La voz no está disponible ahora. Puedes escribir.",
  "Your browser turns your voice into text (in Chrome, through Google).": "Tu navegador convierte tu voz en texto (en Chrome, a través de Google).",
  "Read answers aloud": "Leer respuestas en voz alta",

  // Timeline period (components/Timeline.tsx)
  "Chosen period": "Período elegido",
  "Play the chosen period day by day": "Reproducir el período elegido día a día",
  "Back to the whole period": "Volver a todo el período",
  "Start of the period": "Inicio del período",
  "End of the period": "Fin del período",
  "Drag the two handles to choose where the period starts and ends. Play runs through it day by day.":
    "Arrastra las dos barritas para elegir dónde empieza y dónde termina el período. Reproducir lo recorre día a día.",

  // Legend ranking (components/Legend.tsx)
  "Ranked by land affected": "Ordenados por tierra afectada",
  "Analysed areas, the most land affected first": "Áreas analizadas, primero las de más tierra afectada",

  // Menu (components/CommandMenu.tsx)
  "The day as a camera saw it, with the ground under the clouds inside a circle": "El día tal como lo vio una cámara, con el suelo bajo las nubes dentro de un círculo",

  // Layers panel (components/LayersPanel.tsx)
  "Camera view: NOAA-20 VIIRS true colour (NASA GIBS). Ground under the clouds: Sentinel-2 cloudless mosaic (EOX), a picture made from many clear days, not from that day.":
    "Vista de cámara: color real de NOAA-20 VIIRS (NASA GIBS). Suelo bajo las nubes: mosaico sin nubes de Sentinel-2 (EOX), una imagen hecha con muchos días despejados, no de ese día.",
};
