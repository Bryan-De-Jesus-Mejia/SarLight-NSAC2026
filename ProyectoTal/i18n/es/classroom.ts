/** Spanish for the Classroom (saved cases) and the printable study guide. */

const ui: Record<string, string> = {
  "Saved in the classroom. Tap to remove it.": "Guardado en el aula. Toca para quitarlo.",
  "Save this case in the classroom": "Guardar este caso en el aula",
  "Remove from the classroom": "Quitar del aula",
  "Save to the classroom": "Guardar en el aula",
  Open: "Abrir",
  "Study guide (PDF)": "Guía de estudio (PDF)",
  "Prompt copied": "Prompt copiado",
  "Could not copy": "No se pudo copiar",
  "Copy AI study prompt": "Copiar prompt de estudio con IA",
  Remove: "Quitar",
  Classroom: "Aula",
  "Keep up to {max} cases to come back to, and get a study guide for each one.":
    "Guarda hasta {max} casos para volver a ellos y consigue una guía de estudio de cada uno.",
  "The classroom is full. Which case do you want to replace with “{name}”?": "El aula está llena. ¿Qué caso quieres reemplazar por “{name}”?",
  Replace: "Reemplazar",
  "Nothing saved yet. Open a case and tap the bookmark to keep it here.":
    "Todavía no hay nada guardado. Abre un caso y toca el marcador para guardarlo aquí.",
  "Saved only in this browser: they are not shared between devices.": "Se guardan solo en este navegador: no se comparten entre dispositivos.",
  Version: "Versión",
  "Teacher version": "Versión del maestro",
  "Student version": "Versión del estudiante",
  "Download PDF": "Descargar PDF",
  "In the print window, choose “Save as PDF” as the destination.": "En la ventana de impresión, elige “Guardar como PDF” como destino.",
  "Study guide": "Guía de estudio",
  "QR code to open this case": "Código QR para abrir este caso",
  "Scan to open the case on the globe": "Escanea para abrir el caso en el globo",
  "How a satellite sees this": "Cómo ve esto un satélite",
  "What you will learn": "Qué vas a aprender",
  "Key words": "Palabras clave",
  "Study plan · 45 minutes": "Plan de estudio · 45 minutos",
  "{n} min": "{n} min",
  Questions: "Preguntas",
  Answer: "Respuesta",
  "Hands-on activity": "Actividad práctica",
  "Quick quiz": "Quiz rápido",
  "Study with an AI assistant": "Estudia con un asistente de IA",
  "Paste this prompt into ChatGPT, Claude, Gemini or any assistant you use. It already includes the facts of this case.":
    "Pega este prompt en ChatGPT, Claude, Gemini o el asistente que uses. Ya incluye los datos de este caso.",
  "Learn more": "Aprende más",
  "Radar data: NASA–ISRO NISAR and ESA Copernicus Sentinel-1 (through NASA ASF and OPERA). Land cover: ESA WorldCover 2021.":
    "Datos de radar: NISAR de la NASA e ISRO y Sentinel-1 de Copernicus (ESA), a través de ASF y OPERA de la NASA. Cobertura del suelo: ESA WorldCover 2021.",
  "Made for the NASA Space Apps Challenge 2026, “Dancing with the SARs”.": "Hecho para el NASA Space Apps Challenge 2026, “Dancing with the SARs”.",
};

const topics: Record<string, string> = {
  /* flood */
  "Explain why flooded land looks dark in a radar image.": "Explicar por qué la tierra inundada se ve oscura en una imagen de radar.",
  Flood: "Inundación",
  "Land that is normally dry and is covered by water.": "Tierra que normalmente está seca y queda cubierta por agua.",
  "Look for patches that are dark in the second image and were not dark in the first one.":
    "Busca manchas que son oscuras en la segunda imagen y no lo eran en la primera.",
  "Calm water acts like a mirror: the radar pulse bounces away and little echo returns. Which patches could be water, and which could be wet soil or crops?":
    "El agua en calma actúa como un espejo: el pulso del radar rebota hacia otro lado y regresa poco eco. ¿Qué manchas podrían ser agua y cuáles suelo mojado o cultivos?",
  "Why does calm water look dark to a radar?": "¿Por qué el agua en calma se ve oscura para un radar?",
  "Because it reflects the pulse away from the satellite like a mirror, so almost no echo comes back.":
    "Porque desvía el pulso lejos del satélite como un espejo, así que casi no regresa eco.",
  "Why can wetter soil or growing crops be confused with a flood?": "¿Por qué el suelo más húmedo o los cultivos que crecen pueden confundirse con una inundación?",
  "They also change the echo, but they usually make it brighter, not darker, so the direction of the change matters.":
    "También cambian el eco, pero suelen hacerlo más claro, no más oscuro, así que importa la dirección del cambio.",
  "Plan for the next rain": "Plan para la próxima lluvia",
  "On a sketch of your neighbourhood, mark where water would gather, the way to higher ground and where you would keep important papers. Compare it with the dark patches in the radar image.":
    "En un croquis de tu barrio, marca dónde se juntaría el agua, el camino a terreno más alto y dónde guardarías los papeles importantes. Compáralo con las manchas oscuras de la imagen de radar.",
  /* wildfire */
  "Explain what a fire removes from the land and why the radar echo weakens.": "Explicar qué le quita un incendio a la tierra y por qué se debilita el eco del radar.",
  "Burn scar": "Cicatriz de quema",
  "The mark left on the land after a fire: leaves and branches are gone and bare soil shows.":
    "La marca que deja un incendio en la tierra: sin hojas ni ramas y con el suelo al descubierto.",
  "Look for patches whose echo got weaker between the two passes.": "Busca manchas cuyo eco se debilitó entre las dos pasadas.",
  "Leaves and branches scatter the radar pulse back to the satellite. Without them the echo drops. What else could remove leaves, and how would you tell it apart from a fire?":
    "Las hojas y las ramas devuelven el pulso del radar al satélite. Sin ellas el eco baja. ¿Qué más podría quitar las hojas y cómo lo distinguirías de un incendio?",
  "Why does burned forest send back a weaker echo?": "¿Por qué el bosque quemado devuelve un eco más débil?",
  "Leaves and branches scatter the pulse; once they are gone, less energy returns to the satellite.":
    "Las hojas y las ramas dispersan el pulso; sin ellas, regresa menos energía al satélite.",
  "What other event could make the echo weaker in the same place?": "¿Qué otro evento podría debilitar el eco en el mismo lugar?",
  "Clearing or logging, or a very dry spell. Heat hot spots or optical images on the same dates help tell them apart.":
    "Un desmonte o una tala, o un periodo muy seco. Los puntos de calor o las imágenes ópticas de las mismas fechas ayudan a distinguirlos.",
  "A fire-safe home": "Una casa a salvo del fuego",
  "Draw your home and mark a strip of at least a few metres cleared of dry grass and branches. List three things your community can do to prevent fires.":
    "Dibuja tu casa y marca una franja de al menos unos metros libre de hierba seca y ramas. Anota tres cosas que tu comunidad puede hacer para prevenir incendios.",
  /* earthquake */
  "Explain how comparing two radar passes shows how far the ground moved.": "Explicar cómo comparar dos pasadas de radar muestra cuánto se movió el suelo.",
  Fringe: "Franja",
  "One full cycle of colour in an interferogram: about half a radar wavelength of ground motion.":
    "Un ciclo completo de color en un interferograma: más o menos media longitud de onda del radar de movimiento del suelo.",
  "Count how many colour rings you can see and where they are closest together.": "Cuenta cuántos anillos de color ves y dónde están más juntos.",
  "Each full colour cycle is about 12 cm of movement along the line of sight. Where are the rings packed tightest, and what does that say about the movement?":
    "Cada ciclo completo de color son unos 12 cm de movimiento a lo largo de la línea de visión. ¿Dónde están más apretados los anillos y qué dice eso del movimiento?",
  "What does one full cycle of colour mean?": "¿Qué significa un ciclo completo de color?",
  "About half the radar wavelength of motion along the line of sight, around 12 cm for NISAR.":
    "Más o menos media longitud de onda del radar de movimiento a lo largo de la línea de visión, unos 12 cm para NISAR.",
  "Why do some areas appear blank?": "¿Por qué algunas zonas aparecen en blanco?",
  "The radar lost the thread there, often over water or dense forest, so those pixels could not be measured.":
    "Allí el radar perdió el hilo, a menudo sobre agua o bosque denso, así que esos píxeles no se pudieron medir.",
  "Family earthquake plan": "Plan familiar para un terremoto",
  "With your family or class, agree on a meeting point, a safe spot in each room (under a sturdy table, away from windows) and what to pack in an emergency bag.":
    "Con tu familia o tu clase, acuerden un punto de encuentro, un lugar seguro en cada cuarto (bajo una mesa firme, lejos de las ventanas) y qué poner en una mochila de emergencia.",
  /* agriculture */
  "Explain how a radar can follow a crop through the season.": "Explicar cómo un radar puede seguir un cultivo a lo largo de la temporada.",
  "Crop cycle": "Ciclo de cultivo",
  "The stages of a crop over time: planting, growth, harvest and bare soil.": "Las etapas de un cultivo en el tiempo: siembra, crecimiento, cosecha y suelo desnudo.",
  "Compare the first and last visits: which fields changed, and when?": "Compara la primera y la última visita: ¿qué campos cambiaron y cuándo?",
  "Tall plants send back a strong echo and bare fields send back much less. If a field drops sharply between two visits, what might have happened on it?":
    "Las plantas altas devuelven un eco fuerte y los campos desnudos mucho menos. Si un campo cae bruscamente entre dos visitas, ¿qué pudo pasar en él?",
  "Why does a harvested field send back less echo?": "¿Por qué un campo cosechado devuelve menos eco?",
  "Standing plants scatter the radar pulse; bare soil or stubble scatters much less.":
    "Las plantas en pie dispersan el pulso del radar; el suelo desnudo o el rastrojo dispersan mucho menos.",
  "Why is a single drop not enough to be sure it was a harvest?": "¿Por qué una sola caída no basta para asegurar que fue una cosecha?",
  "Burning, clearing or flooding can look similar, so the place, the calendar and the whole series of passes matter.":
    "Una quema, un desmonte o una inundación pueden verse parecidos, así que importan el lugar, el calendario y toda la serie de pasadas.",
  "A field calendar": "Un calendario de campo",
  "Make a simple calendar of planting, growth, harvest and losses for one field or garden, with one row per month. Add what you would want a satellite to tell you.":
    "Haz un calendario sencillo de siembra, crecimiento, cosecha y pérdidas de un campo o un huerto, con una fila por mes. Agrega lo que te gustaría que te dijera un satélite.",
  /* glacier */
  "Explain how a radar measures the speed of moving ice.": "Explicar cómo un radar mide la velocidad del hielo en movimiento.",
  Glacier: "Glaciar",
  "A large body of ice that flows slowly downhill, often to the sea.": "Una gran masa de hielo que fluye lentamente cuesta abajo, a menudo hacia el mar.",
  "Find the fastest part of the ice on the speed map and the parts that barely move.":
    "Encuentra en el mapa de velocidad la parte más rápida del hielo y las partes que casi no se mueven.",
  "The radar finds the same cracks in two images and measures how far they travelled. Distance divided by days gives speed. Why does ice reaching the sea matter to every coast?":
    "El radar encuentra las mismas grietas en dos imágenes y mide cuánto se desplazaron. La distancia dividida entre los días da la velocidad. ¿Por qué importa a todas las costas el hielo que llega al mar?",
  "How is the speed of the ice measured?": "¿Cómo se mide la velocidad del hielo?",
  "By finding the same cracks and textures in two passes and dividing how far they moved by the days between them.":
    "Encontrando las mismas grietas y texturas en dos pasadas y dividiendo cuánto se movieron entre los días que pasaron.",
  "Why does a glacier flowing into the sea matter for the Caribbean?": "¿Por qué le importa al Caribe que un glaciar fluya hacia el mar?",
  "Ice that reaches the ocean adds water and raises sea level on every coast.": "El hielo que llega al océano suma agua y sube el nivel del mar en todas las costas.",
  "Ice and sea level": "Hielo y nivel del mar",
  "Fill a glass with ice and water to the brim, then another with a block of ice resting on a plate above the water line. Which one overflows when the ice melts, and what does that say about glaciers on land?":
    "Llena un vaso con hielo y agua hasta el borde y otro con un bloque de hielo sobre un plato por encima del nivel del agua. ¿Cuál se desborda cuando el hielo se derrite y qué dice eso de los glaciares en tierra?",
  /* wetland */
  "Explain how radar tells open water from flooded vegetation.": "Explicar cómo distingue el radar el agua abierta de la vegetación inundada.",
  "Land that is covered or soaked with water for part of the year, home to special plants and animals.":
    "Tierra cubierta o empapada de agua durante parte del año, hogar de plantas y animales especiales.",
  "Look for areas that changed between the passes near rivers, lakes or the coast.": "Busca zonas que cambiaron entre las pasadas cerca de ríos, lagos o la costa.",
  "Open water turns dark, but flooded vegetation can turn bright because the pulse bounces off the water and then the stems. What could each look like here?":
    "El agua abierta se oscurece, pero la vegetación inundada puede verse clara porque el pulso rebota en el agua y luego en los tallos. ¿Cómo podría verse cada una aquí?",
  "Why can flooded vegetation look bright in radar?": "¿Por qué la vegetación inundada puede verse clara en el radar?",
  "The pulse bounces off the water and then off the stems back to the satellite, a strong 'double bounce'.":
    "El pulso rebota en el agua y luego en los tallos de vuelta al satélite: un fuerte “doble rebote”.",
  "Why do wetlands matter for people?": "¿Por qué importan los humedales para las personas?",
  "They soak up floodwater, filter water and shelter wildlife and fish.": "Absorben el agua de las inundaciones, filtran el agua y dan refugio a la fauna y a los peces.",
  "Local water map": "Mapa local del agua",
  "List the rivers, ponds and low areas near you and where water goes after heavy rain. Mark which ones people depend on.":
    "Anota los ríos, charcas y zonas bajas cerca de ti y adónde va el agua tras una lluvia fuerte. Marca de cuáles depende la gente.",
  /* deformation */
  "Explain how radar can notice ground that sinks or rises slowly.": "Explicar cómo puede notar el radar un suelo que se hunde o se eleva lentamente.",
  Subsidence: "Subsidencia",
  "A slow sinking of the ground, for example when water or gas is taken from below.": "Un hundimiento lento del suelo, por ejemplo cuando se extrae agua o gas de abajo.",
  "Look for smooth areas of colour that change slowly across the map.": "Busca zonas suaves de color que cambian poco a poco por el mapa.",
  "Tiny changes in the radar wave's timing reveal movements of millimetres. Why can this show damage long before it can be seen with the eye?":
    "Cambios diminutos en el momento de la onda del radar revelan movimientos de milímetros. ¿Por qué esto puede mostrar daños mucho antes de que se vean a simple vista?",
  "Why can radar detect movements too small to see?": "¿Por qué puede el radar detectar movimientos demasiado pequeños para verse?",
  "It measures the timing of the wave very precisely, so even millimetres of change show up between passes.":
    "Mide el momento de la onda con mucha precisión, así que hasta milímetros de cambio aparecen entre pasadas.",
  "Who could use a map of sinking ground?": "¿Quién podría usar un mapa de suelo que se hunde?",
  "Engineers, city planners and water managers, to protect buildings, roads and pipes.":
    "Ingenieros, urbanistas y quienes manejan el agua, para proteger edificios, caminos y tuberías.",
  "Check the signs": "Revisa las señales",
  "Walk around your school or street and look for cracks in walls, tilted poles or uneven ground. Photograph and map them.":
    "Recorre tu escuela o tu calle y busca grietas en paredes, postes inclinados o suelo desparejo. Fotografíalos y márcalos en un mapa.",
  /* landslide */
  "Explain how radar can show that a slope moved.": "Explicar cómo puede mostrar el radar que una ladera se movió.",
  Landslide: "Deslizamiento",
  "Soil, rock or mud sliding down a slope, often after heavy rain or an earthquake.": "Suelo, roca o lodo que se desliza por una ladera, a menudo tras una lluvia fuerte o un terremoto.",
  "Look for patches on slopes where the echo or the ground position changed.": "Busca manchas en las laderas donde cambió el eco o la posición del suelo.",
  "Fresh scars and debris change how rough the surface is, so the echo shifts where the ground moved. Which slopes near you could be at risk after long rain?":
    "Las cicatrices recientes y los escombros cambian la rugosidad de la superficie, así que el eco cambia donde se movió el suelo. ¿Qué laderas cerca de ti podrían estar en riesgo tras una lluvia larga?",
  "What can set off a landslide?": "¿Qué puede provocar un deslizamiento?",
  "Heavy or long rain that soaks the soil, an earthquake, or building on steep or cut slopes.":
    "Una lluvia fuerte o larga que empapa el suelo, un terremoto, o construir en laderas empinadas o cortadas.",
  "Why is it useful to watch slopes from space?": "¿Por qué sirve vigilar las laderas desde el espacio?",
  "It shows where ground moved even where roads are cut or clouds hide the land.": "Muestra dónde se movió el suelo incluso donde los caminos están cortados o las nubes tapan la tierra.",
  "Slope safety walk": "Recorrido de seguridad por las laderas",
  "Identify steep slopes near your home or school. Note new cracks, tilted trees or muddy springs, and decide where people should not stay in long rain.":
    "Identifica laderas empinadas cerca de tu casa o escuela. Anota grietas nuevas, árboles inclinados o manantiales turbios, y decide dónde no debería quedarse la gente en una lluvia larga.",
  /* storm */
  "Explain how radar shows crops and trees flattened by wind.": "Explicar cómo muestra el radar los cultivos y árboles tumbados por el viento.",
  Gust: "Ráfaga",
  "A short burst of strong wind, much faster than the average wind.": "Un golpe breve de viento fuerte, mucho más rápido que el viento promedio.",
  "Look for patches where the echo weakened after the wind, compared with the visits before.":
    "Busca manchas donde el eco se debilitó tras el viento, comparado con las visitas anteriores.",
  "Standing plants send back a strong echo; flattened ones lose that structure. How would a farmer or an insurer use a map of where the wind hit?":
    "Las plantas en pie devuelven un eco fuerte; las tumbadas pierden esa estructura. ¿Cómo usaría un agricultor o una aseguradora un mapa de dónde pegó el viento?",
  "Why does flattened vegetation send back a weaker echo?": "¿Por qué la vegetación tumbada devuelve un eco más débil?",
  "Standing plants scatter the pulse strongly; once flattened they lose that structure.":
    "Las plantas en pie dispersan el pulso con fuerza; al tumbarse pierden esa estructura.",
  "Who could use a map of wind damage?": "¿Quién podría usar un mapa de daños por viento?",
  "Farmers, insurers and local authorities, to decide where to look and help first.":
    "Agricultores, aseguradoras y autoridades locales, para decidir dónde mirar y ayudar primero.",
  "Storm-ready home": "Una casa lista para la tormenta",
  "List what you would tie down, store or move before a storm, and photograph with the date any damage after it: it helps when asking for aid.":
    "Anota qué amarrarías, guardarías o moverías antes de una tormenta, y fotografía con la fecha cualquier daño después: ayuda al pedir ayuda.",
  /* drought */
  "Explain how radar can notice land drying out in the heat.": "Explicar cómo puede notar el radar la tierra que se seca con el calor.",
  Drought: "Sequía",
  "A long period with far less water than normal for the soil, plants and people.": "Un periodo largo con mucha menos agua de la normal para el suelo, las plantas y las personas.",
  "Look for large areas where the echo weakened gradually over several visits.": "Busca zonas grandes donde el eco se debilitó poco a poco a lo largo de varias visitas.",
  "Water makes surfaces bright to radar, so drying soil and plants send back less echo. The radar does not feel heat: it sees what heat does. What can people do to save water?":
    "El agua hace que las superficies se vean claras para el radar, así que el suelo y las plantas que se secan devuelven menos eco. El radar no siente el calor: ve lo que el calor provoca. ¿Qué puede hacer la gente para ahorrar agua?",
  "Why does drier land send back a weaker echo?": "¿Por qué la tierra más seca devuelve un eco más débil?",
  "Water makes soil and plants bright to radar; as they dry, less energy returns.":
    "El agua hace que el suelo y las plantas se vean claros para el radar; al secarse, regresa menos energía.",
  "Does the radar measure temperature?": "¿El radar mide la temperatura?",
  "No. It only sees what heat does to the ground and the plants.": "No. Solo ve lo que el calor le hace al suelo y a las plantas.",
  "A water budget": "Un presupuesto de agua",
  "Count the litres your family uses in a day for drinking, washing and cooking, and find three ways to save water in a dry season.":
    "Cuenta los litros que usa tu familia en un día para beber, lavar y cocinar, y encuentra tres formas de ahorrar agua en una temporada seca.",
};

const guide: Record<string, string> = {
  "NISAR mission": "La misión NISAR",
  "NASA and ISRO's radar mission: what it measures and why.": "La misión de radar de la NASA y la ISRO: qué mide y por qué.",
  "NASA Earthdata": "NASA Earthdata",
  "Free NASA satellite data and learning material.": "Datos satelitales de la NASA y material para aprender, gratis.",
  "Alaska Satellite Facility (ASF)": "Alaska Satellite Facility (ASF)",
  "Where NISAR and Sentinel-1 radar scenes are stored and shared.": "Donde se guardan y comparten las escenas de radar de NISAR y Sentinel-1.",
  "NASA Space Apps Challenge": "NASA Space Apps Challenge",
  "The hackathon this project was made for.": "El hackathon para el que se hizo este proyecto.",
  "Read it": "Léelo",
  "On which two dates did the satellite look at this place?": "¿En qué dos fechas miró el satélite este lugar?",
  "{d1} and {d2}, {span} days apart.": "{d1} y {d2}, con {span} días de diferencia.",
  "How much land changed, and how big is that in football pitches?": "¿Cuánta tierra cambió y qué tan grande es eso en canchas de fútbol?",
  "About {area} km², roughly {pitches} football pitches.": "Unos {area} km², aproximadamente {pitches} canchas de fútbol.",
  "Explain it": "Explícalo",
  "Think about it": "Piénsalo",
  "The radar shows that something changed. Why can it not tell us why?": "El radar muestra que algo cambió. ¿Por qué no puede decirnos por qué?",
  "Different events can leave a similar echo. Only extra evidence, such as weather records or a visit to the place, can confirm the cause.":
    "Eventos distintos pueden dejar un eco parecido. Solo evidencia adicional, como registros del clima o una visita al lugar, puede confirmar la causa.",
  "What would you check on the ground to confirm what the radar found?": "¿Qué comprobarías en el terreno para confirmar lo que encontró el radar?",
  "Photos and dates from people who live there, rain or heat records, and a visit to the patches with the biggest change.":
    "Fotos y fechas de personas que viven allí, registros de lluvia o calor, y una visita a las manchas con más cambio.",
  "{span} days": "{span} días",
  "{n} days": "{n} días",
  "NASA and ISRO (India)": "NASA e ISRO (India)",
  "ESA and JAXA": "ESA y JAXA",
  "NASA and ESA": "NASA y ESA",
  "Only NASA": "Solo la NASA",
  "Dark, because the pulse bounces away": "Oscura, porque el pulso rebota hacia otro lado",
  "Bright, because water shines": "Clara, porque el agua brilla",
  "The same as the land around it": "Igual que la tierra a su alrededor",
  "Invisible, because water has no echo": "Invisible, porque el agua no tiene eco",
  "About {area} km²": "Unos {area} km²",
  "No: it shows that something changed, not why": "No: muestra que algo cambió, no por qué",
  "Yes, always": "Sí, siempre",
  "Yes, if the area is large": "Sí, si el área es grande",
  "Only at night": "Solo de noche",
  "Kind of change": "Tipo de cambio",
  "Satellite passes": "Pasadas del satélite",
  "Days between them": "Días entre ellas",
  "{area} km² (about {pitches} football pitches)": "{area} km² (unas {pitches} canchas de fútbol)",
  Instrument: "Instrumento",
  "radar, day and night": "radar, de día y de noche",
  "A radar satellite passed over {place} on {d1}, and again {span} days later. About {area} km² of land (roughly {pitches} football pitches) looked different the second time.":
    "Un satélite de radar pasó sobre {place} el {d1}, y otra vez {span} días después. Unos {area} km² de terreno (aproximadamente {pitches} canchas de fútbol) se vieron distintos la segunda vez.",
  "These figures come from radar images read by our team. Nobody has checked them on the ground yet: treat them as clues, not conclusions.":
    "Estas cifras salen de imágenes de radar leídas por nuestro equipo. Nadie las ha comprobado todavía en el terreno: tómalas como pistas, no como conclusiones.",
  "Describe in your own words what happened in {place}.": "Describe con tus propias palabras qué pasó en {place}.",
  "Read a before and after radar image and say what changed.": "Leer una imagen de radar de antes y después y decir qué cambió.",
  Pass: "Pasada",
  "One visit of the satellite over a place. NISAR returns every 12 days.": "Una visita del satélite sobre un lugar. NISAR vuelve cada 12 días.",
  "Echo (backscatter)": "Eco (retrodispersión)",
  "The part of the radar pulse that bounces back to the satellite. Rough or leafy ground returns more; calm water returns almost none.":
    "La parte del pulso del radar que rebota de vuelta al satélite. El suelo rugoso o con hojas devuelve más; el agua en calma casi nada.",
  "False colour": "Falso color",
  "Colours chosen to show what the radar measured. They are not what a camera would see.": "Colores elegidos para mostrar lo que midió el radar. No son lo que vería una cámara.",
  Observe: "Observa",
  "Look at the before and after images without any explanation. {look}": "Mira las imágenes de antes y después sin ninguna explicación. {look}",
  Compare: "Compara",
  "Drag the line to compare the two visits. Write down three differences and where they are.":
    "Arrastra la línea para comparar las dos visitas. Anota tres diferencias y dónde están.",
  Explain: "Explica",
  Check: "Comprueba",
  "Answer the questions and the quiz, then share one idea with the class: what would you want to know next?":
    "Responde las preguntas y el quiz, y luego comparte una idea con la clase: ¿qué te gustaría saber después?",
  "How many days passed between the two radar visits?": "¿Cuántos días pasaron entre las dos visitas del radar?",
  "Which space agencies built NISAR?": "¿Qué agencias espaciales construyeron NISAR?",
  "How does calm water look in a radar image?": "¿Cómo se ve el agua en calma en una imagen de radar?",
  "About how much land changed here?": "¿Aproximadamente cuánta tierra cambió aquí?",
  "Can the radar alone prove what caused the change?": "¿Puede el radar por sí solo probar qué causó el cambio?",
  "You are a patient science tutor for a secondary-school student. We are studying a real case seen by the NISAR radar satellite (NASA and ISRO).\n\nCase: {name} in {place}.\nKind of change: {type}.\nThe satellite looked on {d1} and again on {d2} ({span} days later).\nAbout {area} km² of land changed (roughly {pitches} football pitches).\nImportant: these figures come from radar images read by a student team; they have not been verified on the ground.\n\nWhat I should understand: {objective}\n\nHow to help me:\n1. Ask me which grade I am in, then explain with simple words and everyday examples.\n2. Ask me ONE question at a time and wait for my answer before the next one.\n3. If I am wrong, give a hint first and then explain.\n4. Use only the facts above; if something is not known, say so instead of inventing it.\n5. Finish with a 3-question quiz and tell me my score.":
    "Eres un tutor de ciencias paciente para un estudiante de secundaria. Estamos estudiando un caso real visto por el satélite radar NISAR (NASA e ISRO).\n\nCaso: {name} en {place}.\nTipo de cambio: {type}.\nEl satélite miró el {d1} y otra vez el {d2} ({span} días después).\nCambiaron unos {area} km² de terreno (aproximadamente {pitches} canchas de fútbol).\nImportante: estas cifras salen de imágenes de radar leídas por un equipo de estudiantes; no se han verificado en el terreno.\n\nLo que debo entender: {objective}\n\nCómo ayudarme:\n1. Pregúntame en qué grado estoy y luego explica con palabras sencillas y ejemplos cotidianos.\n2. Hazme UNA pregunta a la vez y espera mi respuesta antes de la siguiente.\n3. Si me equivoco, dame primero una pista y después explica.\n4. Usa solo los datos de arriba; si algo no se sabe, dilo en vez de inventarlo.\n5. Termina con un quiz de 3 preguntas y dime mi puntaje.",
};

export const classroom: Record<string, string> = { ...ui, ...topics, ...guide };
