/** Spanish for story mode (the scroll that tells one case) and the globe's own labels. */
export const story: Record<string, string> = {
  /* Story chrome */
  "Story · {name}": "Historia · {name}",
  loading: "cargando",
  "Exit story": "Salir de la historia",
  "Step {n}: {kicker}": "Paso {n}: {kicker}",
  Story: "Historia",
  "Loading the analysis": "Cargando el análisis",
  "Next ↓": "Siguiente ↓",
  "Open the full analysis": "Abrir el análisis completo",
  "Next story: {name} →": "Siguiente historia: {name} →",
  Back: "Atrás",

  /* Radar change maps */
  "We went looking for the mark a fire leaves. When leaves and branches are gone, so is the radar echo they used to send back.":
    "Fuimos a buscar la marca que deja un incendio. Cuando faltan las hojas y las ramas, también falta el eco de radar que antes devolvían.",
  "We went looking for water where there was land. A flooded field turns from rough to mirror-smooth, and its echo collapses.":
    "Fuimos a buscar agua donde había tierra. Un campo inundado pasa de rugoso a liso como un espejo, y su eco se desploma.",
  "The place": "El lugar",
  "We compared two radar passes over this area.": "Comparamos dos pasadas de radar sobre esta zona.",
  "Scroll, or press Next, to follow what the radar saw.": "Desplázate, o pulsa Siguiente, para seguir lo que vio el radar.",
  "The first look": "La primera mirada",
  "On {date}, {sensor} imaged these {area} km² of land in the {pol} channel. Bright is rough: forest, crops, buildings. Dark is smooth: calm water, bare flat ground.":
    "El {date}, {sensor} captó estos {area} km² de tierra en el canal {pol}. Lo claro es rugoso: bosque, cultivos, edificios. Lo oscuro es liso: agua en calma, suelo plano y desnudo.",
  "{span} days later": "{span} días después",
  "The same satellite, on the same track, looked again. To the eye almost nothing moved. That is the point: the change hides in the numbers, not in the picture.":
    "El mismo satélite, en la misma trayectoria, volvió a mirar. A simple vista casi nada se movió. Ese es el punto: el cambio se esconde en los números, no en la imagen.",
  "The difference": "La diferencia",
  "Subtract one from the other": "Restar una de la otra",
  "of land changed by at least {thr} dB": "de tierra cambiaron al menos {thr} dB",
  "Red is where the echo got weaker, blue where it got stronger. Three decibels is about half, or double, the energy. It weakened over {down} km² and strengthened over {up} km².":
    "El rojo es donde el eco se debilitó y el azul donde se reforzó. Tres decibelios son aproximadamente la mitad, o el doble, de la energía. Se debilitó sobre {down} km² y se reforzó sobre {up} km².",
  "Is it real?": "¿Es real?",
  "Only the flagged land moved": "Solo se movió la tierra marcada",
  "on the flagged land · {out} dB everywhere else": "en la tierra marcada · {out} dB en todo lo demás",
  "If rain, season or calibration had shifted the whole scene, the rest of the land would have moved too. It did not.":
    "Si la lluvia, la temporada o la calibración hubieran movido toda la escena, el resto de la tierra también se habría movido. No fue así.",
  "The rest of the land moved by a comparable amount, so part of this may be scene-wide and not a local event.":
    "El resto de la tierra se movió en una cantidad parecida, así que parte de esto puede afectar a toda la escena y no ser un evento local.",
  "The flagged pixels are drawn over the after image.": "Los píxeles marcados se dibujan sobre la imagen posterior.",
  "With {passes} passes of this track, {pct}% of the flagged land moved more than 3 times what those pixels normally do from one pass to the next.":
    "Con {passes} pasadas de esta trayectoria, el {pct}% de la tierra marcada se movió más de 3 veces lo que esos píxeles hacen normalmente de una pasada a la siguiente.",
  "Through time": "A través del tiempo",
  "Every pass of the track": "Cada pasada de la trayectoria",
  "{n} passes in false colour, from {d1} to {d2}. Green and yellow are dense vegetation, purple and blue are bare ground and low crops, black is calm water. Watch for patches that switch colour.":
    "{n} pasadas en falso color, del {d1} al {d2}. El verde y el amarillo son vegetación densa, el morado y el azul son suelo desnudo y cultivos bajos, el negro es agua en calma. Fíjate en las manchas que cambian de color.",
  "What was there": "Qué había allí",
  "Mostly {label}": "Sobre todo {label}",
  "{label} is over-represented in what changed": "{label}: pesa más de lo esperado en lo que cambió",
  "{label} covers {scene}% of the land here, but {flagged}% of the land that changed.":
    "{label}: el {scene}% del terreno aquí, pero el {flagged}% del terreno que cambió.",
  "{flagged}% of the flagged land is {label}, close to its share of the whole area ({scene}%).":
    "{label}: el {flagged}% de la tierra marcada, cerca de su parte del área total ({scene}%).",
  "That comes from a 2021 land-cover map, so the ground may have changed since.":
    "Eso viene de un mapa de cobertura del suelo de 2021, así que el terreno puede haber cambiado desde entonces.",
  "The {main} channel flags {a} km²; {other} flags {b} km² for the same two passes.":
    "El canal {main} marca {a} km²; {other} marca {b} km² con las mismas dos pasadas.",
  "What could explain it": "Qué podría explicarlo",
  "Leads, not conclusions": "Pistas, no conclusiones",
  "Radar shows what changed, not why. None of this has been verified on the ground.":
    "El radar muestra qué cambió, no por qué. Nada de esto se ha verificado en el terreno.",

  /* Farming, ice, earthquakes, landslides */
  "We followed this area pass after pass, to see when its fields change.":
    "Seguimos esta zona pasada tras pasada, para ver cuándo cambian sus campos.",
  "We measured how fast this ice moves by following its pattern from one pass to the next.":
    "Medimos la velocidad de este hielo siguiendo su patrón de una pasada a la siguiente.",
  "We compared the radar phase of two passes to measure how far the ground moved.":
    "Comparamos la fase del radar de dos pasadas para medir cuánto se movió el suelo.",
  "What this does not tell us": "Lo que esto no nos dice",
  "None of this has been verified on the ground.": "Nada de esto se ha verificado en el terreno.",
  "How far the ground moved": "Cuánto se movió el suelo",
  "toward the satellite, at most": "hacia el satélite, como máximo",
  "Along the satellite’s line of sight the ground moved up to {toward} cm toward it and {away} cm away from it, between two passes {days} days apart.":
    "A lo largo de la línea de visión del satélite, el suelo se movió hasta {toward} cm hacia él y {away} cm alejándose de él, entre dos pasadas separadas por {days} días.",
  "Map of the ground movement": "Mapa del movimiento del suelo",
  "How much ground": "Cuánto terreno",
  "Where it moved over 5 cm": "Dónde se movió más de 5 cm",
  "of ground moved more than 5 cm ({area} km² over 10 cm)": "de terreno se movieron más de 5 cm ({area} km² más de 10 cm)",
  "The coloured fringes are the raw measurement: each full colour cycle is {cm} cm of movement. The more cycles packed together, the more the ground moved.":
    "Las franjas de colores son la medición en bruto: cada ciclo completo de color son {cm} cm de movimiento. Cuantos más ciclos juntos, más se movió el suelo.",
  "Only {pct}% of this picture could be measured reliably. Over water, steep or leafy ground the radar lost the thread, so this is a partial view.":
    "Solo el {pct}% de esta imagen se pudo medir con fiabilidad. Sobre agua, terreno empinado o con mucha hoja el radar perdió el hilo, así que es una vista parcial.",
  "{pct}% of this picture could be measured reliably. The rest, such as water or dense vegetation, is left blank.":
    "El {pct}% de esta imagen se pudo medir con fiabilidad. El resto, como el agua o la vegetación densa, se deja en blanco.",
  "The speed": "La velocidad",
  "How fast the ice moves": "Qué tan rápido se mueve el hielo",
  "fastest point · typical {speed} m/day": "punto más rápido · típico {speed} m/día",
  "Following the surface pattern between passes, the fastest ice moved {max} m a day. Most of the area was far slower.":
    "Siguiendo el patrón de la superficie entre pasadas, el hielo más rápido se movió {max} m al día. La mayor parte del área era mucho más lenta.",
  "Map of ice speed": "Mapa de la velocidad del hielo",
  "How much ice": "Cuánto hielo",
  "The fast part": "La parte rápida",
  "moving faster than {thr} m/day": "moviéndose más rápido que {thr} m/día",
  "Across {n} pairs of passes, this is the area that moved faster than the threshold. It shows where the glacier flows quickest.":
    "En {n} pares de pasadas, esta es el área que se movió más rápido que el umbral. Muestra dónde fluye más rápido el glaciar.",
  "The measurement noise is about {noise} m/day, so very slow ice cannot be told apart from standing still.":
    "El ruido de la medición es de unos {noise} m/día, así que el hielo muy lento no se distingue de uno quieto.",
  "Along the season": "A lo largo de la temporada",
  "Fields that dropped": "Campos que bajaron",
  "{pct}% of the {area} km² of vegetation": "{pct}% de los {area} km² de vegetación",
  "The echo of these fields fell between passes, which is what harvest, burning or clearing tends to look like. The biggest drop came in the interval ending {date}.":
    "El eco de estos campos cayó entre pasadas, que es lo que suelen parecer una cosecha, una quema o un desmonte. La mayor caída llegó en el intervalo que termina el {date}.",
  "Map of the fields that changed": "Mapa de los campos que cambiaron",
  "Peak · {date}": "Máximo · {date}",
  "Land under water": "Tierra bajo el agua",
  "{fresh} km² new open water, {veg} km² flooded vegetation": "{fresh} km² de agua abierta nueva, {veg} km² de vegetación inundada",
  "Compared with the passes before, this much land turned to open water or to flooded vegetation at the peak of the season.":
    "En comparación con las pasadas anteriores, esta cantidad de terreno se convirtió en agua abierta o en vegetación inundada en el punto máximo de la temporada.",
  "Map of the flooded area": "Mapa de la zona inundada",
  "The radar sees the echo change, not the reason. What this place is doing, farming, burning or flooding, is our reading of the site.":
    "El radar ve que el eco cambia, no la razón. Qué está pasando en este lugar, si cultivo, quema o inundación, es nuestra lectura del sitio.",

  /* The globe itself */
  Province: "Provincia",
  Country: "País",
  "{n, plural, one {# signal} other {# signals}}": "{n, plural, one {# señal} other {# señales}}",
  "Click to zoom in": "Haz clic para acercarte",
  "3D globe unavailable": "El globo 3D no está disponible",
  "This explorer draws the Earth with WebGL, which this browser or device does not provide. Open it in a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.":
    "Este explorador dibuja la Tierra con WebGL, que este navegador o dispositivo no ofrece. Ábrelo en una versión reciente de Chrome, Edge, Firefox o Safari con la aceleración por hardware activada.",
  "{name}, {country}. Radar analysis, {noun}.": "{name}, {country}. Análisis de radar, {noun}.",
  "changed on land · {sensor}": "cambió en tierra · {sensor}",
  "farmland that changed": "tierras de cultivo que cambiaron",
  "ice moving fast": "hielo moviéndose rápido",
  "ground moved over 5 cm": "el suelo se movió más de 5 cm",
};
