from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Obtener la ruta base del proyecto
BASE_DIR = Path(__file__).resolve().parent

# Inicialización de FastAPI
app = FastAPI(
    title = "Generador de Certificados",
    description = "Sistema de emisión masiva de certificados en PDF",
    version = "1.0.0",
)

# Montar la carpeta de archivos estáticos (CSS, JS)
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend"), name="static")

# Configurar el motor de plantillas Jinja2 señalando la carpeta 'templates'
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# Ruta principal (Home)
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Renderiza la interfaz principal del sistema."""
    return templates.TemplateResponse(
        request = request,
        name = "index.html",
        context = {
            "titulo": "Generador Masivo de Certificados",
        },
    )