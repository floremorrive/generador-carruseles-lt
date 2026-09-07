// ===== Catálogo de datos: tipos de carrusel, temas y límites =====
// (Los diseños de plantilla viven en js/render.js)

// Tamaño real de lámina para Instagram: 1080 x 1440 px (definido por el usuario, no 1080x1350).
const CANVAS_W = 1080, CANVAS_H = 1440;

// Temas / categorías para carruseles tipo "Noticia / hecho".
const TEMAS_NOTICIA = [
  "Pasa en el mundo", "¿Qué está pasando?", "Especiales", "Pasa en las regiones",
  "Pura paja", "Le pasa a las Mujeres", "Temas", "Agro", "Arte y Cultura", "Economía",
  "Educación", "Industria", "Magisterio", "Medio ambiente", "Minería", "Mujeres",
  "Salud", "Servicios públicos", "Mercado Laboral", "Trabajadores", "Género",
  "Petróleo", "Ciencia y Tecnología", "Pensiones", "Historia", "Energía"
];
// Temas para carruseles tipo "Puntos de vista" (los .pptx de esta línea solo usan
// esta única categoría como badge).
const TEMAS_PUNTOS_VISTA = ["Puntos de vista"];

// Tipos de carrusel disponibles.
// `autor` = true → pide foto / nombre / red social / perfil de quien firma (Puntos de vista).
const TIPOS_CARRUSEL = [
  { id: "noticia",      nombre: "Noticia / hecho",   autor: false, temas: TEMAS_NOTICIA },
  { id: "puntos-vista", nombre: "Puntos de vista",   autor: true,  temas: TEMAS_PUNTOS_VISTA }
];

// Estructura: 1 portada + láminas de desarrollo (2 visibles por defecto, hasta 5) +
// [1 lámina de Autor, solo Puntos de vista] + 1 CTA del tema (pregunta que invita a
// comentar, lámina propia, antes del CTA fijo) + 1 CTA fijo (siempre el último, texto fijo).
const LIMITES = { minLaminas: 1, maxLaminas: 5, laminasPorDefecto: 2 };

// Texto FIJO del CTA final — regla no negociable (2026-09-05/06): se usa SIEMPRE,
// sin importar lo que diga cualquier plantilla .pptx de referencia.
// "latribunacolombia.co" va en negrilla en las dos apariciones.
const CTA_FIJO = {
  titulo: "Sigue a @latribunacolombia",
  linea1: "para que no te pierdas nuestro contenido",
  linea2pre: "Lea la nota completa en ",
  linea2bold: "latribunacolombia.co"
};

// Texto fijo del lema de marca — regla no negociable: SIEMPRE Rajdhani,
// "En defensa de " en Light + "Colombia" en Bold (Rajdhani no tiene peso Black real).
// Se dibuja solo si la plantilla original lo trae, y siempre debajo del logo.
const LEMA = { pre: "En defensa de ", bold: "Colombia" };

// Columnas de la tabla de láminas de desarrollo (para armar el <thead> y el CSV).
// Las láminas de desarrollo NO tienen título (regla del proyecto): un solo campo.
const COLUMNAS_TABLA = ["texto"];
const COLUMNAS_TABLA_LABEL = { texto: "Texto de la lámina" };

// Catálogo de los 20 diseños de referencia (orden de ejecución dado por el usuario,
// 2026-09-06). Cada uno corresponde a un .pptx en E:\Mi unidad\FMORRIVE\LT_all\Plantilas_LT-Carrusel\.
// `id` es la clave que usa TEMPLATES en render.js; `tipo` filtra el selector de plantilla
// según "Tipo de carrusel"; `listo` indica si ya tiene diseño real.
const CATALOGO_PLANTILLAS = [
  { id: "especiales-01",        archivo: "Especiales_01.pptx",             tipo: "noticia",      listo: true },
  { id: "especiales-02",        archivo: "Especiales_02.pptx",             tipo: "noticia",      listo: true },
  { id: "pasa-mundo-01",        archivo: "Pasa_en_el_Mundo_01.pptx",       tipo: "noticia",      listo: true },
  { id: "pasa-mundo-02",        archivo: "Pasa_en_el_Mundo_02.pptx",       tipo: "noticia",      listo: true },
  { id: "pasa-mundo-03",        archivo: "Pasa_en_el_Mundo_03.pptx",       tipo: "noticia",      listo: true },
  { id: "pasa-mundo-04",        archivo: "Pasa_en_el_Mundo_04.pptx",       tipo: "noticia",      listo: true },
  { id: "pasa-regiones-01",     archivo: "Pasa_en_las_Regiones_01.pptx",   tipo: "noticia",      listo: true },
  { id: "pasa-regiones-02",     archivo: "Pasa_en_las_Regiones_02.pptx",   tipo: "noticia",      listo: true },
  { id: "pasa-regiones-03",     archivo: "Pasa_en_las_Regiones_03.pptx",   tipo: "noticia",      listo: true },
  { id: "pasa-regiones-04",     archivo: "Pasa_en_las_Regiones_04.pptx",   tipo: "noticia",      listo: true },
  { id: "puntos-vista-01",      archivo: "Puntos_de_Vista_01.pptx",        tipo: "puntos-vista", listo: true },
  { id: "puntos-vista-02",      archivo: "Puntos_de_Vista_02.pptx",        tipo: "puntos-vista", listo: true },
  { id: "pura-paja-01",         archivo: "Pura_Paja_01.pptx",              tipo: "noticia",      listo: true },
  { id: "que-pasa-01",          archivo: "Que_esta_pasando_01.pptx",       tipo: "noticia",      listo: true },
  { id: "que-pasa-02",          archivo: "Que_esta_pasando_02.pptx",       tipo: "noticia",      listo: true },
  { id: "que-pasa-03",          archivo: "Que_esta_pasando_03.pptx",       tipo: "noticia",      listo: true },
  { id: "temas-01",             archivo: "Temas_01.pptx",                  tipo: "noticia",      listo: true },
  { id: "temas-02",             archivo: "Temas_02.pptx",                  tipo: "noticia",      listo: true },
  { id: "temas-03",             archivo: "Temas_03.pptx",                  tipo: "noticia",      listo: true },
  { id: "temas-04",             archivo: "Temas_04.pptx",                  tipo: "noticia",      listo: true }
];
