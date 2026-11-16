// Estado global de la aplicación
const state = {
    excelFilename: null,
    headers: [],
    totalRecords: 0,
    templatePdfFilename: null,
    pages: [], // Info de páginas del PDF
    currentPage: 1,
    scaleRatio: 1, // Relación entre píxeles en pantalla y puntos PDF reales
    fields: [], // Lista de campos colocados en el lienzo
    selectedFieldId: null,
};

// Referencias al DOM
const guideLineVertical = document.getElementById("guideLineVertical");
const guideLineHorizontal = document.getElementById("guideLineHorizontal");

const qrInput = document.getElementById("qrInput");
const qrStatus = document.getElementById("qrStatus");
const imageControls = document.getElementById("imageControls");
const imageWidthInput = document.getElementById("imageWidthInput");
const imageCoordsReadout = document.getElementById("imageCoordsReadout");
const btnDeleteImage = document.getElementById("btnDeleteImage");

const startCorrelativeInput = document.getElementById("startCorrelative");
const excelInput = document.getElementById("excelInput");
const excelStatus = document.getElementById("excelStatus");
const columnsContainer = document.getElementById("columnsContainer");
const columnChips = document.getElementById("columnChips");

const pdfInput = document.getElementById("pdfInput");
const pdfStatus = document.getElementById("pdfStatus");
const pageSelectorBox = document.getElementById("pageSelectorBox");
const pageSelect = document.getElementById("pageSelect");

const emptyCanvasPlaceholder = document.getElementById("emptyCanvasPlaceholder");
const certificateStage = document.getElementById("certificateStage");
const certificateBgImage = document.getElementById("certificateBgImage");
const fieldsOverlayLayer = document.getElementById("fieldsOverlayLayer");
const btnPreviewSample = document.getElementById("btnPreviewSample");
const workspaceHint = document.getElementById("workspaceHint");

const filenamePatternInput = document.getElementById("filenamePattern");
const startRowInput = document.getElementById("startRow");
const endRowInput = document.getElementById("endRow");
const btnGenerateBatch = document.getElementById("btnGenerateBatch");

// Controles de estilo
const noSelectionMsg = document.getElementById("noSelectionMsg");
const styleControls = document.getElementById("styleControls");
const fieldTemplateText = document.getElementById("fieldTemplateText");
const fontFamily = document.getElementById("fontFamily");
const fontSize = document.getElementById("fontSize");
const fontColor = document.getElementById("fontColor");
const btnBold = document.getElementById("btnBold");
const btnItalic = document.getElementById("btnItalic");
const alignButtons = document.querySelectorAll(".align-btn");
const coordsReadout = document.getElementById("coordsReadout");
const btnDeleteField = document.getElementById("btnDeleteField");

// ============================================================================
// 1. CARGA DE EXCEL Y GENERACIÓN DE CHIPS
// ============================================================================
excelInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    excelStatus.textContent = "Procesando Excel...";
    excelStatus.classList.remove("hidden");

    try {
        const res = await fetch("/api/upload-excel", {
            method: "POST",
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al subir Excel");

        state.excelFilename = data.filename;
        state.headers = data.headers;
        state.totalRecords = data.total_records;

        startRowInput.value = 1;
        endRowInput.value = data.total_records;
        endRowInput.max = data.total_records;
        startRowInput.max = data.total_records;

        excelStatus.textContent = `✓ ${file.name} (${data.total_records} registros)`;
        renderColumnChips();
        updateToolbarStatus();
    } catch (err) {
        excelStatus.textContent = `Error: ${err.message}`;
    }
});

function renderColumnChips() {
    columnChips.innerHTML = "";
    state.headers.forEach((header) => {
        const chip = document.createElement("div");
        chip.className = "field-chip";
        chip.textContent = `+ ${header}`;
        chip.draggable = true;

        // Permitir agregar con un clic
        chip.addEventListener("click", () => {
            if (!state.templatePdfFilename) {
                alert("Primero sube la plantilla PDF en el paso 2.");
                return;
            }
            addFieldToCanvas(`{${header}}`, 150, 200);
        });

        // Permitir arrastrar hacia el lienzo (Drag & Drop)
        chip.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", `{${header}}`);
        });

        columnChips.appendChild(chip);
    });
    columnsContainer.classList.remove("hidden");
}

// ============================================================================
// 2. CARGA DE PLANTILLA PDF Y RENDERIZADO EN EL LIENZO
// ============================================================================
pdfInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    pdfStatus.textContent = "Renderizando plantilla PDF...";
    pdfStatus.classList.remove("hidden");

    try {
        const res = await fetch("/api/upload-template", {
            method: "POST",
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al subir PDF");

        state.templatePdfFilename = data.template_pdf_filename;
        state.pages = data.pages;
        state.currentPage = 1;

        pdfStatus.textContent = `✓ Plantilla lista (${data.total_pages} pág.)`;
        setupPageSelector();
        loadPageOnCanvas(1);
        updateToolbarStatus();
    } catch (err) {
        pdfStatus.textContent = `Error: ${err.message}`;
    }
});

function setupPageSelector() {
    pageSelect.innerHTML = "";
    state.pages.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.page_number;
        opt.textContent = `Página ${p.page_number}`;
        pageSelect.appendChild(opt);
    });

    if (state.pages.length > 1) {
        pageSelectorBox.classList.remove("hidden");
    } else {
        pageSelectorBox.classList.add("hidden");
    }
}

pageSelect.addEventListener("change", (e) => {
    state.currentPage = parseInt(e.target.value, 10);
    state.selectedFieldId = null;
    updateStylePanel();
    loadPageOnCanvas(state.currentPage);
});

function loadPageOnCanvas(pageNumber) {
    const pageInfo = state.pages.find((p) => p.page_number === pageNumber);
    if (!pageInfo) return;

    emptyCanvasPlaceholder.classList.add("hidden");
    certificateStage.classList.remove("hidden");

    // Ajustar ancho máximo visual en pantalla manteniendo proporción exacta del PDF
    const maxDisplayWidth = 860;
    const displayWidth = Math.min(maxDisplayWidth, pageInfo.pdf_width * 1.15);
    state.scaleRatio = displayWidth / pageInfo.pdf_width;

    certificateStage.style.width = `${displayWidth}px`;
    certificateStage.style.height = `${pageInfo.pdf_height * state.scaleRatio}px`;

    certificateBgImage.src = `${pageInfo.preview_url}?t=${Date.now()}`;
    renderFieldsOnCanvas();
}

// ============================================================================
// DETECCIÓN DE CENTRO Y MAGNETISMO (SMART GUIDES)
// ============================================================================
function applyCenterSnap(rawX, rawY, boxWidth, boxHeight) {
    const pageInfo = state.pages.find((p) => p.page_number === state.currentPage);
    if (!pageInfo) {
        return { x: rawX, y: rawY, snappedX: false, snappedY: false };
    }

    const pageCenterX = pageInfo.pdf_width / 2;
    const pageCenterY = pageInfo.pdf_height / 2;

    // Margen de tolerancia en puntos PDF (6 pt ≈ 2 milímetros)
    const snapThreshold = 6;

    let finalX = rawX;
    let finalY = rawY;
    let snappedX = false;
    let snappedY = false;

    // Comprobar si el centro horizontal del elemento está cerca del centro de la hoja
    const elementCenterX = rawX + boxWidth / 2;
    if (Math.abs(elementCenterX - pageCenterX) <= snapThreshold) {
        finalX = pageCenterX - boxWidth / 2;
        snappedX = true;
    }

    // Comprobar si el centro vertical del elemento está cerca del centro de la hoja
    const elementCenterY = rawY + boxHeight / 2;
    if (Math.abs(elementCenterY - pageCenterY) <= snapThreshold) {
        finalY = pageCenterY - boxHeight / 2;
        snappedY = true;
    }

    // Mostrar u ocultar las líneas guía en pantalla
    guideLineVertical.classList.toggle("hidden", !snappedX);
    guideLineHorizontal.classList.toggle("hidden", !snappedY);

    return {
        x: Math.max(0, Math.round(finalX * 10) / 10),
        y: Math.max(0, Math.round(finalY * 10) / 10),
    };
}

function hideCenterGuides() {
    guideLineVertical.classList.add("hidden");
    guideLineHorizontal.classList.add("hidden");
}

// ============================================================================
// 3. CREACIÓN, ARRASTRE Y REDIMENSIONAMIENTO DE CAMPOS EN EL LIENZO
// ============================================================================
certificateStage.addEventListener("dragover", (e) => {
    e.preventDefault();
});

certificateStage.addEventListener("drop", (e) => {
    e.preventDefault();
    const templateText = e.dataTransfer.getData("text/plain");
    if (!templateText || !state.templatePdfFilename) return;

    const rect = certificateStage.getBoundingClientRect();
    const dropX = (e.clientX - rect.left) / state.scaleRatio;
    const dropY = (e.clientY - rect.top) / state.scaleRatio;

    // Centrar la caja de 320pt x 18pt justo en la punta del cursor al soltar
    addFieldToCanvas(templateText, Math.max(0, dropX - 160), Math.max(0, dropY - 9));
});

function addFieldToCanvas(templateText, pdfX, pdfY) {
    const newField = {
        id: `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: "text",
        page: state.currentPage,
        template: templateText,
        x: Math.round(pdfX * 10) / 10,
        y: Math.round(pdfY * 10) / 10,
        width: 320,
        font_family: "arial",
        font_size: 18,
        bold: true,
        italic: false,
        color: "#0f2c59",
        align: "center",
    };

    state.fields.push(newField);
    state.selectedFieldId = newField.id;
    renderFieldsOnCanvas();
    updateStylePanel();
}

function renderFieldsOnCanvas() {
    fieldsOverlayLayer.innerHTML = "";

    const pageFields = state.fields.filter((f) => f.page === state.currentPage);

    pageFields.forEach((field) => {
        // --- ELEMENTOS DE IMAGEN (QR / SELLO) ---
        if (field.type === "image") {
            const imgBox = document.createElement("div");
            imgBox.className = "canvas-image-box";
            if (field.id === state.selectedFieldId) {
                imgBox.classList.add("selected");
            }

            imgBox.style.left = `${field.x * state.scaleRatio}px`;
            imgBox.style.top = `${field.y * state.scaleRatio}px`;
            imgBox.style.width = `${field.width * state.scaleRatio}px`;
            imgBox.style.height = `${field.height * state.scaleRatio}px`;

            const imgEl = document.createElement("img");
            imgEl.src = field.image_url;
            imgEl.draggable = false;
            imgBox.appendChild(imgEl);

            const cornerHandle = document.createElement("div");
            cornerHandle.className = "resize-handle-corner";
            imgBox.appendChild(cornerHandle);

            // Arrastrar posición del QR con fluidez
            imgBox.addEventListener("mousedown", (e) => {
                if (e.target === cornerHandle) return;
                e.preventDefault();
                e.stopPropagation();

                if (state.selectedFieldId !== field.id) {
                    state.selectedFieldId = field.id;
                    document
                        .querySelectorAll(".canvas-field-box, .canvas-image-box")
                        .forEach((el) => el.classList.remove("selected"));
                    imgBox.classList.add("selected");
                    updateStylePanel();
                }

                const startX = e.clientX;
                const startY = e.clientY;
                const origX = field.x;
                const origY = field.y;

                const onMove = (moveEv) => {
                    const dx = (moveEv.clientX - startX) / state.scaleRatio;
                    const dy = (moveEv.clientY - startY) / state.scaleRatio;
                    const snapped = applyCenterSnap(
                        origX + dx,
                        origY + dy,
                        field.width,
                        field.height
                    );
                    field.x = snapped.x;
                    field.y = snapped.y;

                    imgBox.style.left = `${field.x * state.scaleRatio}px`;
                    imgBox.style.top = `${field.y * state.scaleRatio}px`;
                    imageCoordsReadout.textContent = `X: ${field.x} pt | Y: ${field.y} pt | ${Math.round(field.width)} x ${Math.round(field.height)} pt`;
                };

                const onUp = () => {
                    hideCenterGuides();
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                };

                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
            });

            // Redimensionar proporcionalmente desde la esquina
            cornerHandle.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const origWidth = field.width;

                const onResize = (moveEv) => {
                    const dw = (moveEv.clientX - startX) / state.scaleRatio;
                    const newW = Math.max(20, Math.round((origWidth + dw) * 10) / 10);
                    field.width = newW;
                    field.height = Math.round((newW / field.aspect_ratio) * 10) / 10;

                    imgBox.style.width = `${field.width * state.scaleRatio}px`;
                    imgBox.style.height = `${field.height * state.scaleRatio}px`;
                    imageWidthInput.value = Math.round(field.width);
                    imageCoordsReadout.textContent = `X: ${field.x} pt | Y: ${field.y} pt | ${Math.round(field.width)} x ${Math.round(field.height)} pt`;
                };

                const onResizeUp = () => {
                    window.removeEventListener("mousemove", onResize);
                    window.removeEventListener("mouseup", onResizeUp);
                };

                window.addEventListener("mousemove", onResize);
                window.addEventListener("mouseup", onResizeUp);
            });

            fieldsOverlayLayer.appendChild(imgBox);
            return;
        }

        // --- ELEMENTOS DE TEXTO ---
        const box = document.createElement("div");
        box.className = "canvas-field-box";
        if (field.id === state.selectedFieldId) {
            box.classList.add("selected");
        }

        box.style.left = `${field.x * state.scaleRatio}px`;
        box.style.top = `${field.y * state.scaleRatio}px`;
        box.style.width = `${field.width * state.scaleRatio}px`;

        box.style.fontFamily =
            field.font_family === "times"
                ? "'Times New Roman', serif"
                : field.font_family === "courier"
                ? "'Courier New', monospace"
                : "Arial, Helvetica, sans-serif";
        box.style.fontSize = `${field.font_size * state.scaleRatio}px`;
        box.style.fontWeight = field.bold ? "bold" : "normal";
        box.style.fontStyle = field.italic ? "italic" : "normal";
        box.style.color = field.color;
        box.style.textAlign = field.align;
        box.textContent = field.template;

        const resizeHandle = document.createElement("div");
        resizeHandle.className = "resize-handle-right";
        box.appendChild(resizeHandle);

        // Evento de selección y arrastre de texto sin reconstruir el DOM
        box.addEventListener("mousedown", (e) => {
            if (e.target === resizeHandle) return;
            e.preventDefault();
            e.stopPropagation();

            if (state.selectedFieldId !== field.id) {
                state.selectedFieldId = field.id;
                document
                    .querySelectorAll(".canvas-field-box, .canvas-image-box")
                    .forEach((el) => el.classList.remove("selected"));
                box.classList.add("selected");
                updateStylePanel();
            }

            const startX = e.clientX;
            const startY = e.clientY;
            const origX = field.x;
            const origY = field.y;

            const onMouseMove = (moveEv) => {
                const dx = (moveEv.clientX - startX) / state.scaleRatio;
                const dy = (moveEv.clientY - startY) / state.scaleRatio;
                const snapped = applyCenterSnap(
                    origX + dx,
                    origY + dy,
                    field.width,
                    field.font_size
                );
                field.x = snapped.x;
                field.y = snapped.y;

                box.style.left = `${field.x * state.scaleRatio}px`;
                box.style.top = `${field.y * state.scaleRatio}px`;
                updateCoordsReadout(field);
            };

            const onMouseUp = () => {
                hideCenterGuides();
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        });

        // Evento de redimensionamiento de ancho de texto
        resizeHandle.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const origWidth = field.width;

            const onResizeMove = (moveEv) => {
                const dw = (moveEv.clientX - startX) / state.scaleRatio;
                field.width = Math.max(60, Math.round(origWidth + dw));
                box.style.width = `${field.width * state.scaleRatio}px`;
                updateCoordsReadout(field);
            };

            const onResizeUp = () => {
                window.removeEventListener("mousemove", onResizeMove);
                window.removeEventListener("mouseup", onResizeUp);
            };

            window.addEventListener("mousemove", onResizeMove);
            window.addEventListener("mouseup", onResizeUp);
        });

        fieldsOverlayLayer.appendChild(box);
    });
}

// ============================================================================
// 4. PANEL DE EDICIÓN DE ESTILOS EN TIEMPO REAL
// ============================================================================
function getSelectedField() {
    return state.fields.find((f) => f.id === state.selectedFieldId) || null;
}

function updateStylePanel() {
    const field = getSelectedField();
    if (!field) {
        noSelectionMsg.classList.remove("hidden");
        styleControls.classList.add("hidden");
        imageControls.classList.add("hidden");
        return;
    }

    noSelectionMsg.classList.add("hidden");

    if (field.type === "image") {
        styleControls.classList.add("hidden");
        imageControls.classList.remove("hidden");
        imageWidthInput.value = Math.round(field.width);
        imageCoordsReadout.textContent = `X: ${field.x} pt | Y: ${field.y} pt | ${Math.round(field.width)} x ${Math.round(field.height)} pt`;
        return;
    }

    imageControls.classList.add("hidden");
    styleControls.classList.remove("hidden");

    fieldTemplateText.value = field.template;
    fontFamily.value = field.font_family;
    fontSize.value = field.font_size;
    fontColor.value = field.color;

    btnBold.classList.toggle("active", field.bold);
    btnItalic.classList.toggle("active", field.italic);

    alignButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.align === field.align);
    });

    updateCoordsReadout(field);
}

function updateCoordsReadout(field) {
    coordsReadout.textContent = `X: ${field.x} pt | Y: ${field.y} pt | Ancho: ${field.width} pt`;
}

fieldTemplateText.addEventListener("input", (e) => {
    const field = getSelectedField();
    if (!field) return;
    field.template = e.target.value;
    renderFieldsOnCanvas();
});

fontFamily.addEventListener("change", (e) => {
    const field = getSelectedField();
    if (!field) return;
    field.font_family = e.target.value;
    renderFieldsOnCanvas();
});

fontSize.addEventListener("input", (e) => {
    const field = getSelectedField();
    if (!field) return;
    field.font_size = parseFloat(e.target.value) || 12;
    renderFieldsOnCanvas();
});

fontColor.addEventListener("input", (e) => {
    const field = getSelectedField();
    if (!field) return;
    field.color = e.target.value;
    renderFieldsOnCanvas();
});

btnBold.addEventListener("click", () => {
    const field = getSelectedField();
    if (!field) return;
    field.bold = !field.bold;
    btnBold.classList.toggle("active", field.bold);
    renderFieldsOnCanvas();
});

btnItalic.addEventListener("click", () => {
    const field = getSelectedField();
    if (!field) return;
    field.italic = !field.italic;
    btnItalic.classList.toggle("active", field.italic);
    renderFieldsOnCanvas();
});

alignButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const field = getSelectedField();
        if (!field) return;
        field.align = btn.dataset.align;
        alignButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderFieldsOnCanvas();
    });
});

btnDeleteField.addEventListener("click", () => {
    if (!state.selectedFieldId) return;
    state.fields = state.fields.filter((f) => f.id !== state.selectedFieldId);
    state.selectedFieldId = null;
    renderFieldsOnCanvas();
    updateStylePanel();
});

// ============================================================================
// 5. SUBIDA DE QR Y CONTROLES DE IMAGEN
// ============================================================================
qrInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!state.templatePdfFilename) {
        alert("Primero sube la plantilla PDF antes de agregar el QR.");
        qrInput.value = "";
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    qrStatus.textContent = "Cargando imagen QR...";
    qrStatus.classList.remove("hidden");

    try {
        const res = await fetch("/api/upload-image", {
            method: "POST",
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al subir imagen");

        const defaultWidth = 85;
        const aspect = data.aspect_ratio || 1.0;

        const newImageField = {
            id: `img_${Date.now()}`,
            type: "image",
            page: state.currentPage,
            image_filename: data.image_filename,
            image_url: data.image_url,
            aspect_ratio: aspect,
            x: 100,
            y: 100,
            width: defaultWidth,
            height: Math.round((defaultWidth / aspect) * 10) / 10,
        };

        state.fields.push(newImageField);
        state.selectedFieldId = newImageField.id;

        qrStatus.textContent = `✓ QR agregado (${file.name})`;
        renderFieldsOnCanvas();
        updateStylePanel();
    } catch (err) {
        qrStatus.textContent = `Error: ${err.message}`;
    } finally {
        qrInput.value = "";
    }
});

imageWidthInput.addEventListener("input", (e) => {
    const field = getSelectedField();
    if (!field || field.type !== "image") return;
    const newW = Math.max(20, parseFloat(e.target.value) || 85);
    field.width = newW;
    field.height = Math.round((newW / field.aspect_ratio) * 10) / 10;
    renderFieldsOnCanvas();
    updateStylePanel();
});

btnDeleteImage.addEventListener("click", () => {
    if (!state.selectedFieldId) return;
    state.fields = state.fields.filter((f) => f.id !== state.selectedFieldId);
    state.selectedFieldId = null;
    renderFieldsOnCanvas();
    updateStylePanel();
});

// ============================================================================
// 6. VISTA PREVIA Y EMISIÓN MASIVA EN LOTE (ZIP)
// ============================================================================
function updateToolbarStatus() {
    if (state.templatePdfFilename) {
        btnPreviewSample.disabled = false;
        workspaceHint.textContent =
            "Arrastra los campos sobre el certificado y ajusta su estilo en el panel izquierdo";
    }
    if (state.templatePdfFilename && state.excelFilename) {
        btnGenerateBatch.disabled = false;
    }
}

function buildElementsPayload() {
    return state.fields.map((f) => {
        if (f.type === "image") {
            return {
                type: "image",
                page: f.page,
                image_filename: f.image_filename,
                x: f.x,
                y: f.y,
                width: f.width,
                height: f.height,
            };
        }
        return {
            type: "text",
            page: f.page,
            text: f.template,
            x: f.x,
            y: f.y,
            width: f.width,
            font_family: f.font_family,
            font_size: f.font_size,
            bold: f.bold,
            italic: f.italic,
            color: f.color,
            align: f.align,
        };
    });
}

btnPreviewSample.addEventListener("click", async () => {
    if (!state.templatePdfFilename || state.fields.length === 0) {
        alert("Agrega al menos un campo sobre el certificado antes de previsualizar.");
        return;
    }

    btnPreviewSample.textContent = "Generando muestra...";
    btnPreviewSample.disabled = true;

    try {
        const res = await fetch("/api/test-pdf-overlay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                template_pdf_filename: state.templatePdfFilename,
                excel_filename: state.excelFilename,
                start_row: parseInt(startRowInput.value, 10) || 1,
                start_correlative: parseInt(startCorrelativeInput.value, 10) || 1,
                elements: buildElementsPayload(),
            }),
        });

        if (!res.ok) throw new Error("Error al generar vista previa PDF");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
    } catch (err) {
        alert(err.message);
    } finally {
        btnPreviewSample.textContent = "Vista Previa (Fila 1)";
        btnPreviewSample.disabled = false;
    }
});

btnGenerateBatch.addEventListener("click", async () => {
    if (!state.excelFilename || !state.templatePdfFilename) {
        alert("Debes cargar tanto el archivo Excel como la plantilla PDF.");
        return;
    }
    if (state.fields.length === 0) {
        alert("Coloca al menos un campo sobre el certificado antes de generar el lote.");
        return;
    }

    const startRow = parseInt(startRowInput.value, 10) || 1;
    const endRow = parseInt(endRowInput.value, 10) || state.totalRecords;
    const startCorrelative = parseInt(startCorrelativeInput.value, 10) || 1;
    const filenamePattern = filenamePatternInput.value.trim() || "{DATOS COMPLETOS}";

    if (startRow > endRow) {
        alert("La fila inicial no puede ser mayor que la fila final.");
        return;
    }

    const originalText = btnGenerateBatch.textContent;
    btnGenerateBatch.textContent = `Generando (${endRow - startRow + 1} PDFs)...`;
    btnGenerateBatch.disabled = true;

    try {
        const res = await fetch("/api/generate-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                excel_filename: state.excelFilename,
                template_pdf_filename: state.templatePdfFilename,
                elements: buildElementsPayload(),
                filename_pattern: filenamePattern,
                start_row: startRow,
                end_row: endRow,
                start_correlative: startCorrelative,
            }),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Error al generar los certificados");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `certificados_filas_${startRow}_a_${endRow}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        alert(err.message);
    } finally {
        btnGenerateBatch.textContent = originalText;
        btnGenerateBatch.disabled = false;
    }
});