import pymupdf
import pandas as pd
import reportlab
from fastapi import FastAPI

print("--- TODAS LAS LIBRERÍAS SE INSTALARON CORRECTAMENTE ---")
print(f"Versión de PyMuPDF: {pymupdf.__version__}")
print(f"Versión de Pandas: {pd.__version__}")
print(f"Versión de ReportLab: {reportlab.__version__}")