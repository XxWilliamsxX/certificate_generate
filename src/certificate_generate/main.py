import shutil
from pathlib import Path
from typing import Any
from fastapi import Body, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from certificate_generate.backend.batch_generator import (
    generate_batch_certificates,
    render_template_string,
)
from certificate_generate.backend.excel_processor import (
    extract_excel_headers,
    get_excel_info_and_rows,
)
from certificate_generate.backend.pdf_engine import (
    generate_single_pdf,
    normalize_filename,
    prepare_template_and_previews,
)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent

UPLOADS_DIR = PROJECT_ROOT / "uploads"
OUTPUT_DIR = PROJECT_ROOT / "output"
PREVIEWS_DIR = UPLOADS_DIR / "previews"
ASSETS_DIR = UPLOADS_DIR / "assets"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Generador de Certificados",
    description="Sistema de emisión masiva de certificados en PDF",
    version="1.0.0",
)

app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"titulo": "Generador Masivo de Certificados"},
    )


@app.post("/api/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Solo se admiten archivos Excel (.xlsx, .xls).",
        )

    safe_excel_name = normalize_filename(file.filename)
    file_path = UPLOADS_DIR / safe_excel_name

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error al guardar el archivo: {str(e)}"
        )

    try:
        headers = extract_excel_headers(file_path)
        info = get_excel_info_and_rows(file_path)

        return JSONResponse(
            status_code=200,
            content={
                "message": "Archivo Excel cargado correctamente",
                "filename": safe_excel_name,
                "headers": headers,
                "total_records": info["total_records"],
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error al leer el archivo Excel: {str(e)}"
        )


@app.get("/previews/{filename}", include_in_schema=False)
async def get_preview_image(filename: str):
    preview_path = PREVIEWS_DIR / filename
    if not preview_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Vista previa no encontrada: {filename}",
        )
    return FileResponse(path=preview_path, media_type="image/png")


@app.post("/api/upload-template")
async def upload_template(request: Request, file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Solo se admiten plantillas en formato PDF (.pdf).",
        )

    safe_filename = normalize_filename(file.filename)
    file_path = UPLOADS_DIR / safe_filename
    base_url = str(request.base_url).rstrip("/")

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        template_data = prepare_template_and_previews(
            file_path, PREVIEWS_DIR, base_url=base_url
        )
        return JSONResponse(
            status_code=200,
            content={
                "message": "Plantilla PDF procesada correctamente",
                **template_data,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error al procesar la plantilla PDF: {str(e)}"
        )


@app.post("/api/test-pdf-overlay")
async def test_pdf_overlay(
    template_pdf_filename: str = Body(..., embed=True),
    elements: list[dict[str, Any]] = Body(..., embed=True),
    excel_filename: str | None = Body(default=None, embed=True),
    start_row: int = Body(default=1, embed=True),
    start_correlative: int = Body(default=1, embed=True),
):
    """Genera un PDF de muestra usando la fila inicial indicada y el correlativo configurado."""
    template_path = UPLOADS_DIR / template_pdf_filename
    if not template_path.exists():
        raise HTTPException(
            status_code=404, detail="No se encontró la plantilla PDF en uploads/"
        )

    resolved_elements = elements
    if excel_filename:
        excel_path = UPLOADS_DIR / excel_filename
        if excel_path.exists():
            info = get_excel_info_and_rows(
                excel_path, start_row=start_row, end_row=start_row
            )
            if info["data"]:
                sample_row = info["data"][0]
                resolved_elements = [
                    {
                        **el,
                        "text": render_template_string(
                            el.get("text", ""),
                            sample_row,
                            correlative=start_correlative,
                        ),
                    }
                    for el in elements
                ]

    test_output_path = OUTPUT_DIR / f"PRUEBA_{template_pdf_filename}"

    try:
        generate_single_pdf(template_path, test_output_path, resolved_elements, assets_dir=ASSETS_DIR)
        return FileResponse(
            path=test_output_path,
            media_type="application/pdf",
            filename=test_output_path.name,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error al generar el PDF de prueba: {str(e)}"
        )


@app.post("/api/generate-batch")
async def generate_batch(
    excel_filename: str = Body(..., embed=True),
    template_pdf_filename: str = Body(..., embed=True),
    elements: list[dict[str, Any]] = Body(..., embed=True),
    filename_pattern: str = Body(default="{DATOS COMPLETOS}", embed=True),
    start_row: int = Body(default=1, embed=True),
    end_row: int | None = Body(default=None, embed=True),
    start_correlative: int = Body(default=1, embed=True),
):
    """Genera masivamente los certificados PDF del rango indicado con numeración correlativa."""
    excel_path = UPLOADS_DIR / excel_filename
    template_path = UPLOADS_DIR / template_pdf_filename

    if not excel_path.exists():
        raise HTTPException(status_code=404, detail="Archivo Excel no encontrado.")
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Plantilla PDF no encontrada.")

    try:
        zip_path = generate_batch_certificates(
            excel_path=excel_path,
            template_pdf_path=template_path,
            output_base_dir=OUTPUT_DIR,
            elements_config=elements,
            filename_pattern=filename_pattern,
            start_row=start_row,
            end_row=end_row,
            start_correlative=start_correlative,
            assets_dir=ASSETS_DIR,
        )
        return FileResponse(
            path=zip_path,
            media_type="application/zip",
            filename=zip_path.name,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error durante la generación masiva: {str(e)}"
        )

@app.get("/assets/{filename}", include_in_schema=False)
async def get_asset_image(filename: str):
    """Sirve la imagen QR o sello al navegador para mostrarla en el lienzo."""
    asset_path = ASSETS_DIR / filename
    if not asset_path.exists():
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(path=asset_path)


@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Sube una imagen PNG/JPG (como un código QR) para estamparla en los certificados."""
    allowed_ext = (".png", ".jpg", ".jpeg")
    if not file.filename or not file.filename.lower().endswith(allowed_ext):
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Sube una imagen PNG o JPG.",
        )

    safe_name = normalize_filename(file.filename)
    asset_path = ASSETS_DIR / safe_name

    try:
        with open(asset_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        from PIL import Image
        with Image.open(asset_path) as img:
            img_w, img_h = img.size

        return JSONResponse(
            status_code=200,
            content={
                "message": "Imagen QR cargada correctamente",
                "image_filename": safe_name,
                "image_url": f"/assets/{safe_name}",
                "aspect_ratio": round(img_w / img_h, 4) if img_h else 1.0,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error al procesar la imagen: {str(e)}"
        )