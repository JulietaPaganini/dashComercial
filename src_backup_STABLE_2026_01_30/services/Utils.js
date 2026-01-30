
// Utility Helper: Parse Currency
// Handles:
// - "USD 13.830" -> 13830 (3 decimals = thousands heuristic)
// - "1.234,56" -> 1234.56 (AR/EU)
// - "1,234.56" -> 1234.56 (US)
// - "(100.00)" -> -100.00 (Accounting)
export const parseCurrency = (value) => {
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (!value) return 0;

    let strVal = value.toString().trim();

    // Detect Accounting Negatives: (100.00)
    const isAccountingNegative = strVal.includes('(') && strVal.includes(')');

    // Remove everything that isn't a digit, dot, comma, or minus
    // We remove parens here, but we tracked isAccountingNegative
    // IMPORTANT: "USD 13.830" -> "13.830"
    let clean = strVal.replace(/[^\d.,-]/g, '');

    // DEBUG: Special trap for ID 300 value
    if (strVal.includes('13.830')) {
        console.warn('TRAP 300 (Utils): ', { strVal, clean, dot: clean.includes('.'), comma: clean.includes(',') });
    }

    let res = 0;

    // HEURISTIC: "13.830"
    const hasDot = clean.indexOf('.') !== -1;
    const hasComma = clean.indexOf(',') !== -1;

    if (hasDot && hasComma) {
        // AMBIGUOUS CASE: "1.234,56" (AR) vs "1,234.56" (US)
        const lastDotIndex = clean.lastIndexOf('.');
        const lastCommaIndex = clean.lastIndexOf(',');

        if (lastDotIndex > lastCommaIndex) {
            // US Format: 1,234.56 -> Remove commas, keep dot
            res = parseFloat(clean.replace(/,/g, ''));
        } else {
            // AR/EU Format: 1.234,56 -> Remove dots, replace comma with dot
            res = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
        }
    }
    else if (hasDot && !hasComma) {
        // Case: 13.830 OR 13.83 OR 13830.00
        // Strategy: Inspect the dot position and neighbors
        const parts = clean.split('.');

        // If multiple dots (1.234.567), it is definitely Thousands separator
        if (parts.length > 2) {
            res = parseFloat(clean.replace(/\./g, ''));
        }
        // If single dot (13.830 or 13.83)
        else {
            // If exactly 3 decimals, assume thousands (legacy logic requested for "13.830")
            // BUT check if it looks like standard money (2 decimals)
            if (parts.length > 1 && parts[parts.length - 1].length === 3) {
                // 13.830 -> 13830
                res = parseFloat(clean.replace(/\./g, ''));
            } else {
                // 13.83 -> 13.83
                res = parseFloat(clean);
            }
        }
    }
    else if (!hasDot && hasComma) {
        // 13,83 -> 13.83 (AR decimal)
        res = parseFloat(clean.replace(',', '.'));
    }
    else {
        // Plain integer
        res = parseFloat(clean);
    }

    if (isNaN(res)) return 0;
    if (isAccountingNegative) res = -Math.abs(res);

    return res;
};

// Detect Currency Code from String
export const detectCurrency = (value) => {
    if (!value) return 'ARS'; // Default
    const str = String(value).toUpperCase();
    if (str.includes('USD') || str.includes('U$S') || str.includes('DOLAR') || str.includes('US$')) return 'USD';
    if (str.includes('EUR')) return 'EUR';
    return 'ARS';
};

// Parse Excel Dates (STRICT)
export const parseExcelDate = (value) => {
    if (!value) return null;

    // 1. Handle Excel Serial Number (e.g. 45690 -> 2025-02-01)
    if (typeof value === 'number') {
        // Excel base date: Dec 30 1899 + days
        // 25569 is offset to Unix Epoch (1970-01-01)
        const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000));
        // Add 12 hours to land safely in middle of day (avoid timezone offset)
        dateObj.setHours(12, 0, 0, 0);
        return dateObj.toISOString();
    }

    // 2. Handle Strings
    if (typeof value === 'string') {
        const cleanVal = value.trim();

        // 2a. Strict Slash Format: DD/MM/YYYY
        if (cleanVal.includes('/')) {
            const parts = cleanVal.split('/');
            // Expecting [DD, MM, YYYY]
            if (parts.length === 3) {
                let day = parseInt(parts[0], 10);
                let month = parseInt(parts[1], 10) - 1; // JS Months are 0-11
                let year = parseInt(parts[2], 10);

                // Handle 2-digit years
                if (year < 100) year += 2000;

                // Create Date (Force Noon)
                const dateObj = new Date(year, month, day, 12, 0, 0);
                if (!isNaN(dateObj.getTime())) return dateObj.toISOString();
            }
        }

        // 2b. Strict Dash Format: DD-MM-YYYY or YYYY-MM-DD
        if (cleanVal.includes('-')) {
            const parts = cleanVal.split('-');
            if (parts.length === 3) {
                // Check if first part sucks as year (> 1900)
                let p0 = parseInt(parts[0], 10);
                if (p0 > 1900) {
                    // YYYY-MM-DD
                    const dateObj = new Date(cleanVal + 'T12:00:00'); // Use ISO
                    if (!isNaN(dateObj.getTime())) return dateObj.toISOString();
                } else {
                    // DD-MM-YYYY
                    let day = p0;
                    let month = parseInt(parts[1], 10) - 1;
                    let year = parseInt(parts[2], 10);
                    if (year < 100) year += 2000;
                    const dateObj = new Date(year, month, day, 12, 0, 0);
                    if (!isNaN(dateObj.getTime())) return dateObj.toISOString();
                }
            }
        }
    }

    // Fallback: Try Date Constructor directly (Risky for "01/02/2025" in US locale, but good for ISO)
    const fallbackDate = new Date(value);
    if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate.toISOString();
    }

    return null;
};
