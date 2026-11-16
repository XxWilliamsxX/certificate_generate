import re
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from certificate_generate.backend.excel_processor import (
    get_excel_info_and_rows,
    sanitize_filename,
)
from certificate_generate.backend.pdf_engine import generate_single_pdf


def render_template_string(
    template_str: str,
    row_data: dict[str, Any],
    correlative: int | None = None,
) -> str:
    """Reemplaza etiquetas {COLUMNA} y {CORRELATIVO} por los valores reales."""
    if not template_str:
        return ""

    text = template_str

    # 1. Reemplazar {CORRELATIVO} o {CORRELATIVO:03} (con ceros a la izquierda)
    if correlative is not None:
        def replace_correlative(match: re.Match) -> str:
            padding = match.group(1)
            if padding and padding.isdigit():
                return str(correlative).zfill(int(padding))
            return str(correlative)

        text = re.sub(
            r"\{CORRELATIVO(?::(\d+))?\}",
            replace_correlative,
            text,
            flags=re.IGNORECASE,
        )

    # 2. Reemplazar columnas del Excel
    def replace_match(match: re.Match) -> str:
        col_name = match.group(1).strip()
        if col_name in row_data:
            val = row_data[col_name]
            return "" if val is None else str(val).strip()
        for k, v in row_data.items():
            if str(k).strip() == col_name:
                return "" if v is None else str(v).strip()
        return match.group(0)

    result = re.sub(r"\{([^{}]+)\}", replace_match, text)
    return re.sub(r"\s+", " ", result).strip()


def generate_batch_certificates(
    excel_path: Path,
    template_pdf_path: Path,
    output_base_dir: Path,
    elements_config: list[dict[str, Any]],
    filename_pattern: str = "{DATOS COMPLETOS}",
    start_row: int = 1,
    end_row: int | None = None,
    start_correlative: int = 1,
    assets_dir: Path | None = None,
) -> Path:
    """Genera todos los certificados PDF del rango indicado con textos e imágenes (QR)."""
    excel_result = get_excel_info_and_rows(
        excel_path, start_row=start_row, end_row=end_row
    )
    rows = excel_result["data"]

    if not rows:
        raise ValueError("No hay registros dentro del rango de filas especificado.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    batch_dir = output_base_dir / f"lote_{timestamp}"
    batch_dir.mkdir(parents=True, exist_ok=True)

    used_filenames: dict[str, int] = {}

    for offset, row in enumerate(rows):
        current_correlative = start_correlative + offset
        excel_row_num = start_row + offset

        # 1. Resolver textos dinámicos y mantener imágenes (QR) intactas
        resolved_elements = []
        for el in elements_config:
            if el.get("type") == "image":
                resolved_elements.append(el)
            else:
                resolved_text = render_template_string(
                    el.get("text", ""),
                    row,
                    correlative=current_correlative,
                )
                resolved_elements.append(
                    {
                        **el,
                        "text": resolved_text,
                    }
                )

        # 2. Construir el nombre seguro del archivo PDF usando el correlativo
        raw_name = render_template_string(
            filename_pattern,
            row,
            correlative=current_correlative,
        )
        safe_stem = sanitize_filename(raw_name)
        if not safe_stem or safe_stem == "SIN_NOMBRE":
            safe_stem = f"certificado_fila_{excel_row_num}"

        if safe_stem in used_filenames:
            used_filenames[safe_stem] += 1
            final_pdf_name = f"{safe_stem}_{used_filenames[safe_stem]}.pdf"
        else:
            used_filenames[safe_stem] = 1
            final_pdf_name = f"{safe_stem}.pdf"

        pdf_output_path = batch_dir / final_pdf_name

        # 3. Renderizar PDF individual con textos e imágenes
        generate_single_pdf(
            template_pdf_path,
            pdf_output_path,
            resolved_elements,
            assets_dir=assets_dir,
        )

    # 4. Empaquetar en ZIP
    zip_path = output_base_dir / f"certificados_{timestamp}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for pdf_file in sorted(batch_dir.glob("*.pdf")):
            zipf.write(pdf_file, arcname=pdf_file.name)

    shutil.rmtree(batch_dir, ignore_errors=True)

    return zip_path