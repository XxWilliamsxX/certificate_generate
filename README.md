# Certificate Generate

Aplicación web local para **generar certificados PDF de forma masiva** a partir de:

- Una **plantilla PDF** (el diseño del certificado).
- Un **archivo Excel** cuyas columnas son los datos de cada persona.
- Un **editor visual drag & drop** donde colocas los campos (`{NOMBRES}`, `{CORRELATIVO}`, un QR, etc.) directamente sobre la vista previa del PDF.

Al finalizar, la aplicación entrega un **archivo ZIP** con un PDF individual por cada fila del Excel.

> Proyecto desarrollado en Python con [uv](https://docs.astral.sh/uv/) como gestor de paquetes y entorno, [FastAPI](https://fastapi.tiangolo.com/) en el backend, [PyMuPDF](https://pymupdf.readthedocs.io/) + [ReportLab](https://www.reportlab.com/) para la composición del PDF y [Pandas](https://pandas.pydata.org/) para leer el Excel.

---

## Características principales

- **Editor visual sin código**: arrastra las columnas del Excel sobre el certificado y acomódalas con el mouse.
- **Vista previa real del PDF**: el PDF se rasteriza y se muestra como lienzo; lo que ves es la posición final.
- **Guías de centrado inteligentes**: al acercarte al centro horizontal o vertical de la hoja, el campo se "imanta" y muestra una línea guía.
- **Estilos por campo**: tipografía, tamaño, color, negrita, cursiva y alineación (izquierda / centro / derecha).
- **Imágenes sobre el certificado**: sube un QR, sello o firma en PNG/JPG y colócalo o redimensiónalo arrastrando su esquina.
- **Soporte multipágina**: si tu plantilla tiene varias páginas, puedes elegir en cuál colocar cada campo.
- **Emisión por rangos**: genera desde la fila *X* hasta la fila *Y* del Excel.
- **Numeración correlativa**: usa `{CORRELATIVO}` o `{CORRELATIVO:03}` para numerar automáticamente los certificados.
- **Nombres de archivo personalizados**: define el patrón del nombre de cada PDF combinando columnas y el correlativo.
- **Descarga en ZIP**: todos los certificados se empaquetan y se descargan en un solo archivo.
- **Vista previa de una sola fila**: genera un PDF de muestra antes de lanzar todo el lote.

---

## Cómo funciona

```
┌────────────┐      ┌────────────┐      ┌──────────────────┐
│  Excel     │ ───► │  FastAPI   │ ───► │  Editor visual    │
│  (.xlsx)   │      │  (Pandas)  │      │  (drag & drop)    │
└────────────┘      └────────────┘      └────────┬─────────┘
                                                 │ coordenadas + estilos
┌────────────┐      ┌────────────┐               │
│ Plantilla  │ ───► │  PyMuPDF   │ ◄─────────────┘
│  (.pdf)    │      │  ReportLab │
└────────────┘      └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  ZIP con   │
                    │  1 PDF por │
                    │  registro  │
                    └────────────┘
```

1. El Excel se lee con Pandas y se extraen los encabezados (primera fila).
2. El PDF se abre con PyMuPDF, se obtienen sus dimensiones reales en *puntos* (pt) y se genera una vista previa PNG por página.
3. En el navegador, cada campo se posiciona en coordenadas PDF (`x`, `y` desde la esquina superior izquierda).
4. El backend dibuja una capa transparente con ReportLab (textos e imágenes) y la fusiona sobre el PDF original con PyMuPDF.
5. Cada fila del rango genera un PDF; al terminar se comprimen todos en un `.zip`.

---

## Requisitos

- **Python 3.15 o superior** (el proyecto fija `3.15` en `.python-version`; uv puede instalarlo automáticamente).
- **[uv](https://docs.astral.sh/uv/)** instalado.
- Un navegador moderno (Chrome, Edge, Firefox).
- Opcional: Excel/LibreOffice para preparar el archivo de datos.

### Instalar uv

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS / Linux:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Verifica la instalación:

```bash
uv --version
```

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/XxWilliamsxX/certificate_generate.git
cd certificate_generate
```

### 2. Sincronizar el entorno y las dependencias

```bash
uv sync
```

Esto crea el entorno virtual `.venv/`, instala Python 3.15 si hace falta y todas las dependencias declaradas en `pyproject.toml` (`fastapi`, `uvicorn`, `pymupdf`, `pandas`, `reportlab`, `pillow`, `jinja2`, `python-multipart`, etc.).

### 3. (Opcional) Verificar que todo esté instalado

```bash
uv run python test_env.py
```

Deberías ver un mensaje confirmando las versiones de PyMuPDF, Pandas y ReportLab.

---

## Ejecución

Desde la raíz del proyecto:

```bash
uv run uvicorn certificate_generate.main:app --reload
```

Luego abre en el navegador:

```
http://127.0.0.1:8000
```

- La documentación interactiva de la API queda disponible en `http://127.0.0.1:8000/docs`.
- `--reload` es útil durante el desarrollo; en uso normal puedes omitirlo.
- Si el puerto 8000 está ocupado, usa `--port 8001` (o el que prefieras).

En Windows también puedes ejecutar sin activar el entorno virtual, ya que `uv run` se encarga de todo.

---

## Guía de uso

La interfaz tiene dos zonas: el **panel izquierdo** con los pasos de configuración y el **lienzo derecho** con el certificado.

### Paso 1 — Cargar el Excel

1. Haz clic en **"Seleccionar archivo .xlsx"** y elige tu archivo.
2. La aplicación mostrará el total de registros y un **chip por cada columna** detectada.
3. Cada chip representa una columna del Excel, por ejemplo `+ NOMBRES`, `+ APELLIDOS`, `+ DNI`.

> La **primera fila** del Excel debe contener los encabezados. La fila 1 de datos (segunda fila del Excel) corresponde al valor `1` en los rangos de emisión.

### Paso 2 — Cargar la plantilla PDF

1. Haz clic en **"Seleccionar plantilla .pdf"**.
2. El PDF se procesa y aparece como imagen de fondo en el lienzo.
3. Si el PDF tiene varias páginas, aparecerá un selector **"Página actual"**.

Puedes subir también una **imagen QR / sello / firma** (PNG o JPG) con el botón `+ Subir imagen QR / Sello`. La imagen se agrega al lienzo con un tamaño inicial de 85 pt y puedes:

- Arrastrarla para moverla.
- Estirarla desde la **esquina inferior derecha** (mantiene la proporción).
- Cambiar su ancho exacto en el panel **"QR opciones"**.

### Paso 3 — Diseñar el certificado (drag & drop)

1. **Arrastra un chip de columna** desde el panel izquierdo y suéltalo sobre el certificado.
   - También puedes hacer **clic** en el chip: el campo se agrega en una posición inicial.
2. El campo muestra el texto de la plantilla, por ejemplo `{NOMBRES}`.
3. Al seleccionar un campo puedes editar en **"Configuración diseño"**:
   - **Contenido / Combinación**: combina varias columnas y texto fijo, por ejemplo:
     ```
     {GRADO} {NOMBRES} {APELLIDOS}
     ```
   - **Tipografía**: Arial/Helvetica, Times New Roman o Courier.
   - **Tamaño** en puntos (pt).
   - **Color**.
   - **Negrita** y **Cursiva**.
   - **Alineación**: izquierda, centro o derecha.
   - **Eliminar** el campo seleccionado.
4. Arrastra el campo para moverlo y usa el tirador del borde derecho para cambiar su **ancho** (útil para la alineación).
5. Al acercar un campo al centro de la hoja verás **guías azules**: el campo se ajusta automáticamente al centro.

> Las coordenadas se guardan en **puntos PDF** reales, por lo que el resultado impreso coincide con lo que ves en pantalla, sin importar el tamaño del monitor.

### Paso 4 — Emisión masiva

En el panel **"Emisión Masiva (Lote)"** configura:

| Opción | Descripción |
| --- | --- |
| **Nombre de archivo PDF** | Patrón del nombre de cada archivo. Acepta columnas y `{CORRELATIVO}`. Ejemplo: `ESC 01 2026 - Certificado N_{CORRELATIVO}` |
| **Desde fila** | Primer registro del Excel a procesar (base 1). |
| **Hasta fila** | Último registro a procesar (base 1). |
| **Iniciar correlativo en** | Valor inicial del `{CORRELATIVO}`. |

Luego:

- **Vista Previa (Fila 1)** → genera un PDF de muestra con los datos de la fila indicada en "Desde fila" y lo abre en una pestaña nueva.
- **Generar Todos (ZIP)** → procesa el rango completo y descarga un ZIP con un PDF por registro.

> Si los nombres de archivo se repiten, se agregan sufijos `_2`, `_3`, etc. para no sobrescribir certificados.

---

## Formato del Excel

Ejemplo de hoja de cálculo:

| NOMBRES | APELLIDOS | DNI | GRADO | CODIFICACIÓN |
| --- | --- | --- | --- | --- |
| Ana María | Pérez López | 74581236 | Primaria | A-001 |
| Luis Alberto | Gómez Ríos | 71234567 | Secundaria | A-002 |

Recomendaciones:

- Usa **`.xlsx`**. El endpoint acepta `.xls`, pero para ese formato antiguo Pandas necesita `xlrd` (`uv add xlrd`).
- La **fila 1 debe contener los encabezados**; no dejes filas vacías ni celdas combinadas en esa fila.
- Los nombres de columna se usan literalmente entre llaves: `{NOMBRES}`, `{DNI}`, `{GRADO}`.
- Las celdas vacías se reemplazan por texto vacío al generar el certificado.

---

## Sintaxis de las plantillas

Dentro de cualquier campo de texto puedes combinar:

| Sintaxis | Resultado |
| --- | --- |
| `{NOMBRES}` | Valor de la columna `NOMBRES` de la fila actual. |
| `{GRADO} {NOMBRES}` | Varias columnas y texto fijo en un mismo campo. |
| `{CORRELATIVO}` | Número correlativo actual (`1`, `2`, `3`, ...). |
| `{CORRELATIVO:03}` | Correlativo con ceros a la izquierda (`001`, `002`, ...). |

- Si una columna no existe en el Excel, la etiqueta se deja tal cual (`{COLUMNA}`) para que puedas detectar el error.
- El nombre dentro de las llaves debe coincidir **exactamente** con el encabezado (mayúsculas, tildes y espacios incluidos).
- Los espacios múltiples se normalizan a uno solo.

Ejemplo de campo combinado:

```
Certificado N° {CORRELATIVO:03}
Otorgado a: {NOMBRES} {APELLIDOS}
```

---

## Archivos y carpetas generadas

El proyecto crea automáticamente estas carpetas en la raíz:

| Ruta | Contenido |
| --- | --- |
| `uploads/` | Archivos Excel y PDF subidos por el usuario. |
| `uploads/previews/` | Vistas previas PNG de cada página del PDF (escala 3x). |
| `uploads/assets/` | Imágenes QR / sellos subidos. |
| `output/` | PDFs de prueba y ZIPs generados. |
| `output/certificados_YYYYMMDD_HHMMSS.zip` | Lote completo de certificados. |
| `output/PRUEBA_<plantilla>.pdf` | PDF de muestra de la vista previa. |

Los lotes intermedios se eliminan después de comprimirse; solo queda el ZIP.

> `uploads/` y `output/` no se versionan en git (se crean al iniciar la aplicación).

---

## Estructura del proyecto

```
certificate_generate/
├── pyproject.toml                  # Metadatos y dependencias (uv)
├── uv.lock                         # Lockfile de dependencias
├── .python-version                 # Versión de Python (3.15)
├── test_env.py                     # Script de verificación de librerías
├── README.md
└── src/
    └── certificate_generate/
        ├── __init__.py
        ├── main.py                 # Aplicación FastAPI y endpoints
        ├── templates/
        │   └── index.html          # Interfaz web (Jinja2)
        ├── frontend/
        │   ├── css/style.css       # Estilos del editor
        │   └── js/app.js           # Lógica drag & drop, estilos y llamadas a la API
        └── backend/
            ├── excel_processor.py  # Lectura del Excel, encabezados y rangos
            ├── pdf_engine.py       # Render de previews, overlay y fusión PDF
            └── batch_generator.py  # Reemplazo de plantillas, nombres y ZIP
```

---

## API HTTP

La app expone una API REST (documentada automáticamente en `/docs`):

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/` | Interfaz del editor. |
| `POST` | `/api/upload-excel` | Sube un Excel y devuelve encabezados y total de registros. |
| `POST` | `/api/upload-template` | Sube el PDF y devuelve dimensiones y previews por página. |
| `POST` | `/api/upload-image` | Sube un QR/sello PNG/JPG y devuelve su proporción. |
| `POST` | `/api/test-pdf-overlay` | Genera un PDF de muestra con una fila del Excel. |
| `POST` | `/api/generate-batch` | Genera el lote completo y responde con un ZIP. |
| `GET` | `/previews/{filename}` | Sirve la imagen PNG de una página. |
| `GET` | `/assets/{filename}` | Sirve una imagen QR/sello. |

Ejemplo de cuerpo para `POST /api/generate-batch`:

```json
{
  "excel_filename": "datos.xlsx",
  "template_pdf_filename": "certificado.pdf",
  "elements": [
    {
      "type": "text",
      "page": 1,
      "text": "{NOMBRES} {APELLIDOS}",
      "x": 120.5,
      "y": 240,
      "width": 320,
      "font_family": "arial",
      "font_size": 18,
      "bold": true,
      "italic": false,
      "color": "#0f2c59",
      "align": "center"
    },
    {
      "type": "image",
      "page": 1,
      "image_filename": "qr.png",
      "x": 700,
      "y": 520,
      "width": 85,
      "height": 85
    }
  ],
  "filename_pattern": "ESC 01 2026 - Certificado N_{CORRELATIVO}",
  "start_row": 1,
  "end_row": 50,
  "start_correlative": 1
}
```

### Coordenadas

- `x` e `y` se expresan en **puntos PDF** (1 pt = 1/72 pulgada) desde la **esquina superior izquierda** de la página.
- `width` es el ancho del cuadro de texto; para las imágenes también se usa `height`.
- El backend convierte automáticamente la coordenada Y al sistema de ReportLab (origen abajo a la izquierda).

### Tipografías disponibles

| Valor | ReportLab |
| --- | --- |
| `arial` | Helvetica / Helvetica-Bold / Helvetica-Oblique |
| `times` | Times-Roman / Times-Bold / Times-Italic |
| `courier` | Courier / Courier-Bold / Courier-Oblique |

Se usan las fuentes **Base-14** de PDF, por lo que no hace falta embeber archivos de fuente. Los acentos y la `ñ` funcionan correctamente, pero caracteres fuera del juego Latin-1 (emojis, alfabetos no latinos) no se renderizarán.

---

## Detalles técnicos

- **Escala del lienzo**: `scaleRatio = ancho_en_pantalla / ancho_pdf`, de modo que mover 10 px en pantalla equivale a `10 / scaleRatio` puntos PDF.
- **Imán de centrado**: tolerancia de **6 pt** (~2 mm) respecto al centro de la página.
- **Overlay**: ReportLab dibuja sobre un buffer en memoria y PyMuPDF fusiona la capa con `show_pdf_page`; el PDF original nunca se modifica.
- **Previews**: se rasterizan a escala **3x (216 DPI)** para que se vean nítidas en pantalla.
- **Imágenes**: se dibujan con `preserveAspectRatio` para no deformarse.
- **Lotes**: se nombran con timestamp (`lote_YYYYMMDD_HHMMSS`) y se eliminan al terminar de comprimir.
- **Nombres seguros**: se eliminan tildes, se reemplazan caracteres inválidos y se evitan colisiones.

---

## Problemas comunes

**`ModuleNotFoundError: fastapi` / `No module named ...`**
Ejecuta `uv sync` dentro de la raíz del proyecto. Si el entorno quedó desactualizado:
```bash
uv sync --reinstall
```

**El navegador no muestra la página**
Verifica que el servidor siga corriendo en la terminal y que estés usando el puerto correcto (`http://127.0.0.1:8000`).

**El PDF se ve pero los textos no aparecen en el lienzo**
Recuerda que el lienzo muestra la *plantilla* con las etiquetas (`{NOMBRES}`), no los datos reales. Usa **Vista Previa** para verlos.

**Los acentos de mi Excel se ven mal**
Guarda el Excel como `.xlsx` con codificación UTF-8 (formato estándar de Excel) y evita `.csv`.

**Error al leer un `.xls`**
Instala el lector del formato antiguo:
```bash
uv add xlrd
```
O guarda el archivo como `.xlsx`.

**El QR es el mismo en todos los certificados**
El editor coloca una imagen estática; no genera un QR distinto por fila. Para QRs dinámicos se necesitaría una columna con la URL/imagen por registro (mejora futura).

**El puerto 8000 está ocupado**
```bash
uv run uvicorn certificate_generate.main:app --port 8001
```

---

## Desarrollo

- Linter/formateador incluido: [Ruff](https://docs.astral.sh/ruff/)
  ```bash
  uv run ruff check .
  uv run ruff format .
  ```
- Recarga automática durante el desarrollo:
  ```bash
  uv run uvicorn certificate_generate.main:app --reload
  ```

> La aplicación está pensada para **uso local**. No incluye autenticación, control de usuarios ni límites de tamaño de archivo; si la expones en una red, hazlo detrás de un proxy y con las protecciones adecuadas.

---

## Autor

**XxWilliamsxX** — [williams29rw@gmail.com](mailto:williams29rw@gmail.com)

Repositorio: [github.com/XxWilliamsxX/certificate_generate](https://github.com/XxWilliamsxX/certificate_generate)
