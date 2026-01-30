import * as XLSX from 'xlsx';

export const parseExcelFiles = async (files) => {
    const dataset = {
        quotes: [],
        sales: [],
        clients: [],
        issues: [] // { file, sheet, row, column, type, value, message }
    };

    for (const file of files) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);

            // --- STRATEGY: Detect File Type based on Sheet Names ---
            const sheetNames = workbook.SheetNames;
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
// --- QUOTES FILE PROCESSING ---
const processQuotesFile = (workbook, dataset) => {
    // 1. PRESUPUESTOS Sheet
    const quotesSheet = workbook.Sheets['PRESUPUESTOS'];
    if (quotesSheet) {
        // Step 1: Find Header Row dynamically
        const aoa = XLSX.utils.sheet_to_json(quotesSheet, { header: 1, defval: null });
        let headerRowIndex = 0;

        // Look for a row containing 'CLIENTE' and 'FECHA' to serve as headers (max scan 20 rows)
        for (let i = 0; i < Math.min(aoa.length, 20); i++) {
            const rowValues = aoa[i]?.map(v => String(v).toUpperCase().trim()) || [];
            if (rowValues.includes('CLIENTE') && rowValues.some(v => v.includes('FECHA'))) {
                headerRowIndex = i;
                break;
            }
        }

        // Step 2: Parse using the identified header row
        const range = XLSX.utils.decode_range(quotesSheet['!ref']);
        range.s.r = headerRowIndex;
        const rawQuotes = XLSX.utils.sheet_to_json(quotesSheet, { range: range, defval: null });

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
                else if (cleanKey.includes('A FACTURAR') || cleanKey.includes('TOTAL') || cleanKey.includes('MONTO') || cleanKey.includes('PRECIO') || cleanKey.includes('VALOR') || cleanKey.includes('IMPORTE')) normalized.amount = row[key];
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
                else if (cleanKey === 'FECHA DE OC') normalized.ocDate = row[key];
                else if (cleanKey === 'FECHA DE ENTREGA') normalized.deliveryDate = row[key];
                else if (cleanKey.includes('FECHA FACTURA') || cleanKey.includes('FECHA FC')) normalized.invoiceDate = row[key];
                else if (cleanKey === 'FECHA COBRO') normalized.paymentDate = row[key];

                // Financials
                else if (cleanKey === 'COSTO') normalized.cost = row[key];
                else if (cleanKey.includes('BENEFICIO $')) normalized.profitAmount = row[key];
                else if (cleanKey.includes('BENEFICIO %')) normalized.profitPercent = row[key];
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
                else if (cleanKey === 'DESCRIPCION' || cleanKey === 'DESCRIPCION DEL TRABAJO') normalized.workDescription = row[key];
            });

            if (normalized.quoteId) {
                dataset.sales.push(normalized);
            }
        });
    }
};

// --- CLIENTS FILE PROCESSING ---
const processClientsFile = (workbook, dataset) => {
    workbook.SheetNames.forEach(sheetName => {
        // Skip summary sheets if any known ones avoid them, else process all
        if (sheetName.toUpperCase().includes('RESUMEN') || sheetName.toUpperCase().includes('SALDO TANGO')) return;

        const sheet = workbook.Sheets[sheetName];

        // We know headers are on Row 3 (Index 2)
        // range: s: {c:0, r:2} -> Start at row 2
        const range = XLSX.utils.decode_range(sheet['!ref']);
        range.s.r = 2; // Force start at 3rd row

        const rawClientRows = XLSX.utils.sheet_to_json(sheet, { range: range, defval: null });

        rawClientRows.forEach((row) => {
            const normalized = {
                clientSheet: sheetName // Track which client this belongs to
            };

            let hasData = false;
            Object.keys(row).forEach(key => {
                const cleanKey = key.trim().toUpperCase();
                if (cleanKey === 'FECHA') { normalized.date = row[key]; hasData = true; }
                else if (cleanKey === 'TIPO COMP') { normalized.type = row[key]; hasData = true; }
                else if (cleanKey === 'NUMERO') { normalized.number = row[key]; hasData = true; }
                else if (cleanKey === 'FECHA VTO') { normalized.dueDate = row[key]; }
                else if (cleanKey === 'IMPORTE') { normalized.amount = row[key]; hasData = true; } // Might need parsing
                else if (cleanKey === 'OBSERVACIONES') normalized.obs = row[key];
                else if (cleanKey === 'FECHA COBRO') normalized.paymentDate = row[key];
            });

            // Filter out empty rows or summary rows that don't have a date/document number
            if (hasData && normalized.date && normalized.amount) {
                dataset.clients.push(normalized);
            }
        });
    });
};
