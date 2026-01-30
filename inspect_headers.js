
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const files = [
    'ESTADOS CUENTAS DE CLIENTES.xlsx',
    'ESTADOS DE COTIZACIONES.xlsx'
];

files.forEach(file => {
    try {
        console.log(`\n--- Reading ${file} ---`);
        if (!fs.existsSync(file)) {
            console.log('File not found');
            return;
        }
        const buf = fs.readFileSync(file);
        const workbook = XLSX.read(buf, { type: 'buffer' });

        workbook.SheetNames.forEach(sheetName => {
            console.log(`\nSheet: ${sheetName}`);
            const worksheet = workbook.Sheets[sheetName];
            // Get the range
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            // Read the first row (headers)
            const headers = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = { c: C, r: range.s.r };
                const cellRef = XLSX.utils.encode_cell(cellAddress);
                const cell = worksheet[cellRef];
                if (cell && cell.v) headers.push(cell.v);
            }
            console.log('Headers:', headers);

            // Print first row of data to see formats
            const firstDataRow = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = { c: C, r: range.s.r + 1 }; // Next row
                const cellRef = XLSX.utils.encode_cell(cellAddress);
                const cell = worksheet[cellRef];
                if (cell) firstDataRow.push(cell.w || cell.v); // Use w for formatted text if available
            }
            console.log('First Data Row Snippet:', firstDataRow);

        });
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
