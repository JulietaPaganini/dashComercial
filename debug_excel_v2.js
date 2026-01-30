import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.resolve('ESTADOS CUENTAS DE CLIENTES.xlsx');

const parseCurrency = (value) => {
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (!value) return 0;
    let clean = value.toString().replace(/[$\s]|[a-zA-Z]/g, '').replace(/[\u2013\u2014\u2212]/g, '-');
    let res = 0;
    if (clean.includes(',') && clean.includes('.')) {
        res = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    } else if (clean.includes(',')) {
        res = parseFloat(clean.replace(',', '.'));
    } else {
        res = parseFloat(clean);
    }
    return isNaN(res) ? 0 : res;
};

const parseExcelDate = (value) => {
    if (!value) return null;
    let dateObj = null;

    if (typeof value === 'number') {
        dateObj = new Date(Math.round((value - 25569) * 86400 * 1000));
        dateObj.setHours(dateObj.getHours() + 12);
    } else if (value instanceof Date) {
        dateObj = new Date(value);
        if (dateObj.getHours() < 3) dateObj.setHours(12);
    } else if (typeof value === 'string') {
        let cleanVal = value.trim();
        let parts = [];
        if (cleanVal.includes('/')) parts = cleanVal.split('/');
        else if (cleanVal.includes('-')) parts = cleanVal.split('-');

        if (parts.length === 3) {
            dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else if (parts.length === 2) {
            const today = new Date();
            const currentYear = today.getFullYear();
            dateObj = new Date(currentYear, parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        if (dateObj) dateObj.setHours(12);
    }
    if (dateObj && !isNaN(dateObj.getTime())) return dateObj.toISOString();
    return null;
};

async function run() {
    console.log(`Reading file: ${filePath}`);
    const buf = fs.readFileSync(filePath);
    const workbook = XLSX.read(buf, { type: 'buffer' });

    // Find Automat sheet
    const sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes('AUTOMAT'));
    if (!sheetName) {
        console.error('ERROR: Could not find AUTOMAT sheet');
        return;
    }

    console.log(`Processing Sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];

    const range = XLSX.utils.decode_range(sheet['!ref']);
    range.s.r = 2; // Start row index 2 (Row 3)
    const rawRows = XLSX.utils.sheet_to_json(sheet, { range: range, defval: null });

    const processed = [];
    let lastValidRow = {};

    rawRows.forEach((row, idx) => {
        const rowValuesStr = Object.values(row).map(v => String(v).toUpperCase()).join(' ');

        // Debug specific invoices from screenshot or user report
        // Looking for 1436 or large negative amounts
        const isTarget = rowValuesStr.includes('1436') ||
            (rowValuesStr.includes('-') && rowValuesStr.includes('382')); // rough check for -382M

        if (isTarget) {
            console.log(`\n[DEBUG TARGET ROW ${idx}] Raw:`, JSON.stringify(row));
        }

        const normalized = { clientSheet: sheetName };
        let hasData = false;

        Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toUpperCase();
            if (cleanKey === 'FECHA') { normalized.date = parseExcelDate(row[key]); hasData = true; }
            else if (cleanKey === 'TIPO COMP') { normalized.type = row[key]; hasData = true; }
            else if (cleanKey === 'NUMERO') { normalized.number = row[key]; hasData = true; }
            else if (cleanKey === 'IMPORTE' || cleanKey.includes('SALDO')) {
                const rawAmt = row[key];
                if (rawAmt !== null && rawAmt !== undefined && String(rawAmt).trim() !== '' && String(rawAmt).trim() !== '-') {
                    normalized.amount = rawAmt;
                    hasData = true;
                }
            }
            else if (cleanKey === 'OBSERVACIONES' || cleanKey.includes('OBS') || cleanKey.includes('REF')) normalized.obs = row[key];
        });

        const paymentKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'FECHA COBRO');
        const rawPaymentDate = paymentKey ? row[paymentKey] : null;
        let pDate = null;
        if (rawPaymentDate) pDate = parseExcelDate(rawPaymentDate);

        if (isTarget) {
            console.log(`[DEBUG TARGET ROW ${idx}] PaymentDate Parsed: ${pDate}`);
            console.log(`[DEBUG TARGET ROW ${idx}] Obs: ${normalized.obs}`);
        }

        const finalRow = { ...normalized, paymentDate: pDate };
        let currentHasData = hasData;
        if (pDate) currentHasData = true;

        // SUMMARY CHECK
        const isSummaryText = rowValuesStr.includes('TOTAL') ||
            rowValuesStr.includes('SALDO') ||
            rowValuesStr.includes('DEUDA') ||
            rowValuesStr.includes('DEVENGADO') ||
            rowValuesStr.includes('RESTO');

        if (!isSummaryText && (finalRow.amount !== undefined && finalRow.amount !== null && finalRow.amount !== 0)) {
            if (!finalRow.date && lastValidRow.date) {
                finalRow.date = lastValidRow.date;
                finalRow.type = lastValidRow.type || finalRow.type;
                currentHasData = true;
                if (isTarget) console.log(`[DEBUG TARGET ROW ${idx}] FILLED DOWN from previous`);
            }
            if (!finalRow.number && lastValidRow.number) {
                finalRow.number = lastValidRow.number;
                currentHasData = true;
            }
        } else {
            if (isSummaryText) currentHasData = false;
            if (!finalRow.number && !finalRow.type && !finalRow.paymentDate) {
                currentHasData = false;
            }
        }

        if (currentHasData && finalRow.date && !isSummaryText) {
            processed.push(finalRow);
            if (finalRow.number) lastValidRow = { ...finalRow };

            if (isTarget) console.log(`[DEBUG TARGET ROW ${idx}] PUSHED to dataset`);
        } else if (isTarget) {
            console.log(`[DEBUG TARGET ROW ${idx}] SKIPPED (Summary: ${isSummaryText}, HasData: ${currentHasData}, Date: ${finalRow.date})`);
        }
    });

    // Calc Debt
    let debt = 0;
    processed.forEach(inv => {
        const isSettled = (inv.paymentDate) ||
            (inv.obs && (
                inv.obs.toString().toLowerCase().includes('saldada') ||
                inv.obs.toString().toLowerCase().includes('pagad') ||
                inv.obs.toString().toLowerCase().includes('cancel')
            ));

        let amt = parseCurrency(inv.amount);
        if (inv.type && (inv.type.includes('NC') || inv.type.includes('PAGO'))) amt = -Math.abs(amt);

        if (!isSettled) {
            debt += amt;
        } else {
            // console.log(`[DEBUG] Ignoring Settled/Paid Invoice: ${inv.number} ($${amt})`);
        }
    });

    console.log(`\n--------------------------`);
    console.log(`TOTAL CALCULATED DEBT: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(debt)}`);
    console.log(`--------------------------`);
}

run();
