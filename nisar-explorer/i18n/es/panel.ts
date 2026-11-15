/** Spanish for the case panel: simple view, technical view, evidence and the radar viewer. */

/* ------------------------------ simple view ------------------------------ */

const simple: Record<string, string> = {
  "Signs of water where there was land": "Señales de agua donde antes había tierra",
  "The land changed here, but it does not look like a flood": "La tierra cambió aquí, pero no parece una inundación",
  "Signs of vegetation lost": "Señales de vegetación perdida",
  "The ground changed here": "El suelo cambió aquí",
  about: "unas",
  "{n} football pitches": "{n} canchas de fútbol",
  "of land": "de terreno",
  "A radar satellite passed over {region} on {date}, and again {span} days later. This much land looked different the second time.":
    "Un satélite de radar pasó sobre {region} el {date}, y otra vez {span} días después. Esta cantidad de terreno se vio distinta la segunda vez.",
  "See it for yourself": "Míralo tú mismo",
  "Drag the line to compare the two visits.": "Arrastra la línea para comparar las dos visitas.",
  "What was on that land": "Qué había en ese terreno",
  "{n} pitches": "{n} canchas",
  "From a 2021 map of land use, so the ground may be different today.":
    "Viene de un mapa de uso del suelo de 2021, así que hoy el terreno puede ser distinto.",
  Farmland: "Tierras de cultivo",
  "Food and income for families": "Comida e ingresos para las familias",
  "Homes and streets": "Casas y calles",
  "Where people live and work": "Donde la gente vive y trabaja",
  Forest: "Bosque",
  "Shade, clean water and wildlife": "Sombra, agua limpia y vida silvestre",
  "Pasture and grassland": "Pastos y praderas",
  "Where animals graze": "Donde pastan los animales",
  Scrubland: "Matorral",
  "Dry-land habitat": "Hábitat de zonas secas",
  Wetland: "Humedal",
  "A natural sponge against floods": "Una esponja natural contra las inundaciones",
  Mangroves: "Manglares",
  "They shield the coast from storms": "Protegen la costa de las tormentas",
  "Bare ground": "Suelo desnudo",
  "Open soil and rock": "Tierra y roca al descubierto",
  "Why it matters to people": "Por qué importa a las personas",
  "When water covers farmland, a season of food and income can be lost. When it reaches homes, families have to leave them. Radar sees through storm clouds, so help can be pointed to the right place sooner.":
    "Cuando el agua cubre los campos de cultivo, se puede perder una temporada de comida e ingresos. Cuando llega a las casas, las familias tienen que dejarlas. El radar ve a través de las nubes de tormenta, así que la ayuda puede dirigirse antes al lugar correcto.",
  "A fire takes the forest that holds soil and water in place, and it can threaten the homes and farms nearby. Radar sees the damage through smoke, while it is still burning.":
    "Un incendio se lleva el bosque que sostiene el suelo y el agua, y puede amenazar las casas y las fincas cercanas. El radar ve el daño a través del humo, mientras todavía arde.",
  "How sure are we?": "¿Qué tan seguros estamos?",
  "A strong clue": "Una pista fuerte",
  "A clue": "Una pista",
  "A weak clue": "Una pista débil",
  "Only this land changed. Everything around it stayed the same.": "Solo cambió este terreno. Todo lo que lo rodea siguió igual.",
  "The whole area shifted a little too, so part of this may be the weather.":
    "Toda la zona también se movió un poco, así que parte de esto puede deberse al clima.",
  "This land rarely changes this much from one visit to the next.":
    "Este terreno rara vez cambia tanto de una visita a la siguiente.",
  "Part of it is sea or lake, where waves confuse the radar.": "Una parte es mar o lago, donde las olas confunden al radar.",
  "Most of the change points to wetter soil or growing crops, not standing water.":
    "La mayor parte del cambio apunta a suelo más húmedo o cultivos que crecen, no a agua acumulada.",
  "The area is very small, so it could be noise.": "El área es muy pequeña, así que podría ser ruido.",
  "Nobody has checked it on the ground yet.": "Nadie lo ha comprobado todavía en el terreno.",
  "The satellite shows that something changed. It cannot tell us why.":
    "El satélite muestra que algo cambió. No puede decirnos por qué.",
  "How can a satellite see this?": "¿Cómo puede un satélite ver esto?",
  "It makes its own light": "Fabrica su propia luz",
  "Like a bat, it sends a signal and listens for the echo.": "Como un murciélago, envía una señal y escucha el eco.",
  "Clouds do not stop it": "Las nubes no lo detienen",
  "It works at night, in rain and through smoke.": "Funciona de noche, con lluvia y a través del humo.",
  "Water looks dark": "El agua se ve oscura",
  "Calm water is a mirror. Forests and towns look bright.": "El agua en calma es un espejo. Los bosques y los pueblos se ven claros.",
  "See the technical details behind this →": "Ver los detalles técnicos detrás de esto →",
};

/* ------------------------------ case panel ------------------------------ */

const casePanel: Record<string, string> = {
  "Loading case": "Cargando el caso",
  "Close case panel": "Cerrar el panel del caso",
  "This case did not load": "Este caso no se cargó",
  "Tell me the story": "Cuéntame la historia",
  "A step-by-step walk through what the radar saw": "Un recorrido paso a paso por lo que vio el radar",
  "The two passes": "Las dos pasadas",
  "Changed on land": "Cambió en tierra",
  "{pct}% of {area} km² of land": "{pct}% de {area} km² de tierra",
  "Weaker / stronger": "Más débil / más fuerte",
  "on land, ≥ {thr} dB": "en tierra, ≥ {thr} dB",
  "Mean change": "Cambio medio",
  "over the whole scene, after − before": "en toda la escena, después − antes",
  Passes: "Pasadas",
  "{span} days apart": "separadas por {span} días",
  "Flagged land vs the rest · every pass · dB": "Tierra marcada frente al resto · cada pasada · dB",
  "What a change like this can mean": "Qué puede significar un cambio como este",
  "Read with care": "Léelo con cuidado",
  "How this was computed": "Cómo se calculó",
  Sensor: "Sensor",
  "{sensor}, {band}-band, {pol}, {size} m pixels": "{sensor}, banda {band}, {pol}, píxeles de {size} m",
  Track: "Trayectoria",
  Threshold: "Umbral",
  "{thr} dB, {px}×{px} median filter": "{thr} dB, filtro de mediana de {px}×{px}",
  "Open water": "Agua abierta",
  "before image darker than {db} dB ({area} km²)": "imagen anterior más oscura que {db} dB ({area} km²)",
  Overlap: "Solapamiento",
  "{pct}% of the area seen on both passes": "{pct}% del área vista en ambas pasadas",
  "Both passes are converted to decibels, the second is resampled onto the first, and the difference is thresholded.":
    "Las dos pasadas se convierten a decibelios, la segunda se remuestrea sobre la primera y a la diferencia se le aplica un umbral.",
  "Read the methods": "Lee los métodos",
  Satellite: "Satélite",

  "Vegetation scatters radar energy, so burned or cleared ground tends to return a weaker echo, especially in cross-polarised channels (HV, VH). Rain, soil moisture and farming can move the echo too, so a drop on its own does not prove a fire.":
    "La vegetación dispersa la energía del radar, así que el suelo quemado o despejado tiende a devolver un eco más débil, sobre todo en los canales de polarización cruzada (HV, VH). La lluvia, la humedad del suelo y la agricultura también pueden mover el eco, así que una caída por sí sola no prueba un incendio.",
  "Calm open water bounces the radar pulse away from the satellite, so flooded land usually turns dark. Wetter soil and growing crops do the opposite and make the echo brighter, which is not flooding.":
    "El agua abierta en calma desvía el pulso del radar lejos del satélite, así que la tierra inundada suele oscurecerse. El suelo más húmedo y los cultivos que crecen hacen lo contrario y aclaran el eco, y eso no es una inundación.",
  "Open water turns dark in radar. Flooded vegetation can turn bright, because the pulse bounces off the water and then the stems back to the satellite.":
    "El agua abierta se ve oscura en el radar. La vegetación inundada puede verse clara, porque el pulso rebota en el agua y luego en los tallos de vuelta hacia el satélite.",
  "Ice surfaces carry a stable speckle pattern, so shifts between passes track how the ice moves.":
    "Las superficies de hielo tienen un patrón de moteado estable, así que sus desplazamientos entre pasadas siguen el movimiento del hielo.",
  "Phase changes between passes show how far the ground moved along the satellite's line of sight.":
    "Los cambios de fase entre pasadas muestran cuánto se movió el suelo a lo largo de la línea de visión del satélite.",
  "Backscatter changes with crop growth, harvest and tillage, so shifts mark changes in what is planted.":
    "La retrodispersión cambia con el crecimiento, la cosecha y el arado, así que sus variaciones marcan cambios en lo que se siembra.",
  "Phase changes between passes reveal slow sinking or uplift of the ground.":
    "Los cambios de fase entre pasadas revelan hundimientos o elevaciones lentos del terreno.",
  "Phase changes between passes show how far a slope moved along the satellite's line of sight.":
    "Los cambios de fase entre pasadas muestran cuánto se movió una ladera a lo largo de la línea de visión del satélite.",

  "Comparing two {sensor} {pol} passes {span} days apart ({d1} and {d2}), no land crossed the {thr} threshold.":
    "Al comparar dos pasadas {sensor} {pol} separadas por {span} días ({d1} y {d2}), ninguna parte de la tierra superó el umbral de {thr}.",
  "Comparing two {sensor} {pol} passes {span} days apart ({d1} and {d2}), the radar echo weakened by at least {thr} over {area} km² of land ({pct}% of the {valid} km² of land analysed).":
    "Al comparar dos pasadas {sensor} {pol} separadas por {span} días ({d1} y {d2}), el eco del radar se debilitó al menos {thr} sobre {area} km² de tierra ({pct}% de los {valid} km² de tierra analizados).",
  "Comparing two {sensor} {pol} passes {span} days apart ({d1} and {d2}), the radar echo strengthened by at least {thr} over {area} km² of land ({pct}% of the {valid} km² of land analysed).":
    "Al comparar dos pasadas {sensor} {pol} separadas por {span} días ({d1} y {d2}), el eco del radar se reforzó al menos {thr} sobre {area} km² de tierra ({pct}% de los {valid} km² de tierra analizados).",
  "Comparing two {sensor} {pol} passes {span} days apart ({d1} and {d2}), the radar echo changed by at least {thr} over {area} km² of land ({pct}% of the {valid} km² of land analysed): it weakened over {down} km² and strengthened over {up} km².":
    "Al comparar dos pasadas {sensor} {pol} separadas por {span} días ({d1} y {d2}), el eco del radar cambió al menos {thr} sobre {area} km² de tierra ({pct}% de los {valid} km² de tierra analizados): se debilitó sobre {down} km² y se reforzó sobre {up} km².",
  "{pct}% of the pixels flagged over the whole scene were open water already in the before image. Wind and waves change the echo of the sea, so they are left out of the land figure.":
    "El {pct}% de los píxeles marcados en toda la escena ya era agua abierta en la imagen anterior. El viento y las olas cambian el eco del mar, así que quedan fuera de la cifra de tierra.",
  "Under 0.1% of the land changed. At this size radar speckle, soil moisture or wind can account for it: treat it as a lead to check, not a finding.":
    "Cambió menos del 0.1% de la tierra. A este tamaño, el moteado del radar, la humedad del suelo o el viento pueden explicarlo: tómalo como una pista por comprobar, no como un hallazgo.",
  "The two passes straddle ASF's switch from provisional to validated NISAR products ({date}). They come from different processing releases, so a small shift in level can come from the processing and not from the ground.":
    "Las dos pasadas quedan a ambos lados del cambio de ASF de productos NISAR provisionales a validados ({date}). Vienen de versiones de procesamiento distintas, así que un pequeño cambio de nivel puede deberse al procesamiento y no al terreno.",
  "Over land the echo got stronger more often ({up} km²) than weaker ({down} km²). Flooding usually makes open ground darker, so this looks more like wetter soil or crop growth than a flood.":
    "Sobre la tierra el eco se reforzó más veces ({up} km²) que se debilitó ({down} km²). Una inundación suele oscurecer el terreno abierto, así que esto se parece más a suelo más húmedo o a cultivos que crecen que a una inundación.",
  "This analysis only looked for weaker echoes. The echo also got stronger by at least {thr} dB over {up} km² of land, which is not counted above.":
    "Este análisis solo buscó ecos más débiles. El eco también se reforzó al menos {thr} dB sobre {up} km² de tierra, y eso no se cuenta arriba.",
  "The 2021 land-cover map marks {pct}% of the flagged land as permanent water: shoreline or shallow water that the brightness filter did not catch. That part is not land change.":
    "El mapa de cobertura del suelo de 2021 marca el {pct}% de la tierra señalada como agua permanente: costa o agua poco profunda que el filtro de brillo no descartó. Esa parte no es un cambio de la tierra.",
  "Not verified on the ground or against other sources.": "No verificado en el terreno ni con otras fuentes.",
};

/* -------------------------------- evidence -------------------------------- */

const evidence: Record<string, string> = {
  "Between the two passes the flagged land moved <b>{inside} dB</b>, while the rest of the land moved <b>{outside} dB</b>.":
    "Entre las dos pasadas, la tierra marcada se movió <b>{inside} dB</b>, mientras que el resto de la tierra se movió <b>{outside} dB</b>.",
  "The change is local: it did not come from something that shifted the whole scene.":
    "El cambio es local: no vino de algo que movió toda la escena.",
  "The whole scene shifted by a comparable amount, so part of this may be scene-wide (rain, season or calibration).":
    "Toda la escena se movió en una cantidad parecida, así que parte de esto puede afectar a toda la escena (lluvia, temporada o calibración).",
  "co-polarised: sensitive to surfaces, soil moisture and water under vegetation":
    "co-polarizado: sensible a las superficies, a la humedad del suelo y al agua bajo la vegetación",
  "co-polarised: sensitive to surfaces, soil moisture and rough water":
    "co-polarizado: sensible a las superficies, a la humedad del suelo y al agua agitada",
  "cross-polarised: sensitive to vegetation volume (leaves, branches)":
    "de polarización cruzada: sensible al volumen de la vegetación (hojas, ramas)",
  "Both channels flag a similar area, which points to a change that affects the surface and the vegetation alike.":
    "Ambos canales marcan un área parecida, lo que apunta a un cambio que afecta por igual a la superficie y a la vegetación.",
  "{big} flags {ratio}× more land than {small}: the change is mostly in what {big} responds to.":
    "{big} marca {ratio}× más tierra que {small}: el cambio está sobre todo en lo que responde {big}.",
  "{big} flags far more land than {small}: the change is mostly in what {big} responds to.":
    "{big} marca mucha más tierra que {small}: el cambio está sobre todo en lo que responde {big}.",
  "Which channel sees it": "Qué canal lo ve",
  analysed: "analizado",
  "Same two passes, same land, same {thr} dB threshold.": "Las mismas dos pasadas, la misma tierra, el mismo umbral de {thr} dB.",
  "Other wavelength:": "Otra longitud de onda:",
  "{label} ({band}-band, {pol}) flags <b>{area} km²</b> on land between {d1} and {d2}":
    "{label} (banda {band}, {pol}) marca <b>{area} km²</b> en tierra entre el {d1} y el {d2}",
  ", against {area} km² here. The dates differ, so read it as a second opinion, not a like-for-like test. L-band (24 cm) passes through leaves to trunks and soil; C-band (5.6 cm) mostly sees the top of the canopy.":
    ", frente a {area} km² aquí. Las fechas difieren, así que tómalo como una segunda opinión, no como una prueba equivalente. La banda L (24 cm) atraviesa las hojas hasta los troncos y el suelo; la banda C (5.6 cm) ve sobre todo la parte alta del dosel.",
  "What was on the ground": "Qué había en el suelo",
  "share of the flagged land": "parte de la tierra marcada",
  "share of all the land analysed": "parte de toda la tierra analizada",
  "<b>{label}</b> is {scene}% of the land analysed but {flagged}% of what changed: {lift}× over-represented.":
    "<b>{label}</b>: el {scene}% de la tierra analizada pero el {flagged}% de lo que cambió ({lift}× más de lo esperado).",
  "Land cover: {source}, a 2021 map. The ground may have changed since.":
    "Cobertura del suelo: {source}, un mapa de 2021. El terreno puede haber cambiado desde entonces.",
  "Compared with normal variation": "Comparado con la variación normal",
  "This track has {passes} passes. From {pairs} other pairs of consecutive passes we measured how much each pixel normally moves from one pass to the next (typically ±{sigma} dB).":
    "Esta trayectoria tiene {passes} pasadas. Con otros {pairs} pares de pasadas consecutivas medimos cuánto se mueve normalmente cada píxel de una pasada a la siguiente (típicamente ±{sigma} dB).",
  "<b>{pct}% of the flagged land ({area} km²)</b> changed by more than 3 times its own normal variation.":
    "<b>El {pct}% de la tierra marcada ({area} km²)</b> cambió más de 3 veces su propia variación normal.",
  "For those pixels this is unusual behaviour, not their ordinary flicker.":
    "Para esos píxeles esto es un comportamiento inusual, no su parpadeo habitual.",
  "The rest sits on pixels that often move this much, so it is weaker evidence.":
    "El resto está en píxeles que suelen moverse tanto, así que es una evidencia más débil.",
  "Not measured here: this track has only {passes} passes over the area, and a per-pixel baseline needs at least 7. As NISAR keeps returning every 12 days, this check becomes possible.":
    "No se midió aquí: esta trayectoria solo tiene {passes} pasadas sobre el área, y una línea base por píxel necesita al menos 7. Como NISAR sigue volviendo cada 12 días, esta comprobación será posible.",
  "What could be driving it": "Qué podría estar causándolo",
  "Hypotheses, each with the evidence that would confirm or rule it out.":
    "Hipótesis, cada una con la evidencia que la confirmaría o la descartaría.",
  "To check: {check}": "Para comprobarlo: {check}",
  "Fire removed leaves and branches, so less energy is scattered back in the cross-polarised channel.":
    "El fuego quitó hojas y ramas, así que se dispersa menos energía de vuelta en el canal de polarización cruzada.",
  "Thermal hot spots (NASA FIRMS) or a burn scar in optical imagery on the same dates.":
    "Puntos de calor térmicos (NASA FIRMS) o una cicatriz de quema en imágenes ópticas de las mismas fechas.",
  "Clearing or logging, a human driver, would look much the same to the radar.":
    "Un desmonte o una tala, de origen humano, se vería casi igual para el radar.",
  "Straight edges and roads nearby in optical imagery; local land-use records.":
    "Bordes rectos y caminos cercanos en imágenes ópticas; registros locales de uso del suelo.",
  "Drying: less water in soil and plants lowers the echo without any loss of vegetation.":
    "Sequedad: menos agua en el suelo y las plantas baja el eco sin que se pierda vegetación.",
  "Rainfall and soil-moisture records. Drying affects wide areas, not sharp patches.":
    "Registros de lluvia y de humedad del suelo. La sequedad afecta a zonas amplias, no a manchas nítidas.",
  "Standing water on open ground or crops turned a rough surface into a mirror, so the echo dropped.":
    "El agua acumulada sobre el terreno abierto o los cultivos convirtió una superficie rugosa en un espejo, y por eso cayó el eco.",
  "Rainfall and river records, NASA's OPERA surface-water product (DSWx), local reports.":
    "Registros de lluvia y de ríos, el producto de agua superficial OPERA de la NASA (DSWx), reportes locales.",
  "Wetter soil and growing crops raise the echo: a stronger return is not flooding.":
    "El suelo más húmedo y los cultivos que crecen suben el eco: un retorno más fuerte no es una inundación.",
  "Crop calendars and rainfall. Rises that follow field boundaries point to farming.":
    "Calendarios de cultivo y lluvia. Los aumentos que siguen los límites de los campos apuntan a agricultura.",
  "Farming itself: irrigation, harvest or ploughing between the two passes.":
    "La propia agricultura: riego, cosecha o arado entre las dos pasadas.",
  "Whether the patches match field shapes and the local crop cycle (rice paddies are flooded on purpose).":
    "Si las manchas coinciden con la forma de los campos y con el ciclo local de cultivo (los arrozales se inundan a propósito).",
  "Open water expanded or retreated with the seasons.": "El agua abierta se expandió o retrocedió con las estaciones.",
  "Rainfall and river levels; OPERA surface-water maps.": "Lluvia y niveles de los ríos; mapas de agua superficial de OPERA.",
  "Copy this link": "Copia este enlace",
  "Link copied": "Enlace copiado",
  "Copy link to this case": "Copiar el enlace a este caso",
  "Download data (JSON)": "Descargar los datos (JSON)",
  "Download area (GeoJSON)": "Descargar el área (GeoJSON)",
};

/* ------------------------------ radar viewer ------------------------------ */

const viewer: Record<string, string> = {
  "Before / after": "Antes / después",
  "What changed": "Qué cambió",
  Difference: "Diferencia",
  Flagged: "Marcado",
  "Over time": "A lo largo del tiempo",
  "Time-lapse": "Secuencia temporal",
  "Radar backscatter on {date}": "Retrodispersión del radar el {date}",
  "Before · {date}": "Antes · {date}",
  "After · {date}": "Después · {date}",
  "Compare the before and after radar images": "Comparar las imágenes de radar de antes y después",
  "{before}% before, {after}% after": "{before}% antes, {after}% después",
  "Change in backscatter between {before} and {after}": "Cambio en la retrodispersión entre el {before} y el {after}",
  "After − before": "Después − antes",
  "Pixels that changed by at least {thr}": "Píxeles que cambiaron al menos {thr}",
  "Changed ≥ {thr}": "Cambió ≥ {thr}",
  "False-colour radar image of {date}": "Imagen de radar en falso color del {date}",
  "Pass {n} / {total}": "Pasada {n} / {total}",
  "no data here": "sin datos aquí",
  "Pause the time-lapse": "Pausar la secuencia",
  "Play the time-lapse": "Reproducir la secuencia",
  "Satellite pass": "Pasada del satélite",
  "Bright is rough ground, forest or buildings. Dark is calm water or smooth ground.":
    "Lo claro es terreno rugoso, bosque o edificios. Lo oscuro es agua en calma o terreno liso.",
  "The coloured dots are the places that looked different on the second visit.":
    "Los puntos de color son los lugares que se vieron distintos en la segunda visita.",
  "Every visit of the satellite. Green is thick vegetation, purple is bare ground or low crops, black is water.":
    "Cada visita del satélite. El verde es vegetación densa, el morado es suelo desnudo o cultivos bajos, el negro es agua.",
  "Radar backscatter: brighter is a stronger echo (rough ground, buildings, vegetation); dark is calm water or smooth ground. Drag to compare; hover to read a pixel.":
    "Retrodispersión del radar: más claro es un eco más fuerte (terreno rugoso, edificios, vegetación); oscuro es agua en calma o terreno liso. Arrastra para comparar; pasa el cursor para leer un píxel.",
  "Red: the echo got weaker between the two passes. Blue: it got stronger. White: no change. Smoothed with a {px}-pixel median filter.":
    "Rojo: el eco se debilitó entre las dos pasadas. Azul: se reforzó. Blanco: sin cambio. Suavizado con un filtro de mediana de {px} píxeles.",
  "Weaker by ≥ {thr}": "Más débil en ≥ {thr}",
  "Stronger by ≥ {thr}": "Más fuerte en ≥ {thr}",
  "Pixels that crossed the threshold, drawn over the after image.": "Píxeles que superaron el umbral, dibujados sobre la imagen posterior.",
  "Only decreases were searched for in this analysis.": "En este análisis solo se buscaron descensos.",
  "Every pass of this track in false colour, on one fixed colour scale. Green and yellow: dense vegetation, which scatters the pulse in all directions. Purple and blue: bare ground, low crops and other surfaces. Black: calm water. Watch for patches that switch colour between passes.":
    "Cada pasada de esta trayectoria en falso color, con una escala de color fija. Verde y amarillo: vegetación densa, que dispersa el pulso en todas direcciones. Morado y azul: suelo desnudo, cultivos bajos y otras superficies. Negro: agua en calma. Fíjate en las manchas que cambian de color entre pasadas.",
  "Show on the globe": "Mostrar en el globo",
  "Zoom back out": "Alejar de nuevo",
  "Zoom the globe in": "Acercar el globo",
  Enlarge: "Ampliar",
  "Download image": "Descargar la imagen",
  "Image view": "Vista de la imagen",
  "Radar images, enlarged": "Imágenes de radar, ampliadas",
  "Close the enlarged view": "Cerrar la vista ampliada",

  /* Charts */
  "Only {n, plural, one {# pass} other {# passes}} of this track cover the area well enough, so there is no time series to draw.":
    "Solo {n, plural, one {# pasada} other {# pasadas}} de esta trayectoria cubren bien el área, así que no hay una serie temporal que dibujar.",
  Before: "Antes",
  After: "Después",
  "Median radar backscatter in dB on each pass, for the flagged land and for the rest of the land, from {from} to {to}. A table of the values follows.":
    "Retrodispersión mediana del radar en dB en cada pasada, para la tierra marcada y para el resto de la tierra, del {from} al {to}. A continuación sigue una tabla con los valores.",
  "Flagged land": "Tierra marcada",
  "Rest of land": "Resto de la tierra",
  "Rest of the land ({db} dB)": "Resto de la tierra ({db} dB)",
  "{n} passes": "{n} pasadas",
  "View data table": "Ver la tabla de datos",
  "Median backscatter on each pass, in dB.": "Retrodispersión mediana en cada pasada, en dB.",
  Date: "Fecha",
  Rest: "Resto",
  Note: "Nota",
  "Partial pass ({pct}%)": "Pasada parcial ({pct}%)",
  "{names} over time, in {unit}": "{names} a lo largo del tiempo, en {unit}",
};

/* ------------------- farming, ice, earthquakes, landslides ------------------- */

const extra: Record<string, string> = {
  "Track {track} · frame {frame} · {direction}": "Trayectoria {track} · cuadro {frame} · {direction}",
  ascending: "ascendente",
  descending: "descendente",
  asc: "asc",
  desc: "desc",
  "Radar image of {date}": "Imagen de radar del {date}",
  "Pass date": "Fecha de la pasada",
  "How this was measured": "Cómo se midió",
  "looks harvested": "parece cosechado",
  flooded: "quedó inundado",
  "looks burned or cleared": "parece quemado o despejado",
  "looks cleared of trees or crops": "parece despejado de árboles o cultivos",
  harvest: "cosecha",
  flooding: "inundación",
  burning: "quema",
  clearing: "desmonte",
  "{area} km² of land ({pct}% of the vegetation the satellite watched) {activity}: its radar echo dropped between {d1} and {d2}. The busiest stretch ended on {peak}, when {drop} km² changed in one step.":
    "{area} km² de terreno ({pct}% de la vegetación que vigiló el satélite) {activity}: su eco de radar bajó entre el {d1} y el {d2}. El tramo más activo terminó el {peak}, cuando {drop} km² cambiaron de una sola vez.",
  "At its peak, on {date}, about {total} km² were under water: {fresh} km² of new open water and {veg} km² of flooded vegetation, compared with the weeks before. In rice country fields are also flooded on purpose, so not all of it is a disaster.":
    "En su punto máximo, el {date}, unos {total} km² estaban bajo el agua: {fresh} km² de agua abierta nueva y {veg} km² de vegetación inundada, en comparación con las semanas anteriores. En zonas de arroz los campos también se inundan a propósito, así que no todo es un desastre.",
  "Land that changed": "Terreno que cambió",
  "{pct}% of the vegetated land": "{pct}% del terreno con vegetación",
  "Busiest stretch": "Tramo más activo",
  "{area} km² in 12 days": "{area} km² en 12 días",
  "until {date}": "hasta el {date}",
  "Half had changed by": "La mitad había cambiado para el",
  "median date of the change": "fecha mediana del cambio",
  "Passes used": "Pasadas usadas",
  "Flooded at peak": "Inundado en el máximo",
  "New open water": "Agua abierta nueva",
  "was dry in the baseline": "estaba seco en la línea base",
  "Flooded vegetation": "Vegetación inundada",
  "water under crops or trees": "agua bajo cultivos o árboles",
  "Always water": "Siempre agua",
  "rivers and ponds, left out": "ríos y estanques, excluidos",
  "Land that has changed, pass by pass": "Terreno que ha cambiado, pasada a pasada",
  "km², running total": "km², total acumulado",
  "Changed so far": "Cambiado hasta ahora",
  "Median echo of the whole area": "Eco mediano de toda el área",
  "co-pol": "co-pol",
  "cross-pol": "pol. cruzada",
  "Water by pass": "Agua por pasada",
  "Empty rings are the baseline passes the others are compared with.":
    "Los anillos vacíos son las pasadas de referencia con las que se comparan las demás.",
  "Satellite track": "Trayectoria del satélite",
  "Map of change dates": "Mapa de fechas del cambio",
  "Map of the flooding": "Mapa de la inundación",
  "Map of when each patch of land changed": "Mapa de cuándo cambió cada parche de terreno",
  "Map of new water and flooded vegetation": "Mapa del agua nueva y la vegetación inundada",
  "Each patch is coloured by the date its echo dropped (see the bar). Blank land did not change.":
    "Cada parche está coloreado según la fecha en que bajó su eco (mira la barra). El terreno en blanco no cambió.",
  "Blue is new open water, green is flooded vegetation, on a grey radar image of the dry season.":
    "El azul es agua abierta nueva y el verde es vegetación inundada, sobre una imagen de radar gris de la estación seca.",
  "Each pass": "Cada pasada",
  "False colour: red and blue carry the co-polarised echo, green the cross-polarised one. Vegetation tends to look green; bare or wet ground looks darker.":
    "Falso color: el rojo y el azul llevan el eco co-polarizado y el verde el de polarización cruzada. La vegetación tiende a verse verde; el suelo desnudo o mojado se ve más oscuro.",
  "The radar sees the echo weaken or strengthen. That this was {what} is our reading of the place, not something the radar tells apart.":
    "El radar ve que el eco se debilita o se refuerza. Que esto fuera {what} es nuestra lectura del lugar, no algo que el radar distinga.",
  Polarisations: "Polarizaciones",
  "{a} and {b}": "{a} y {b}",
  "Vegetation above": "Vegetación por encima de",
  "Water below": "Agua por debajo de",
  "Median filter": "Filtro de mediana",
  Pixel: "Píxel",
  "Mean largest drop": "Mayor caída media",
  "Baseline passes": "Pasadas de referencia",

  "The ice here moves up to {max} m a day at its fastest, about {between} m between two passes {days} days apart. Roughly {area} km² of it moves faster than {thr} m a day. The speed comes from tracking how the radar speckle pattern slides from one pass to the next.":
    "El hielo aquí se mueve hasta {max} m al día en su punto más rápido, unos {between} m entre dos pasadas separadas por {days} días. Aproximadamente {area} km² se mueven más rápido que {thr} m al día. La velocidad sale de seguir cómo se desliza el patrón de moteado del radar de una pasada a la siguiente.",
  "Fastest ice": "Hielo más rápido",
  "top speed in the scene": "velocidad máxima en la escena",
  "m/day": "m/día",
  Typical: "Típico",
  "half the scene is slower": "la mitad de la escena es más lenta",
  "Faster than {thr} m/day": "Más rápido que {thr} m/día",
  "average over the pairs": "promedio de los pares",
  "Passes compared": "Pasadas comparadas",
  pairs: "pares",
  "Speed map": "Mapa de velocidad",
  "Map of the ice speed": "Mapa de la velocidad del hielo",
  "Median speed over all the pairs, in metres a day, on a logarithmic scale: dark blue is nearly still, red is fastest. Dark patches are ground the method could not read.":
    "Velocidad mediana de todos los pares, en metros por día, en escala logarítmica: el azul oscuro está casi quieto y el rojo es lo más rápido. Las manchas oscuras son terreno que el método no pudo leer.",
  "False colour of single passes: red and blue carry the co-polarised echo, green the cross-polarised one.":
    "Falso color de pasadas individuales: el rojo y el azul llevan el eco co-polarizado y el verde el de polarización cruzada.",
  "Speed over time": "Velocidad a lo largo del tiempo",
  "m per day": "m por día",
  "Fast edge (95th percentile)": "Borde rápido (percentil 95)",
  "Median of ice > {thr} m/day": "Mediana del hielo > {thr} m/día",
  Method: "Método",
  "Assumed incidence": "Incidencia supuesta",
  "Noise on still ground": "Ruido en suelo quieto",
  "Fastest pair": "Par más rápido",

  "Between {d1} and {d2}, the ground moved up to {toward} cm toward the satellite and {away} cm away from it, along the satellite’s line of sight. About {area} km² moved more than 5 cm.":
    "Entre el {d1} y el {d2}, el suelo se movió hasta {toward} cm hacia el satélite y {away} cm alejándose de él, a lo largo de la línea de visión del satélite. Unos {area} km² se movieron más de 5 cm.",
  "Only {pct}% of this picture could be measured reliably: over water, steep or leafy ground the radar lost the thread, so read it as a partial view.":
    "Solo el {pct}% de esta imagen se pudo medir con fiabilidad: sobre agua, terreno empinado o con mucha hoja el radar perdió el hilo, así que tómala como una vista parcial.",
  "{pct}% of this picture could be measured reliably.": "El {pct}% de esta imagen se pudo medir con fiabilidad.",
  "Pair of passes": "Par de pasadas",
  "Toward the satellite": "Hacia el satélite",
  "up and/or toward it": "hacia arriba y/o hacia él",
  "Away from it": "Alejándose de él",
  "down and/or away": "hacia abajo y/o alejándose",
  "Moved over 5 cm": "Se movió más de 5 cm",
  "{area} km² over 10 cm": "{area} km² más de 10 cm",
  "Collapse on": "Derrumbe el",
  "Event on": "Evento el",
  "{days} days between the passes": "{days} días entre las pasadas",
  "Ground movement": "Movimiento del suelo",
  "Map of the ground movement in centimetres": "Mapa del movimiento del suelo en centímetros",
  "Red: the ground moved toward the satellite. Blue: away from it. Blank areas could not be measured. Axes are kilometres on the ground.":
    "Rojo: el suelo se movió hacia el satélite. Azul: se alejó de él. Las zonas en blanco no se pudieron medir. Los ejes son kilómetros sobre el terreno.",
  Fringes: "Franjas",
  "Interferogram fringes": "Franjas del interferograma",
  "Each full colour cycle is {cm} cm of movement along the line of sight. The more cycles close together, the more the ground moved.":
    "Cada ciclo completo de color son {cm} cm de movimiento a lo largo de la línea de visión. Cuantos más ciclos juntos, más se movió el suelo.",
  Pair: "Par",
  "{days} days": "{days} días",
  Wavelength: "Longitud de onda",
  "Coverage of the area": "Cobertura del área",
  "Reliable pixels": "Píxeles fiables",
  "Median coherence": "Coherencia mediana",
  "Lost coherence": "Coherencia perdida",
  "Moved over 20 cm": "Se movió más de 20 cm",
  "Ionosphere removed": "Ionosfera eliminada",
  yes: "sí",
  no: "no",
};

export const panel: Record<string, string> = { ...simple, ...casePanel, ...evidence, ...viewer, ...extra };
