/** Spanish for the Methods page. */
export const methods: Record<string, string> = {
  Site: "Sitio",
  "Back to the globe": "Volver al globo",
  Methods: "Métodos",
  "How radar sees the Earth": "Cómo ve el radar a la Tierra",
  move: "moverse",
  "What the satellite measures, how two radar passes become a change map, and what the numbers can and cannot tell you.":
    "Qué mide el satélite, cómo dos pasadas de radar se convierten en un mapa de cambios y qué pueden y qué no pueden decirte los números.",
  "Every figure in the explorer is computed from real radar scenes.":
    "Cada cifra del explorador se calcula a partir de escenas reales de radar.",
  "It is a first-pass analysis: nothing has been verified on the ground yet, and the limits are listed below.":
    "Es un análisis preliminar: nada se ha verificado todavía en el terreno, y los límites se enumeran más abajo.",

  "01 · The instrument": "01 · El instrumento",
  "Radar that makes its own light": "Un radar que fabrica su propia luz",
  "A camera needs sunlight and a clear sky. A Synthetic Aperture Radar (SAR) sends its own microwave pulses and records the echo, so it works at night and straight through cloud, smoke and rain. By combining echoes collected along its orbit, it synthesises an antenna kilometres long and resolves details a few metres across from hundreds of kilometres up.":
    "Una cámara necesita luz del sol y un cielo despejado. Un radar de apertura sintética (SAR) envía sus propios pulsos de microondas y registra el eco, así que funciona de noche y a través de nubes, humo y lluvia. Al combinar los ecos recogidos a lo largo de su órbita, sintetiza una antena de kilómetros de largo y distingue detalles de pocos metros desde cientos de kilómetros de altura.",
  "NISAR, a joint mission of NASA and the Indian Space Research Organisation (ISRO) launched in July 2025, carries two radars: NASA’s L-band (wavelength about 24 cm) and ISRO’s S-band (about 9 cm). The long L-band waves pass through leaves and reach trunks, soil and ice, which is what makes it good at forests, wetlands and ground motion. It images nearly all of Earth’s land and ice and returns to the same ground track every 12 days — which is why the charts in this app have one point per pass.":
    "NISAR, una misión conjunta de la NASA y la Organización de Investigación Espacial de la India (ISRO) lanzada en julio de 2025, lleva dos radares: la banda L de la NASA (longitud de onda de unos 24 cm) y la banda S de la ISRO (unos 9 cm). Las ondas largas de la banda L atraviesan las hojas y llegan a los troncos, el suelo y el hielo, y por eso sirve para bosques, humedales y movimientos del terreno. Fotografía casi toda la tierra y el hielo del planeta y vuelve a la misma trayectoria cada 12 días, por eso las gráficas de esta aplicación tienen un punto por pasada.",

  "02 · Four ways to read an echo": "02 · Cuatro maneras de leer un eco",
  "The techniques behind the signals": "Las técnicas detrás de las señales",
  "Used here for: {uses}": "Se usa aquí para: {uses}",
  "Backscatter intensity": "Intensidad de retrodispersión",
  "How much of the pulse comes back": "Cuánto del pulso regresa",
  "Rough or leafy surfaces scatter a lot of energy back to the satellite and look bright; smooth ones such as calm water send it away and look dark. Tracking brightness over time reveals flooding, burn scars, harvests and clearing.":
    "Las superficies rugosas o con hojas devuelven mucha energía al satélite y se ven claras; las lisas, como el agua en calma, la desvían y se ven oscuras. Seguir el brillo a lo largo del tiempo revela inundaciones, cicatrices de quema, cosechas y desmontes.",
  "Wildfire, agriculture, glacier fronts": "Incendios, agricultura, frentes de glaciares",
  Polarimetry: "Polarimetría",
  "How the pulse's orientation changes": "Cómo cambia la orientación del pulso",
  "NISAR sends horizontally polarised pulses and listens in both horizontal (HH) and vertical (HV). Bare ground mostly keeps the orientation; vegetation rotates it; flooded stems create a strong double bounce in HH. The mix tells surface types apart.":
    "NISAR envía pulsos polarizados horizontalmente y escucha tanto en horizontal (HH) como en vertical (HV). El suelo desnudo casi siempre conserva la orientación; la vegetación la gira; los tallos inundados crean un fuerte doble rebote en HH. La mezcla permite distinguir los tipos de superficie.",
  "Wetlands, flooded vegetation, crops": "Humedales, vegetación inundada, cultivos",
  "Interferometry (InSAR)": "Interferometría (InSAR)",
  "Change in distance, from wave phase": "Cambio de distancia, a partir de la fase de la onda",
  "Comparing the phase of the returning wave between two passes shows whether the ground moved toward or away from the satellite. One full colour cycle (a fringe) is half a wavelength of motion: about 12 cm at L-band. Stacking many pairs reaches millimetres per year.":
    "Comparar la fase de la onda que regresa entre dos pasadas muestra si el suelo se movió hacia el satélite o se alejó de él. Un ciclo completo de color (una franja) es media longitud de onda de movimiento: unos 12 cm en banda L. Al apilar muchos pares se llega a milímetros por año.",
  "Earthquakes, subsidence, uplift": "Terremotos, hundimientos, elevaciones",
  "Coherence change": "Cambio de coherencia",
  "How much the surface was disturbed": "Cuánto se alteró la superficie",
  "If the ground is untouched between passes, the two radar images stay correlated (coherent). Collapsed buildings, landslides, fresh lava or ploughed fields scramble the signal, so a sudden loss of coherence maps where something was disturbed.":
    "Si el suelo no se toca entre pasadas, las dos imágenes de radar siguen correlacionadas (coherentes). Edificios derrumbados, deslizamientos, lava reciente o campos arados desordenan la señal, así que una pérdida repentina de coherencia señala dónde se alteró algo.",
  "Damage mapping, landslides, land clearing": "Mapas de daños, deslizamientos, desmontes",

  "03 · What we track": "03 · Lo que seguimos",
  "What the analyses look for": "Qué buscan los análisis",
  "Today the analyses cover fire and flood searches in the Dominican Republic; the other types are what the explorer is built to grow into. Each type has its own colour and its own glyph, so the map never relies on colour alone.":
    "Hoy los análisis cubren búsquedas de incendios e inundaciones en República Dominicana; los demás tipos son hacia donde está pensado crecer el explorador. Cada tipo tiene su propio color y su propio símbolo, así que el mapa nunca depende solo del color.",

  "04 · From two images to a number": "04 · De dos imágenes a un número",
  "How a change is measured": "Cómo se mide un cambio",
  "Pick two passes": "Elegir dos pasadas",
  "Two scenes from the same satellite track and polarisation, so both look at the ground from the same angle.":
    "Dos escenas de la misma trayectoria y polarización del satélite, para que ambas miren el suelo desde el mismo ángulo.",
  "Convert to decibels": "Convertir a decibelios",
  "Backscatter power becomes 10·log10(power). Differences then read as ratios: −3 dB is about half the echo.":
    "La potencia retrodispersada pasa a 10·log10(potencia). Así las diferencias se leen como razones: −3 dB es aproximadamente la mitad del eco.",
  "Align and subtract": "Alinear y restar",
  "The second scene is resampled onto the pixel grid of the first and subtracted: after − before.":
    "La segunda escena se remuestrea sobre la cuadrícula de píxeles de la primera y se resta: después − antes.",
  "Calm the speckle": "Calmar el moteado",
  "Radar images are naturally grainy. A median filter (5×5 pixels) smooths the difference without blurring edges.":
    "Las imágenes de radar son granuladas por naturaleza. Un filtro de mediana (5×5 píxeles) suaviza la diferencia sin desdibujar los bordes.",
  "Apply a threshold": "Aplicar un umbral",
  "A pixel is flagged when it changed by at least 3 dB. Fire analyses look for weaker echoes only; flood analyses look in both directions.":
    "Un píxel se marca cuando cambió al menos 3 dB. Los análisis de incendios buscan solo ecos más débiles; los de inundaciones miran en ambos sentidos.",
  "Count the area": "Contar el área",
  "Flagged pixels become square kilometres using the pixel size: 10 m for NISAR, 30 m for Sentinel-1.":
    "Los píxeles marcados se convierten en kilómetros cuadrados según el tamaño del píxel: 10 m para NISAR, 30 m para Sentinel-1.",
  "Compare with the rest": "Comparar con el resto",
  "For every pass of the track we take the median echo of the flagged land and of all the other land. If only the flagged land moves, the change is local.":
    "Para cada pasada de la trayectoria tomamos el eco mediano de la tierra marcada y de todo el resto. Si solo se mueve la tierra marcada, el cambio es local.",
  "Check the other channel": "Revisar el otro canal",
  "The same two passes are compared again with the other polarisation, over the same land and with the same threshold.":
    "Las mismas dos pasadas se comparan de nuevo con la otra polarización, sobre la misma tierra y con el mismo umbral.",
  "Measure normal variation": "Medir la variación normal",
  "Where a track has at least 7 passes, the differences between consecutive passes give each pixel its own typical variation; we report how much of the flagged land moved more than 3 times that.":
    "Donde una trayectoria tiene al menos 7 pasadas, las diferencias entre pasadas consecutivas le dan a cada píxel su propia variación típica; informamos cuánto de la tierra marcada se movió más de 3 veces eso.",
  "Set the sea aside": "Apartar el mar",
  "Pixels that were already open water in the before image (darker than −17 dB in HH/VV, −22 dB in HV/VH) are reported separately: wind and waves change their echo, so they are not counted as land change.":
    "Los píxeles que ya eran agua abierta en la imagen anterior (más oscuros que −17 dB en HH/VV, −22 dB en HV/VH) se informan por separado: el viento y las olas cambian su eco, así que no se cuentan como cambio de la tierra.",
  "flagged where": "marcado donde",
  "The analyses behind the explorer": "Los análisis detrás del explorador",
  Area: "Área",
  "Land changed": "Tierra que cambió",
  "On sea": "En el mar",
  "These rows come straight from the analysis files; the case panel shows the same figures with the images behind them.":
    "Estas filas vienen directamente de los archivos de análisis; el panel del caso muestra las mismas cifras con las imágenes detrás.",

  "05 · How sure are we": "05 · Qué tan seguros estamos",
  "What these numbers cannot tell you": "Lo que estos números no pueden decirte",
  "No ground truth": "Sin verdad de terreno",
  "Nothing here has been checked against field reports, fire detections or flood maps. A flagged area is a lead, not a finding.":
    "Nada aquí se ha contrastado con reportes de campo, detecciones de incendios o mapas de inundación. Un área marcada es una pista, no un hallazgo.",
  "Only two passes": "Solo dos pasadas",
  "With one before and one after there is no baseline: we cannot say whether the change is unusual for that place. The chart of every pass shows how much the whole area normally moves.":
    "Con una pasada anterior y una posterior no hay línea base: no podemos decir si el cambio es inusual para ese lugar. La gráfica de todas las pasadas muestra cuánto se mueve normalmente toda el área.",
  "Radar is not a camera": "El radar no es una cámara",
  "A weaker echo can come from burned or cleared vegetation, but also from drier or smoother ground. A stronger one can come from wetter soil or growing crops.":
    "Un eco más débil puede venir de vegetación quemada o despejada, pero también de un suelo más seco o más liso. Uno más fuerte puede venir de suelo más húmedo o de cultivos que crecen.",
  "The threshold is a choice": "El umbral es una elección",
  "3 dB is a convention that balances false alarms against missed changes. A different value would flag a different area.":
    "3 dB es una convención que equilibra las falsas alarmas frente a los cambios no detectados. Otro valor marcaría un área distinta.",
  "Data releases differ": "Las versiones de los datos difieren",
  "ASF labels NISAR L-band products beta, provisional or validated. Provisional covers acquisitions from 17 June to 20 October 2026 and validated starts on 21 October, so a comparison across that date mixes two processing releases. There is also a gap with no data from 27 July to 10 August 2026.":
    "ASF etiqueta los productos NISAR de banda L como beta, provisionales o validados. Los provisionales cubren adquisiciones del 17 de junio al 20 de octubre de 2026 y los validados empiezan el 21 de octubre, así que una comparación que cruce esa fecha mezcla dos versiones de procesamiento. Además hay un vacío sin datos del 27 de julio al 10 de agosto de 2026.",

  "06 · Where the data comes from": "06 · De dónde vienen los datos",
  Sources: "Fuentes",
  "L-band (about 24 cm), polarimetric backscatter at 10 m, from the Alaska Satellite Facility archive of NASA (ASF DAAC).":
    "Retrodispersión polarimétrica en banda L (unos 24 cm) a 10 m, del archivo del Alaska Satellite Facility de la NASA (ASF DAAC).",
  "C-band (about 5.6 cm) Sentinel-1 backscatter at 30 m, terrain-corrected by the OPERA project of NASA, also from ASF.":
    "Retrodispersión de Sentinel-1 en banda C (unos 5.6 cm) a 30 m, corregida por el relieve por el proyecto OPERA de la NASA, también de ASF.",
  "Base map and radar layers": "Mapa base y capas de radar",
  "Satellite base map: Sentinel-2 cloudless by EOX (contains modified Copernicus Sentinel data 2021). Radar overlays and the same-day camera view of the radar lens (NOAA-20 VIIRS true colour): NASA GIBS.":
    "Mapa base satelital: Sentinel-2 sin nubes de EOX (contiene datos modificados de Copernicus Sentinel 2021). Capas de radar y vista de cámara del mismo día de la lente de radar (color real de NOAA-20 VIIRS): NASA GIBS.",
  "Land cover": "Cobertura del suelo",
  "ESA WorldCover 2021 v200 at 10 m (© ESA WorldCover project, contains modified Copernicus Sentinel data), used to say what kind of ground the flagged pixels sit on.":
    "ESA WorldCover 2021 v200 a 10 m (© proyecto ESA WorldCover, contiene datos modificados de Copernicus Sentinel), usado para decir sobre qué tipo de terreno están los píxeles marcados.",
  "NISAR scene footprints": "Huellas de las escenas de NISAR",
  "The 12-day dance draws the footprints of every NISAR L2 GCOV scene of one cycle, as listed in the public NASA CMR catalogue.":
    "El baile de 12 días dibuja las huellas de cada escena NISAR L2 GCOV de un ciclo, tal como figuran en el catálogo público CMR de la NASA.",
  "Next steps: compare each flagged area against independent records (fire detections, flood reports), build a per-pixel baseline from the whole time series so significance can be measured, and add live hazard feeds as a separate layer.":
    "Próximos pasos: comparar cada área marcada con registros independientes (detecciones de incendios, reportes de inundaciones), construir una línea base por píxel con toda la serie temporal para poder medir la significancia, y añadir fuentes de amenazas en vivo como una capa aparte.",
  "Built for the NASA Space Apps Challenge 2026, challenge “Dancing with the SARs”. Radar data: NASA ASF DAAC (NISAR) and ESA Copernicus Sentinel-1 via the NASA OPERA project.":
    "Creado para el NASA Space Apps Challenge 2026, reto “Dancing with the SARs”. Datos de radar: NASA ASF DAAC (NISAR) y ESA Copernicus Sentinel-1 mediante el proyecto OPERA de la NASA.",
};
