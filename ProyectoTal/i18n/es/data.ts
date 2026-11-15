/** Spanish for the data itself: change types, case names, places, ground cover. */

const types: Record<string, string> = {
  "Wetlands & water": "Humedales y agua",
  wetland: "humedal",
  "Flooded vegetation and open-water extent seen through L-band double bounce.":
    "Vegetación inundada y extensión de agua abierta, vistas por el doble rebote de la banda L.",
  Floods: "Inundaciones",
  flood: "inundación",
  "Land that turns to open water, seen as a sharp drop in radar backscatter.":
    "Tierra que se convierte en agua abierta, vista como una caída brusca de la retrodispersión del radar.",
  "Glaciers & ice": "Glaciares y hielo",
  glacier: "glaciar",
  "Ice flow speed and terminus position from offset tracking.":
    "Velocidad del flujo de hielo y posición del frente, medidas con seguimiento de desplazamientos.",
  Wildfire: "Incendio forestal",
  wildfire: "incendio forestal",
  "Burn scars from the drop in volume scattering after canopy loss.":
    "Cicatrices de quema, vistas por la caída de la dispersión de volumen tras perder el dosel.",
  Earthquakes: "Terremotos",
  earthquake: "terremoto",
  "Co-seismic ground displacement mapped with InSAR.": "Desplazamiento cosísmico del terreno, medido con InSAR.",
  Agriculture: "Agricultura",
  agriculture: "agricultura",
  "Crop cycles and land conversion from backscatter time series.":
    "Ciclos de cultivo y cambios de uso del suelo, a partir de series de retrodispersión.",
  "Land deformation": "Deformación del terreno",
  "land deformation": "deformación del terreno",
  "Slow subsidence and uplift measured to millimetres with InSAR.":
    "Hundimiento y elevación lentos, medidos al milímetro con InSAR.",
  "Landslides & collapses": "Deslizamientos y derrumbes",
  landslide: "deslizamiento",
  "Slopes that give way, measured as ground movement toward or away from the satellite.":
    "Laderas que ceden, medidas como movimiento del suelo hacia el satélite o en sentido contrario.",
};

const names: Record<string, string> = {
  "Venezuela earthquake": "Terremoto de Venezuela",
  "Pine Island Glacier ice flow": "Flujo de hielo del glaciar Pine Island",
  "Hubbard Glacier ice flow": "Flujo de hielo del glaciar Hubbard",
  "Amazon forest clearing": "Tala del bosque amazónico",
  "Jakobshavn Isbræ ice flow": "Flujo de hielo del Jakobshavn Isbræ",
  "Mekong Delta rice flooding": "Inundación de arrozales del delta del Mekong",
  "Saskatchewan crop harvest": "Cosecha de cultivos en Saskatchewan",
  "Mexico earthquake": "Terremoto de México",
  "Nile Delta rice harvest": "Cosecha de arroz del delta del Nilo",
  "Sacramento Valley rice harvest": "Cosecha de arroz del valle de Sacramento",
  "Ukraine sunflower harvest": "Cosecha de girasol en Ucrania",
  "Indonesia earthquake": "Terremoto de Indonesia",
  "Langtang Lirung collapse": "Derrumbe del Langtang Lirung",
  "Iowa crop harvest": "Cosecha de cultivos en Iowa",
  "Punjab crop-residue burning": "Quema de residuos de cultivos en Punyab",
  "Panama earthquake": "Terremoto de Panamá",
  "Pelempito fire analysis": "Análisis del incendio de Pelempito",
  "Sierra de Bahoruco fire analysis": "Análisis del incendio de la Sierra de Bahoruco",
  "Azua flood analysis": "Análisis de la inundación de Azua",
  "Monte Plata flood analysis": "Análisis de la inundación de Monte Plata",
  // Without the trailing "analysis".
  "Pelempito fire": "Incendio de Pelempito",
  "Sierra de Bahoruco fire": "Incendio de la Sierra de Bahoruco",
  "Azua flood": "Inundación de Azua",
  "Monte Plata flood": "Inundación de Monte Plata",
};

const regions: Record<string, string> = {
  "Central coast": "Costa central",
  "Amundsen Sea": "Mar de Amundsen",
  "Yakutat Bay, Alaska": "Bahía de Yakutat, Alaska",
  "Pará, Amazon": "Pará, Amazonía",
  "Ilulissat Icefjord": "Fiordo helado de Ilulissat",
  "Mekong Delta": "Delta del Mekong",
  "Chiapas coast": "Costa de Chiapas",
  "Nile Delta": "Delta del Nilo",
  "Sacramento Valley, California": "Valle de Sacramento, California",
  "Central Ukraine": "Centro de Ucrania",
  "Flores Sea": "Mar de Flores",
  "Central Iowa": "Centro de Iowa",
  Punjab: "Punyab",
  "Southwestern Panama": "Suroeste de Panamá",
};

const countries: Record<string, string> = {
  Antarctica: "Antártida",
  "United States": "Estados Unidos",
  Brazil: "Brasil",
  Greenland: "Groenlandia",
  Canada: "Canadá",
  Mexico: "México",
  Egypt: "Egipto",
  Ukraine: "Ucrania",
  Panama: "Panamá",
  "Dominican Republic": "República Dominicana",
};

/** Proper nouns that read the same in both languages, so the lookup finds them without a warning. */
const same = [
  "Venezuela",
  "Vietnam",
  "Indonesia",
  "Nepal",
  "India",
  "Saskatchewan",
  "Langtang, Rasuwa",
  "Sierra de Bahoruco",
  "Sierra de Bahoruco, Pedernales",
  "Pelempito",
  "Azua",
  "Monte Plata",
];

const land: Record<string, string> = {
  "Tree cover": "Cobertura de árboles",
  Shrubland: "Matorral",
  Grassland: "Pastizal",
  Cropland: "Tierras de cultivo",
  "Built-up": "Zona construida",
  "Bare / sparse vegetation": "Suelo desnudo o vegetación escasa",
  "Bare or sparse vegetation": "Suelo desnudo o vegetación escasa",
  "Permanent water bodies": "Cuerpos de agua permanentes",
  "Permanent water": "Agua permanente",
  "Herbaceous wetland": "Humedal herbáceo",
  Mangroves: "Manglares",
  "Snow and ice": "Nieve y hielo",
  "Moss and lichen": "Musgo y líquenes",
};

export const data: Record<string, string> = {
  ...types,
  ...names,
  ...regions,
  ...countries,
  ...land,
  ...Object.fromEntries(same.map((name) => [name, name])),
};
