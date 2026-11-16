import io
import re
import unicodedata
from pathlib import Path
from typing import Any
import fitz  # PyMuPDF
from reportlab.pdfgen import canvas


# Mapeo de tipografías amigables a fuentes vectoriales Base-14 de PDF
REPORTLAB_FONT_MAP = {
    ("arial", False, False): "Helvetica",
    ("arial", True, False): "Helvetica-Bold",
    ("arial", False, True): "Helvetica-Oblique",
    ("arial", True, True): "Helvetica-BoldOblique",
    ("helvetica", False, False): "Helvetica",
    ("helvetica", True, False): "Helvetica-Bold",
    ("helvetica", False, True): "Helvetica-Oblique",
    ("helvetica", True, True): "Helvetica-BoldOblique",
    ("times", False, False): "Times-Roman",
    ("times", True, False): "Times-Bold",
    ("times", False, True): "Times-Italic",
    ("times", True, True): "Times-BoldItalic",
    ("courier", False, False): "Courier",
    ("courier", True, False): "Courier-Bold",
    ("courier", False, True): "Courier-Oblique",
    ("courier", True, True): "Courier-BoldOblique",
}


def normalize_filename(original_filename: str) -> str:
    """Convierte el nombre del archivo en uno limpio y seguro para URLs y rutas."""
    path = Path(original_filename)
    stem = path.stem
    suffix = path.suffix.lower()

    # Eliminar tildes y caracteres especiales
    stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    stem = re.sub(r"[^a-zA-Z0-9]+", "_", stem).strip("_")

    if not stem:
        stem = "plantilla_certificado"

    return f"{stem}{suffix}"


def hex_to_rgb_normalized(hex_color: str) -> tuple[float, float, float]:
    """Convierte un color hexadecimal (#RRGGBB) a valores RGB decimales (0.0 a 1.0)."""
    clean_hex = hex_color.lstrip("#").strip()
    if len(clean_hex) != 6:
        return (0.0, 0.0, 0.0)

    r = int(clean_hex[0:2], 16) / 255.0
    g = int(clean_hex[2:4], 16) / 255.0
    b = int(clean_hex[4:6], 16) / 255.0
    return (r, g, b)


def resolve_reportlab_font(
    family: str, bold: bool = False, italic: bool = False
) -> str:
    """Devuelve el identificador de fuente vectorial para ReportLab."""
    key = (family.lower().strip(), bold, italic)
    return REPORTLAB_FONT_MAP.get(key, "Helvetica")


def prepare_template_and_previews(
    file_path: Path, previews_dir: Path, base_url: str = ""
) -> dict[str, Any]:
    """Lee el PDF plantilla, extrae sus dimensiones exactas y genera vistas previas PNG nítidas."""
    if file_path.suffix.lower() != ".pdf":
        raise ValueError("El archivo de plantilla debe tener extensión .pdf")

    previews_dir.mkdir(parents=True, exist_ok=True)
    stem = file_path.stem

    pdf_doc = fitz.open(file_path)
    pages_info = []

    # Escala 3.0x (216 DPI) para visualizar con claridad en el lienzo web
    zoom_matrix = fitz.Matrix(3.0, 3.0)

    for page_index in range(len(pdf_doc)):
        page = pdf_doc[page_index]
        rect = page.rect

        pix = page.get_pixmap(matrix=zoom_matrix, alpha=False)
        preview_filename = f"{stem}_page_{page_index + 1}.png"
        preview_path = previews_dir / preview_filename
        pix.save(preview_path)

        preview_rel_url = f"/previews/{preview_filename}"
        pages_info.append(
            {
                "page_number": page_index + 1,
                "pdf_width": round(rect.width, 2),
                "pdf_height": round(rect.height, 2),
                "preview_url": preview_rel_url,
                "full_preview_url": f"{base_url}{preview_rel_url}"
                if base_url
                else preview_rel_url,
                "preview_width": pix.width,
                "preview_height": pix.height,
            }
        )

    total_pages = len(pdf_doc)
    pdf_doc.close()

    return {
        "template_pdf_filename": file_path.name,
        "total_pages": total_pages,
        "pages": pages_info,
    }

def generate_single_pdf(
    template_pdf_path: Path,
    output_pdf_path: Path,
    elements: list[dict[str, Any]],
    assets_dir: Path | None = None,
) -> Path:
    """Crea una capa vectorial/imagen transparente con ReportLab y la fusiona sobre el PDF original."""
    base_doc = fitz.open(template_pdf_path)
    total_pages = len(base_doc)

    overlay_buffer = io.BytesIO()
    c = canvas.Canvas(overlay_buffer)

    for page_idx in range(total_pages):
        page_num = page_idx + 1
        page_rect = base_doc[page_idx].rect
        pdf_width = page_rect.width
        pdf_height = page_rect.height

        c.setPageSize((pdf_width, pdf_height))

        page_elements = [
            el for el in elements if int(el.get("page", 1)) == page_num
        ]

        for item in page_elements:
            el_type = item.get("type", "text")
            x = float(item.get("x", 0))
            y = float(item.get("y", 0))
            width = float(item.get("width", 100))

            # --- CASO A: ELEMENTO DE IMAGEN (QR / FIRMA / SELLO) ---
            if el_type == "image":
                image_filename = item.get("image_filename", "")
                height = float(item.get("height", width))
                if not image_filename or assets_dir is None:
                    continue

                img_path = assets_dir / image_filename
                if not img_path.exists():
                    continue

                # En ReportLab Y=0 es abajo; el borde inferior de la imagen queda en:
                rl_img_y = pdf_height - y - height
                c.drawImage(
                    str(img_path),
                    x,
                    rl_img_y,
                    width=width,
                    height=height,
                    preserveAspectRatio=True,
                    mask="auto",
                )
                continue

            # --- CASO B: ELEMENTO DE TEXTO ---
            text = str(item.get("text", ""))
            if not text:
                continue

            font_size = float(item.get("font_size", 16))
            align = item.get("align", "center").lower()

            font_name = resolve_reportlab_font(
                family=item.get("font_family", "arial"),
                bold=bool(item.get("bold", False)),
                italic=bool(item.get("italic", False)),
            )
            r, g, b = hex_to_rgb_normalized(item.get("color", "#000000"))

            c.setFont(font_name, font_size)
            c.setFillColorRGB(r, g, b)

            rl_y = pdf_height - y - (font_size * 0.82)

            if align == "center":
                c.drawCentredString(x + (width / 2.0), rl_y, text)
            elif align == "right":
                c.drawRightString(x + width, rl_y, text)
            else:
                c.drawString(x, rl_y, text)

        c.showPage()

    c.save()
    overlay_buffer.seek(0)

    overlay_doc = fitz.open("pdf", overlay_buffer.getvalue())
    for page_idx in range(total_pages):
        base_doc[page_idx].show_pdf_page(
            base_doc[page_idx].rect, overlay_doc, page_idx
        )

    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    base_doc.save(output_pdf_path)

    overlay_doc.close()
    base_doc.close()

    return output_pdf_path