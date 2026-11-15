/** Spanish for what the team added later: wind and drought cases, flood settings, new sources, the cloud lens. */
export const more: Record<string, string> = {
  /* Welcome card */
  "Water where people live": "Agua donde vive la gente",
  "Wind that flattened crops": "Viento que tumbó cultivos",
  "Land drying in the heat": "Tierra que se seca con el calor",
  "Slopes on the move": "Laderas en movimiento",
  "Forest lost": "Bosque perdido",
  "Fields changing": "Campos que cambian",
  "Ice sliding to the sea": "Hielo que se desliza al mar",
  "Stories from space": "Historias desde el espacio",
  "It sees through clouds and in the dark. Floods that take homes, wind that flattens a harvest, heat that dries the land: it picks up the marks they leave. Tap a place to hear its story.":
    "Ve a través de las nubes y en la oscuridad. Inundaciones que se llevan casas, viento que tumba una cosecha, calor que seca la tierra: capta las huellas que dejan. Toca un lugar para escuchar su historia.",
  "Close to home · Dominican Republic": "Cerca de casa · República Dominicana",
  "Around the world": "Alrededor del mundo",
  "Clues from real NISAR radar images, read by our team. Not yet confirmed on the ground.":
    "Pistas de imágenes reales del radar NISAR, leídas por nuestro equipo. Aún sin confirmar en el terreno.",

  /* Chat, lens, layers */
  "Guided answers · offline, not an AI": "Respuestas guiadas · sin conexión, no es una IA",
  "See through the clouds: the day as a camera saw it, the ground underneath inside a circle":
    "Ver a través de las nubes: el día tal como lo vio una cámara, con el suelo debajo dentro de un círculo",
  "Cloud lens": "Lente de nubes",
  "The planet as a camera saw it that day, clouds and all. Inside the circle the clouds are lifted and the ground underneath shows: what a camera misses on a cloudy day, and what NISAR’s radar sees anyway.":
    "El planeta tal como lo vio una cámara ese día, nubes incluidas. Dentro del círculo se levantan las nubes y aparece el suelo de debajo: lo que una cámara no ve en un día nublado y lo que el radar de NISAR ve de todos modos.",
  "Camera view: NOAA-20 VIIRS true colour (NASA GIBS). Ground under the clouds: Sentinel-2 cloudless mosaic (EOX), a picture made from many clear days, not from that day. The radar itself: the NISAR layer below.":
    "Vista de cámara: color real de VIIRS en NOAA-20 (NASA GIBS). El suelo bajo las nubes: mosaico sin nubes de Sentinel-2 (EOX), una imagen hecha con muchos días despejados, no con ese día. El radar en sí: la capa de NISAR de abajo.",
  "land that changed after the event": "terreno que cambió tras el evento",
  "Under the clouds · cloud-free mosaic": "Bajo las nubes · mosaico sin nubes",

  /* Change types added later */
  "Wind & storms": "Viento y tormentas",
  "wind damage": "daño por viento",
  "Crops and trees knocked down by strong wind, seen as standing vegetation losing its echo.":
    "Cultivos y árboles derribados por un viento fuerte, vistos como vegetación en pie que pierde su eco.",
  "Heat & drought": "Calor y sequía",
  drought: "sequía",
  "Soil and plants drying out in long heat: dry ground sends back a weaker radar echo.":
    "Suelo y plantas que se secan con un calor prolongado: el suelo seco devuelve un eco de radar más débil.",
  "Standing crops and trees scatter the pulse strongly; flattened ones lose that structure, so the echo weakens where the wind hit.":
    "Los cultivos y árboles en pie dispersan el pulso con fuerza; los tumbados pierden esa estructura, así que el eco se debilita donde golpeó el viento.",
  "Water makes surfaces bright to radar. As soil and plants dry, the echo weakens. Radar does not measure heat, only what heat does to the ground.":
    "El agua hace que las superficies se vean claras para el radar. A medida que el suelo y las plantas se secan, el eco se debilita. El radar no mide el calor, solo lo que el calor le hace al terreno.",

  /* Flood settings */
  "This is the riverside, where homes sit close to the water.": "Esta es la orilla del río, donde las casas están junto al agua.",
  "This is a dense neighbourhood: even a small flooded area here means streets and homes under water.":
    "Este es un barrio denso: aquí incluso una pequeña zona inundada significa calles y casas bajo el agua.",
  "Here the river meets the sea, among towns, cane fields and roads.":
    "Aquí el río se encuentra con el mar, entre pueblos, cañaverales y carreteras.",
  "In a mountain valley, water gathers fast in the low land along the river.":
    "En un valle de montaña, el agua se acumula rápido en la parte baja junto al río.",
  "At its peak, on {date}, about {total} km² were under water: {fresh} km² of new open water and {veg} km² of flooded vegetation, compared with the weeks before. {note}":
    "En su punto máximo, el {date}, unos {total} km² estaban bajo el agua: {fresh} km² de agua abierta nueva y {veg} km² de vegetación inundada, en comparación con las semanas anteriores. {note}",
  "In rice country fields are also flooded on purpose, so not all of it is a disaster.":
    "En zonas de arroz los campos también se inundan a propósito, así que no todo es un desastre.",

  /* Methods: new sources */
  "Weather records": "Registros del tiempo",
  "Daily rain, maximum temperature and wind gusts from the ERA5 reanalysis through the Open-Meteo historical weather API (CC BY 4.0), at the centre of each area. They support the “Why it happened” chain; they do not prove a cause pixel by pixel.":
    "Lluvia diaria, temperatura máxima y ráfagas de viento del reanálisis ERA5 a través de la API de clima histórico de Open-Meteo (CC BY 4.0), en el centro de cada área. Respaldan la cadena “Por qué pasó”; no prueban una causa píxel por píxel.",
  Population: "Población",
  "People per 1 km square from the GHSL population grid (GHS-POP R2023A, epoch 2025, European Commission JRC, CC BY 4.0). We add up the people living on the pixels our analysis flagged; each 20 m pixel takes the density of its square, so the result is an estimate, not a census.":
    "Personas por cuadrado de 1 km de la cuadrícula de población GHSL (GHS-POP R2023A, época 2025, JRC de la Comisión Europea, CC BY 4.0). Sumamos las personas que viven en los píxeles que marcó nuestro análisis; cada píxel de 20 m toma la densidad de su cuadrado, así que el resultado es una estimación, no un censo.",
  "Earthquake catalogue": "Catálogo de terremotos",
  "Magnitude, depth, time and place of earthquakes from the USGS catalogue (public domain). For Venezuela (M7.5, 24 June 2026) and Mexico (M7.3, 17 July 2026) it independently confirms the events our radar analysis was built around.":
    "Magnitud, profundidad, hora y lugar de los terremotos del catálogo del USGS (dominio público). Para Venezuela (M7.5, 24 de junio de 2026) y México (M7.3, 17 de julio de 2026) confirma de forma independiente los eventos en torno a los cuales se construyó nuestro análisis de radar.",
};
