# Manual de uso · Generador de Carruseles La Tribuna

Para quien redacta y arma los carruseles (no requiere saber programar).

---

## 1. Abrir la aplicación

Mientras no esté publicada en internet, se abre en local:

```bash
cd "Generador-Carruseles-LT"
python -m http.server 5609
```

Y luego entrar a `http://localhost:5609` en el navegador.

---

## 2. Estructura de un carrusel

Cada carrusel que arma la aplicación tiene, en este orden:

1. **Portada** — imagen + título + tema (categoría).
2. **Hasta 5 láminas de desarrollo** — cada una con su propio título y su texto.
3. **CTA fijo** (última lámina) — siempre igual, se genera solo:
   > Siga a @LaTribunaColombia
   > Sigue a @latribunacolombia para que no te pierdas nuestro contenido
   > Lee esta nota y más en latribunacolombia.co

El **tema** que se escoge en el paso 1 aparece también como una pastilla al pie de
cada lámina de desarrollo (funciona como el "CTA de tema": recuerda de qué trata el
carrusel a quien entra a mitad del carrusel).

### Carrusel "Puntos de vista"

Al elegir el tipo **Puntos de vista** aparece un bloque adicional para **Autor**:
nombre, perfil/cargo y foto. Esos datos se muestran en la portada.

---

## 3. Llenar el contenido

- **Tema**: escriba o elija de la lista (Pasa en el mundo, Economía, Especiales, etc.).
- **Plantilla**: elige uno de los diseños disponibles. Mientras no se hayan cargado
  las plantillas reales, la mayoría dicen *"Pendiente de diseño"* y solo sirven para
  probar la app con colores provisionales.
- **Portada**: suba la imagen, ajuste zoom/posición si hace falta, y escriba el título.
- **Láminas de desarrollo**: use la tabla igual que una hoja de cálculo:
  - Escriba directamente en cada celda (Título / Texto).
  - **Pegar desde Excel**: copie dos columnas (Título y Texto) en Excel o Google Sheets
    y péguelas sobre la primera celda de la tabla — se reparten solas en las filas
    siguientes.
  - **Exportar CSV** guarda la tabla actual como archivo `.csv` (útil para trabajar el
    texto fuera de la app y como respaldo).
  - **Importar CSV** carga un archivo `.csv` con las columnas Título,Texto (puede ser
    uno que usted mismo exportó antes, o uno hecho en Excel y guardado como CSV).
  - Máximo 5 láminas de desarrollo. El botón "+ Agregar lámina" se desactiva al llegar
    al tope.

---

## 4. Descargar

- Cada lámina tiene su propio botón **Descargar PNG** (1080×1350, listo para Instagram/Facebook).
- **Descargar todas las láminas** las baja todas en orden (portada, láminas, CTA fijo),
  con una pequeña pausa entre cada una para que el navegador no las bloquee.
- Los archivos se nombran con el título de la portada, por ejemplo:
  `colombia-entra-en-la-fase-decisiva-lamina-1.png`.

Súbalas a Instagram/Facebook en el mismo orden en que aparecen en la pantalla.

---

## 5. Si algo no se ve bien

- El texto se encoge solo si es muy largo para no salirse de la lámina. Si queda
  demasiado pequeño, es señal de que el texto es muy largo: acórtelo.
- Si la plantilla dice "Pendiente de diseño", es normal que se vea gris/plano: falta
  cargar su diseño real (ver `MANUAL-TECNICO.md`).
