// ===== Lógica de la interfaz =====
const $ = id => document.getElementById(id);

function plantillaLabel(cat){
  const nombre = cat.archivo.replace(/\.pptx$/i, "").replace(/_/g, " ");
  return nombre + (cat.listo ? "" : " (pendiente)");
}

const state = {
  tipo: TIPOS_CARRUSEL[0],
  tema: TIPOS_CARRUSEL[0].temas[0],
  plantilla: null,
  pregunta: "",
  portada: { imagen: null, transform: { zoom: 1, dx: 0, dy: 0 }, titulo: "" },
  autor: { nombre: "", perfil: "", red: "", foto: null, transform: { zoom: 1, dx: 0, dy: 0 } },
  laminas: Array.from({ length: LIMITES.laminasPorDefecto }, () => ({ texto: "" }))
};

// --- poblar selects fijos ---
function fillSelect(sel, items, getVal, getLabel){
  sel.innerHTML = "";
  items.forEach(it => {
    const o = document.createElement("option");
    o.value = getVal(it); o.textContent = getLabel(it);
    sel.appendChild(o);
  });
}
fillSelect($("tipo"), TIPOS_CARRUSEL, t => t.id, t => t.nombre);

// El selector de Plantilla y el de Tema dependen del Tipo de carrusel elegido:
// "Noticia / hecho" solo ofrece las plantillas/temas de noticias, "Puntos de vista"
// solo las de esa línea. Nunca se mezclan ni se duplican entre tipos.
function plantillasDelTipo(){
  return CATALOGO_PLANTILLAS.filter(c => c.tipo === state.tipo.id);
}
function refreshPlantillas(){
  const opciones = plantillasDelTipo();
  fillSelect($("plantilla"), opciones, c => c.id, plantillaLabel);
  if (!opciones.some(c => c.id === state.plantilla)) state.plantilla = opciones[0].id;
  $("plantilla").value = state.plantilla;
  refreshHintPlantilla();
}
function refreshTemas(){
  fillSelect($("tema"), state.tipo.temas, t => t, t => t);
  if (state.tipo.temas.indexOf(state.tema) === -1) state.tema = state.tipo.temas[0];
  $("tema").value = state.tema;
}
function refreshHintPlantilla(){
  const cat = CATALOGO_PLANTILLAS.find(c => c.id === state.plantilla);
  $("hint-plantilla").textContent = cat && cat.listo
    ? "Plantilla lista (" + cat.archivo + ")."
    : "Esta plantilla todavía no tiene diseño real cargado: se ve con colores provisionales.";
}
refreshTemas();
refreshPlantillas();

// --- eventos: tipo / tema / plantilla ---
$("tipo").addEventListener("change", e => {
  state.tipo = TIPOS_CARRUSEL.find(t => t.id === e.target.value);
  $("wrap-autor").hidden = !state.tipo.autor;
  refreshTemas();
  refreshPlantillas();
  render();
});
$("tema").addEventListener("change", e => { state.tema = e.target.value; render(); });
$("plantilla").addEventListener("change", e => { state.plantilla = e.target.value; refreshHintPlantilla(); render(); });
$("pregunta").addEventListener("input", e => { state.pregunta = e.target.value; render(); });

// --- portada ---
$("portada-foto").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  loadImg(URL.createObjectURL(file)).then(img => {
    state.portada.imagen = img;
    document.querySelector(".foto-controls").hidden = false;
    render();
  });
});
["p-zoom", "p-posx", "p-posy"].forEach(id => $(id).addEventListener("input", () => {
  state.portada.transform = { zoom: +$("p-zoom").value, dx: +$("p-posx").value, dy: +$("p-posy").value };
  render();
}));
$("portada-titulo").addEventListener("input", e => { state.portada.titulo = e.target.value; render(); });

// --- autor (Puntos de vista) ---
$("autor-nombre").addEventListener("input", e => { state.autor.nombre = e.target.value; render(); });
$("autor-perfil").addEventListener("input", e => { state.autor.perfil = e.target.value; render(); });
$("autor-red").addEventListener("input", e => { state.autor.red = e.target.value; render(); });
$("autor-foto").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  loadImg(URL.createObjectURL(file)).then(img => {
    state.autor.foto = img;
    document.querySelector(".autor-foto-controls").hidden = false;
    render();
  });
});
["a-zoom", "a-posx", "a-posy"].forEach(id => $(id).addEventListener("input", () => {
  state.autor.transform = { zoom: +$("a-zoom").value, dx: +$("a-posx").value, dy: +$("a-posy").value };
  render();
}));

// ===== Tabla de láminas (editable como hoja de cálculo). Sin columna de título: =====
// las láminas de desarrollo no tienen título (regla del proyecto), solo texto.
function pintarTabla(){
  const tbody = $("tabla-laminas").querySelector("tbody");
  tbody.innerHTML = "";
  state.laminas.forEach((lam, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td>' + (i + 1) + '</td>' +
      '<td><textarea data-i="' + i + '" data-c="texto" rows="2"></textarea></td>' +
      '<td><button type="button" class="btn-quitar" data-i="' + i + '" title="Quitar lámina">✕</button></td>';
    tr.querySelector('[data-c="texto"]').value = lam.texto;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("textarea").forEach(el => {
    el.addEventListener("input", e => {
      const i = +e.target.dataset.i, c = e.target.dataset.c;
      state.laminas[i][c] = e.target.value;
      render();
    });
    // Pegar desde Excel: si el portapapeles trae varias filas, se reparten en la tabla
    // a partir de la celda donde se pegó (una sola columna: Texto).
    el.addEventListener("paste", e => {
      const texto = (e.clipboardData || window.clipboardData).getData("text");
      if (!texto.includes("\n")) return; // pegado normal de una celda
      e.preventDefault();
      const filas = texto.replace(/\r/g, "").split("\n").filter((r, idx, arr) => !(idx === arr.length - 1 && r === ""));
      const startI = +e.target.dataset.i;
      filas.forEach((fila, fi) => {
        const li = startI + fi;
        while (state.laminas.length <= li && state.laminas.length < LIMITES.maxLaminas) state.laminas.push({ texto: "" });
        if (li >= state.laminas.length) return;
        state.laminas[li].texto = fila.split("\t")[0];
      });
      pintarTabla();
      render();
    });
  });
  tbody.querySelectorAll(".btn-quitar").forEach(btn => btn.addEventListener("click", e => {
    const i = +e.target.dataset.i;
    if (state.laminas.length <= LIMITES.minLaminas) return;
    state.laminas.splice(i, 1);
    pintarTabla();
    render();
  }));
}
$("btn-add-fila").addEventListener("click", () => {
  if (state.laminas.length >= LIMITES.maxLaminas) { alert("Máximo " + LIMITES.maxLaminas + " láminas de desarrollo."); return; }
  state.laminas.push({ texto: "" });
  pintarTabla();
  render();
});

// --- CSV: exportar / importar (para trabajar el texto en Excel / Google Sheets) ---
function csvEscape(v){ return '"' + String(v || "").replace(/"/g, '""') + '"'; }
$("btn-csv-export").addEventListener("click", () => {
  const filas = [COLUMNAS_TABLA.map(c => csvEscape(COLUMNAS_TABLA_LABEL[c])).join(",")];
  state.laminas.forEach(l => filas.push(COLUMNAS_TABLA.map(c => csvEscape(l[c])).join(",")));
  const blob = new Blob(["﻿" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "laminas-carrusel.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
function parseCSV(texto){
  const filas = []; let fila = []; let campo = ""; let enComillas = false;
  for (let i = 0; i < texto.length; i++){
    const c = texto[i];
    if (enComillas){
      if (c === '"' && texto[i + 1] === '"'){ campo += '"'; i++; }
      else if (c === '"') enComillas = false;
      else campo += c;
    } else {
      if (c === '"') enComillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        fila.push(campo); campo = ""; filas.push(fila); fila = [];
      } else campo += c;
    }
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(v => v !== ""));
}
$("csv-import").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const filas = parseCSV(reader.result.replace(/^﻿/, ""));
    const datos = filas.slice(1, 1 + LIMITES.maxLaminas);
    if (!datos.length) return;
    state.laminas = datos.map(f => ({ texto: f[0] || "" }));
    pintarTabla();
    render();
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ===== Vista previa: una lámina = un <canvas> =====
// Orden: Portada → hasta 5 láminas de desarrollo → [Autor, solo Puntos de vista] →
// CTA del tema → CTA fijo. La lámina de autor es siempre su propia lámina (regla del
// proyecto), aunque algún .pptx de referencia la traiga combinada con el CTA del tema.
function slidesDefinidos(){
  const lista = [{ kind: "portada", label: "Portada" }];
  state.laminas.forEach((_, i) => lista.push({ kind: "lamina", label: "Lámina " + (i + 1), i }));
  if (state.tipo.autor) lista.push({ kind: "autor", label: "Autor" });
  lista.push({ kind: "cta", label: "CTA del tema" });
  lista.push({ kind: "ctaFijo", label: "CTA fijo" });
  return lista;
}
function dataPortada(){
  return {
    imagen: state.portada.imagen, imagenTransform: state.portada.transform,
    titulo: state.portada.titulo || "Título del carrusel",
    tema: state.tema
  };
}
function dataLamina(i){
  const l = state.laminas[i] || { texto: "" };
  return { texto: l.texto || "Texto de la lámina", tema: state.tema,
    indice: i + 1, total: state.laminas.length };
}
function dataCta(){
  // Algunas plantillas (p. ej. Puntos_de_Vista_02) muestran una segunda aparición
  // del autor dentro de la lámina de CTA del tema — debe alimentarse con los mismos
  // datos que la lámina de autor, no quedar vacía ni con texto de ejemplo.
  return { pregunta: state.pregunta || "¿Pregunta que invita a comentar?", tema: state.tema, autor: state.autor };
}
function dataAutor(){
  return { autor: state.autor, tema: state.tema };
}
let armado = false;
function construirTira(){
  const cont = $("slides");
  cont.innerHTML = "";
  slidesDefinidos().forEach(s => {
    const card = document.createElement("div");
    card.className = "slide-card";
    card.dataset.kind = s.kind; if (s.i != null) card.dataset.i = s.i;
    card.innerHTML = '<h3>' + s.label + '</h3><canvas width="' + CANVAS_W + '" height="' + CANVAS_H + '"></canvas><button type="button">Descargar PNG</button>';
    card.querySelector("button").addEventListener("click", () => descargarUna(card));
    cont.appendChild(card);
  });
  armado = true;
}
function dataFor(kind, i){
  if (kind === "portada") return dataPortada();
  if (kind === "autor") return dataAutor();
  if (kind === "cta") return dataCta();
  if (kind === "ctaFijo") return { tema: state.tema };
  return dataLamina(i);
}
async function render(){
  if (!armado) construirTira();
  const tarjetas = [...$("slides").children];
  const def = slidesDefinidos();
  if (tarjetas.length !== def.length) { construirTira(); return render(); }
  for (let k = 0; k < def.length; k++){
    const s = def[k];
    const canvas = tarjetas[k].querySelector("canvas");
    await renderSlide(canvas, s.kind, state.plantilla, dataFor(s.kind, s.i));
  }
}

// --- descargas: AAAA-MM-DD-01.png, 02.png... y AAAA-MM-DD-carrusel.zip ---
function fechaHoy(){
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function nombreLamina(indiceUno){
  return fechaHoy() + "-" + String(indiceUno).padStart(2, "0") + ".png";
}
function indiceDeCard(card){
  return [...$("slides").children].indexOf(card) + 1;
}
function canvasABlob(canvas){
  return new Promise(res => canvas.toBlob(res, "image/png"));
}
function descargarBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function descargarUna(card){
  const blob = await canvasABlob(card.querySelector("canvas"));
  descargarBlob(blob, nombreLamina(indiceDeCard(card)));
}
$("btn-descargar-todo").addEventListener("click", async () => {
  const boton = $("btn-descargar-todo");
  boton.disabled = true;
  const textoOriginal = boton.textContent;
  boton.textContent = "Generando ZIP…";
  try {
    const tarjetas = [...$("slides").children];
    const archivos = {};
    for (let k = 0; k < tarjetas.length; k++){
      const blob = await canvasABlob(tarjetas[k].querySelector("canvas"));
      const buf = new Uint8Array(await blob.arrayBuffer());
      archivos[nombreLamina(k + 1)] = buf;
    }
    const zipData = fflate.zipSync(archivos, { level: 0 });
    descargarBlob(new Blob([zipData], { type: "application/zip" }), fechaHoy() + "-carrusel.zip");
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
});

// --- arranque ---
(async function(){
  $("btn-descargar-todo").disabled = true;
  await initAssets();
  pintarTabla();
  construirTira();
  await render();
  $("btn-descargar-todo").disabled = false;
})();
