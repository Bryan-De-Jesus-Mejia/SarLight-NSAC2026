# Idiomas (ES / EN)

La interfaz está en inglés y español. El visitante empieza en el idioma de su navegador (`?lang=es|en` en la dirección manda sobre todo), puede cambiarlo con el interruptor **ES | EN** de la barra superior (y de `/methods`) y la elección se guarda en `localStorage` (`ge-lang`).

## Cómo funciona

**La frase en inglés es la clave.** El código escribe el inglés; el español vive en `i18n/es/*.ts`.

```tsx
const t = useT();                       // en componentes
t("Simple view")                        // "Vista sencilla"
t("{n} days later", { n: 12 })          // "12 días después"
t("{n, plural, one {# pass} other {# passes}}", { n })
rich(t("It flags <b>{area} km²</b>.", { area }), { b: (c) => <b>{c}</b> })   // negritas que se mueven con el idioma
```

- Fuera de React (stores, `lib/*`, HTML del globo) usa `import { t } from "@/i18n/core"`.
- Textos fijos en constantes (tablas, listas): envuélvelos en `msg("…")` donde se declaran y tradúcelos con `t(valor)` al dibujarlos.
- Nunca pases una plantilla con `${}` a `t()`; usa marcadores `{nombre}`. Una frase completa por mensaje: el español cambia el orden de las palabras.
- Fechas y números: `lib/format.ts` (`formatDate`, `formatNumber`, `formatValue`…). Usan `es-DO`, que escribe los números como en inglés (1,234.5).
- Nombres de casos, regiones, países y tipos de cobertura se traducen con `t(event.name)`, `t(event.region)`… (`i18n/es/data.ts`). Los países del globo salen de `Intl.DisplayNames` (`i18n/countries.ts`).

## Añadir o revisar traducciones

1. Escribe el texto nuevo con `t()` / `msg()`.
2. `node scripts/check-i18n.mjs` lista lo que falta en español (sale con error si falta algo). `--unused` lista entradas sin uso.
3. Agrega la entrada en el archivo de su área dentro de `i18n/es/` (hay uno por área para que tres personas no editen las mismas líneas) y regístralo en `i18n/es/index.ts`.

Si falta una traducción la app muestra el inglés (y avisa una vez en la consola en desarrollo): nunca queda en blanco.
