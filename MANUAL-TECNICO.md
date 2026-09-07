# Manual técnico · Generador de Carruseles La Tribuna

## Estado actual (2026-09-06)

Las **20 plantillas reales** están cargadas, leídas directamente de los `.pptx` en
`E:\Mi unidad\FMORRIVE\LT_all\Plantilas_LT-Carrusel\` con `python-pptx` (posiciones,
colores, tipografías y degradados exactos — no estimados a ojo). Motor y catálogo en
`js/render.js`, catálogo/etiquetas en `js/data.js`.

| id | Archivo | Familia tipográfica |
|---|---|---|
| especiales-01 | Especiales_01.pptx | Rajdhani + Inter Tight |
| especiales-02 | Especiales_02.pptx | Rajdhani + Inter Tight |
| pasa-mundo-01 | Pasa_en_el_Mundo_01.pptx | Antonio + Source Serif 4 |
| pasa-mundo-02 | Pasa_en_el_Mundo_02.pptx | Antonio + Source Serif 4 |
| pasa-mundo-03 | Pasa_en_el_Mundo_03.pptx | Antonio + Source Serif 4 |
| pasa-mundo-04 | Pasa_en_el_Mundo_04.pptx | Antonio + Source Serif 4 |
| pasa-regiones-01 | Pasa_en_las_Regiones_01.pptx | Antonio + Source Serif 4 |
| pasa-regiones-02 | Pasa_en_las_Regiones_02.pptx | Antonio + Source Serif 4 |
| pasa-regiones-03 | Pasa_en_las_Regiones_03.pptx | Antonio + Source Serif 4 |
| pasa-regiones-04 | Pasa_en_las_Regiones_04.pptx | Rajdhani + Inter Tight |
| puntos-vista-01 | Puntos_de_Vista_01.pptx | Rajdhani + Inter Tight |
| puntos-vista-02 | Puntos_de_Vista_02.pptx | Antonio + Source Serif 4 |
| pura-paja-01 | Pura_Paja_01.pptx | Rajdhani + Inter Tight |
| que-pasa-01 | Que_esta_pasando_01.pptx | Rajdhani + Inter Tight |
| que-pasa-02 | Que_esta_pasando_02.pptx | Rajdhani + Inter Tight |
| que-pasa-03 | Que_esta_pasando_03.pptx | Antonio + Source Serif 4 |
| temas-01 | Temas_01.pptx | Antonio + Source Serif 4 |
| temas-02 | Temas_02.pptx | Rajdhani + Inter Tight |
| temas-03 | Temas_03.pptx | Antonio + Source Serif 4 (idéntica a pasa-regiones-03) |
| temas-04 | Temas_04.pptx | Rajdhani + Inter Tight |

## Arquitectura

HTML + CSS + JS puro, canvas 1080×1440. `js/render.js` define, por plantilla, un
objeto con hasta 5 funciones — `portada`, `desarrollo`, `autor` (solo si el .pptx de
origen trae una lámina de autor dedicada), `ctaTema`, `ctaFijo` — construidas con
"piezas" compartidas: `fillBox`, `gradientBox` (degradados multi-stop reales, con
alpha), `drawPill` (pastilla que se autoajusta al ancho del texto), `drawFrame`,
`drawCornerMarks`/`drawCornerMarksDiag`, `drawBubble`, `drawLogo` (variantes
`"white"`/`"vino"`/`"mono"`/hex), `drawLema` y `drawCtaFijo` (estas dos con el
contenido FIJO no negociable, ver abajo). `fitTitle`/`paragraph` auto-ajustan el
tamaño de letra para no salirse del cuadro.

## Reglas fijas aplicadas en las 20 (no dependen del .pptx de origen)

1. Canvas 1080×1440 — las plantillas que traían 1080×1350 (los `Pasa_en_el_Mundo_01`)
   se reescalan verticalmente (`SY = 1440/1350`).
2. "En defensa de Colombia": siempre Rajdhani, "En defensa de " Light + "Colombia"
   Bold (`drawLema`), sin importar si el resto de la plantilla es Familia 1 o 2. Solo
   se dibuja si el .pptx de esa plantilla la trae.
3. CTA fijo: siempre el texto oficial (`CTA_FIJO` en `data.js`), con la URL en
   negrilla, sin importar el texto que tuviera el .pptx (varios traían "no se
   pierda"/usted; se reemplaza por el texto oficial en tú).
4. Lámina de autor (Puntos de vista): siempre su propia lámina, aunque el .pptx
   original la trajera combinada con el CTA del tema (`puntos-vista-01`) — se separó
   en dos funciones (`autor` y `ctaTema`).

## Simplificaciones conscientes (por límite de tiempo, no por regla)

- Ilustraciones agrupadas complejas del .pptx (`GROUP`, confeti de `Pura_Paja_01`) no
  se replican trazo por trazo; se conserva paleta + tipografía + motivo de puntos.
- El recorte exacto (`crop`) de la foto de cada .pptx de referencia no se replica: el
  usuario reencuadra su propia foto con zoom/posición en la app, así que no aplica.
- Colores de texto marcados como `theme` (sin `srgbClr` directo) se resolvieron a la
  paleta del proyecto por contraste (fondo claro→oscuro, fondo oscuro→claro/dorado),
  no están garantizados pixel-igual al original.

## Cómo releer un .pptx si hace falta ajustar algo

```bash
python extract.py archivo.pptx      # genera archivo.json con posiciones/colores/fuentes/gradientes exactos
```

El script vive en la carpeta temporal de la sesión que hizo este trabajo; si no está
disponible, pedir que se regenere (usa `python-pptx`, ya instalado, sin dependencias
nuevas).

## Pendientes

- Verificación visual exhaustiva de las 20 (se verificaron visualmente todas al
  construirlas; no se hizo una comparación pixel-a-pixel automatizada contra el
  .pptx original porque este equipo no tiene LibreOffice/Poppler instalados).
- `assets/img/logo-lt-monograma-2.png` es el monograma "LT" nuevo (extraído de
  `Pasa_en_el_Mundo_04.pptx`), distinto del `logo-lt-monograma.png` heredado de
  Generador-LaTribuna.
