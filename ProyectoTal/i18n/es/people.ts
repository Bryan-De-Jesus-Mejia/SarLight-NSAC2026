/** Spanish for the people-centred layer: welcome, community check, "why it happened", impact, "Why?" cards. */

const welcome: Record<string, string> = {
  "A satellite that sees in the dark": "Un satélite que ve en la oscuridad",
  "Most satellites take photos. This one listens to echoes.": "La mayoría de los satélites toman fotos. Este escucha ecos.",
  "NISAR, from NASA and India's space agency, sends its own radio waves to the ground and listens to what comes back. Clouds, smoke and night do not stop it.":
    "NISAR, de la NASA y la agencia espacial de la India, envía sus propias ondas de radio al suelo y escucha lo que regresa. Las nubes, el humo y la noche no lo detienen.",
  "Real places, real changes": "Lugares reales, cambios reales",
  "Floods, wind, drought, earthquakes, melting ice.": "Inundaciones, viento, sequía, terremotos, hielo que se derrite.",
  "Every marker on the globe is a place we analysed with real NISAR images: from Capotillo and the Cibao to Venezuela, Punjab and Greenland. Each one has a story you can follow step by step.":
    "Cada marcador del globo es un lugar que analizamos con imágenes reales de NISAR: desde Capotillo y el Cibao hasta Venezuela, Punyab y Groenlandia. Cada uno tiene una historia que puedes seguir paso a paso.",
  Skip: "Omitir",
  "Next →": "Siguiente →",
  "Where do you want to start?": "¿Por dónde quieres empezar?",
  "Pick your way in": "Elige tu camino",
  "Close to home": "Cerca de casa",
  "Fly to the Dominican Republic and its stories": "Vuela a República Dominicana y sus historias",
  "Watch the guided tour": "Mira el recorrido guiado",
  "Two minutes, hands free": "Dos minutos, sin tocar nada",
  "Explore on my own": "Explorar por mi cuenta",
  "Drag the globe and tap any marker": "Arrastra el globo y toca cualquier marcador",
  "Is my community at risk? See what our radar found around a place":
    "¿Mi comunidad está en riesgo? Mira lo que encontró nuestro radar alrededor de un lugar",
};

const community: Record<string, string> = {
  "slopes on the move": "laderas en movimiento",
  "heat and drying": "calor y sequedad",
  fire: "incendio",
  "an earthquake": "un terremoto",
  "changing fields": "campos que cambian",
  "moving ice": "hielo en movimiento",
  "Your place": "Tu lugar",
  "Is my community at risk?": "¿Mi comunidad está en riesgo?",
  "See what our radar analyses found around a place you care about.":
    "Mira lo que encontraron nuestros análisis de radar alrededor de un lugar que te importa.",
  "Finding you…": "Buscando tu ubicación…",
  "Use my location": "Usar mi ubicación",
  "Tap the globe…": "Toca el globo…",
  "Pick on the globe": "Elegir en el globo",
  "Location is not available. Pick the place on the globe instead.": "La ubicación no está disponible. Elige el lugar en el globo.",
  "Tap your community on the globe. Zoom in first for a precise spot.":
    "Toca tu comunidad en el globo. Acércate primero para un punto más preciso.",
  "Our radar found signs of {what} within {km} km of this place.": "Nuestro radar encontró señales de {what} a menos de {km} km de este lugar.",
  "Within {km} km our radar watched {what}.": "A menos de {km} km nuestro radar vigiló {what}.",
  "you are inside": "estás dentro",
  "Hear its story →": "Escucha su historia →",
  "We have not analysed this area yet.": "Todavía no hemos analizado esta zona.",
  "The closest place we watched is {name}, {km} km away.": "El lugar más cercano que vigilamos es {name}, a {km} km.",
  "What you can do": "Qué puedes hacer",
  "Emergency: <b>9-1-1</b>. Official alerts: <b>COE</b> and <b>Defensa Civil</b>.":
    "Emergencias: <b>9-1-1</b>. Alertas oficiales: <b>COE</b> y <b>Defensa Civil</b>.",
  "In an emergency, call your local emergency number and follow your civil protection's alerts.":
    "En una emergencia, llama al número de emergencias de tu localidad y sigue las alertas de protección civil.",
  "Based only on the {n} places our team analysed with NISAR radar. No signal here does not mean no risk, and nothing has been checked on the ground.":
    "Basado solo en los {n} lugares que nuestro equipo analizó con el radar NISAR. Que no haya señal aquí no significa que no haya riesgo, y nada se ha comprobado en el terreno.",
};

const drivers: Record<string, string> = {
  "Why it happened": "Por qué pasó",
  "What the radar measured": "Lo que midió el radar",
  "{rain} of rain in the week before {date}": "{rain} de lluvia en la semana previa al {date}",
  "the last pass": "la última pasada",
  ", {ratio}× a usual week of this record": ", {ratio}× una semana normal de este registro",
  ", less than a usual week": ", menos que una semana normal",
  "Heavy rain": "Lluvia fuerte",
  "Rain falls faster than the soil and drains can take it.": "La lluvia cae más rápido de lo que el suelo y los drenajes pueden absorber.",
  "Water spreads over land": "El agua se extiende sobre la tierra",
  "Rivers and gullies overflow; low streets and fields fill.": "Los ríos y las cañadas se desbordan; las calles bajas y los campos se llenan.",
  "Calm water is a mirror: the pulse bounces away, so flooded open ground turns dark. Flooded trees and crops can turn brighter instead, as the pulse bounces off the water and then the stems.":
    "El agua en calma es un espejo: el pulso rebota hacia otro lado y el terreno abierto inundado se oscurece. Los árboles y cultivos inundados pueden verse más claros, porque el pulso rebota en el agua y luego en los tallos.",
  "What people live through": "Lo que vive la gente",
  "Homes to leave, roads cut, a harvest that rots in the field.": "Casas que hay que dejar, caminos cortados, una cosecha que se pudre en el campo.",
  "Heat and dry fuel": "Calor y combustible seco",
  "Hot, dry weeks turn leaves and grass into fuel.": "Semanas secas y calurosas convierten las hojas y la hierba en combustible.",
  "Hottest day {temp} °C; {rain} of rain in the week before": "Día más caluroso: {temp} °C; {rain} de lluvia en la semana previa",
  "Hottest day {temp} °C": "Día más caluroso: {temp} °C",
  "The canopy burns": "El dosel se quema",
  "Leaves and branches go; bare trunks and soil remain.": "Se van las hojas y las ramas; quedan los troncos y el suelo al descubierto.",
  "Leaves scatter the pulse in all directions. Without them the cross-polarised echo (HV) drops.":
    "Las hojas dispersan el pulso en todas direcciones. Sin ellas, el eco de polarización cruzada (HV) baja.",
  "Smoke, lost forest that held soil and water, risk to homes and farms nearby.":
    "Humo, bosque perdido que sostenía el suelo y el agua, riesgo para las casas y fincas cercanas.",
  "Strong wind": "Viento fuerte",
  "A storm sweeps across the valley.": "Una tormenta barre el valle.",
  "Strongest gust {gust} km/h around {date}": "Ráfaga más fuerte: {gust} km/h alrededor del {date}",
  "the event": "el evento",
  "Crops and trees go down": "Cultivos y árboles caen",
  "Banana plants, maize and branches are flattened or snapped.": "Las matas de guineo, el maíz y las ramas se aplastan o se parten.",
  "Standing plants send back a strong echo. Flattened ones lose that structure, so the echo weakens where the wind hit.":
    "Las plantas en pie devuelven un eco fuerte. Las tumbadas pierden esa estructura, así que el eco se debilita donde golpeó el viento.",
  "A season of crops lost, fallen power lines, blocked roads.": "Una temporada de cultivos perdida, tendido eléctrico caído, caminos bloqueados.",
  "Heat and little rain": "Calor y poca lluvia",
  "Day after day of strong sun dries the land.": "Día tras día de sol fuerte seca la tierra.",
  "{days} days at 35 °C or more, hottest {temp} °C": "{days} días a 35 °C o más, el más caluroso {temp} °C",
  "Soil and plants dry out": "El suelo y las plantas se secan",
  "Pasture yellows, crops wilt, soil loses its water.": "El pasto se amarillea, los cultivos se marchitan, el suelo pierde su agua.",
  "Water makes things bright to radar (a high dielectric constant). Dry soil and dry plants send back a weaker echo. The radar does not measure heat: it sees what heat does.":
    "El agua hace que las cosas se vean claras para el radar (una constante dieléctrica alta). El suelo y las plantas secos devuelven un eco más débil. El radar no mide el calor: ve lo que el calor provoca.",
  "Smaller harvests, thirsty animals, less water for homes.": "Cosechas más pequeñas, animales con sed, menos agua para las casas.",
  "A fault slips": "Una falla se desliza",
  "Stress built up over years is released in seconds.": "La tensión acumulada durante años se libera en segundos.",
  "USGS: magnitude {mag} on {date}, {depth} km deep, {km} km from the centre of this area":
    "USGS: magnitud {mag} el {date}, a {depth} km de profundidad, a {km} km del centro de esta zona",
  "The ground moves": "El suelo se mueve",
  "Whole regions rise, sink or shift by centimetres.": "Regiones enteras suben, se hunden o se desplazan unos centímetros.",
  "The radar wave is about 24 cm long. Comparing its phase before and after, each colour cycle is about 12 cm of motion toward or away from the satellite.":
    "La onda del radar mide unos 24 cm. Al comparar su fase antes y después, cada ciclo de color son unos 12 cm de movimiento hacia el satélite o alejándose de él.",
  "Cracked buildings and roads; the map shows engineers and rescuers where the ground moved most.":
    "Edificios y caminos agrietados; el mapa muestra a ingenieros y rescatistas dónde se movió más el suelo.",
  "A soaked slope": "Una ladera empapada",
  "Rain fills the soil until the slope can no longer hold.": "La lluvia llena el suelo hasta que la ladera ya no aguanta.",
  "USGS: magnitude {mag} earthquake nearby on {date}": "USGS: terremoto de magnitud {mag} cerca, el {date}",
  "The slope gives way": "La ladera cede",
  "Soil and rock slide down, burying what lies below.": "El suelo y las rocas se deslizan, enterrando lo que hay abajo.",
  "Fresh scars and debris change how rough the surface is, so the echo shifts where the ground moved.":
    "Las cicatrices recientes y los escombros cambian la rugosidad de la superficie, así que el eco cambia donde se movió el suelo.",
  "Roads cut off, homes on the slope at risk.": "Caminos cortados, casas en la ladera en riesgo.",
  "Warmer ocean and air": "Océano y aire más cálidos",
  "Warm water reaches the front of the ice and melts it from below.": "El agua cálida llega al frente del hielo y lo derrite desde abajo.",
  "The ice speeds up": "El hielo se acelera",
  "With less to hold it back, the glacier flows and breaks off faster.": "Con menos que lo sujete, el glaciar fluye y se desprende más rápido.",
  "By tracking the same patch of ice in two passes, the radar measures how many metres it moved per day, even in polar night.":
    "Siguiendo el mismo trozo de hielo en dos pasadas, el radar mide cuántos metros se movió por día, incluso en la noche polar.",
  "What it means for everyone": "Qué significa para todos",
  "Ice that reaches the sea raises sea level, for every coast, the Caribbean included.":
    "El hielo que llega al mar sube el nivel del mar en todas las costas, incluido el Caribe.",
  "Farmers burn the stubble": "Los agricultores queman el rastrojo",
  "After harvest, leftover straw is burned to clear the field fast.": "Después de la cosecha, se quema la paja que sobra para limpiar el campo rápido.",
  "Forest is cleared": "Se despeja el bosque",
  "Trees are cut and burned to make room for pasture or crops.": "Se cortan y queman árboles para dar paso a pastos o cultivos.",
  "Paddies are flooded": "Se inundan los arrozales",
  "Rice is grown in standing water: farmers flood the fields on purpose.": "El arroz se cultiva en agua estancada: los agricultores inundan los campos a propósito.",
  "Harvest time": "Hora de cosechar",
  "The crop calendar decides when fields are cut.": "El calendario de cultivo decide cuándo se cortan los campos.",
  "The fields change": "Los campos cambian",
  "Green fields turn to sheets of water, then back to green.": "Los campos verdes se vuelven láminas de agua y luego vuelven a ser verdes.",
  "Tall plants are replaced by bare soil or stubble.": "Las plantas altas son reemplazadas por suelo desnudo o rastrojo.",
  "Open water turns dark; young rice standing in water can turn bright.": "El agua abierta se oscurece; el arroz joven en el agua puede verse claro.",
  "Tall crops scatter the pulse; bare fields send back much less, so the echo drops.":
    "Los cultivos altos dispersan el pulso; los campos desnudos devuelven mucho menos, así que el eco baja.",
  "Forest lost for good, with its water, wildlife and carbon.": "Un bosque perdido para siempre, con su agua, su fauna y su carbono.",
  "Smoke that chokes cities hundreds of kilometres away.": "Humo que ahoga ciudades a cientos de kilómetros.",
  "Food on the table, and income for the families who grow it.": "Comida en la mesa e ingresos para las familias que la cultivan.",
  "{what} from {from} to {to}": "{what} del {from} al {to}",
  "Daily rain": "Lluvia diaria",
  "Daily maximum temperature": "Temperatura máxima diaria",
  "Daily maximum wind gust": "Ráfaga máxima de viento diaria",
  "Weather: ERA5 reanalysis via Open-Meteo, at the centre of the area (a grid of about 25 km). Earthquakes: USGS catalogue. These records make the cause likely; they do not prove it for each pixel.":
    "Clima: reanálisis ERA5 vía Open-Meteo, en el centro del área (una cuadrícula de unos 25 km). Terremotos: catálogo del USGS. Estos registros hacen probable la causa; no la prueban para cada píxel.",
};

const impact: Record<string, string> = {
  "fewer than 100": "menos de 100",
  "about {n}": "unas {n}",
  "live on land where water appeared": "viven en tierra donde apareció agua",
  "live on land where crops and trees lost their echo after the wind": "viven en tierra donde los cultivos y árboles perdieron su eco tras el viento",
  "live on land that dried out": "viven en tierra que se secó",
  "live on slopes whose surface changed": "viven en laderas cuya superficie cambió",
  "live in or right next to the burned land": "viven dentro o junto a la tierra quemada",
  "live among the fields that went under water": "viven entre los campos que quedaron bajo el agua",
  Alert: "Alerta",
  Watch: "Vigilancia",
  Seasonal: "Estacional",
  "Possible crop loss": "Posible pérdida de cultivos",
  "{area} of crops and trees lost their echo after the wind of {event}, the most by {peak}. Flattened plants send back less. Expect a smaller harvest there.":
    "{area} de cultivos y árboles perdieron su eco tras el viento del {event}, el máximo para el {peak}. Las plantas tumbadas devuelven menos. Se espera una cosecha menor allí.",
  "Fields drying": "Campos que se secan",
  "{area} of land lost echo during the heat, the most by {peak}. Dry soil and wilting crops send back less. Watch for a weaker harvest and thirsty livestock.":
    "{area} de tierra perdieron eco durante el calor, el máximo para el {peak}. El suelo seco y los cultivos marchitos devuelven menos. Hay que vigilar una cosecha más débil y ganado con sed.",
  "Fields under water": "Campos bajo el agua",
  "At the peak, on {date}, {total} were under water, {veg} of it with plants standing in it. Rice wants some water; weeks of deep water can drown it.":
    "En el punto máximo, el {date}, {total} estaban bajo el agua, {veg} de ellos con plantas dentro. El arroz necesita algo de agua; semanas de agua profunda pueden ahogarlo.",
  "Harvest under way": "Cosecha en marcha",
  "{pct}% of the crops the satellite watched ({area}) were cut by {last}; the busiest stretch ended on {peak}. This is the season's normal rhythm, not a loss.":
    "El {pct}% de los cultivos que vigiló el satélite ({area}) se había cortado para el {last}; el tramo más activo terminó el {peak}. Es el ritmo normal de la temporada, no una pérdida.",
  "Fields cleared, likely by fire": "Campos despejados, probablemente por fuego",
  "Forest or plantation cleared": "Bosque o plantación despejados",
  "{area} of fields lost their cover after the harvest. Burning the stubble is fast, but it fills the air with smoke and takes nutrients from the soil.":
    "{area} de campos perdieron su cobertura tras la cosecha. Quemar el rastrojo es rápido, pero llena el aire de humo y le quita nutrientes al suelo.",
  "{area} lost their tall cover. Land cleared of trees holds less water and soil, and stores less carbon.":
    "{area} perdieron su cobertura alta. La tierra sin árboles retiene menos agua y suelo, y almacena menos carbono.",
  "Know your way to higher ground before the rain; keep papers and medicine in a sealed bag.":
    "Conoce el camino a un terreno más alto antes de la lluvia; guarda los documentos y las medicinas en una bolsa sellada.",
  "Never walk or drive through moving water: 30 cm can carry a car away.": "Nunca camines ni manejes por agua en movimiento: 30 cm pueden arrastrar un carro.",
  "After the flood, boil or treat drinking water and avoid wading barefoot: floodwater spreads disease.":
    "Después de la inundación, hierve o trata el agua de beber y evita caminar descalzo en el agua: el agua de la inundación propaga enfermedades.",
  "Tie down roofs and loose objects before a storm is forecast.": "Asegura los techos y los objetos sueltos antes de que se pronostique una tormenta.",
  "Keep away from fallen power lines and damaged trees.": "Aléjate de los cables eléctricos caídos y de los árboles dañados.",
  "Photograph damaged fields with the date: it helps when asking for aid or insurance.":
    "Fotografía los campos dañados con la fecha: ayuda al pedir ayuda o reclamar un seguro.",
  "Store water covered: open containers breed the mosquitoes that carry dengue.":
    "Guarda el agua tapada: los recipientes abiertos crían los mosquitos que transmiten el dengue.",
  "Work outdoors early or late and drink often; confusion and hot dry skin are signs of heat stroke.":
    "Trabaja al aire libre temprano o tarde y bebe a menudo; la confusión y la piel caliente y seca son señales de golpe de calor.",
  "Do not burn fields or rubbish in dry, windy weather.": "No quemes campos ni basura con tiempo seco y ventoso.",
  "Watch for new cracks in walls or ground, tilting poles and trees, or springs turning muddy.":
    "Fíjate en grietas nuevas en paredes o en el suelo, postes y árboles que se inclinan, o manantiales que se enturbian.",
  "Leave steep slopes and the foot of ravines during long, heavy rain.": "Deja las laderas empinadas y el pie de las cañadas durante lluvias largas y fuertes.",
  "Avoid building on cut slopes or close to a ravine edge.": "Evita construir en taludes cortados o cerca del borde de una cañada.",
  "Never burn fields or rubbish on dry, windy days.": "Nunca quemes campos ni basura en días secos y ventosos.",
  "Keep a strip around the house clear of dry grass and branches.": "Mantén una franja alrededor de la casa libre de hierba seca y ramas.",
  "Report smoke early: a small fire is easy to stop.": "Avisa del humo temprano: un fuego pequeño es fácil de detener.",
  "During the shaking: drop, cover under a sturdy table, and hold on.": "Durante el temblor: agáchate, cúbrete bajo una mesa firme y agárrate.",
  "Agree on a meeting point with your family before it happens.": "Acuerda con tu familia un punto de encuentro antes de que pase.",
  "Afterwards, expect aftershocks, check for gas leaks and stay out of cracked buildings.":
    "Después, espera réplicas, revisa si hay fugas de gas y no entres en edificios agrietados.",
  "Share these maps with your cooperative or extension office to plan the next season.":
    "Comparte estos mapas con tu cooperativa o con la oficina de extensión agrícola para planificar la próxima temporada.",
  "Keep a simple calendar of planting, harvest and losses for each field.": "Lleva un calendario sencillo de siembra, cosecha y pérdidas de cada campo.",
  "{count} people {verb}, out of {total} in the whole area we watched.": "{count} personas {verb}, de {total} en toda la zona que vigilamos.",
  "{count} people live in the area the radar watched move.": "{count} personas viven en la zona donde el radar vio moverse el suelo.",
  "{count} people live in the area we watched.": "{count} personas viven en la zona que vigilamos.",
  "Who lives there": "Quién vive allí",
  "Estimate from the GHSL population grid (1 km squares, 2025), not a census.":
    "Estimación de la cuadrícula de población GHSL (cuadrados de 1 km, 2025), no un censo.",
  "For those who farm": "Para quienes cultivan",
  "Emergency: <b>9-1-1</b>. Follow the alerts of the <b>COE</b> and <b>Defensa Civil</b>.":
    "Emergencias: <b>9-1-1</b>. Sigue las alertas del <b>COE</b> y de <b>Defensa Civil</b>.",
  "For people": "Para las personas",
};

const storyMore: Record<string, string> = {
  "From the sky to the ground": "Del cielo al suelo",
  "Why it matters": "Por qué importa",
  "What this means for people": "Qué significa para las personas",
  "Behind every square kilometre of water there are streets, homes and fields. Knowing where the water went, even through storm clouds, is how help reaches the right door.":
    "Detrás de cada kilómetro cuadrado de agua hay calles, casas y campos. Saber adónde fue el agua, incluso a través de nubes de tormenta, es lo que hace que la ayuda llegue a la puerta correcta.",
  "A flattened banana field is a family's income for the year. Mapping where the wind hit, field by field, tells farmers and insurers where to look first.":
    "Un platanal tumbado es el ingreso de una familia durante todo el año. Mapear dónde pegó el viento, campo por campo, le dice a agricultores y aseguradoras dónde mirar primero.",
  "Dry land means smaller harvests and thirsty animals. Seeing drought spread week by week gives farmers and water managers time to act.":
    "Tierra seca significa cosechas más pequeñas y animales con sed. Ver cómo avanza la sequía semana a semana les da tiempo de actuar a agricultores y a quienes manejan el agua.",
  "A slope that moves can bury a road or a home. Watching the slopes after heavy rain helps decide where people should not stay.":
    "Una ladera que se mueve puede enterrar un camino o una casa. Vigilar las laderas tras una lluvia fuerte ayuda a decidir dónde no debe quedarse la gente.",
  "Seeing exactly where the ground moved, and by how much, guides rescuers and engineers to the places that need them most.":
    "Ver exactamente dónde se movió el suelo, y cuánto, guía a rescatistas e ingenieros a los lugares que más los necesitan.",
  "Ice that slides into the sea raises the ocean everywhere, including the Caribbean coast. Watching glaciers is watching our own shorelines.":
    "El hielo que se desliza al mar sube el océano en todas partes, incluida la costa del Caribe. Vigilar los glaciares es vigilar nuestras propias costas.",
  "Fields are food. Seeing when and where they change helps forecast harvests, and spot burning and clearing that harm air and forest.":
    "Los campos son comida. Ver cuándo y dónde cambian ayuda a pronosticar cosechas y a detectar quemas y desmontes que dañan el aire y el bosque.",
  "We followed these fields pass after pass, to see when they changed.": "Seguimos estos campos pasada tras pasada, para ver cuándo cambiaron.",
  "We tracked the ice, pass after pass, to measure how fast it slides to the sea.":
    "Seguimos el hielo, pasada tras pasada, para medir qué tan rápido se desliza hacia el mar.",
  "We compared radar passes from before and after the shaking, to see how far the ground moved.":
    "Comparamos pasadas de radar de antes y después del temblor, para ver cuánto se movió el suelo.",
  "We let the satellite learn what normal looks like here, then compared it with the passes after the event.":
    "Dejamos que el satélite aprendiera cómo es lo normal aquí y luego lo comparamos con las pasadas posteriores al evento.",
  "We followed this area pass after pass, to see when water came and how far it spread.":
    "Seguimos esta zona pasada tras pasada, para ver cuándo llegó el agua y hasta dónde se extendió.",
  "What the radar saw": "Lo que vio el radar",
  "{n} visits, one place": "{n} visitas, un solo lugar",
  "Every 12 days NISAR came back. In false colour, standing plants look green, bare or dry ground looks purple and calm water looks black. Compare the first visit with the last.":
    "Cada 12 días NISAR volvió. En falso color, las plantas en pie se ven verdes, el suelo desnudo o seco se ve morado y el agua en calma se ve negra. Compara la primera visita con la última.",
  "lost their echo by {date}": "perdieron su eco para el {date}",
  "under water at the peak, {date}": "bajo el agua en el máximo, {date}",
  "of fields changed ({pct}% of the vegetation)": "de campos cambiaron ({pct}% de la vegetación)",
  "The change": "El cambio",
  "Where the ground changed": "Dónde cambió el terreno",
  "Where the water went": "Adónde fue el agua",
  "When each field changed": "Cuándo cambió cada campo",
  "Each coloured patch is a piece of land whose radar echo changed enough to count, compared with the visits before.":
    "Cada mancha de color es un pedazo de tierra cuyo eco de radar cambió lo suficiente como para contar, comparado con las visitas anteriores.",
  "Map from our analysis": "Mapa de nuestro análisis",
  "Rainbow rings": "Anillos de arcoíris",
  "Each ring is 12 centimetres": "Cada anillo son 12 centímetros",
  "The radar wave is about {wave} cm long. Comparing it before and after the earthquake draws rings of colour: every full cycle means the ground moved about {fringe} cm closer to or further from the satellite.":
    "La onda del radar mide unos {wave} cm. Compararla antes y después del terremoto dibuja anillos de color: cada ciclo completo significa que el suelo se movió unos {fringe} cm hacia el satélite o alejándose de él.",
  "How far it moved": "Cuánto se movió",
  "The ground rose and sank": "El suelo subió y bajó",
  "toward the satellite at most · {area} km² moved more than 5 cm": "hacia el satélite, como máximo · {area} km² se movieron más de 5 cm",
  "Red moved toward the satellite, blue away from it. Blank areas could not be measured, often because they are water or dense forest.":
    "El rojo se movió hacia el satélite y el azul se alejó de él. Las zonas en blanco no se pudieron medir, a menudo porque son agua o bosque denso.",
  "Ground movement from our analysis": "Movimiento del suelo según nuestro análisis",
  "A river of ice": "Un río de hielo",
  "How fast the ice slides": "Qué tan rápido se desliza el hielo",
  "fastest measured · typical {speed} m/day": "lo más rápido medido · típico {speed} m/día",
  "The radar recognises the same cracks and textures on the ice in two visits and measures how far they travelled, even in the months of polar night.":
    "El radar reconoce las mismas grietas y texturas del hielo en dos visitas y mide cuánto se desplazaron, incluso en los meses de noche polar.",
  "Ice speed from our analysis": "Velocidad del hielo según nuestro análisis",
  "This is a reading of real radar images. Nobody has checked it on the ground yet.":
    "Esta es una lectura de imágenes reales de radar. Nadie la ha comprobado todavía en el terreno.",
};

const changeEvents: Record<string, string> = {
  "the windstorm": "la tormenta de viento",
  "standing crops and trees that lost their echo, as if knocked down": "cultivos y árboles en pie que perdieron su eco, como si los hubieran tumbado",
  "the start of the heat wave": "el inicio de la ola de calor",
  "land whose echo weakened, as soil and plants dried": "tierra cuyo eco se debilitó, al secarse el suelo y las plantas",
  "the date of the landslide reports": "la fecha de los reportes del deslizamiento",
  "slopes whose echo changed, where ground may have moved": "laderas cuyo eco cambió, donde el suelo puede haberse movido",
  "Before {event_date}, {event}, the satellite passed {n} times to learn what normal looks like here. On {peak_date}, {drop} km² were {weaker}. {rise} km² became brighter, which can be regrowth, wetter soil or debris.":
    "Antes del {event_date}, {event}, el satélite pasó {n} veces para aprender cómo es lo normal aquí. El {peak_date}, {drop} km² eran {weaker}. {rise} km² se volvieron más claros, lo que puede ser rebrote, suelo más húmedo o escombros.",
  "Weaker echo": "Eco más débil",
  "on {date}": "el {date}",
  "Stronger echo": "Eco más fuerte",
  "First look after": "Primera mirada después",
  "{area} km² weaker": "{area} km² más débil",
  Event: "Evento",
  "{n} passes before it": "{n} pasadas antes",
  "Map of the change": "Mapa del cambio",
  "Map of where the radar echo changed after the event": "Mapa de dónde cambió el eco del radar tras el evento",
  "Where the echo got weaker or stronger after the event, compared with the passes before it.":
    "Dónde el eco se debilitó o se reforzó tras el evento, comparado con las pasadas anteriores.",
  "False colour: red and blue carry the co-polarised echo, green the cross-polarised one. Standing vegetation tends to look green.":
    "Falso color: el rojo y el azul llevan el eco co-polarizado y el verde el de polarización cruzada. La vegetación en pie tiende a verse verde.",
  "Empty rings are the passes before the event, which set what is normal.":
    "Los anillos vacíos son las pasadas previas al evento, que fijan lo que es normal.",
  "The date of the event was set by our team from public reports. The radar sees the echo change; linking it to {event} is our reading.":
    "La fecha del evento la fijó nuestro equipo a partir de reportes públicos. El radar ve que el eco cambia; vincularlo con {event} es nuestra lectura.",
};

const whyCards: Record<string, string> = {
  "cloud droplet: 0.01 mm": "gota de nube: 0.01 mm",
  "radar wave: 24 cm": "onda de radar: 24 cm",
  "bounces away:": "rebota hacia otro lado:",
  "no echo, dark pixel": "sin eco, píxel oscuro",
  "scatters everywhere:": "se dispersa en todas direcciones:",
  "part comes back, bright": "una parte regresa, claro",
  "same spot, same angle,": "mismo punto, mismo ángulo,",
  "every 12 days": "cada 12 días",
  "0 dB": "0 dB",
  "−3 dB": "−3 dB",
  "−6 dB": "−6 dB",
  "half, a quarter": "la mitad, un cuarto",
  "one full colour cycle": "un ciclo completo de color",
  "= about 12 cm of motion": "= unos 12 cm de movimiento",
  "only motion along this line": "solo el movimiento a lo largo de esta línea",
  "(toward or away from it)": "(hacia él o alejándose)",
  "same crack, 12 days later:": "la misma grieta, 12 días después:",
  "distance ÷ days = speed": "distancia ÷ días = velocidad",
  "people per 1 km square,": "personas por cuadrado de 1 km,",
  "counted where it changed": "contadas donde cambió",
  "record + radar + place = most likely story": "registro + radar + lugar = la historia más probable",
  "slow, repeating: seasons": "lento y repetido: estaciones",
  "sudden jump: an event": "salto repentino: un evento",
  "How can a satellite see through clouds?": "¿Cómo puede un satélite ver a través de las nubes?",
  "NISAR's L-band radar uses waves about 24 cm long. Cloud droplets are thousands of times smaller, so the wave passes them as if they were not there. It also brings its own signal, so it works at night.":
    "El radar de banda L de NISAR usa ondas de unos 24 cm. Las gotas de las nubes son miles de veces más pequeñas, así que la onda pasa como si no estuvieran. Además lleva su propia señal, por eso funciona de noche.",
  "Why every 12 days?": "¿Por qué cada 12 días?",
  "NISAR repeats the same path over the planet every 12 days, at the same angle. Comparing two identical visits means any difference comes from the ground, not from the way the picture was taken.":
    "NISAR repite el mismo camino sobre el planeta cada 12 días, con el mismo ángulo. Al comparar dos visitas idénticas, cualquier diferencia viene del terreno y no de la forma en que se tomó la imagen.",
  "Why does water look black?": "¿Por qué el agua se ve negra?",
  "Calm water is a mirror. The radar pulse hits it at an angle and bounces away, like a ball off a smooth floor, so almost nothing comes back to the satellite. Little echo means a dark pixel.":
    "El agua en calma es un espejo. El pulso del radar la golpea en ángulo y rebota hacia otro lado, como una pelota en un piso liso, así que casi nada regresa al satélite. Poco eco significa un píxel oscuro.",
  "Why do plants shine on radar?": "¿Por qué las plantas brillan en el radar?",
  "Leaves, stems and branches scatter the pulse in every direction and some of it comes back. When a fire, a harvest or the wind removes them, the echo weakens and the pixel gets darker.":
    "Las hojas, los tallos y las ramas dispersan el pulso en todas direcciones y una parte regresa. Cuando un incendio, una cosecha o el viento las quitan, el eco se debilita y el píxel se oscurece.",
  "What is a decibel (dB)?": "¿Qué es un decibelio (dB)?",
  "A way of counting echo strength by multiplying, not adding. Every 3 dB less means half the echo. A drop of 6 dB means only a quarter of the echo came back.":
    "Una forma de contar la fuerza del eco multiplicando, no sumando. Cada 3 dB menos significa la mitad del eco. Una caída de 6 dB significa que solo regresó una cuarta parte del eco.",
  "Why watch for months, not just one day?": "¿Por qué vigilar durante meses y no solo un día?",
  "Fields grow and dry every season, so a single difference can fool you. Watching every pass shows the slow normal rhythm, and a sudden jump against it is what points to an event.":
    "Los campos crecen y se secan cada temporada, así que una sola diferencia puede engañarte. Ver cada pasada muestra el ritmo lento y normal, y un salto repentino contra él es lo que apunta a un evento.",
  "What are the coloured rings?": "¿Qué son los anillos de colores?",
  "The radar also measures the exact timing of the wave. If the ground moved between two visits, the timing shifts. Every full cycle of colours means about 12 cm of movement, half the 24 cm wave.":
    "El radar también mide el momento exacto de la onda. Si el suelo se movió entre dos visitas, ese momento cambia. Cada ciclo completo de colores significa unos 12 cm de movimiento, la mitad de la onda de 24 cm.",
  "Why only one direction?": "¿Por qué solo una dirección?",
  "The radar looks sideways at the ground and measures motion only along its line of sight: toward it or away from it. Two passes from different sides help rebuild the real motion.":
    "El radar mira el suelo de lado y mide el movimiento solo a lo largo de su línea de visión: hacia él o alejándose. Dos pasadas desde lados distintos ayudan a reconstruir el movimiento real.",
  "How do you measure ice speed from space?": "¿Cómo se mide la velocidad del hielo desde el espacio?",
  "The radar finds the same cracks and textures in two images 12 days apart and measures how far they travelled. Distance divided by time gives the speed, even in the dark polar winter.":
    "El radar encuentra las mismas grietas y texturas en dos imágenes separadas por 12 días y mide cuánto se desplazaron. La distancia dividida entre el tiempo da la velocidad, incluso en el oscuro invierno polar.",
  "Does the weather prove the cause?": "¿El clima prueba la causa?",
  "No, it supports it. Rain, heat or an earthquake recorded at the right time, plus a change the radar saw in the right place, make the most likely story. Only a visit on the ground can confirm it.":
    "No, la respalda. La lluvia, el calor o un terremoto registrados en el momento justo, más un cambio que el radar vio en el lugar correcto, forman la historia más probable. Solo una visita al terreno puede confirmarla.",
  "How do we count the people?": "¿Cómo contamos a las personas?",
  "A European population map splits the planet into 1 km squares with an estimate of how many people live in each. We add up the squares where our radar flagged change, so it is an estimate, not a census.":
    "Un mapa europeo de población divide el planeta en cuadrados de 1 km con una estimación de cuántas personas viven en cada uno. Sumamos los cuadrados donde nuestro radar marcó cambios, así que es una estimación, no un censo.",
};

export const people: Record<string, string> = {
  ...welcome,
  ...community,
  ...drivers,
  ...impact,
  ...storyMore,
  ...changeEvents,
  ...whyCards,
};
