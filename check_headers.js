
import { readFile } from 'fs/promises';
import * as XLSX from 'xlsx';
import path from 'path';

async function main() {
    try {
        console.log("--- ESTADOS DE COTIZACIONES.xlsx ---");
        const buf1 = await readFile(path.resolve(process.cwd(), 'ESTADOS DE COTIZACIONES.xlsx'));
        const wb1 = XLSX.read(buf1);
        const ws1 = wb1.Sheets[wb1.SheetNames[0]];
        const headers1 = [];
        const range1 = XLSX.utils.decode_range(ws1['!ref']);
        for (let C = range1.s.c; C <= range1.e.c; ++C) {
            const cell = ws1[XLSX.utils.encode_cell({ r: range1.s.r, c: C })];
            if (cell && cell.v) headers1.push(cell.v);
        }
        console.log("Headers:", headers1);

        console.log("\n--- ESTADOS CUENTAS DE CLIENTES.xlsx ---");
        const buf2 = await readFile(path.resolve(process.cwd(), 'ESTADOS CUENTAS DE CLIENTES.xlsx'));
        const wb2 = XLSX.read(buf2);
        console.log("Sheet Names:", wb2.SheetNames);

        // Check first sheet
        const ws2 = wb2.Sheets[wb2.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws2, { header: 1, range: 0, defval: null });
        console.log("First 10 rows of sheet 1:", JSON.stringify(data.slice(0, 10), null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
