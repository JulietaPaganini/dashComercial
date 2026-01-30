import * as XLSX from 'xlsx';
import { parseCurrency, detectCurrency, parseExcelDate } from './Utils';

export const parseExcelFiles = async (files) => {
    const dataset = {
        quotes: [],
        sales: [],
        clients: [],
        audit: {}, // Initialize Audit Map
        issues: [] // { file, sheet, row, column, type, value, message }
    };

    for (const file of files) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);

            // --- STRATEGY: Detect File Type based on Sheet Names ---
            const sheetNames = workbook.SheetNames;
            console.log('[PARSER] File:', file.name, 'Sheets:', sheetNames);

            const isQuotesFile = sheetNames.some(s => s.toUpperCase().includes('PRESUPUESTOS'));

            // In this specific case, if it's not the Quotes file, we assume it's the Clients file
            // because the user promised 2 specific files.

            if (isQuotesFile) {
                processQuotesFile(workbook, dataset);
            } else {
                processClientsFile(workbook, dataset);
            }

        } catch (error) {
            dataset.issues.push({
                file: file.name,
                sheet: 'GENERAL',
                row: 0,
                column: 'N/A',
                type: 'CRITICAL',
                value: error.message,
                message: 'No se pudo leer el archivo. Asegurate de que no esté corrupto.'
            });
        }
    }

    return dataset;
};

// --- QUOTES FILE PROCESSING ---
const processQuotesFile = (workbook, dataset) => {
    // 1. PRESUPUESTOS Sheet
    const quotesSheet = workbook.Sheets['PRESUPUESTOS'];
    if (quotesSheet) {
        // Step 1: Find Header Row dynamically
        const aoa = XLSX.utils.sheet_to_json(quotesSheet, { header: 1, defval: null, raw: false });
        let headerRowIndex = 0;

        // Look for a row containing 'CLIENTE' and 'FECHA' to serve as headers (max scan 20 rows)
        for (let i = 0; i < Math.min(aoa.length, 20); i++) {
            const rowValues = aoa[i]?.map(v => String(v).toUpperCase().trim()) || [];
            if (rowValues.includes('CLIENTE') && rowValues.some(v => v.includes('FECHA'))) {
                headerRowIndex = i;
                console.log('[PARSER] Found Quotes Header at Row:', i, rowValues);
                break;
            }
            // Log failed attempts to debug
            if (i < 5) console.log('[PARSER] Scanning Row', i, rowValues);
        }

        // Step 2: Parse using the identified header row
        const range = XLSX.utils.decode_range(quotesSheet['!ref']);
        range.s.r = headerRowIndex;
        // FORCE RAW: FALSE to prevent number conversion (e.g. 13.830 -> 13.83)
        const rawQuotes = XLSX.utils.sheet_to_json(quotesSheet, { range: range, defval: null, raw: false });

        // Normalize
        rawQuotes.forEach((row) => {
            const normalized = {};
            Object.keys(row).forEach(key => {
                const cleanKey = key.trim().toUpperCase();

                // STRICT ID MAPPING: Avoid capturing "Nº OC" or "Nº Cliente" as the ID
                if (['Nº', 'N°', 'NUMERO', 'NÚMERO', 'NO.', 'Nº PRESUPUESTO', 'Nº COTIZACION'].includes(cleanKey)) {
                    normalized.id = row[key];
                }
                // Fallback for "Nº" prefix only if not already found and not a forbidden type
                else if ((cleanKey.startsWith('Nº') || cleanKey.startsWith('N°')) && !normalized.id) {
                    const blacklist = ['OC', 'FC', 'FACTURA', 'CLIENTE', 'REMITO', 'PEDIDO'];
                    if (!blacklist.some(term => cleanKey.includes(term))) {
                        normalized.id = row[key];
                    }
                }

                else if (cleanKey.includes('FECHA')) normalized.date = row[key];
                else if (cleanKey === 'CLIENTE') normalized.client = row[key];
                else if (cleanKey.includes('DESCRIPCION')) normalized.description = row[key];
                else if (cleanKey.includes('OBSERVACIONES') || cleanKey === 'OBS') normalized.observations = row[key];
                else if (cleanKey.includes('A FACTURAR') || cleanKey.includes('TOTAL') || cleanKey.includes('MONTO') || cleanKey.includes('PRECIO') || cleanKey.includes('VALOR') || cleanKey.includes('IMPORTE')) {
                    normalized.amount = row[key];
                    normalized.currency = detectCurrency(row[key]);
                }
                else if (cleanKey === 'ESTADO') normalized.status = row[key];
                else if (cleanKey === 'EQUIPO' || cleanKey === 'EQUIPO - PATENTE') normalized.equipment = row[key];
            });

            if (normalized.id) {
                dataset.quotes.push(normalized);
            }
        });
    }

    // 2. VENTAS Sheet
    const salesSheet = workbook.Sheets['VENTAS'];
    if (salesSheet) {
        // Same header finding logic for Sales (robustness)
        const aoa = XLSX.utils.sheet_to_json(salesSheet, { header: 1, defval: null });
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(aoa.length, 20); i++) {
            const rowValues = aoa[i]?.map(v => String(v).toUpperCase().trim()) || [];
            if (rowValues.includes('CLIENTE') && rowValues.some(v => v.includes('FECHA'))) {
                headerRowIndex = i;
                break;
            }
        }

        const range = XLSX.utils.decode_range(salesSheet['!ref']);
        range.s.r = headerRowIndex;
        const rawSales = XLSX.utils.sheet_to_json(salesSheet, { range: range, defval: null });

        rawSales.forEach(row => {
            const normalized = {};
            Object.keys(row).forEach(key => {
                const cleanKey = key.trim().toUpperCase();
                // Link
                if (cleanKey === 'Nº' || cleanKey === 'N°' || (cleanKey.includes('COTIZACION') && !cleanKey.includes('FECHA') && !cleanKey.includes('DATE'))) normalized.quoteId = row[key];

                // Vehiculo / Equipo
                else if (cleanKey.includes('DOMINIO') || cleanKey.includes('CC')) normalized.domain = row[key];

                // Dates
                else if (cleanKey === 'FECHA DE OC' || cleanKey === 'FECHA OC') normalized.ocDate = row[key];
                else if (cleanKey === 'FECHA DE ENTREGA') normalized.deliveryDate = row[key];
                else if (cleanKey.includes('FECHA FACTURA') || cleanKey.includes('FECHA FC') || cleanKey.includes('F. FACTURA') || cleanKey.includes('F. FC')) normalized.invoiceDate = row[key];
                else if (cleanKey === 'FECHA COBRO') normalized.paymentDate = row[key];

                // Financials
                else if (cleanKey.includes('COSTO')) {
                    normalized.cost = row[key];
                    normalized.currency = detectCurrency(row[key]); // Assuming cost follows same currency as sale? Usually yes.
                }
                // Robust check for Benefits: Match both "BENEFICIO ... ($)" and simple "BEN $"
                else if ((cleanKey.includes('BENEFICIO') && cleanKey.includes('$')) || cleanKey === 'BEN $' || cleanKey === 'BENEFICIO') normalized.profitAmount = row[key];
                // Robust check for Percent: Match both "BENEFICIO ... (%)" and simple "BEN %"
                else if ((cleanKey.includes('BENEFICIO') && cleanKey.includes('%')) || cleanKey === 'BEN %') normalized.profitPercent = row[key];
                else if (cleanKey === 'A COBRAR STD') normalized.receivableStd = row[key];
                else if (cleanKey === 'A COBRAR REAL') normalized.receivableReal = row[key];

                // Status / Docs
                else if (cleanKey === 'ESTADO') normalized.collectionStatus = row[key];
                else if (cleanKey === 'OC Nº' || cleanKey === 'OC N°') normalized.ocNumber = row[key];
                else if (cleanKey.includes('FC Nº') || cleanKey.includes('FC N°')) normalized.invoiceNumber = row[key];

                // Operational / Policy
                else if (cleanKey === 'HS COTIZADAS') normalized.hoursQuoted = row[key];
                else if (cleanKey === 'HS UTILIZADAS') normalized.hoursUsed = row[key];
                else if (cleanKey === 'POLIZA') normalized.policyIndex = row[key];
                else if (cleanKey === 'ESTADO DE POLIZA') normalized.policyStatus = row[key];

                // Desc
                else if (cleanKey === 'DESCRIPCION' || cleanKey === 'DESCRIPCION DEL TRABAJO' || cleanKey === 'DESC. TRABAJO' || cleanKey === 'DESC TRABAJO') normalized.workDescription = row[key];
            });

            if (normalized.quoteId || (normalized.client && typeof normalized.amount === 'number')) {
                // Determine a fallback ID if missing (needed for keys)
                if (!normalized.quoteId) {
                    normalized.quoteId = `SIN-COT-${Math.random().toString(36).substr(2, 5)}`;
                }
                dataset.sales.push(normalized);
            }
        });
    }
};

// --- CLIENTS FILE PROCESSING ---
const processClientsFile = (workbook, dataset) => {
    // Initialize audit container
    dataset.audit = {};

    workbook.SheetNames.forEach((sheetName, sheetIdx) => {
        try {
            console.log(`[PARSER DEBUG] Processing Sheet: ${sheetName}`);

            // Skip summary sheets unique names
            if (sheetName.toUpperCase().includes('RESUMEN') || sheetName.toUpperCase().includes('SALDO TANGO')) {
                console.log(`[PARSER DEBUG] Skipping Excluded Sheet: ${sheetName}`);
                return;
            }

            // SKIP HIDDEN SHEETS
            // Check workbook metadata for visibility
            if (workbook.Workbook && workbook.Workbook.Sheets) {
                const sheetMeta = workbook.Workbook.Sheets[sheetIdx];
                // Hidden: 1 (Hidden), 2 (Very Hidden). Visible: 0
                if (sheetMeta && sheetMeta.Hidden !== 0) {
                    console.log(`[PARSER DEBUG] Skipping Hidden Sheet: ${sheetName} (Hidden Code: ${sheetMeta.Hidden})`);
                    return;
                }
            }

            const sheet = workbook.Sheets[sheetName];

            // DYNAMIC HEADER FINDING
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
            let headerRowIndex = 2; // Default to Row 3 (Index 2) as fallback

            // Scan first 50 rows to find the real header
            for (let i = 0; i < Math.min(aoa.length, 50); i++) {
                const rowValues = aoa[i]?.map(v => String(v).toUpperCase().trim()) || [];
                // Criteria: Must have FECHA and (IMPORTE or DEBE or HABER or COMPROBANTE)
                const hasFecha = rowValues.some(v => v === 'FECHA' || v.includes('DATE') || v === 'VILLA');
                const hasImporte = rowValues.some(v => v.includes('IMPORTE') || v === 'DEBE' || v === 'HABER' || v === 'SALDO' || v === 'TOTAL' || v === 'MONTO');
                const hasComp = rowValues.some(v => v.includes('COMPROBANTE') || v.includes('TIPO') || v.includes('DETALLE'));

                // Special case for Automat: sometimes headers are implicit or row is "FECHA | TIPO | ..."
                if (hasFecha && (hasImporte || hasComp)) {
                    headerRowIndex = i;
                    console.log(`[PARSER DEBUG] Found Header for ${sheetName} at Row ${i + 1}`);
                    break;
                }
            }

            const range = XLSX.utils.decode_range(sheet['!ref']);
            range.s.r = headerRowIndex;
            console.warn(`[PARSER DEBUG] ${sheetName} - Using Header Row: ${headerRowIndex}`);

            // Get Valid Range
            // FORCE RAW: FALSE to prevent "13.830" becoming 13.83 (Number)
            // This ensures we get the displayed string (e.g. "13.830") and can parse it with our logic
            const rawClientRows = XLSX.utils.sheet_to_json(sheet, { range: range, defval: null, raw: false });

            let lastValidRow = {};

            // --- STRICT AUDIT SCAN: "TOTAL DEUDA" ---
            const fullSheetAoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

            // Scan ALL rows for "TOTAL DEUDA" marker
            // Strategy: Find cell with "TOTAL DEUDA", get next cell value
            for (let r = 0; r < fullSheetAoa.length; r++) {
                const row = fullSheetAoa[r];
                if (!row || row.length === 0) continue;

                // Find index of "TOTAL DEUDA"
                const markerIndex = row.findIndex(cell =>
                    cell && String(cell).toUpperCase().trim().includes('TOTAL DEUDA')
                );

                if (markerIndex !== -1 && markerIndex < row.length - 1) {
                    // Get Value from adjacent cell
                    const rawValue = row[markerIndex + 1];
                    const parsedValue = parseCurrency(rawValue);

                    // ALWAYS capture if marker found (even if 0 or empty)
                    dataset.audit[sheetName.trim()] = parsedValue;
                    console.log(`[PARSER AUDIT] Found TOTAL DEUDA detected: ${parsedValue}`);
                    break; // Stop after finding the first match
                }
            }

            rawClientRows.forEach((row) => {
                const rowValuesStrDebug = Object.values(row).map(v => String(v).toUpperCase()).join(' ');

                // DEBUG TRACE FOR SPECIFIC MISSING ROWS
                if (rowValuesStrDebug.includes('200000095') || rowValuesStrDebug.includes('1311')) {
                    console.warn(`[PARSER TRACE] Found Target Row in ${sheetName}:`, row);
                    console.warn(`[PARSER TRACE] Keys available:`, Object.keys(row));
                }

                const normalized = {
                    clientSheet: sheetName.trim() // Track which client this belongs to
                };

                let hasData = false;

                // 2. NORMALIZE ROW DATA
                Object.keys(row).forEach(key => {
                    // Normalize: Trim, Uppercase, and Remove Accents (DÉBITO -> DEBITO)
                    const cleanKey = key.trim().toUpperCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                    if (cleanKey === 'FECHA') { normalized.date = parseExcelDate(row[key]); hasData = true; }
                    else if (cleanKey === 'TIPO COMP') { normalized.type = row[key]; hasData = true; }
                    else if (cleanKey === 'NUMERO') { normalized.number = row[key]; hasData = true; }
                    else if (cleanKey === 'FECHA VTO') { normalized.dueDate = parseExcelDate(row[key]); }
                    else if (cleanKey === 'FECHA VTO') { normalized.dueDate = parseExcelDate(row[key]); }
                    else if (cleanKey.includes('IMPORTE') || cleanKey === 'MONTO' || cleanKey === 'VALOR') {
                        // Priority: Explicit IMPORTE or Synonyms (Fuzzy Match)
                        const rawAmt = row[key];
                        // Ignore if 0, to allow fallback to SALDO/DEBE/HABER if present
                        if (rawAmt !== null && rawAmt !== undefined && String(rawAmt).trim() !== '' && String(rawAmt).trim() !== '-' && parseCurrency(rawAmt) !== 0) {
                            normalized.amount = rawAmt;
                            hasData = true;
                        }
                    }
                    else if (cleanKey === 'DEBE' || cleanKey === 'DEBITO') {
                        // Priority similar to IMPORTE
                        const rawAmt = row[key];
                        // If we don't have an amount yet (or previous was 0), take this
                        if ((normalized.amount === undefined || parseCurrency(normalized.amount) === 0) && rawAmt) {
                            if (parseCurrency(rawAmt) !== 0) {
                                normalized.amount = rawAmt;
                                hasData = true;
                            }
                        }
                    }
                    else if (cleanKey === 'HABER' || cleanKey === 'CREDITO') {
                        const rawAmt = row[key];
                        if ((normalized.amount === undefined || parseCurrency(normalized.amount) === 0) && rawAmt) {
                            // Credits are usually positive in the column, but negative for debt.
                            // We'll store the number. DataProcessor handles sign based on Type, OR we rely on DataProcessor logic.
                            // But we must ensure we captured it.
                            if (parseCurrency(rawAmt) !== 0) {
                                normalized.amount = rawAmt;
                                hasData = true;
                            }
                        }
                    }
                    else if (cleanKey.includes('SALDO') && (normalized.amount === undefined || parseCurrency(normalized.amount) === 0)) {
                        // Fallback: Use SALDO only if IMPORTE wasn't found yet or was 0
                        const rawAmt = row[key];
                        if (rawAmt !== null && rawAmt !== undefined && String(rawAmt).trim() !== '' && String(rawAmt).trim() !== '-') {
                            normalized.amount = rawAmt;
                            hasData = true;
                        }
                    }
                    else if (cleanKey === 'OBSERVACIONES' || cleanKey.includes('OBS') || cleanKey === 'DETALLE' || cleanKey === 'COMENTARIOS') {
                        if (row[key]) {
                            // Concatenate to avoid overwriting with empty columns or losing multiple data points
                            normalized.obs = (normalized.obs ? normalized.obs + ' ' : '') + row[key];
                        }
                    }
                });

                // 3. FALLBACK: BRUTE FORCE AMOUNT DETECTION
                // If we still have 0 amount, scan for ANY numeric value in the row that looks like money
                if (!normalized.amount || parseCurrency(normalized.amount) === 0) {
                    const potentialAmounts = Object.values(row).filter(val => {
                        if (!val) return false;
                        const num = parseCurrency(val);
                        if (num === 0) return false;
                        // Exclude obvious non-amounts
                        const str = String(val).toUpperCase();
                        if (str.includes('/') || str.includes('DATE') || str.includes(':')) return false; // Dates/Times
                        if (str === String(normalized.number)) return false; // Doc Number
                        if (str === String(normalized.clientSheet)) return false; // Client Name
                        if (str.length > 20) return false; // Too long description

                        // Exclude years (2023, 2024, 2025) if exactly that
                        if (num >= 2000 && num <= 2030 && Number.isInteger(num)) return false;

                        return true;
                    });

                    if (potentialAmounts.length > 0) {
                        // Take the last one? Or first? Often "Balance" is last.
                        // Let's take the one with largest absolute value?
                        // Or just the first one.
                        const fallbackAmt = potentialAmounts[0];
                        // Check if it really is a number
                        if (parseCurrency(fallbackAmt) !== 0) {
                            normalized.amount = fallbackAmt;
                            hasData = true;
                            console.warn(`[PARSER FALLBACK] Used brute force amount for ${sheetName} Row: ${fallbackAmt}`, row);
                        }
                    }
                }

                // 3. DATE SPLITTING LOGIC (Preserved)
                let paymentDates = [];
                const paymentKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'FECHA COBRO');
                const rawPaymentDate = paymentKey ? row[paymentKey] : null;

                // FIX: If Payment Date column contains TEXT like "SALDADA", capture it in OBS
                // otherwise it gets lost because it fails date parsing.
                if (typeof rawPaymentDate === 'string') {
                    const upperRaw = rawPaymentDate.toUpperCase();
                    if (upperRaw.includes('SALDADA') || upperRaw.includes('PAGAD') || upperRaw.includes('CANCEL') || upperRaw.includes('COMPEN')) {
                        normalized.obs = (normalized.obs || '') + ' - ' + rawPaymentDate;
                    }
                }

                if (typeof rawPaymentDate === 'string' && (rawPaymentDate.toUpperCase().includes(' Y ') || rawPaymentDate.includes('&'))) {
                    const parts = rawPaymentDate.split(/\s+[Yy&]\s+/);
                    parts.forEach(p => {
                        const d = parseExcelDate(p.trim());
                        if (d) paymentDates.push(d);
                    });
                } else if (rawPaymentDate) {
                    const d = parseExcelDate(rawPaymentDate);
                    if (d) paymentDates.push(d);
                } else if (normalized.paymentDate) {
                    paymentDates.push(normalized.paymentDate);
                }

                if (paymentDates.length === 0) paymentDates.push(null);

                // --- ROW PUSH LOOP ---
                paymentDates.forEach((pDate, pIdx) => {
                    const finalRow = { ...normalized }; // Clone
                    finalRow.paymentDate = pDate;

                    // Split Invoice logic: If multiple payment dates, split amount evenly
                    if (paymentDates.length > 1 && finalRow.amount) {
                        finalRow.amount = finalRow.amount / paymentDates.length;
                        finalRow.obs = `${finalRow.obs || ''} (Pago ${pIdx + 1}/${paymentDates.length})`;
                    }

                    // GHOST ROW PREVENTION
                    // Re-eval hasData for finalRow context
                    let currentHasData = hasData;
                    if (finalRow.paymentDate) currentHasData = true;

                    // CRITICAL FIX: PREVENT SUMMARY ROWS FROM BECOMING GHOST INVOICES
                    // If a row has "TOTAL" or "SALDO", it is NOT an invoice part.
                    const isSummaryText = rowValuesStrDebug.includes('TOTAL') ||
                        rowValuesStrDebug.includes('SALDO') ||
                        rowValuesStrDebug.includes('DEUDA') ||
                        rowValuesStrDebug.includes('DEVENGADO') ||
                        rowValuesStrDebug.includes('DIFERENCIA') || // Added due to Row 93 Ghost Invoice
                        rowValuesStrDebug.includes('RESTO'); // Added RESTO just in case

                    // STRICT CHECK: Do NOT fill down if it looks like a summary row
                    if (!isSummaryText && (finalRow.amount !== undefined && finalRow.amount !== null && finalRow.amount !== 0)) {
                        if (!finalRow.date && lastValidRow.date) {
                            finalRow.date = lastValidRow.date;
                            finalRow.type = lastValidRow.type || finalRow.type;
                            currentHasData = true;
                        }
                        if (!finalRow.number && lastValidRow.number) {
                            // FIX: Only fill down number for Invoice parts (positive), not isolated Payments/Credits (negative)
                            if (finalRow.amount >= 0) {
                                finalRow.number = lastValidRow.number;
                                currentHasData = true;
                            }
                        }

                        // FIX: If it's a Payment on Account (Negative) and has no number, give it a placeholder
                        // so it doesn't get dropped, but doesn't inherit a wrong number.
                        if (finalRow.amount < 0 && !finalRow.number) {
                            finalRow.number = 'SIN-REF';
                            currentHasData = true;
                        }

                    } else {
                        // If it IS summary text, FORCE rejection unless it explicitly has its own date (unlikely for totals)
                        if (isSummaryText) currentHasData = false;

                        // STRICTER CHECK: If no distinct invoice indicators, DROP IT.
                        if (!finalRow.number && !finalRow.type && !finalRow.paymentDate) {
                            currentHasData = false;
                        }
                    }

                    // EXTRA GHOST CHECK: If Amount is 0 and it's NOT a specific payment/settlement row (no date), drop it.
                    if (finalRow.amount === 0 && !finalRow.paymentDate && !finalRow.date) {
                        currentHasData = false;
                    }

                    // Final Filter
                    // Ensure we never push a summary row
                    if (currentHasData && finalRow.date && !isSummaryText && finalRow.amount !== undefined && finalRow.amount !== null) {
                        // DEBUG 310
                        if (String(finalRow.number).includes('310')) {
                            console.log('[DEBUG 310] Found Invoice 310:', finalRow);
                        }
                        dataset.clients.push(finalRow);

                        // Update Context only on first valid pass
                        if (pIdx === 0 && finalRow.number) lastValidRow = { ...finalRow };
                    }
                });
            });

            console.log(`[PARSER DEBUG] Finished Sheet: ${sheetName}. Total Clients Pushed so far: ${dataset.clients.length}`);

        } catch (err) {
            console.error(`[PARSER ERROR] Failed to process sheet ${sheetName}:`, err);
        }
    });
};
