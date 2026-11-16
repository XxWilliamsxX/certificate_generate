import re
from pathlib import Path
from typing import Any
import pandas as pd

def sanitize_filename(text: str) -> str:
    """Limpia los nombres del excel, para guardarlo como nombre de archivo en PDF"""
    if not text or pd.isna(text):
        return "SIN_NOMBRE"

    #Convertimos a texto y eliminamos espacios al inicio y al final
    clean_text = str(text).strip()

    # Reemplazar caracteres no permitidos en el sistema operativo, por guiones
    clean_text = re.sub(r'[\\/:*?"<>|]', "-", clean_text)

    # Eliminar múltiples guiones seguidos o espacios dobles
    clean_text = re.sub(r"-+", "-", clean_text)
    clean_text = re.sub(r"\s+", " ", clean_text)

    return clean_text.strip(" -")

def extract_excel_headers(file_path: Path) -> list[str]:
    """Lee únicamente la primera fila del Excel y retorna la lista de nombres de columnas."""

    # nrows=0 lee solo los encabezados sin cargar todos los datos en memoria
    df = pd.read_excel(file_path, nrows=0)

    #Limpiar los nombres de columnas de espacios al inicio o final
    headers = [str(col).strip() for col in df.columns]

    return headers

def get_excel_info_and_rows(
        file_path: Path, start_row: int = 1, end_row: int | None = None
    ) -> dict[str, Any]:
    """Lee el Excel completo, obtiene el total de registros y extrae el rango solicitado.

    Nota: El parámetro 'start_row' 1 corresponde al primer registro de datos
    (Fila 2 de Excel, asumiendo que la Fila 1 es el encabezado).
    """

    df = pd.read_excel(file_path)

    # Rellenar valores nulos con cadenas vacías para evitar errores de tipo float/NaN
    df = df.fillna("")

    total_records = len(df)

    # Ajustar rangos válidos (Base 1 para el usuario final)
    start_idx = max(1, start_row) - 1
    end_idx = total_records if end_row is None or end_row > total_records else end_row

    if start_idx >= total_records or start_idx > end_idx:
        filtered_df = pd.DataFrame(columns=df.columns)
    else: 
        filtered_df = df.iloc[start_idx:end_idx]

    # Convertir las filas seleccionadas a una lista de diccionarios
    records = filtered_df.to_dict(orient="records")

    return {
        "total_records": total_records,
        "processed_records_count": len(records),
        "headers": [str(col).strip() for col in df.columns],
        "data": records,
    }

