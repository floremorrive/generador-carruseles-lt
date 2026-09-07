// ===== Motor de render de carruseles (canvas 1080 x 1440, un canvas por lámina) =====
// Arquitectura: cada plantilla es una función que dibuja con "piezas" compartidas
// (rectángulos con alpha, degradados multi-stop, texto, foto con recorte, lema fijo,
// bloque de CTA fijo) usando los números EXACTOS leídos de cada .pptx de referencia.
const W = CANVAS_W, H = CANVAS_H; // 1080 x 1440 (data.js)

const COLORS = { vino: "#8A3D33", gold: "#C6A465", cream: "#FAF4F2", dark: "#272624" };

// --- carga de assets compartidos ---
const ASSETS = {};
function loadImg(src){
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
async function initAssets(){
  const base = "assets/img/";
  const [grano, grunge, logoWhite, logoVino, logoMono, ppCamara, ppPeriodico] = await Promise.all([
    loadImg(base + "fx-grano.png"),
    loadImg(base + "fx-grunge.png"),
    loadImg(base + "logo-latribuna-script-white.png"),
    loadImg(base + "logo-latribuna-script-vino.png"),
    loadImg(base + "logo-lt-monograma-2.png"),
    loadImg(base + "pura-paja-camara.png"),
    loadImg(base + "pura-paja-periodico.png")
  ]);
  ASSETS.grano = grano; ASSETS.grunge = grunge;
  ASSETS.logoWhite = logoWhite; ASSETS.logoVino = logoVino; ASSETS.logoMono = logoMono;
  ASSETS.ppCamara = ppCamara; ASSETS.ppPeriodico = ppPeriodico;
  // El canvas NO dispara la descarga de una @font-face por sí solo (a diferencia del
  // texto normal del DOM): hay que pedirla explícitamente con document.fonts.load(),
  // si no, fillText() dibuja con la fuente por defecto sin avisar del error.
  if (document.fonts){
    const pesos = ["300", "400", "500", "600", "700"];
    const familias = ["Rajdhani", "Inter Tight", "Antonio", "Source Serif 4"];
    const pendientes = [];
    familias.forEach(f => pesos.forEach(p => pendientes.push(document.fonts.load(p + " 40px '" + f + "'").catch(() => {}))));
    await Promise.all(pendientes);
    if (document.fonts.ready) await document.fonts.ready;
  }
}

// ===== Piezas de bajo nivel =====
function hexToRgb(hex){
  const h = hex.replace('#','');
  return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
}
function rgba(hex, pct){
  const [r,g,b] = hexToRgb(hex || "#000000");
  const a = (pct == null ? 100 : pct) / 100;
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}
function fillBox(ctx, x, y, w, h, hex, pct){
  ctx.fillStyle = rgba(hex, pct != null ? pct : 100);
  ctx.fillRect(x, y, w, h);
}
function roundRectFill(ctx, x, y, w, h, r, hex, pct){
  ctx.save(); ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fillStyle = rgba(hex, pct != null ? pct : 100); ctx.fill(); ctx.restore();
}
// Pastilla de categoría / rótulo, reutilizada por varias plantillas pero SIN geometría
// propia: cada plantilla debe pasar sus propias medidas reales, leídas de su .pptx.
// cfg.w es el ancho MÍNIMO (crece si el texto no cabe) salvo que cfg.fixedW sea true,
// caso en el que cfg.w es el ancho EXACTO del original (nunca se reduce ni se autoajusta) —
// úsese fixedW cuando el .pptx define un ancho real por razones gráficas (no todos los
// rótulos son "texto + relleno mínimo"; ver REGLA GENERAL SOBRE BANNERS del proyecto).
function drawPill(ctx, cfg, text){
  const padx = cfg.padx != null ? cfg.padx : 14;
  const font = (cfg.weight || 700) + " " + cfg.size + "px '" + (cfg.font || "Rajdhani") + "'";
  ctx.save(); ctx.font = font;
  const tw = ctx.measureText(text).width;
  ctx.restore();
  const boxW = cfg.fixedW ? cfg.w : Math.max(cfg.w || 0, tw + padx * 2);
  const x = cfg.centerX != null ? cfg.centerX - boxW/2 : cfg.rightEdge != null ? cfg.rightEdge - boxW : cfg.x;
  if (cfg.boxHex) roundRectFill(ctx, x, cfg.y, boxW, cfg.h, cfg.r != null ? cfg.r : cfg.h/2, cfg.boxHex, 100);
  if (cfg.borderHex){
    ctx.save(); ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, cfg.y, boxW, cfg.h, cfg.r != null ? cfg.r : cfg.h/2); else ctx.rect(x, cfg.y, boxW, cfg.h);
    ctx.strokeStyle = cfg.borderHex; ctx.lineWidth = cfg.borderWidth || 2; ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.font = font; ctx.fillStyle = cfg.color;
  ctx.textBaseline = "alphabetic";
  if (cfg.textAlign === "center"){
    ctx.textAlign = "center";
    ctx.fillText(text, x + boxW/2, cfg.y + cfg.h/2 + cfg.size*0.35);
  } else {
    ctx.textAlign = "left";
    ctx.fillText(text, x + padx, cfg.y + cfg.h/2 + cfg.size*0.35);
  }
  ctx.restore();
  return boxW;
}
// Pastilla girada 90°: (cx,cy) = centro geométrico exacto de la forma en el .pptx
// original; boxLen = dimensión larga, boxThick = dimensión corta (antes de rotar).
function drawPillVertical(ctx, cx, cy, boxLen, boxThick, cfg, text){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  drawPill(ctx, Object.assign({}, cfg, { x: -boxLen/2, y: -boxThick/2, w: boxLen, h: boxThick }), text);
  ctx.restore();
}
// Rectángulo girado 90° en torno a su propio centro geométrico (cx,cy) — para bandas
// verticales cuyo relleno y cuyo texto NO comparten el mismo centro en el .pptx real
// (el texto puede estar desplazado dentro de la banda, no centrado en ella).
function drawRotatedRect(ctx, cx, cy, w, h, hex){
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = hex; ctx.fillRect(-w/2, -h/2, w, h);
  ctx.restore();
}
// Texto girado 90° en torno al centro geométrico PROPIO de su caja de texto real
// (independiente del centro de cualquier banda/relleno que tenga detrás).
function drawRotatedText(ctx, cx, cy, w, h, text, font, hex, padx){
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2);
  ctx.font = font; ctx.fillStyle = hex; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const m = font.match(/([\d.]+)px/);
  const size = m ? parseFloat(m[1]) : 20;
  ctx.fillText(text, -w/2 + (padx || 0), size * 0.35);
  ctx.restore();
}
function drawLineH(ctx, x, y, w, thicknessPx, hex){
  fillBox(ctx, x, y - thicknessPx/2, w, thicknessPx, hex, 100);
}
function drawFrame(ctx, x, y, w, h, thicknessPx, hex){
  ctx.save(); ctx.strokeStyle = hex; ctx.lineWidth = thicknessPx; ctx.strokeRect(x, y, w, h); ctx.restore();
}
// Cuatro marcas de esquina en "L" (motivo decorativo repetido en varias plantillas).
function drawCornerMarks(ctx, hex, inset, len, thick){
  inset = inset != null ? inset : 34; len = len != null ? len : 74; thick = thick != null ? thick : 4;
  [[inset, inset, 1, 1], [W-inset, inset, -1, 1], [inset, H-inset, 1, -1], [W-inset, H-inset, -1, -1]].forEach(([x,y,sx,sy]) => {
    fillBox(ctx, sx>0?x:x-len, y-thick/2, len, thick, hex, 100);
    fillBox(ctx, x-thick/2, sy>0?y:y-len, thick, len, hex, 100);
  });
}
// Degradado lineal multi-stop, tal como lo exporta PowerPoint (stops = [{pos_pct, hex, alpha_pct}]).
function gradientBox(ctx, x, y, w, h, stops, angleDeg){
  let x0, y0, x1, y1;
  const ang = angleDeg == null ? 90 : angleDeg;
  if (ang === 90){ x0=x; y0=y; x1=x; y1=y+h; }
  else if (ang === 270){ x0=x; y0=y+h; x1=x; y1=y; }
  else if (ang === 0){ x0=x; y0=y; x1=x+w; y1=y; }
  else if (ang === 180){ x0=x+w; y0=y; x1=x; y1=y; }
  else {
    const rad = ang * Math.PI / 180, dx = Math.cos(rad), dy = Math.sin(rad);
    const cx = x + w/2, cy = y + h/2, len = Math.max(w,h);
    x0 = cx - dx*len/2; y0 = cy - dy*len/2; x1 = cx + dx*len/2; y1 = cy + dy*len/2;
  }
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(s => g.addColorStop(s.pos_pct/100, rgba(s.hex, s.alpha_pct)));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
function drawCover(ctx, img, x, y, w, h, t){
  t = t || { zoom: 1, dx: 0, dy: 0 };
  const scale = Math.max(w / img.width, h / img.height) * (t.zoom || 1);
  const dw = img.width * scale, dh = img.height * scale;
  const ox = x + (w - dw) / 2 + (t.dx || 0);
  const oy = y + (h - dh) / 2 + (t.dy || 0);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, ox, oy, dw, dh);
  ctx.restore();
}
function drawCoverCircle(ctx, img, cx, cy, r, t){
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.clip();
  drawCover(ctx, img, cx-r, cy-r, r*2, r*2, t);
  ctx.restore();
}
let _microNoise = null;
function getMicroNoise(){
  if (_microNoise) return _microNoise;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); const im = g.createImageData(W, H); const d = im.data;
  for (let i = 0; i < d.length; i += 4){
    const r = Math.random();
    if (r < 0.28){ d[i]=d[i+1]=d[i+2]=0; d[i+3]=Math.random()*255; }
    else if (r > 0.72){ d[i]=d[i+1]=d[i+2]=255; d[i+3]=Math.random()*255; }
    else d[i+3]=0;
  }
  g.putImageData(im, 0, 0); _microNoise = c; return c;
}
function photoGrain(ctx, x, y, w, h, op){
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = op != null ? op : 0.15;
  ctx.drawImage(getMicroNoise(), x, y, w, h, x, y, w, h);
  ctx.restore();
}
function tintedLogo(img, color){
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
// variant: "white" | "vino" | "mono" (monograma "LT") | "mono:#hex" | color hex (recolorea el logo blanco)
function drawLogo(ctx, variant, x, y, w){
  let src;
  if (variant === "white") src = ASSETS.logoWhite;
  else if (variant === "vino") src = ASSETS.logoVino;
  else if (variant === "mono") src = ASSETS.logoMono;
  else if (typeof variant === "string" && variant.indexOf("mono:") === 0) src = tintedLogo(ASSETS.logoMono, variant.slice(5));
  else src = tintedLogo(ASSETS.logoWhite, variant);
  const h = src.height * w / src.width;
  ctx.drawImage(src, x, y, w, h);
  return { x, y, w, h };
}
function wrap(ctx, text, maxW){
  const words = (text || "").split(/\s+/);
  const lines = []; let line = "";
  for (const wd of words){
    const test = line ? line + " " + wd : wd;
    if (ctx.measureText(test).width > maxW && line){ lines.push(line); line = wd; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function paragraph(ctx, text, x, y, maxW, font, color, lh, align){
  ctx.save();
  ctx.font = font; ctx.fillStyle = color;
  ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic";
  const lines = wrap(ctx, text, maxW);
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lh));
  ctx.restore();
  return y + lines.length * lh;
}
// Título con auto-ajuste: reduce el tamaño (hasta 60%) si no cabe entre y y bottom.
// vAnchor "top" (por defecto) dibuja desde y hacia abajo, como antes.
// vAnchor "middle" CENTRA el bloque de texto verticalmente entre y y bottom — se usa
// en el cuerpo de las láminas de desarrollo (regla del proyecto: el centro del bloque
// debe quedar visualmente estable sin importar cuánto texto traiga cada lámina) y en
// los títulos de portada cuyo recuadro original está centrado verticalmente.
// minPx: piso ABSOLUTO en px que el tamaño nunca debe cruzar al autoajustarse (además
// del piso relativo de 60%) — se usa en el cuerpo de las láminas de desarrollo, donde
// el proyecto exige mantenerlo siempre legible (40-48px), sin importar cuánto texto
// traiga la lámina; si el texto no cabe ni al tamaño mínimo, se deja desbordar antes
// que encogerlo más.
function fitTitle(ctx, text, x, y, w, bottom, size, weight, font, color, lh, align, vAnchor, minPx){
  let f = 1, n = 1;
  const floor = minPx != null ? Math.max(minPx / size, 0.001) : 0.6;
  for (let i = 0; i < 12; i++){
    ctx.font = weight + " " + (size*f) + "px '" + font + "'";
    n = wrap(ctx, text, w).length;
    if (y + n * (lh != null ? lh*f : size*f*1.05) <= bottom || f <= floor) break;
    f -= 0.05;
  }
  if (minPx != null && size*f < minPx) f = minPx / size;
  const useLh = (lh != null ? lh*f : size*f*1.05);
  let startY = y;
  if (vAnchor === "middle"){
    const blockH = (n - 1) * useLh + size * f;
    const centerY = (y + bottom) / 2;
    startY = centerY - blockH / 2 + size * f * 0.78;
  }
  const ax = align === "center" ? x + w/2 : (align === "right" ? x + w : x);
  // Canal lateral (no cambia el valor de retorno, que ya se usa como "y siguiente" en
  // el resto del proyecto): guarda dónde empezó realmente el bloque, para plantillas
  // donde un punto/marca decorativa debe seguir a un texto que se autoajusta o centra.
  fitTitle.lastStartY = startY;
  fitTitle.lastCapHeight = size * f * 0.72;
  return paragraph(ctx, text, ax, startY, w, weight + " " + Math.round(size*f) + "px '" + font + "'", color, useLh, align);
}
// Una sola línea con varios tramos de distinto peso/color (para negrilla parcial y el lema).
function richLine(ctx, runs, x, y, align){
  ctx.save(); ctx.textBaseline = "alphabetic";
  let total = 0;
  runs.forEach(r => { ctx.font = r.font; total += ctx.measureText(r.text).width; });
  let cx = align === "center" ? x - total/2 : (align === "right" ? x - total : x);
  runs.forEach(r => {
    ctx.font = r.font; ctx.fillStyle = r.color;
    ctx.fillText(r.text, cx, y);
    cx += ctx.measureText(r.text).width;
  });
  ctx.restore();
}
// Lema de marca — regla fija: SIEMPRE Rajdhani, "En defensa de " Light + "Colombia" Bold.
function drawLema(ctx, x, y, sizePx, color, align){
  richLine(ctx, [
    { text: LEMA.pre,  font: "300 " + sizePx + "px 'Rajdhani'", color },
    { text: LEMA.bold, font: "700 " + sizePx + "px 'Rajdhani'", color }
  ], x, y, align);
}
// Párrafo con varios tramos de estilo, envuelto por palabra (para negrilla parcial
// dentro de un párrafo que sí necesita salto de línea). align: "left" (por defecto) o "center".
function richWrapParagraph(ctx, segments, x, y, maxW, lh, align){
  const words = [];
  segments.forEach(seg => seg.text.split(/\s+/).filter(Boolean).forEach(w =>
    words.push({ w, font: seg.font, color: seg.color })));
  ctx.save(); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  // Primero se agrupan las palabras en líneas según el ancho disponible.
  const spaceW = (font) => { ctx.font = font; return ctx.measureText(" ").width; };
  const lines = [[]];
  let lineW = 0;
  words.forEach((item, i) => {
    ctx.font = item.font;
    const ww = ctx.measureText(item.w).width;
    const sw = i > 0 ? spaceW(item.font) : 0;
    if (lines[lines.length-1].length && lineW + sw + ww > maxW){ lines.push([]); lineW = 0; }
    else if (lines[lines.length-1].length) lineW += sw;
    lines[lines.length-1].push(item);
    lineW += ww;
  });
  let cy = y;
  lines.forEach(line => {
    let totalW = 0;
    line.forEach((item, i) => {
      ctx.font = item.font;
      totalW += ctx.measureText(item.w).width;
      if (i > 0) totalW += spaceW(item.font);
    });
    let cx = align === "center" ? x + (maxW - totalW) / 2 : x;
    line.forEach(item => {
      ctx.font = item.font; ctx.fillStyle = item.color;
      ctx.fillText(item.w, cx, cy);
      cx += ctx.measureText(item.w).width + spaceW(item.font);
    });
    cy += lh;
  });
  ctx.restore();
  return cy;
}
// Bloque de CTA fijo — regla fija: SIEMPRE este contenido, con la URL en negrilla.
// Envuelve cada línea al ancho del cuadro (cfg.w) para que nunca se salga.
// cfg.align: "left" (por defecto) o "center" — cada plantilla indica la suya, según
// cómo esté compuesto su CTA fijo real (no todas centran el bloque).
// Regla general del proyecto: el bloque completo (título + cuerpo) debe quedar
// CENTRADO VERTICALMENTE en su área disponible — nunca amontonado contra el logo
// ni con un vacío grande abajo. Para eso, en vez de cfg.y (punto fijo de inicio) se
// pasan cfg.top/cfg.bottom (el rango real, tomado de la forma "CTA fijo" del .pptx
// de cada plantilla): se mide el bloque en una pasada muda (alpha 0) y se calcula el
// punto de inicio real que lo centra entre top y bottom antes de dibujarlo.
function drawCtaFijo(ctx, cfg){
  function paint(startY){
    let y = startY;
    y = fitTitle(ctx, CTA_FIJO.titulo, cfg.x, y, cfg.w, y + 9999,
      cfg.titleSize, cfg.titleWeight || 700, cfg.titleFont, cfg.titleColor, cfg.titleLh, cfg.align);
    y += cfg.gap != null ? cfg.gap : cfg.bodySize*0.9;
    const bodyFontStr = "400 " + cfg.bodySize + "px '" + cfg.bodyFont + "'";
    const boldFontStr = "700 " + cfg.bodySize + "px '" + cfg.bodyFont + "'";
    const bodyLh = cfg.bodyLh || cfg.bodySize*1.3;
    y = paragraph(ctx, CTA_FIJO.linea1, cfg.align === "center" ? cfg.x + cfg.w/2 : cfg.x, y, cfg.w, bodyFontStr, cfg.bodyColor, bodyLh, cfg.align);
    y += cfg.gapLineas != null ? cfg.gapLineas : bodyLh*0.35;
    y = richWrapParagraph(ctx, [
      { text: CTA_FIJO.linea2pre,  font: bodyFontStr, color: cfg.bodyColor },
      { text: CTA_FIJO.linea2bold, font: boldFontStr, color: cfg.bodyColor }
    ], cfg.x, y, cfg.w, bodyLh, cfg.align);
    return y;
  }
  if (cfg.top != null && cfg.bottom != null){
    ctx.save(); ctx.globalAlpha = 0;
    const endY = paint(cfg.top);
    ctx.restore();
    const blockH = endY - cfg.top;
    const startY = cfg.top + Math.max(0, (cfg.bottom - cfg.top - blockH) / 2);
    return paint(startY);
  }
  return paint(cfg.y);
}
function textureOverlays(ctx, granoOp, grungeOp){
  ctx.save();
  ctx.globalAlpha = granoOp; ctx.drawImage(ASSETS.grano, 0, 0, W, H);
  ctx.globalAlpha = grungeOp; ctx.drawImage(ASSETS.grunge, 0, 0, W, H);
  ctx.restore();
}

// ============================================================================
// ESPECIALES-01 — leída de Especiales_01.pptx (ver memoria del proyecto)
// ============================================================================
const TPL_especiales01 = {
  portada(ctx, d){
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform); // Imagen 8 (foto, crop lateral 25.16%)
    else fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, 0, W, H, "#000000", 9);                            // Velo oscuro
    gradientBox(ctx, 0, 420, W, 1020, [                                 // Sombra inferior
      { pos_pct: 0,  hex: "#000000", alpha_pct: 0 },
      { pos_pct: 52, hex: "#000000", alpha_pct: 65 },
      { pos_pct: 100, hex: "#000000", alpha_pct: 92 }
    ], 90);
    // Geometría real (XML): "Acento vino" x=-19,y=102,w=261.94,h=40 — su borde derecho
    // coincide EXACTAMENTE con el borde derecho de la caja de texto "Categoría" (que
    // empieza en x=86); es decir, crece con el texto real en vez de tener un ancho fijo
    // (con "ESPECIALES" el ancho real es 261.94; con un tema más largo, más ancho).
    // Categoría centrada verticalmente en los 40px de alto (vAnchor MIDDLE del .pptx).
    const temaTxtEsp01 = d.tema.toUpperCase();
    ctx.save(); ctx.font = "700 26px 'Rajdhani'";
    const temaWEsp01 = ctx.measureText(temaTxtEsp01).width;
    ctx.restore();
    fillBox(ctx, -19, 102, 105 + temaWEsp01 + 22, 40, COLORS.vino, 100); // +22 de holgura real (el texto medido en canvas no debe tocar el borde)
    paragraph(ctx, temaTxtEsp01, 86, 131, 900, "700 26px 'Rajdhani'", COLORS.cream, 40);
    fitTitle(ctx, d.titulo, 100, 387, 880, 857,                        // Titular de portada (recuadro real, centrado)
      88, 700, "Rajdhani", COLORS.cream, 101, null, "middle");         // interlineado más holgado (1.15x), no amontonado
    fillBox(ctx, 86, 900, 370, 7, COLORS.gold, 100);                   // Regla
    drawLema(ctx, 86, 1358, 25, COLORS.cream, "left");                 // Lema (FIJO)
    drawLogo(ctx, "white", 86, 1206.8, 320);                           // Imagen 15 (logo)
  },
  // El .pptx real trae 2 láminas de desarrollo de ejemplo que solo difieren en el
  // color del acento (lámina 2: dorado; lámina 3: vino) — se alterna igual aquí.
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);                       // Fondo
    fillBox(ctx, 0, 0, W, 250, COLORS.dark, 100);                      // Panel negro
    const acento = (d.indice % 2 === 0) ? COLORS.vino : COLORS.gold;
    fillBox(ctx, 0, 250, 290, 26, acento, 100);                        // Acento (alterna dorado/vino)
    paragraph(ctx, d.tema.toUpperCase(), 104, 145, 620,                // Categoría
      "700 26px 'Rajdhani'", COLORS.cream, 30);
    fitTitle(ctx, d.texto, 104, 300, 820, 1260,                        // Cuerpo de desarrollo, centrado
      45, 400, "Inter Tight", COLORS.dark, 58, null, "middle", 40);
    paragraph(ctx, "latribunacolombia.co", 644.6, 1318, 330.4,         // watermark del pie
      "700 32px 'Rajdhani'", COLORS.vino, 36);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);                       // Fondo
    paragraph(ctx, d.tema.toUpperCase(), 82, 122, 620,                 // Categoría
      "700 26px 'Rajdhani'", COLORS.vino, 30);
    fillBox(ctx, 0, 260, W, 920, COLORS.dark, 100);                    // Panel negro
    fillBox(ctx, 82, 1142, 590, 12, COLORS.vino, 100);                 // Línea vino
    fitTitle(ctx, d.pregunta, 130, 510, 820, 930,                      // CTA variable (pregunta): centrado SOLO en vertical, alineado a la izquierda
      69, 700, "Rajdhani", COLORS.cream, 76, null, "middle");
    richLine(ctx, [                                                     // Continuidad (color real: vino, no dorado)
      { text: "La Tribuna ", font: "700 25px 'Rajdhani'", color: COLORS.vino },
      { text: "Colombia",    font: "300 25px 'Rajdhani'", color: COLORS.vino }
    ], 540, 1244, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);                        // Fondo
    fillBox(ctx, 0, 0, 540, H, COLORS.cream, 100);                     // Mitad marfil
    fillBox(ctx, 520, 0, 20, H, COLORS.vino, 100);                     // Línea vino
    drawLogo(ctx, "vino", 90, 240.3, 350);                             // Imagen 10 (logo vino)
    drawLema(ctx, 90, 402, 27, COLORS.vino, "left");                   // Lema (FIJO), SIEMPRE debajo del logo — vino sobre marfil (oro era ilegible aquí)
    drawCtaFijo(ctx, {
      x: 590, top: 380, bottom: 980, w: 424.86,                        // rango real de "CTA fijo" (y=380,h=600): bloque centrado en él
      titleSize: 41, titleFont: "Inter Tight", titleWeight: 700, titleColor: COLORS.cream,
      bodySize: 41, bodyFont: "Inter Tight", bodyColor: COLORS.cream, bodyLh: 52, gap: 30
    });
    fillBox(ctx, 590, 1015, 405, 7, COLORS.gold, 100);                 // Regla final
  }
};

// ============================================================================
// ESPECIALES-02 — leída de Especiales_02.pptx
// ============================================================================
const TPL_especiales02 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    fillBox(ctx, 0, 0, W, H, "#7F7F7F", 8);                            // Velo gris
    gradientBox(ctx, 0, 0, W, H, [                                      // degradado oscurece hacia abajo
      { pos_pct: 0,  hex: "#000000", alpha_pct: 25 },
      { pos_pct: 55, hex: "#000000", alpha_pct: 31 },
      { pos_pct: 100, hex: "#000000", alpha_pct: 100 }
    ], 90);
    drawPill(ctx, { x: 82.31, y: 94.15, w: 178, h: 37, r: 6, boxHex: COLORS.dark, color: COLORS.gold, size: 26 }, d.tema.toUpperCase());
    fitTitle(ctx, d.titulo, 86, 862, 912.58, 1186.46, 96, 700, "Rajdhani", COLORS.cream, 110, null, "middle");
    drawLogo(ctx, "white", 21.96, 1250.41, 384.42);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    drawPill(ctx, { x: 82.31, y: 94.15, w: 178, h: 37, r: 6, boxHex: COLORS.dark, color: COLORS.gold, size: 26 }, d.tema.toUpperCase());
    fitTitle(ctx, d.texto, 133, 220, 837.39, 1280, 41, 400, "Inter Tight", COLORS.dark, 52, null, "middle", 40);
    paragraph(ctx, "@" + "LATRIBUNACOLOMBIA", 655.38, 1323, 342.58, "700 26px 'Rajdhani'", COLORS.dark, 30);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    paragraph(ctx, d.tema.toUpperCase(), 86, 122, 300, "700 26px 'Rajdhani'", COLORS.cream, 30);
    fitTitle(ctx, d.pregunta, 168, 389.6, 767.35, 1050.4, 92, 700, "Rajdhani", COLORS.gold, 98, null, "middle"); // centrado en el rango real (y=389.6..1050.4), alineado a la izquierda
    drawLogo(ctx, "white", 143.07, 1246.86, 280);
    paragraph(ctx, "@LATRIBUNACOLOMBIA", 672, 1336, 279.7, "700 26px 'Rajdhani'", COLORS.cream, 30);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    paragraph(ctx, "@LATRIBUNACOLOMBIA", 86, 122, 400, "700 26px 'Rajdhani'", COLORS.cream, 30);
    drawLogo(ctx, "white", 97, 340, 620);
    drawLema(ctx, 97, 610, 30, COLORS.gold, "left");                    // Lema (FIJO)
    drawCtaFijo(ctx, {
      x: 116.85, top: 720.24, bottom: 961.33, w: 846.3,                // rango real (título+cuerpo1 y=720.24..961.33)
      titleSize: 53, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.cream,
      bodySize: 40, bodyFont: "Inter Tight", bodyColor: COLORS.cream, bodyLh: 50, gap: 26
    });
  }
};

// ============================================================================
// PASA-MUNDO-01 — leída de Pasa_en_el_Mundo_01.pptx (Familia 2: Antonio + Source Serif 4).
// Diseñada en un canvas de 1080x1350; sus coordenadas Y se escalan por SY = 1440/1350
// para adaptarse al tamaño fijo de 1080x1440 sin deformar las proporciones.
// ============================================================================
const SY_pem01 = CANVAS_H / 1350;
const TPL_pasaMundo01 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    fillBox(ctx, 108, 738.67*SY_pem01, 864, 503.33*SY_pem01, COLORS.cream, 100); // tarjeta
    fitTitle(ctx, d.titulo, 192, 800, 735, 1120, 64, 700, "Antonio", COLORS.dark, 68, null, "middle");
    drawLineH(ctx, 172.66, 1125.3, 734.67, 3, COLORS.gold);
    drawLogo(ctx, "white", 172, 126.0, 270);
    drawPill(ctx, { x: 178.86, y: 1215.7, w: 230, h: 55.1, borderHex: COLORS.gold, borderWidth: 1.5,
      boxHex: COLORS.vino, color: COLORS.cream, size: 27, font: "Antonio", weight: 500 }, d.tema);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawLogo(ctx, "white", 108, 91.8, 230);
    fitTitle(ctx, d.texto, 108, 240, 830, 1200, 48, 400, "Source Serif 4", COLORS.cream, 60, null, "middle", 40);
    drawLineH(ctx, 108, 1221.3, 864.01, 2, COLORS.gold);
    drawPill(ctx, { x: 100, y: 1289.6, w: 230, h: 55.1, borderHex: COLORS.gold, borderWidth: 1.5,
      boxHex: COLORS.vino, color: COLORS.cream, size: 27, font: "Antonio", weight: 500 }, d.tema.toUpperCase());
  },
  // El .pptx real de este archivo NO trae una lámina de CTA-del-tema (solo portada +
  // 2 láminas de desarrollo de ejemplo + CTA fijo) — se construye con la misma
  // paleta/tipografía/geometría de la lámina de desarrollo de este mismo archivo,
  // igual que se hizo para Pasa_en_las_Regiones_04 en el mismo caso.
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawLogo(ctx, "white", 108, 91.8, 230);
    fitTitle(ctx, d.pregunta, 108, 570, 830, 1180, 52, 400, "Antonio", COLORS.gold, 62);
    drawLineH(ctx, 108, 1221.3, 864.01, 2, COLORS.gold);
    drawPill(ctx, { x: 100, y: 1289.6, w: 230, h: 55.1, borderHex: COLORS.gold, borderWidth: 1.5,
      boxHex: COLORS.vino, color: COLORS.cream, size: 27, font: "Antonio", weight: 500 }, d.tema);
  },
  // Recompuesto 2026-09-06 contra el XML real (no de memoria): el lema original es
  // texto plano SIN caja/fondo (TextBox 15, sin relleno) — la "pastilla" que llevaba
  // antes era en realidad la geometría del rótulo de categoría del pie (que faltaba
  // por completo en esta lámina). Proporción real: separación corta logo→lema,
  // separación mucho mayor lema→CTA, y al pie la línea + rótulo que sí trae el .pptx.
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawLogo(ctx, "white", 108, 160.1, 360);
    drawLema(ctx, 108, 341, 27, COLORS.cream, "left");                 // texto plano, sin fondo — bloque logo+lema
    drawCtaFijo(ctx, {
      x: 108, top: 484.09, bottom: 898.29, w: 828,                     // rango real (título+cuerpo y=484.09..898.29)
      titleSize: 66, titleFont: "Antonio", titleWeight: 400, titleColor: COLORS.gold, gap: 42,
      bodySize: 40, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 52
    });
    drawLineH(ctx, 108, 1221.3, 864.01, 3, COLORS.gold);               // línea del pie (existe en el XML, faltaba)
    drawPill(ctx, { x: 100, y: 1289.6, w: 268.84, h: 55.1, borderHex: COLORS.gold, borderWidth: 1.5,  // rótulo del pie (existe en el XML, faltaba; ancho real algo mayor que en las otras láminas)
      boxHex: COLORS.vino, color: COLORS.cream, size: 27, font: "Antonio", weight: 500 }, d.tema);
  }
};

// ============================================================================
// PASA-MUNDO-02 — leída de Pasa_en_el_Mundo_02.pptx (Familia 2: Antonio + Source Serif 4).
// ============================================================================
const TPL_pasaMundo02 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    fitTitle(ctx, d.titulo, 108, 175, 760, 360, 76, 700, "Antonio", COLORS.dark, 87, null, "middle");
    if (d.imagen) drawCover(ctx, d.imagen, 108, 560, 864, 690, d.imagenTransform);
    else fillBox(ctx, 108, 560, 864, 690, COLORS.dark, 100);
    drawPill(ctx, { x: 732.73, y: 522, w: 347.27, h: 54, r: 8, boxHex: COLORS.vino,  // ancho fijo real (llega hasta el borde derecho)
      color: COLORS.cream, size: 26, font: "Antonio", weight: 700, padx: 18 }, d.tema.toUpperCase());
    drawLogo(ctx, "vino", 108, 1276.45, 270);
    drawLema(ctx, 108, 1404, 25, COLORS.vino, "left");                  // Lema (FIJO)
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, 0, 135, H, COLORS.vino, 100);                      // Banda lateral
    fillBox(ctx, 208, 280, 12, 830, COLORS.gold, 100);                 // Regla dorada (vertical)
    paragraph(ctx, d.tema.toUpperCase(), 205, 143, 620, "700 26px 'Antonio'", COLORS.gold, 30);
    fitTitle(ctx, d.texto, 270, 220, 690, 1250, 43, 400, "Source Serif 4", COLORS.cream, 54, null, "middle", 40);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 119, 620, "700 26px 'Antonio'", COLORS.gold, 30);
    fillBox(ctx, 82, 300, 8, 720, COLORS.vino, 100);                   // Línea vertical
    fillBox(ctx, 0, 1195, W, 245, COLORS.vino, 100);                   // Banda inferior
    fitTitle(ctx, d.pregunta, 130, 470, 820, 890, 69, 700, "Antonio", COLORS.cream, 76, null, "middle"); // izquierda (real), centrado SOLO en vertical
    paragraph(ctx, "latribunacolombia.co", 280, 1244, 520, "700 27px 'Antonio'", COLORS.gold, 30, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, 0, W, 190, COLORS.vino, 100);                      // Banda superior
    fillBox(ctx, 0, 1250, W, 190, COLORS.gold, 100);                   // Banda inferior
    drawLogo(ctx, "white", 350, 270.08, 380);                          // posición real (Imagen 10: y=270.08, no 235.08)
    drawLema(ctx, 540, 425, 27, COLORS.gold, "center");                 // Lema (FIJO), SIEMPRE debajo del logo (real: pegado, y=401.92)
    drawCtaFijo(ctx, {
      x: 140, top: 510, bottom: 920, w: 800,                           // centrado SOLO verticalmente; alineación horizontal a la izquierda (no centrar texto)
      titleSize: 48, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.cream, gap: 28,
      bodySize: 39, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 50
    });
    fillBox(ctx, 250, 1015, 580, 7, COLORS.gold, 100);                 // Regla final
  }
};

// ============================================================================
// PASA-MUNDO-03 — leída de Pasa_en_el_Mundo_03.pptx (Familia 2, con marco de esquinas).
// ============================================================================
const TPL_pasaMundo03 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 788, W, 652, d.imagenTransform);
    else fillBox(ctx, 0, 788, W, 652, COLORS.dark, 100);
    fillBox(ctx, 0, 788, W, 652, "#7F7F7F", 8);
    drawPill(ctx, { x: 84, y: 96.58, w: 0, h: 60, boxHex: COLORS.gold,        // ancho ajustado al texto real (el .pptx trae "PASA EN EL MUNDO"
      color: COLORS.dark, size: 32, font: "Antonio", weight: 700, padx: 16 }, d.tema.toUpperCase()); // con ~16px de aire por lado; con un tema más corto/largo no debe sobrar ni faltar espacio)
    drawLogo(ctx, "mono:#FFFFFF", 848.1, 96, 133.9);                        // logo real: monograma blanco (no el wordmark)
    fitTitle(ctx, d.titulo, 108, 380, 889.92, 634, 72, 700, "Antonio", COLORS.cream, 76, null, "middle");
    drawLineH(ctx, 128, 709, 769, 2, COLORS.gold);
    drawCornerMarks(ctx, COLORS.gold);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    paragraph(ctx, d.tema.toUpperCase(), 102, 132, 620, "700 32px 'Antonio'", COLORS.gold, 36);
    drawLogo(ctx, "white", 840.34, 81.05, 140.62);
    fitTitle(ctx, d.texto, 120.79, 220, 838.42, 1290, 53, 500, "Source Serif 4", COLORS.cream, 66, null, "middle", 40);
    paragraph(ctx, "www.latribunacolombia.co", 108, 1335, 406.69, "700 28px 'Rajdhani'", COLORS.gold, 32);
    drawCornerMarks(ctx, COLORS.gold);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    paragraph(ctx, "www.latribunacolombia.co", 108, 106, 406.69, "700 28px 'Rajdhani'", COLORS.gold, 32);
    fitTitle(ctx, d.pregunta, 124, 610, 889.92, 940, 72, 700, "Antonio", COLORS.cream, 76);
    drawLineH(ctx, 128, 960, 769, 2, COLORS.gold);
    drawLogo(ctx, "white", 124, 1230.5, 250);                          // real: blanco sobre fondo oscuro, no vino
    drawCornerMarks(ctx, COLORS.gold);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    drawLogo(ctx, "white", 128, 375.77, 600);
    drawLema(ctx, 124, 630, 30, COLORS.gold, "left");                  // Lema (FIJO), debajo del logo
    drawLineH(ctx, 128, 700, 769, 2, COLORS.gold);
    drawCtaFijo(ctx, {
      x: 124, top: 797.15, bottom: 1138.08, w: 865.2,                 // rango real (título+cuerpo y=797.15..1138.08)
      titleSize: 50, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.cream, gap: 30,
      bodySize: 38, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 48
    });
    drawCornerMarks(ctx, COLORS.gold);
  }
};

// ============================================================================
// PASA-MUNDO-04 — leída de Pasa_en_el_Mundo_04.pptx (fondo dorado / bandera de esquina).
// ============================================================================
const TPL_pasaMundo04 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.gold, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 106, 115, 866, 614, d.imagenTransform);
    else fillBox(ctx, 106, 115, 866, 614, COLORS.dark, 100);
    fillBox(ctx, 106, 115, 866, 614, "#7F7F7F", 8);
    // Banda de categoría real (Shape1: x=840.16,y=1198,w=436.91,h=42.77,rot=270°) y su
    // texto real (Text2: x=878.40,y=1090.56,w=364.13,h=40,rot=270°, Antonio 24pt=32px)
    // NO comparten centro: el texto queda desplazado hacia arriba dentro de la banda,
    // no centrado en ella (por eso se dibujan por separado, cada uno con su propio eje).
    drawRotatedRect(ctx, 1058.615, 1219.385, 436.91, 42.77, COLORS.dark);
    drawRotatedText(ctx, 1060.465, 1110.56, 364.13, 40, d.tema.toUpperCase(), "400 32px 'Antonio'", COLORS.gold, 20);
    fitTitle(ctx, d.titulo, 111.32, 836.4, 832.07, 1046.3, 66, 700, "Antonio", COLORS.dark, 70, null, "middle"); // rango real (y=836.4..1046.3): más aire, ya no se comprime
    drawLogo(ctx, COLORS.dark, 42.77, 1236.93, 260);
    drawLema(ctx, 98.5, 1358, 26, COLORS.dark, "left");                // Lema (FIJO)
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.gold, 100);
    fillBox(ctx, 0, 0, 194, 190, COLORS.dark, 100);
    drawLogo(ctx, "mono:#FAF4F2", 38.83, 45.38, 116.35);
    // Misma lógica que portada: banda (Shape1: x=841.54,y=1199.38,w=436.91,h=40) y
    // texto (Text2: x=877.94,y=1080.36,w=364.13,h=40, Antonio 20pt=27px) con centros
    // propios, el texto desplazado hacia arriba dentro de la banda.
    drawRotatedRect(ctx, 1059.995, 1219.38, 436.91, 40, COLORS.dark);
    drawRotatedText(ctx, 1060.005, 1100.36, 364.13, 40, d.tema.toUpperCase(), "400 27px 'Antonio'", COLORS.gold, 20);
    fitTitle(ctx, d.texto, 148.6, 220, 782.8, 1270, 42, 400, "Source Serif 4", COLORS.dark, 47, null, "middle", 40);
    drawLineH(ctx, 108, 1289.69, 542, 2, COLORS.dark);
    paragraph(ctx, "latribunacolombia.co", 108, 1350, 260, "400 28px 'Antonio'", COLORS.dark, 32); // tamaño legible (antes 24px)
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, 0, 194, 190, COLORS.gold, 100);
    drawLogo(ctx, "mono", 42, 61.31, 110);
    fitTitle(ctx, d.pregunta, 260, 545, 659.2, 895, 66, 700, "Antonio", COLORS.cream, 70, null, "middle");
    drawLineH(ctx, 260, 905.23, 560, 2, COLORS.gold);
    paragraph(ctx, "latribunacolombia.co", 260, 971, 260, "400 28px 'Antonio'", COLORS.gold, 32); // tamaño legible (antes 24px)
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, 0, 194, 190, COLORS.gold, 100);
    drawLogo(ctx, "mono", 42, 61.31, 110);
    drawLogo(ctx, "white", 260, 368.02, 560);
    drawLema(ctx, 260, 598, 27, COLORS.gold, "left");                  // Lema (FIJO), debajo del logo
    drawCtaFijo(ctx, {
      x: 260, top: 697.06, bottom: 1076.16, w: 660,                   // rango real (título+cuerpo y=697.06..1076.16)
      titleSize: 58, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.cream, gap: 32,
      bodySize: 32, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 42
    });
    drawLineH(ctx, 260, 1291, 542, 2, COLORS.gold);
  }
};

// ============================================================================
// PASA-REGIONES-01 — leída de Pasa_en_las_Regiones_01.pptx (bloques geométricos).
// ============================================================================
const TPL_pasaRegiones01 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    gradientBox(ctx, 0, 430, W, 1010, [
      { pos_pct: 0,  hex: "#000000", alpha_pct: 0 },
      { pos_pct: 48, hex: "#000000", alpha_pct: 72 },
      { pos_pct: 100, hex: "#000000", alpha_pct: 96 }
    ], 90);
    paragraph(ctx, d.tema.toUpperCase(), 108, 787, 650, "700 26px 'Antonio'", COLORS.gold, 30);
    fitTitle(ctx, d.titulo, 108, 940, 820, 1158, 82, 700, "Antonio", COLORS.cream, 94, null, "middle");
    drawLogo(ctx, "white", 108, 1278.45, 288.24);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 118, 210, 844, 980, COLORS.cream, 100);              // Tarjeta marfil
    fillBox(ctx, 118, 210, 220, 56, COLORS.gold, 100);                // Pestaña dorada
    fillBox(ctx, 820, 1060, 142, 130, COLORS.vino, 100);              // Bloque vino
    paragraph(ctx, d.tema.toUpperCase(), 104, 143, 620, "700 26px 'Antonio'", COLORS.gold, 30);
    fitTitle(ctx, d.texto, 180, 290, 720, 1040, 43, 400, "Source Serif 4", COLORS.dark, 54, null, "middle", 40);
    // Indicador "0N / 0N" — existe en el .pptx real (pie derecho); se numera según la
    // lámina de desarrollo actual, ya que el archivo original no distingue entre
    // numerar solo el desarrollo o el carrusel completo.
    if (d.indice != null) paragraph(ctx, String(d.indice).padStart(2,"0") + " / " + String(d.total).padStart(2,"0"),
      924, 1324, 130, "700 26px 'Antonio'", COLORS.gold, 30, "right");
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 119, 620, "700 26px 'Antonio'", COLORS.gold, 30);
    fillBox(ctx, 86, 300, 908, 760, COLORS.cream, 100);               // Panel marfil
    fillBox(ctx, 86, 300, 180, 180, COLORS.vino, 100);                // Bloque vino
    fillBox(ctx, 814, 880, 180, 180, COLORS.gold, 100);               // Bloque oro
    fitTitle(ctx, d.pregunta, 130, 500, 820, 860, 69, 700, "Antonio", COLORS.dark, 76, null, "middle"); // centrado en la zona libre entre los dos bloques
    paragraph(ctx, "latribunacolombia.co", 280, 1244, 520, "700 25px 'Antonio'", COLORS.gold, 28, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, 0, W, 320, COLORS.vino, 100);                     // Bloque vino superior
    fillBox(ctx, 820, 320, 260, 260, COLORS.gold, 100);               // Bloque oro
    fillBox(ctx, 0, 1180, 390, 260, COLORS.dark, 100);                // Bloque carbón (decorativo)
    // Geometría real (Imagen 12: x=350,y=373.58,w=380,h=131.84) — antes el logo estaba
    // a y=156.73, muy arriba (casi dentro del bloque vino superior); va más abajo, ya
    // fuera de él. El lema real (x=195,y=511.42,w=600,centro=495) queda pegado justo
    // debajo del logo (gap real ≈6px).
    drawLogo(ctx, "white", 350, 373.58, 380);
    drawLema(ctx, 495, 548, 27, COLORS.gold, "center");                // Lema (FIJO), SIEMPRE debajo del logo
    drawCtaFijo(ctx, {
      x: 140, top: 717, bottom: 1127, w: 800,                          // centrado SOLO verticalmente; alineación horizontal a la izquierda
      titleSize: 48, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.cream, gap: 28,
      bodySize: 39, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 50
    });
    fillBox(ctx, 250, 1165, 580, 7, COLORS.gold, 100);                 // posición real (y=1165, no 1015 — más abajo en esta plantilla)
  }
};

// ============================================================================
// PASA-REGIONES-02 — leída de Pasa_en_las_Regiones_02.pptx (vino + círculos dorados).
// ============================================================================
const TPL_pasaRegiones02 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    gradientBox(ctx, 0, 300, W, 1140, [
      { pos_pct: 0,  hex: COLORS.vino, alpha_pct: 0 },
      { pos_pct: 50, hex: COLORS.vino, alpha_pct: 78 },
      { pos_pct: 100, hex: "#5B1712", alpha_pct: 98 }
    ], 90);
    drawPill(ctx, { x: 74.16, y: 94, w: 223.63, h: 40, r: 2, boxHex: COLORS.gold,  // ancho fijo real, esquinas casi rectas
      color: COLORS.dark, size: 26, font: "Antonio", weight: 700, padx: 16 }, d.tema.toUpperCase());
    fitTitle(ctx, d.titulo, 110, 810, 860, 1080, 94, 700, "Antonio", COLORS.cream, 98, "center", "middle");
    drawLogo(ctx, "white", 390, 1221.78, 300);
    drawLema(ctx, 540, 1400, 26, COLORS.gold, "center");               // Lema (FIJO), centrado debajo del logo
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    roundRectFill(ctx, 768, 92, 170, 170, 8, COLORS.gold, 100);        // recuadro real (esquinas casi rectas, NO es un círculo)
    drawLogo(ctx, "mono:#272624", 795, 130, 120);                      // logo real dentro del recuadro dorado
    paragraph(ctx, d.tema.toUpperCase(), 104, 143, 620, "700 26px 'Antonio'", COLORS.gold, 30);
    fitTitle(ctx, d.texto, 104, 220, 820, 1100, 43, 400, "Source Serif 4", COLORS.cream, 54, null, "middle", 40);
    fillBox(ctx, 104, 1120, 680, 7, COLORS.gold, 100);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 119, 620, "700 26px 'Antonio'", COLORS.gold, 30);
    ctx.save(); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 3; ctx.strokeRect(70, 270, 940, 820); ctx.restore();
    ctx.save(); ctx.strokeStyle = COLORS.cream; ctx.lineWidth = 2; ctx.strokeRect(112, 312, 856, 736); ctx.restore();
    fitTitle(ctx, d.pregunta, 150, 360, 780, 1000, 69, 700, "Antonio", COLORS.cream, 76, null, "middle"); // centrado dentro del marco
    paragraph(ctx, "latribunacolombia.co", 280, 1244, 520, "700 25px 'Antonio'", COLORS.gold, 28, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    ctx.save(); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.strokeRect(82, 82, 916, 1276); ctx.restore();
    drawLogo(ctx, "white", 350, 235.08, 380);
    drawLema(ctx, 497, 411, 27, COLORS.gold, "center");                 // Lema (FIJO), SIEMPRE debajo del logo (centro real x=196.9+300=496.9)
    drawCtaFijo(ctx, {
      x: 140, top: 510, bottom: 920, w: 800,                          // centrado SOLO verticalmente; alineación horizontal a la izquierda (no centrar texto)
      titleSize: 48, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.cream, gap: 28,
      bodySize: 39, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 50
    });
    fillBox(ctx, 250, 1015, 580, 7, COLORS.gold, 100);
  }
};

// ============================================================================
// PASA-REGIONES-03 — leída de Pasa_en_las_Regiones_03.pptx (foto oscurecida + cremas planas).
// ============================================================================
const TPL_pasaRegiones03 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    fillBox(ctx, 0, 0, W, H, "#7F7F7F", 8);
    gradientBox(ctx, 0, 0, W, H, [
      { pos_pct: 0,  hex: "#000000", alpha_pct: 19 },
      { pos_pct: 55, hex: "#000000", alpha_pct: 55 },
      { pos_pct: 100, hex: "#000000", alpha_pct: 100 }
    ], 90);
    drawLogo(ctx, "white", 86, 103.61, 237.96);
    drawLema(ctx, 86, 232, 27, COLORS.gold, "left");                   // Lema (FIJO), debajo del logo
    paragraph(ctx, d.tema.toUpperCase(), 126.41, 895, 638, "400 30px 'Antonio'", COLORS.gold, 34);
    fitTitle(ctx, d.titulo, 126.41, 1000, 861.29, 1290, 72, 700, "Antonio", COLORS.cream, 76, null, "middle");
    paragraph(ctx, "@LATRIBUNACOLOMBIA", 126.41, 1349, 327.46, "400 26px 'Antonio'", COLORS.cream, 30);
  },
  // Corregido 2026-09-06: varios colores estaban en vino/rojo — la paleta REAL de este
  // archivo (confirmada en su XML actual) es dorada de punta a punta (C6A465), la misma
  // que en portada; solo la pregunta del CTA del tema usa su propio bronce (BB9145).
  // El vino que aparecía aquí venía arrastrado de Temas_03 (que sí es vino) — plantillas
  // independientes, no deben compartir color.
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 108, 141, 400, "400 32px 'Antonio'", COLORS.gold, 36);
    fitTitle(ctx, d.texto, 108, 220, 782.8, 1300, 72, 700, "Antonio", COLORS.dark, 76, null, "middle", 40);
    paragraph(ctx, "LATRIBUNACOLOMBIA.CO", 108, 1347, 302.95, "400 24px 'Antonio'", COLORS.gold, 27);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 86, 121, 400, "400 32px 'Antonio'", COLORS.dark, 36); // color real: scheme:tx1 (oscuro), no vino
    fitTitle(ctx, d.pregunta, 344, 392, 659.2, 1081, 60, 700, "Antonio", "#BB9145", 66, null, "middle"); // color propio de esta plantilla (no el dorado general)
    drawLogo(ctx, COLORS.gold, 108, 1250.22, 230);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, "@LATRIBUNACOLOMBIA", 86, 121, 400, "400 26px 'Antonio'", COLORS.gold, 30);
    drawLogo(ctx, COLORS.gold, 113.46, 348.92, 600);
    drawLema(ctx, 113.46, 605, 27, COLORS.gold, "left");                // Lema (FIJO), debajo del logo
    drawCtaFijo(ctx, {
      x: 108, top: 642.36, bottom: 981.82, w: 824,                     // rango real (título+cuerpo y=642.36..981.82)
      titleSize: 54, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.dark, gap: 30,
      bodySize: 32, bodyFont: "Source Serif 4", bodyColor: COLORS.gold, bodyLh: 42
    });
  }
};

// ============================================================================
// TEMAS-03 — leída de Temas_03.pptx. Comparte la geometría de Pasa_en_las_Regiones_03
// (confirmado shape por shape: mismas posiciones X/Y/ancho/alto en las 4 láminas),
// pero NO comparte la paleta — su archivo real usa vino donde el otro usa dorado, y
// el logo del CTA del tema tiene otra posición/tamaño. Configuración independiente,
// no un alias, para no arrastrar cambios de un archivo al otro cuando difieren.
// ============================================================================
const TPL_temas03 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    fillBox(ctx, 0, 0, W, H, "#7F7F7F", 8);
    gradientBox(ctx, 0, 0, W, H, [
      { pos_pct: 0,  hex: "#000000", alpha_pct: 19 },
      { pos_pct: 55, hex: "#000000", alpha_pct: 55 },
      { pos_pct: 100, hex: "#000000", alpha_pct: 100 }
    ], 90);
    drawLogo(ctx, "white", 86, 103.61, 237.96);
    drawLema(ctx, 86, 232, 27, COLORS.cream, "left");                   // Lema (FIJO): color propio (crema, no dorado)
    paragraph(ctx, d.tema.toUpperCase(), 126.41, 895, 638, "400 28px 'Antonio'", COLORS.vino, 32); // color y tamaño propios
    fitTitle(ctx, d.titulo, 126.41, 1000, 861.29, 1290, 72, 700, "Antonio", COLORS.cream, 76, null, "middle");
    paragraph(ctx, "@LATRIBUNACOLOMBIA", 126.41, 1349, 327.46, "400 26px 'Antonio'", COLORS.cream, 30);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 86, 145, 400, "400 26px 'Antonio'", COLORS.vino, 30); // tamaño real (26px, no 20)
    fitTitle(ctx, d.texto, 108, 220, 782.8, 1300, 72, 700, "Antonio", COLORS.dark, 76, null, "middle", 40);
    paragraph(ctx, "LATRIBUNACOLOMBIA.CO", 86, 1350, 340, "400 28px 'Antonio'", COLORS.vino, 32); // legible (antes 24px)
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 86, 125, 400, "400 26px 'Antonio'", COLORS.vino, 30); // tamaño real (26px, no 20)
    fitTitle(ctx, d.pregunta, 344, 392, 659.2, 1081, 60, 700, "Antonio", COLORS.vino, 66, null, "middle"); // color propio: vino
    drawLogo(ctx, "vino", 108, 1250.22, 230);                            // misma posición real que el CTA fijo de este archivo
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, "@LATRIBUNACOLOMBIA", 86, 121, 400, "400 26px 'Antonio'", COLORS.vino, 30);
    drawLogo(ctx, "vino", 113.46, 348.92, 600);
    drawLema(ctx, 113.46, 605, 27, COLORS.vino, "left");                // Lema (FIJO), debajo del logo
    drawCtaFijo(ctx, {
      x: 108, top: 655.53, bottom: 1013.74, w: 824,                    // rango real (título+cuerpo y=655.53..1013.74)
      titleSize: 54, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.dark, gap: 30,
      bodySize: 32, bodyFont: "Source Serif 4", bodyColor: COLORS.vino, bodyLh: 42
    });
  }
};

// ============================================================================
// PASA-REGIONES-04 — leída de Pasa_en_las_Regiones_04.pptx (Familia 1, crema).
// El archivo de referencia no trae una lámina de CTA-del-tema distinta: se construye
// con la misma paleta/tipografía de la lámina de desarrollo de este mismo archivo.
// ============================================================================
const TPL_pasaRegiones04 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, 960, d.imagenTransform);
    else fillBox(ctx, 0, 0, W, 960, COLORS.dark, 100);
    fillBox(ctx, 0, 0, W, 960, "#7F7F7F", 8);
    fitTitle(ctx, d.titulo, 103.28, 1060, 873.44, 1252, 78, 700, "Rajdhani", COLORS.dark, 82, null, "middle");
    drawPill(ctx, { x: 90.36, y: 1320, w: 0, h: 49.85, color: COLORS.vino,
      size: 28, font: "Inter Tight", weight: 700, padx: 0 }, d.tema);
    drawLogo(ctx, "vino", 817.54, 1291.38, 200);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 124, 128, 620, "700 26px 'Rajdhani'", COLORS.dark, 30);
    fitTitle(ctx, d.texto, 124, 220, 813.7, 1400, 42, 400, "Inter Tight", COLORS.dark, 48, null, "middle", 40);
    fillBox(ctx, 0, 1414, W, 26, COLORS.vino, 100);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 124, 128, 620, "700 26px 'Rajdhani'", COLORS.dark, 30);
    // Área disponible real: desde justo debajo de la categoría (termina ~158) hasta
    // la franja vino del pie (empieza en 1414) — antes el rango (500-1370) dejaba el
    // centro visual más abajo del centro real del espacio libre, y se veía "abajo".
    fitTitle(ctx, d.pregunta, 124, 200, 813.7, 1400, 52, 700, "Rajdhani", COLORS.vino, 58, null, "middle");
    fillBox(ctx, 0, 1414, W, 26, COLORS.vino, 100);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    drawLogo(ctx, "vino", 124, 400, 600);
    drawLema(ctx, 124, 645, 30, COLORS.vino, "left");                  // Lema (FIJO), debajo del logo
    drawCtaFijo(ctx, {
      x: 124, top: 734.84, bottom: 1060.46, w: 844.6,                 // rango real (título+cuerpo y=734.84..1060.46)
      titleSize: 48, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.dark, gap: 30,
      bodySize: 36, bodyFont: "Inter Tight", bodyColor: COLORS.dark, bodyLh: 46
    });
    fillBox(ctx, 0, 1414, W, 26, COLORS.vino, 100);
  }
};

// ============================================================================
// PUNTOS-VISTA-01 — leída de Puntos_de_Vista_01.pptx. La lámina 3 combina AUTOR
// (foto, nombre, red social) y CTA-del-tema (pregunta) en una sola lámina, tal como
// está en el archivo real — solo se usa en carruseles tipo "Puntos de vista".
// ============================================================================
const TPL_puntosVista01 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    gradientBox(ctx, 0, 360, W, 1080, [
      { pos_pct: 0,  hex: "#000000", alpha_pct: 0 },
      { pos_pct: 48, hex: "#000000", alpha_pct: 60 },
      { pos_pct: 100, hex: "#000000", alpha_pct: 94 }
    ], 90);
    // Banda de categoría real (verificado de nuevo contra el .pptx actual): x=122.1,
    // y=108,w=252.1,h=54, Rajdhani 700 24pt=32px — ancho fijo porque esta línea SOLO
    // usa la categoría "Puntos de vista" (no hay otras opciones de tema aquí).
    drawPill(ctx, { x: 108, y: 108, w: 252.1, fixedW: true, h: 54, r: 7, boxHex: COLORS.gold,
      color: COLORS.dark, size: 32, font: "Rajdhani", weight: 700, padx: 16 }, d.tema.toUpperCase());
    fitTitle(ctx, d.titulo, 108, 850, 850, 1130, 78, 700, "Rajdhani", COLORS.cream, 82, null, "middle");
    drawLogo(ctx, "white", 720, 1240.69, 290);
    drawLema(ctx, 720, 1373, 25, COLORS.gold, "left");                 // Lema (FIJO), texto plano sin fondo
  },
  // Corregido 2026-09-06: el "Marco dorado" del XML (x=78,y=78,w=924,h=1284) tiene
  // el trazo con relleno "none" — es decir, en el PowerPoint real NO se ve ningún
  // borde ahí (confirmado en el XML: line.fill.kind = "none"). No se dibuja.
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, -24, W, 194, COLORS.gold, 100);                    // banda dorada superior ("Etiqueta" del XML)
    paragraph(ctx, d.tema.toUpperCase(), 100.08, 133, 620, "700 37px 'Rajdhani'", COLORS.dark, 42);
    fitTitle(ctx, d.texto, 142, 220, 760, 1080, 45, 400, "Inter Tight", COLORS.cream, 56, null, "middle", 40);
    roundRectFill(ctx, 850, 1110, 80, 80, 8, COLORS.vino, 100);        // recuadro real (esquinas casi rectas, NO es un círculo)
    drawLogo(ctx, "mono:#FAF4F2", 866, 1126, 48);
    paragraph(ctx, "latribunacolombia.co", 724, 1318, 224.5, "700 26px 'Rajdhani'", COLORS.gold, 30, "right");
  },
  // Lámina propia de CTA-del-tema: solo la pregunta (en el .pptx original venía
  // combinada con el autor en una sola lámina; el proyecto exige una lámina de
  // autor aparte, así que aquí queda solo la parte de la pregunta). El "Marco vino"
  // del XML tiene el trazo con relleno "none" (invisible en el PowerPoint real) —
  // no se dibuja.
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    fillBox(ctx, 0, -150, W, 470, COLORS.gold, 100);
    paragraph(ctx, d.tema.toUpperCase(), 116, 224, 500, "700 32px 'Rajdhani'", COLORS.dark, 36);
    // En el .pptx real esta pregunta comparte lámina con el autor (por eso su caja
    // propia es angosta, y=390-640): como aquí es una lámina propia y separada, sin
    // nada más debajo, el "área disponible" real es todo el espacio libre bajo la
    // banda dorada (que termina en y=320) hasta el pie del lienzo.
    fitTitle(ctx, d.pregunta, 130, 340, 820, 1400, 62, 700, "Rajdhani", COLORS.dark, 66, null, "middle");
  },
  // Lámina de autor propia (foto, nombre, red social) — geometría real de la lámina 3
  // del .pptx (foto+nombre+red social; el original combina esto con el CTA del tema,
  // separado aquí por regla del proyecto). Esta lámina NO tiene campo de "perfil/cargo":
  // en su lugar trae una invitación fija a leer la columna completa — se reproduce tal
  // cual, no se inventa un espacio para el perfil que el diseño original no tiene.
  autor(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    fillBox(ctx, 0, -150, W, 470, COLORS.gold, 100);
    paragraph(ctx, (d.tema || "Puntos de vista").toUpperCase(), 116, 224, 500, "700 32px 'Rajdhani'", COLORS.dark, 36);
    const a = d.autor || {};
    fillBox(ctx, 116, 720, 250, 310, COLORS.vino, 100);
    if (a.foto) drawCover(ctx, a.foto, 130, 734, 222, 282, a.transform);
    paragraph(ctx, (a.nombre || "Nombre del autor").toUpperCase(), 410, 760, 490, "700 34px 'Rajdhani'", COLORS.vino, 38);
    paragraph(ctx, a.red || "@usuario", 410, 830, 490, "400 29px 'Inter Tight'", COLORS.dark, 32);
    richWrapParagraph(ctx, [
      { text: "Lea la columna completa en ", font: "400 28px 'Inter Tight'", color: COLORS.dark },
      { text: "latribunacolombia.co.", font: "700 28px 'Inter Tight'", color: COLORS.dark }
    ], 410, 918, 490, 34);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    fillBox(ctx, -43.1, -33, W+90, 187, COLORS.gold, 100);
    drawLogo(ctx, "vino", 350, 235.08, 380);
    drawLema(ctx, 540, 410, 27, COLORS.vino, "center");                 // Lema (FIJO), SIEMPRE debajo del logo
    drawCtaFijo(ctx, {
      x: 140, top: 510, bottom: 920, w: 800,                          // centrado SOLO verticalmente; alineación horizontal a la izquierda
      titleSize: 48, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.dark, gap: 28,
      bodySize: 41, bodyFont: "Inter Tight", bodyColor: COLORS.dark, bodyLh: 52
    });
    fillBox(ctx, 250, 1015, 580, 7, COLORS.gold, 100);
  }
};

// ============================================================================
// PUNTOS-VISTA-02 — leída de Puntos_de_Vista_02.pptx. Este archivo SÍ trae una
// lámina de autor dedicada (su lámina 4): se usa esa, en vez de combinarla con el
// CTA del tema (su lámina 3 queda solo con la pregunta).
// ============================================================================
const TPL_puntosVista02 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    fillBox(ctx, 0, 0, W, H, "#7F7F7F", 8);
    gradientBox(ctx, 0, 425, W, 1015, [
      { pos_pct: 0,  hex: COLORS.dark, alpha_pct: 0 },
      { pos_pct: 46, hex: COLORS.dark, alpha_pct: 90 },
      { pos_pct: 100, hex: COLORS.dark, alpha_pct: 100 }
    ], 90);
    // El tamaño real (32px en una caja de 83px de alto) deja casi toda la caja vacía:
    // el texto ocupa una franja delgada en medio de mucho espacio dorado. Se sube el
    // texto a 40px y se ajusta el alto de la caja a su medida (ya no 83, un resto
    // pensado para 32px) para que el texto sea lo que realmente se note más grande.
    drawPill(ctx, { x: 108, y: 144, w: 0, h: 68, r: 0, boxHex: COLORS.gold,
      color: COLORS.dark, size: 40, font: "Antonio", weight: 400, padx: 20 }, d.tema.toUpperCase());
    fitTitle(ctx, d.titulo, 108, 940, 886.83, 1074, 76, 700, "Antonio", COLORS.cream, 80, null, "middle");
    paragraph(ctx, "LATRIBUNACOLOMBIA.CO", 108, 1228, 365.47, "400 30px 'Antonio'", COLORS.gold, 34);
    drawLogo(ctx, "white", 770, 1075, 250);                           // más grande y ubicado en el espacio libre entre el título (termina en 1074) y la URL (empieza en 1228), sin invadir ninguno
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    drawPill(ctx, { x: 108, y: 144, w: 0, h: 68, r: 0, boxHex: COLORS.gold,  // texto a 40px, caja ajustada a su medida (no al resto de 92px pensado para 32px)
      color: COLORS.dark, size: 40, font: "Antonio", weight: 400, padx: 20 }, d.tema.toUpperCase());
    fitTitle(ctx, d.texto, 108, 250, 864, 1180, 43, 400, "Source Serif 4", COLORS.dark, 54, null, "middle", 40);
    fillBox(ctx, 0, 1199, W, 241, COLORS.gold, 100);
    paragraph(ctx, "latribunacolombia.co", 108, 1334, 375.69, "400 32px 'Antonio'", COLORS.dark, 36);
    drawLogo(ctx, COLORS.dark, 855, 1262, 117);
  },
  // Esta lámina trae en el .pptx real una firma pequeña del autor (foto circular +
  // nombre + red social/cargo) al pie, además de la lámina de autor completa aparte
  // — se reproduce tal cual, no se omite por existir ya la lámina de autor dedicada.
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    drawPill(ctx, { x: 108, y: 144, w: 0, h: 68, r: 0, boxHex: COLORS.gold,  // texto a 40px, caja ajustada a su medida (no al resto de 92px pensado para 32px)
      color: COLORS.dark, size: 40, font: "Antonio", weight: 400, padx: 20 }, d.tema.toUpperCase());
    fitTitle(ctx, d.pregunta, 112, 570, 889.92, 1180, 80, 700, "Antonio", COLORS.gold, 84);
    fillBox(ctx, 0, 1199, W, 241, COLORS.gold, 100);
    const a = d.autor || {};
    ctx.save(); ctx.beginPath(); ctx.arc(184.5, 1323.5, 76.5, 0, Math.PI*2); ctx.clip();
    if (a.foto) drawCover(ctx, a.foto, 108, 1247, 153, 153, a.transform); else fillBox(ctx, 108, 1247, 153, 153, COLORS.dark, 100);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(184.5, 1323.5, 76.5, 0, Math.PI*2); ctx.strokeStyle = COLORS.dark; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    paragraph(ctx, a.nombre || "Nombre del autor", 285, 1288, 700, "700 40px 'Antonio'", COLORS.dark, 44);
    paragraph(ctx, (a.red || "@usuario") + (a.perfil ? " · " + a.perfil : ""), 285, 1345, 700,
      "700 26px 'Source Serif 4'", COLORS.cream, 30);
  },
  // Lámina de autor propia (lámina 4 del archivo real: foto + nombre + red social).
  // No lleva categoría: esa etiqueta es de las láminas de contenido, no de esta.
  autor(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.gold, 100);
    const a = d.autor || {};
    ctx.save(); ctx.beginPath(); ctx.arc(293, 565, 180, 0, Math.PI*2); ctx.clip();       // foto circular real (no cuadrada)
    if (a.foto) drawCover(ctx, a.foto, 113, 385, 360, 360, a.transform); else fillBox(ctx, 113, 385, 360, 360, COLORS.dark, 100);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(293, 565, 180, 0, Math.PI*2); ctx.strokeStyle = COLORS.cream; ctx.lineWidth = 8; ctx.stroke(); ctx.restore();
    paragraph(ctx, a.nombre || "Nombre del autor", 108, 890, 824, "700 92px 'Antonio'", COLORS.dark, 96);
    paragraph(ctx, a.red || "@usuario", 108, 970, 700, "700 36px 'Source Serif 4'", COLORS.vino, 40);
    paragraph(ctx, a.perfil || "", 108, 1030, 824, "400 34px 'Source Serif 4'", COLORS.dark, 44);
    fillBox(ctx, 0, 1199, W, 241, COLORS.cream, 100);
    paragraph(ctx, "LATRIBUNACOLOMBIA.CO", 119, 1318, 365.47, "400 30px 'Antonio'", COLORS.dark, 34);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    drawLogo(ctx, COLORS.dark, 40.62, 364.82, 537.23);
    drawLema(ctx, 119, 570, 30, COLORS.dark, "left");                  // Lema (FIJO), debajo del logo
    drawCtaFijo(ctx, {
      x: 108, top: 670, bottom: 918.83, w: 890,                       // rango real (título+cuerpo y=670..918.83)
      titleSize: 64, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.dark, gap: 30,
      bodySize: 38, bodyFont: "Source Serif 4", bodyColor: COLORS.dark, bodyLh: 48
    });
    fillBox(ctx, 0, 1199, W, 241, COLORS.gold, 100);
    paragraph(ctx, "LATRIBUNACOLOMBIA.CO", 119, 1318, 365.47, "400 30px 'Antonio'", COLORS.dark, 34);
  }
};

function drawDotsRow(ctx, x, y, n, gap, r, hex){
  for (let i = 0; i < n; i++){
    ctx.save(); ctx.beginPath(); ctx.arc(x + i*gap + r, y + r, r, 0, Math.PI*2); ctx.fillStyle = hex; ctx.fill(); ctx.restore();
  }
}
// ============================================================================
// PURA-PAJA-01 — leída de Pura_Paja_01.pptx (motivo de puntos, tono ligero).
// La cámara y el recorte de periódico son imágenes reales del .pptx (extraídas e
// incorporadas a assets/img/), no un motivo genérico.
// ============================================================================
const TPL_puraPaja01 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    if (ASSETS.ppPeriodico) ctx.drawImage(ASSETS.ppPeriodico, 314.38, 743, 751.24, 470);
    if (ASSETS.ppCamara) ctx.drawImage(ASSETS.ppCamara, 580, 194.48, 440, 381.03);
    paragraph(ctx, d.tema.toUpperCase(), 72, 100, 430, "700 26px 'Rajdhani'", COLORS.gold, 30);
    // El ancho real (620) llega hasta x=690, dentro de la imagen de la cámara (que
    // empieza en x=580): en el .pptx real el título de ejemplo es corto y solo la roza,
    // pero un título más largo (varias líneas) queda tapado por la cámara. Se limita el
    // ancho a 480 (hasta x=550, antes de la imagen) para que NINGÚN título, sin importar
    // su longitud, quede debajo de ella.
    fitTitle(ctx, d.titulo, 70, 238, 480, 858, 98, 700, "Rajdhani", COLORS.cream, 102, null, "middle");
    drawLogo(ctx, "white", 72, 1236.47, 288.24);
    drawLema(ctx, 72, 1365, 25, COLORS.cream, "left");                 // Lema (FIJO)
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    fillBox(ctx, 0, 0, W, 250, COLORS.vino, 100);
    fillBox(ctx, 0, 1180, W, 260, COLORS.dark, 100);
    drawDotsRow(ctx, 800, 134, 5, 44, 9, COLORS.gold);
    paragraph(ctx, d.tema.toUpperCase(), 104, 138, 620, "700 26px 'Rajdhani'", COLORS.cream, 30);
    fitTitle(ctx, d.texto, 104, 290, 850, 1160, 45, 400, "Inter Tight", COLORS.dark, 57, null, "middle", 40);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 119, 620, "700 26px 'Rajdhani'", COLORS.gold, 30);
    fillBox(ctx, 55, 250, 970, 900, COLORS.cream, 100);                // "Explosión" — rectángulo real, esquinas rectas
    ctx.save(); ctx.strokeStyle = COLORS.dark; ctx.lineWidth = 5; ctx.strokeRect(55, 250, 970, 900); ctx.restore(); // borde real (existe en el XML, faltaba)
    fillBox(ctx, 55, 1010, 970, 140, COLORS.dark, 100);
    for (let i = 0; i < 6; i++) fillBox(ctx, 120 + i*140, 1080, 75, 8, COLORS.gold, 100); // 6 rayas reales (NO son puntos/círculos)
    fitTitle(ctx, d.pregunta, 130, 470, 820, 890, 69, 700, "Rajdhani", COLORS.dark, 76, "center", "middle"); // centrado (real)
    paragraph(ctx, "latribunacolombia.co", 280, 1244, 520, "700 25px 'Rajdhani'", COLORS.gold, 28, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    fillBox(ctx, 0, 0, W, 240, COLORS.vino, 100);
    fillBox(ctx, 0, 1170, W, 270, COLORS.dark, 100);
    drawDotsRow(ctx, 95, 1240, 5, 48, 9, COLORS.gold);
    drawLogo(ctx, "vino", 350, 304.08, 380);
    drawLema(ctx, 540, 468, 27, COLORS.vino, "center");                // Lema (FIJO), SIEMPRE debajo del logo
    drawCtaFijo(ctx, {
      x: 140, top: 510, bottom: 920, w: 800,                          // centrado SOLO verticalmente; alineación horizontal a la izquierda
      titleSize: 48, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.dark, gap: 28,
      bodySize: 39, bodyFont: "Inter Tight", bodyColor: COLORS.dark, bodyLh: 50
    });
    fillBox(ctx, 250, 1015, 580, 7, COLORS.gold, 100);
  }
};

function strokeCircle(ctx, cx, cy, r, thicknessPx, hex){
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.strokeStyle = hex; ctx.lineWidth = thicknessPx; ctx.stroke(); ctx.restore();
}
// ============================================================================
// QUE-PASA-01 — leída de Que_esta_pasando_01.pptx (aros concéntricos).
// ============================================================================
const TPL_quePasa01 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 850, W, 590, d.imagenTransform);
    else fillBox(ctx, 0, 850, W, 590, COLORS.dark, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 165, 720, "700 27px 'Rajdhani'", COLORS.gold, 30);
    fillBox(ctx, 82, 590, 58, 61, COLORS.gold, 100);
    fitTitle(ctx, d.titulo, 82, 245, 875, 535, 76, 700, "Rajdhani", COLORS.cream, 88, null, "middle");
    drawLogo(ctx, "white", 82.12, 1252, 299.76);
    drawLema(ctx, 82, 1390, 19, COLORS.cream, "left");                 // Lema (FIJO)
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 112, 168, 720, "700 27px 'Rajdhani'", COLORS.vino, 30);
    fitTitle(ctx, d.texto, 112, 250, 856, 1000, 45, 400, "Inter Tight", COLORS.dark, 57, null, "middle", 40);
    drawPill(ctx, { x: 112, y: 1018, w: 226.94, h: 39.96, r: 0, boxHex: COLORS.gold,  // freeform del .pptx: esquinas rectas, no una cápsula
      color: COLORS.dark, size: 22, font: "Rajdhani", weight: 700, padx: 14 }, "La Tribuna Colombia");
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    strokeCircle(ctx, 540, 707, 612, 2, COLORS.gold);
    strokeCircle(ctx, 540, 707, 472, 2, COLORS.cream);
    strokeCircle(ctx, 540, 707, 330, 2, COLORS.gold);
    fitTitle(ctx, d.pregunta, 254, 590, 572, 840, 55, 700, "Rajdhani", COLORS.cream, 60, "center");
    // El elemento real aquí NO es un texto plano "latribunacolombia.co": es el mismo
    // sello dorado "La Tribuna Colombia" que aparece en el resto de láminas de esta
    // plantilla, con su tamaño real fijo: 6cm x 1.06cm = 226.94 x 39.96px.
    drawPill(ctx, { centerX: 540, y: 915.04, w: 226.94, fixedW: true, h: 39.96, r: 0, boxHex: COLORS.gold,
      color: COLORS.dark, size: 22, font: "Rajdhani", weight: 700, textAlign: "center" }, "La Tribuna Colombia");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawLogo(ctx, "white", 618, 146.05, 360);
    drawCtaFijo(ctx, {
      x: 108, top: 510.53, bottom: 967.03, w: 844.16,                 // rango real (título+cuerpo y=510.53..967.03)
      titleSize: 68, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.gold, gap: 34,
      bodySize: 42, bodyFont: "Inter Tight", bodyColor: COLORS.cream, bodyLh: 54
    });
    // Texto real plano, SIN caja (TextBox 6: fill sin relleno, como el resto de
    // "TextBox N" de este archivo) — no es un banner.
    paragraph(ctx, "Latribunacolombia.co", 108 + 430/2, 1008 + 86/2 + 23*0.35, 430, "700 31px 'Rajdhani'", COLORS.cream, 36, "center");
    // Sello dorado real "La Tribuna Colombia", mismo tamaño fijo en todas las láminas: 6cm x 1.06cm = 226.94 x 39.96px.
    drawPill(ctx, { x: 108, y: 1313.53, w: 226.94, fixedW: true, h: 39.96, r: 0, boxHex: COLORS.gold,
      color: COLORS.dark, size: 22, font: "Rajdhani", weight: 700, textAlign: "center" }, "La Tribuna Colombia");
  }
};

// ============================================================================
// QUE-PASA-02 — leída de Que_esta_pasando_02.pptx (corchetes / marco quebrado).
// ============================================================================
const TPL_quePasa02 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    else fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    gradientBox(ctx, 0, 0, W, H, [
      { pos_pct: 0,  hex: COLORS.cream, alpha_pct: 0 },
      { pos_pct: 28, hex: COLORS.cream, alpha_pct: 12 },
      { pos_pct: 55, hex: COLORS.cream, alpha_pct: 90 },
      { pos_pct: 100, hex: COLORS.cream, alpha_pct: 100 }
    ], 90);
    drawPill(ctx, { x: 72, y: 78, w: 0, h: 47, r: 7, boxHex: COLORS.vino,   // ancho ajustado al texto real (el tema varía; con "QUÉ ESTÁ PASANDO" da 296.33, como el original, pero no se queda fijo con temas más cortos)
      color: COLORS.cream, size: 22, font: "Rajdhani", weight: 700, padx: 18 }, d.tema.toUpperCase());
    fitTitle(ctx, d.titulo, 110, 780, 860, 1020, 92, 700, "Rajdhani", COLORS.dark, 96, "center", "middle");
    fillBox(ctx, 410, 1040, 260, 7, COLORS.vino, 100);
    drawLogo(ctx, "vino", 390, 1189.96, 300);
    drawLema(ctx, 540, 1358, 25, COLORS.dark, "center");               // Lema (FIJO)
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 64, 64, 952, 1312, COLORS.cream, 100);
    fillBox(ctx, 64, 64, 952, 118, COLORS.dark, 100);
    fillBox(ctx, 64, 1258, 952, 118, COLORS.vino, 100);
    paragraph(ctx, d.tema.toUpperCase(), 104, 143, 620, "700 26px 'Rajdhani'", COLORS.cream, 30);
    fitTitle(ctx, d.texto, 130, 260, 820, 1230, 45, 400, "Inter Tight", COLORS.dark, 57, null, "middle", 40);
    paragraph(ctx, "latribunacolombia.co", 685.71, 1308, 289.29, "700 32px 'Rajdhani'", COLORS.cream, 36);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 119, 620, "700 26px 'Rajdhani'", COLORS.vino, 30);
    fillBox(ctx, 80, 320, 18, 670, COLORS.vino, 100);                  // corchete izquierdo
    fillBox(ctx, 80, 320, 170, 18, COLORS.vino, 100);                  // corchete superior
    fillBox(ctx, 982, 320, 18, 670, COLORS.vino, 100);                 // corchete derecho
    fillBox(ctx, 830, 972, 170, 18, COLORS.vino, 100);                 // corchete inferior
    fitTitle(ctx, d.pregunta, 130, 470, 820, 890, 69, 700, "Rajdhani", COLORS.cream, 76, null, "middle"); // centrado SOLO en vertical, alineado a la izquierda (real)
    paragraph(ctx, "latribunacolombia.co", 280, 1244, 520, "700 32px 'Rajdhani'", COLORS.vino, 36, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 0, 0, 72, H, COLORS.vino, 100);
    fillBox(ctx, 1008, 0, 72, H, COLORS.vino, 100);
    drawLogo(ctx, "white", 350, 235.08, 380);
    drawLema(ctx, 540, 410, 27, COLORS.gold, "center");                 // Lema (FIJO), SIEMPRE debajo del logo
    drawCtaFijo(ctx, {
      x: 140, top: 564.86, bottom: 974.86, w: 800,                    // centrado SOLO verticalmente; alineación horizontal a la izquierda
      titleSize: 48, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.cream, gap: 28,
      bodySize: 39, bodyFont: "Inter Tight", bodyColor: COLORS.cream, bodyLh: 50
    });
    fillBox(ctx, 250, 1015, 580, 7, COLORS.vino, 100);
  }
};

// ============================================================================
// QUE-PASA-03 — leída de Que_esta_pasando_03.pptx (Familia 2, badge a caballo sobre la foto).
// ============================================================================
const TPL_quePasa03 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fitTitle(ctx, d.titulo, 108, 260, 864, 470, 64, 700, "Antonio", COLORS.cream, 68, null, "middle");
    if (d.imagen) drawCover(ctx, d.imagen, 108, 589, 864, 691, d.imagenTransform);
    else fillBox(ctx, 108, 589, 864, 691, "#3a3733", 100);
    fillBox(ctx, 108, 589, 864, 691, "#7F7F7F", 8);
    drawPill(ctx, { centerX: 824.77, y: 552.38, w: 0, h: 71.85, r: 0, boxHex: COLORS.gold,  // ancho ajustado al texto (298.15 era fijo, sobraba con temas cortos)
      color: COLORS.dark, size: 22, font: "Antonio", weight: 700, padx: 22 }, d.tema);
    paragraph(ctx, "latribunacolombia.co", 108, 1360, 240.88, "400 24px 'Antonio'", COLORS.gold, 27);
    drawLogo(ctx, "white", 857.32, 1299, 117.36);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawPill(ctx, { x: 92.85, y: 205.85, w: 0, h: 35, r: 0, boxHex: COLORS.gold,  // ancho ajustado al texto (257.88 era fijo, sobraba con temas cortos)
      color: COLORS.dark, size: 22, font: "Antonio", weight: 700, padx: 14 }, d.tema);
    fitTitle(ctx, d.texto, 134.31, 260, 811.38, 1270, 43, 400, "Source Serif 4", COLORS.cream, 54, null, "middle", 40);
    fillBox(ctx, 108, 1291, 542, 2, COLORS.gold, 100);
    paragraph(ctx, "latribunacolombia.co", 108, 1349, 240.88, "400 24px 'Antonio'", COLORS.gold, 27);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.gold, 100);
    drawPill(ctx, { x: 91, y: 204, w: 0, h: 35, r: 0, boxHex: COLORS.dark,  // ancho ajustado al texto (257.88 era fijo, sobraba con temas cortos)
      color: COLORS.gold, size: 22, font: "Antonio", weight: 700, padx: 14 }, d.tema);
    fitTitle(ctx, d.pregunta, 109, 485.8, 782.8, 781, 58, 700, "Antonio", COLORS.dark, 62, null, "middle"); // rango real (y=485.8,h=295.2): centrado en vertical, izquierda (real)
    fillBox(ctx, 108, 1291, 542, 2, COLORS.dark, 100);
    paragraph(ctx, "latribunacolombia.co", 108, 1349, 240.88, "400 24px 'Antonio'", COLORS.dark, 27);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawLogo(ctx, "white", 108, 346.7, 600);
    drawLema(ctx, 123.87, 605, 27, COLORS.gold, "left");               // Lema (FIJO), debajo del logo
    drawCtaFijo(ctx, {
      x: 108, top: 722.46, bottom: 1062.95, w: 836,                   // rango real (título+cuerpo y=722.46..1062.95)
      titleSize: 50, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.cream, gap: 30,
      bodySize: 34, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 44
    });
    fillBox(ctx, 108, 1291, 542, 2, COLORS.gold, 100);
    paragraph(ctx, "latribunacolombia.co", 108, 1349, 240.88, "400 24px 'Antonio'", COLORS.gold, 27);
  }
};

// ============================================================================
// TEMAS-01 — leída de Temas_01.pptx (Familia 2, tarjeta vino con marco desplazado).
// ============================================================================
const TPL_temas01 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 106, 108, 866, 576, d.imagenTransform);
    else fillBox(ctx, 106, 108, 866, 576, COLORS.dark, 100);
    fitTitle(ctx, d.titulo, 108, 850, 720, 1000, 78, 700, "Antonio", COLORS.dark, 82, null, "middle");
    fillBox(ctx, 108, 1128, 542, 3, COLORS.vino, 100);
    drawPill(ctx, { x: 770, y: 1103, w: 310, h: 54, r: 8, boxHex: COLORS.vino, // ancho fijo real, alineada con la línea roja
      color: COLORS.cream, size: 26, font: "Antonio", weight: 700, padx: 18 }, d.tema.toUpperCase());
    drawLogo(ctx, "vino", 108, 1250.9, 290);
    drawLema(ctx, 106, 1384, 25, COLORS.vino, "left");                 // Lema (FIJO)
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    drawFrame(ctx, 70, 70, 940, 1300, 2, COLORS.vino);
    fillBox(ctx, 70, 70, 940, 88, COLORS.vino, 100);
    paragraph(ctx, d.tema.toUpperCase(), 104, 135, 620, "700 26px 'Antonio'", COLORS.cream, 30);
    fitTitle(ctx, d.texto, 120, 220, 760, 1270, 43, 400, "Source Serif 4", COLORS.dark, 54, null, "middle", 40);
    paragraph(ctx, "latribunacolombia.co", 724, 1319, 251, "700 27px 'Antonio'", COLORS.vino, 30);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.cream, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 119, 620, "700 26px 'Antonio'", COLORS.vino, 30);
    drawFrame(ctx, 58, 276, 916, 760, 3, "#FFFFFF");                   // blanco puro (bg1 real), distinto del fondo marfil de la página
    fillBox(ctx, 82, 300, 916, 760, COLORS.vino, 100);
    fitTitle(ctx, d.pregunta, 150, 380, 780, 980, 69, 700, "Antonio", COLORS.cream, 76, null, "middle"); // centrado SOLO en vertical dentro del bloque vino, alineado a la izquierda
    paragraph(ctx, "DESLICE PARA CONTINUAR", 280, 1244, 520, "700 25px 'Antonio'", COLORS.vino, 28, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    fillBox(ctx, 74, 74, 260, 40, COLORS.vino, 100);
    drawLogo(ctx, "white", 350, 235.08, 380);
    drawLema(ctx, 540, 410, 27, COLORS.gold, "center");                 // Lema (FIJO), SIEMPRE debajo del logo
    drawCtaFijo(ctx, {
      x: 140, top: 535.47, bottom: 945.47, w: 800,                    // centrado SOLO verticalmente; alineación horizontal a la izquierda
      titleSize: 48, titleFont: "Antonio", titleWeight: 700, titleColor: COLORS.cream, gap: 28,
      bodySize: 39, bodyFont: "Source Serif 4", bodyColor: COLORS.cream, bodyLh: 50
    });
    fillBox(ctx, 250, 1015, 580, 7, COLORS.vino, 100);
  }
};

// Dos "L" diagonales (esquina superior-izq + inferior-der), cada una de su color —
// motivo asimétrico repetido en Temas_02.
function drawCornerMarksDiag(ctx, hexTL, hexBR){
  fillBox(ctx, 62, 62, 180, 12, hexTL, 100);
  fillBox(ctx, 62, 62, 12, 180, hexTL, 100);
  fillBox(ctx, 838, 1366, 180, 12, hexBR, 100);
  fillBox(ctx, 1006, 1198, 12, 180, hexBR, 100);
}
// ============================================================================
// TEMAS-02 — leída de Temas_02.pptx (Familia 1, esquinas diagonales oro/vino).
// ============================================================================
const TPL_temas02 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 780, W, 660, d.imagenTransform);
    else fillBox(ctx, 0, 780, W, 660, "#3a3733", 100);
    drawPill(ctx, { x: 84, y: 92, w: 236, h: 54, r: 8, boxHex: COLORS.gold,   // ancho fijo real del .pptx
      color: COLORS.dark, size: 26, font: "Rajdhani", weight: 700, padx: 18 }, d.tema.toUpperCase());
    fitTitle(ctx, d.titulo, 126, 400, 830, 690, 78, 700, "Rajdhani", COLORS.gold, 82, null, "middle");
    fillBox(ctx, 98, 720, 872, 12.27, COLORS.gold, 100);
    drawLogo(ctx, "white", 760, 74.9, 260);
    drawLema(ctx, 760, 205, 25, COLORS.cream, "left");                 // Lema (FIJO), debajo del logo
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawCornerMarksDiag(ctx, COLORS.gold, COLORS.vino);
    paragraph(ctx, (d.tema || "Tema").toUpperCase(), 104, 143, 620, "700 26px 'Rajdhani'", COLORS.gold, 30);
    fitTitle(ctx, d.texto, 104, 260, 790, 1180, 45, 400, "Inter Tight", COLORS.cream, 57, null, "middle", 40);
    paragraph(ctx, "latribunacolombia.co", 750.37, 1324, 224.63, "700 28px 'Rajdhani'", COLORS.gold, 32);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    paragraph(ctx, d.tema.toUpperCase(), 82, 119, 620, "700 26px 'Rajdhani'", COLORS.gold, 30);
    fillBox(ctx, 0, 250, W, 900, COLORS.gold, 100);
    fitTitle(ctx, d.pregunta, 130, 470, 820, 890, 69, 700, "Rajdhani", COLORS.dark, 76, null, "middle"); // centrado SOLO en vertical, alineado a la izquierda (ya lo estaba)
    paragraph(ctx, "latribunacolombia.co", 280, 1244, 520, "700 25px 'Rajdhani'", COLORS.dark, 28, "center");
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.dark, 100);
    drawCornerMarksDiag(ctx, COLORS.gold, COLORS.vino);
    drawLogo(ctx, "white", 350, 235.08, 380);
    drawLema(ctx, 540, 410, 27, COLORS.gold, "center");                 // Lema (FIJO), SIEMPRE debajo del logo
    drawCtaFijo(ctx, {
      x: 140, top: 510, bottom: 920, w: 800,                          // centrado SOLO verticalmente; alineación horizontal a la izquierda
      titleSize: 48, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.cream, gap: 28,
      bodySize: 39, bodyFont: "Inter Tight", bodyColor: COLORS.cream, bodyLh: 50
    });
    fillBox(ctx, 250, 1015, 580, 7, COLORS.gold, 100);
  }
};

function drawBubble(ctx, cx, cy, r, hex, pct){
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = rgba(hex, pct); ctx.fill(); ctx.restore();
}
// ============================================================================
// TEMAS-04 — leída de Temas_04.pptx (Familia 1, vino con burbujas doradas translúcidas).
// ============================================================================
const TPL_temas04 = {
  portada(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    if (d.imagen) drawCover(ctx, d.imagen, 0, 0, W, H, d.imagenTransform);
    gradientBox(ctx, 0, 0, W, H, [
      { pos_pct: 0,  hex: COLORS.vino, alpha_pct: 15 },
      { pos_pct: 57, hex: COLORS.vino, alpha_pct: 96 },
      { pos_pct: 100, hex: COLORS.vino, alpha_pct: 100 }
    ], 90);
    drawBubble(ctx, 921+322.5, 990+322.5, 322.5, COLORS.gold, 28);
    drawBubble(ctx, -446+322.5, 990+322.5, 322.5, COLORS.gold, 28);
    // Puntos reales (círculos, no cuadrados): uno junto al inicio del título, otro
    // junto a la categoría, y uno puramente decorativo cerca del círculo derecho.
    drawBubble(ctx, 136.23, 840.08, 21, COLORS.gold, 100);
    drawBubble(ctx, 247.90, 1254.19, 21, COLORS.gold, 100);
    drawBubble(ctx, 900, 1101, 21, COLORS.gold, 100);
    drawLogo(ctx, "mono:#FAF4F2", 88.23, 108.31, 96);                  // logo real de esta plantilla (monograma, no el wordmark)
    // Rango real de la categoría (y=1219.62,h=74 → centro en 1256.62), para que quede
    // a la altura del punto que la acompaña (y=1254.19), no más arriba que él.
    fitTitle(ctx, (d.tema || "Temas").toUpperCase(), 296.81, 1219.62, 566.5, 1293.62, 40, 700, "Rajdhani", COLORS.gold, 44, null, "middle"); // alineado a la izquierda (real, no centrado)
    // Título real: x=184.23,y=819.08,w=766.54,h=323.92, vAnchor TOP (no middle) — el
    // bloque empieza exactamente en y=819.08, no se centra en un rango más bajo.
    fitTitle(ctx, d.titulo.toUpperCase(), 184.23, 819.08, 766.54, 1143, 60, 700, "Rajdhani", COLORS.cream, 64);
  },
  desarrollo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    drawBubble(ctx, 805+322.5, 1126+322.5, 322.5, COLORS.gold, 28);
    fillBox(ctx, 64, 64, 92, 92, COLORS.gold, 100);                    // cuadrado real (fondo del logo, no un punto)
    drawLogo(ctx, "mono", 78, 90.41, 64);                              // logo real de esta plantilla (monograma)
    // Cuerpo real: x=196,y=608.77, vAnchor TOP (no middle) — empieza exactamente ahí,
    // junto al punto amarillo (círculo, no cuadrado) que marca su inicio, pegado a su
    // izquierda a la misma altura de la primera línea.
    drawBubble(ctx, 127, 637, 21, COLORS.gold, 100);
    fitTitle(ctx, d.texto, 196, 608.77, 721, 880.58, 40, 400, "Inter Tight", COLORS.cream, 51, null, null, 40);
    drawBubble(ctx, 145, 1253.38, 21, COLORS.gold, 100);               // punto real (círculo) junto a la categoría
    // y=1220 era el TOP real del texto (paragraph() dibuja por línea de base, no por
    // tope) — quedaba ~35px por encima de donde debía, separado del punto. Convertido
    // a línea de base real (top + altura de mayúsculas) para que quede a su altura.
    paragraph(ctx, (d.tema || "Temas").toUpperCase(), 196, 1255, 566.5, "700 44px 'Rajdhani'", COLORS.gold, 48);
  },
  ctaTema(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    drawBubble(ctx, -431+322.5, 306+322.5, 322.5, COLORS.gold, 28);
    drawBubble(ctx, 870+322.5, 54+322.5, 322.5, COLORS.gold, 28);
    fillBox(ctx, 64, 64, 92, 92, COLORS.gold, 100);
    drawLogo(ctx, "mono", 78, 90.41, 64);                              // logo real de esta plantilla (monograma)
    // Alineación real: DERECHA (no centrado). Las dos circunferencias ocupan x=-431..214
    // (izquierda) y x=870..1515 (derecha): el bloque se acota a x=224..854, el único
    // rango horizontal que no cae dentro de ninguna de las dos, sin importar cuántas
    // líneas ocupe. Centrado SOLO en vertical, en el área real disponible de la lámina.
    fitTitle(ctx, d.pregunta, 224, 200, 630, 1150, 48, 400, "Inter Tight", COLORS.gold, 60, "right", "middle");
    // Punto ubicado relativo a donde realmente empezó el bloque (que varía según el
    // texto), arriba de la primera línea — así nunca tapa letras ni entra en ninguna
    // de las dos circunferencias (queda en x=854, dentro del rango seguro).
    drawBubble(ctx, 854, fitTitle.lastStartY - fitTitle.lastCapHeight - 16, 21, COLORS.gold, 100);
    drawLogo(ctx, "white", 400, 1192.86, 280);
  },
  ctaFijo(ctx, d){
    fillBox(ctx, 0, 0, W, H, COLORS.vino, 100);
    drawBubble(ctx, 805+322.5, 1126+322.5, 322.5, COLORS.gold, 28);
    drawBubble(ctx, -431+322.5, -120+322.5, 322.5, COLORS.gold, 28);
    drawLogo(ctx, "white", 260, 400, 560);
    drawLema(ctx, 540, 622, 30, COLORS.gold, "center");                // Lema (FIJO), debajo del logo
    drawCtaFijo(ctx, {
      x: 128, top: 751.75, bottom: 1062.38, w: 824,                   // alineación horizontal original a la izquierda; centrado SOLO en el eje vertical
      titleSize: 48, titleFont: "Rajdhani", titleWeight: 700, titleColor: COLORS.cream, gap: 30,
      bodySize: 46, bodyFont: "Inter Tight", bodyColor: COLORS.cream, bodyLh: 58
    });
  }
};

// ===== Catálogo real (se completa plantilla por plantilla) =====
const TEMPLATES = {
  "especiales-01": TPL_especiales01,
  "especiales-02": TPL_especiales02,
  "pasa-mundo-01": TPL_pasaMundo01,
  "pasa-mundo-02": TPL_pasaMundo02,
  "pasa-mundo-03": TPL_pasaMundo03,
  "pasa-mundo-04": TPL_pasaMundo04,
  "pasa-regiones-01": TPL_pasaRegiones01,
  "pasa-regiones-02": TPL_pasaRegiones02,
  "pasa-regiones-03": TPL_pasaRegiones03,
  "pasa-regiones-04": TPL_pasaRegiones04,
  "puntos-vista-01": TPL_puntosVista01,
  "puntos-vista-02": TPL_puntosVista02,
  "pura-paja-01": TPL_puraPaja01,
  "que-pasa-01": TPL_quePasa01,
  "que-pasa-02": TPL_quePasa02,
  "que-pasa-03": TPL_quePasa03,
  "temas-01": TPL_temas01,
  "temas-02": TPL_temas02,
  // Temas_03.pptx comparte la geometría de Pasa_en_las_Regiones_03.pptx pero NO su
  // paleta (confirmado en el XML real de ambos archivos) — configuración propia,
  // ver TPL_temas03 arriba. Ya no es un alias del otro template.
  "temas-03": TPL_temas03,
  "temas-04": TPL_temas04
};

// Plantilla de relleno para ids que aún no tienen diseño cargado.
function placeholderTpl(ctx, kind, d){
  fillBox(ctx, 0, 0, W, H, "#3B3937", 100);
  paragraph(ctx, "PENDIENTE DE DISEÑO", 90, 120, 900, "700 32px 'Rajdhani'", "#C8B79A", 36);
  if (kind === "portada") fitTitle(ctx, d.titulo, 90, 700, 900, 1200, 64, 700, "Rajdhani", "#F0EAE0", 70);
  if (kind === "lamina") paragraph(ctx, d.texto, 90, 700, 900, "400 40px 'Inter Tight'", "#F0EAE0", 52);
  if (kind === "autor" && d.autor) paragraph(ctx, (d.autor.nombre || "Nombre del autor"), 90, 700, 900, "700 48px 'Rajdhani'", "#F0EAE0", 54);
  if (kind === "cta") fitTitle(ctx, d.pregunta, 90, 700, 900, 1200, 56, 700, "Rajdhani", "#F0EAE0", 62);
  if (kind === "ctaFijo") drawCtaFijo(ctx, { x: 90, y: 700, w: 900, titleSize: 48, titleFont: "Rajdhani",
    titleColor: "#C8B79A", bodySize: 36, bodyFont: "Inter Tight", bodyColor: "#F0EAE0" });
}

// ===== API principal =====
// kind: "portada" | "lamina" | "autor" | "cta" | "ctaFijo"
async function renderSlide(canvas, kind, templateId, data){
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  const tpl = TEMPLATES[templateId];
  const fnByKind = { portada: "portada", lamina: "desarrollo", autor: "autor", cta: "ctaTema", ctaFijo: "ctaFijo" };
  if (tpl && tpl[fnByKind[kind]]) tpl[fnByKind[kind]](ctx, data);
  else placeholderTpl(ctx, kind, data);
}
