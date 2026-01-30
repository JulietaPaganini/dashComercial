
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const file = 'ESTADOS CUENTAS DE CLIENTES.xlsx';

try {
    console.log(`\n--- Deep Dive into ${file} ---`);
    const buf = fs.readFileSync(file);
    const workbook = XLSX.read(buf, { type: 'buffer' });

    // Pick a client sheet
    const sheetName = 'AUTOMAT';
    if (workbook.Sheets[sheetName]) {
        console.log(`\nSheet: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];

        // Read first 10 rows to find headers
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        for (let R = 0; R < 10; ++R) {
            const row = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = { c: C, r: R };
                const cellRef = XLSX.utils.encode_cell(cellAddress);
                const cell = worksheet[cellRef];
                row.push(cell ? (cell.w || cell.v) : null);
            }
            console.log(`Row ${R + 1}:`, JSON.stringify(row));
        }
    } else {
        console.log(`Sheet ${sheetName} not found.`);
    }

} catch (e) {
    console.error(e.message);
}
