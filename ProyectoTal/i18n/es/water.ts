/** Spanish for reservoirs and lakes, droughts and the flood setting added with the later cases. */

export const water: Record<string, string> = {
  // Case panel (components/panel/ExtraCase.tsx)
  "The satellite counted the calm open water here on {n} passes. The most it saw was {max} km², on {max_date}; the least, {min} km², on {min_date}. From the first pass ({d1}) to the last ({d2}) it went from {first} to {last} km².":
    "El satélite contó el agua abierta y tranquila de aquí en {n} pasadas. Lo máximo que vio fueron {max} km², el {max_date}; lo mínimo, {min} km², el {min_date}. De la primera pasada ({d1}) a la última ({d2}) pasó de {first} a {last} km².",
  "The count jumps a lot from pass to pass. Wind ruffles the water, and ruffled water sends the pulse back like land, so part of the water can vanish from one pass. Trust the trend over many passes more than any single one.":
    "La cifra salta mucho de una pasada a otra. El viento riza el agua, y el agua rizada devuelve el pulso como si fuera tierra, así que parte del agua puede desaparecer en una pasada. Fíate más de la tendencia de muchas pasadas que de una sola.",
  "Most water seen": "Máximo de agua visto",
  "Least water seen": "Mínimo de agua visto",
  "Last pass": "Última pasada",
  "Map of the water": "Mapa del agua",
  "Map of the water on the passes with the most and the least water":
    "Mapa del agua en las pasadas con más y con menos agua",
  "Dark blue: water on both the pass with the most water and the one with the least. Light blue: water only on the pass with the most. On a grey radar image, the median of all passes.":
    "Azul oscuro: agua tanto en la pasada con más agua como en la de menos. Celeste: agua solo en la pasada con más. Sobre una imagen de radar gris, la mediana de todas las pasadas.",
  "False colour: red and blue carry the co-polarised echo, green the cross-polarised one. Calm water looks black; dry shore and bare soil look purple.":
    "Falso color: el rojo y el azul llevan el eco copolarizado, el verde el de polarización cruzada. El agua tranquila se ve negra; la orilla seca y el suelo desnudo se ven morados.",
  "Calm water by pass": "Agua tranquila por pasada",
  "Calm open water": "Agua abierta y tranquila",
  "A reservoir rises and falls with the rain, and with the water taken out for electricity, farms and cities. The radar sees how much water there is; why it changed is our reading, not something the radar tells apart.":
    "Un embalse sube y baja con la lluvia y con el agua que se saca para electricidad, fincas y ciudades. El radar ve cuánta agua hay; por qué cambió es nuestra lectura, no algo que el radar distinga.",
  "A lake rises and falls with the rain, evaporation and the water people take from its rivers. The radar sees how much water there is; why it changed is our reading, not something the radar tells apart.":
    "Un lago sube y baja con la lluvia, la evaporación y el agua que la gente toma de sus ríos. El radar ve cuánta agua hay; por qué cambió es nuestra lectura, no algo que el radar distinga.",
  "Range between passes": "Rango entre pasadas",
  "{pct}% of the largest": "{pct}% del máximo",
  "This is farmland and small villages, where a flooded road can cut a whole community off.":
    "Son fincas y pequeños poblados, donde un camino inundado puede dejar incomunicada a toda una comunidad.",
  "the start of the dry spell": "el inicio de la temporada seca",

  // Why it happened (components/panel/Drivers.tsx)
  "Rain, or the lack of it": "La lluvia, o su falta",
  "Rivers fill the reservoir in the rainy months; in a dry spell, little comes in.":
    "Los ríos llenan el embalse en los meses de lluvia; en una temporada seca entra poca agua.",
  "People draw the water": "La gente saca el agua",
  "Turbines, irrigation canals and city pipes take water out all year, rain or no rain.":
    "Las turbinas, los canales de riego y las tuberías de las ciudades sacan agua todo el año, llueva o no.",
  "Farms and towns take water from the rivers that feed the lake, and the sun evaporates the rest.":
    "Las fincas y los pueblos toman agua de los ríos que alimentan el lago, y el sol evapora el resto.",
  "Calm water is a mirror: the pulse bounces away and the water turns black. As the level drops, the dark area shrinks and the bare shore appears.":
    "El agua tranquila es un espejo: el pulso rebota lejos y el agua se ve negra. Cuando el nivel baja, la zona oscura se encoge y aparece la orilla desnuda.",
  "Less water for homes and fields, and less electricity from the dam.":
    "Menos agua para las casas y los campos, y menos electricidad de la presa.",

  // For people (components/panel/Impact.tsx)
  "{area} of land lost echo during the dry spell, the most by {peak}. Dry soil and wilting crops send back less. Watch for a weaker harvest and thirsty livestock.":
    "{area} de tierra perdieron eco durante la temporada seca, la mayor parte para el {peak}. El suelo seco y los cultivos marchitos devuelven menos. Vigila una cosecha más pobre y el ganado con sed.",
  "Use water sparingly when the reservoir runs low: fix leaks and water crops early or late.":
    "Ahorra agua cuando el embalse está bajo: arregla las fugas y riega temprano o al final de la tarde.",
  "Store drinking water covered: open containers breed the mosquitoes that carry dengue.":
    "Guarda el agua de beber tapada: los recipientes abiertos crían los mosquitos que transmiten el dengue.",
  "Follow the water and power authority's notices about rationing.":
    "Sigue los avisos de las autoridades de agua y electricidad sobre racionamientos.",

  // Story (components/storyExtra.tsx) and globe callouts (components/globe/markers.ts)
  "A reservoir is the tap of a whole region: drinking water, irrigation and electricity. Watching its water from space, every 12 days, shows a shortage coming before the taps run dry.":
    "Un embalse es la llave de paso de toda una región: agua de beber, riego y electricidad. Vigilar su agua desde el espacio, cada 12 días, avisa de la escasez antes de que se sequen las llaves.",
  "We counted the calm open water here on every pass, to see it rise and fall.":
    "Contamos el agua abierta y tranquila de aquí en cada pasada, para verla subir y bajar.",
  "Calm water is a mirror for the radar: the pulse bounces away and the water looks black. Dry shore and bare soil look purple. Compare the first visit with the last.":
    "Para el radar, el agua tranquila es un espejo: el pulso rebota lejos y el agua se ve negra. La orilla seca y el suelo desnudo se ven morados. Compara la primera visita con la última.",
  "How much water there was": "Cuánta agua había",
  "of calm water at most, on {date} · {min} km² at least": "de agua tranquila como máximo, el {date} · {min} km² como mínimo",
  "Light blue is water the satellite saw only on the pass with the most water. Wind can ruffle the surface and hide part of it, so the trend over many passes matters more than one.":
    "El celeste es agua que el satélite vio solo en la pasada con más agua. El viento puede rizar la superficie y ocultar una parte, así que importa más la tendencia de muchas pasadas que una sola.",
  "calm water at most": "agua tranquila como máximo",
};
