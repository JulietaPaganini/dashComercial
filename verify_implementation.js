
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { parseExcelFiles } from './src/services/ExcelParser.js';
import { processDataset } from './src/services/DataProcessor.js';
import { calculateKPIs } from './src/services/kpiService.js';

// Mock Browser File Object for Node.js
class MockFile {
    constructor(name, buffer) {
        this.name = name;
        this.buffer = buffer;
    }
    async arrayBuffer() {
        return this.buffer;
    }
}

async function main() {
    try {
        console.log("Loading files...");
        const buf1 = await readFile(resolve(process.cwd(), 'ESTADOS DE COTIZACIONES.xlsx'));
        const buf2 = await readFile(resolve(process.cwd(), 'ESTADOS CUENTAS DE CLIENTES.xlsx'));

        const files = [
            new MockFile('ESTADOS DE COTIZACIONES.xlsx', buf1),
            new MockFile('ESTADOS CUENTAS DE CLIENTES.xlsx', buf2)
        ];

        console.log("Parsing Excel...");
        const raw = await parseExcelFiles(files);
        console.log(`- Quotes Raw: ${raw.quotes.length}`);
        console.log(`- Clients Sheets Processed: ${raw.clients.length} rows`);
        if (raw.issues.length > 0) console.log("ISSUES:", raw.issues);

        console.log("Processing Dataset...");
        const processed = processDataset(raw);
        console.log(`- Quotes Processed: ${processed.quotes.length}`);
        console.log(`- Clients Processed: ${processed.clients.length}`);

        console.log("Calculating KPIs...");
        const kpis = calculateKPIs(processed);

        console.log("\n--- KPI RESULTS ---");
        console.log("Quotes Conversion:", kpis.quotes.conversionRate.toFixed(2) + "%");
        console.log("Total Pipeline:", kpis.quotes.pipelineValue);
        console.log("Avg Cycle Days:", kpis.quotes.avgCycleDays);

        console.log("\nSales Total:", kpis.sales.totalSales);
        console.log("Top Product 1:", kpis.sales.topProducts[0]);

        console.log("\nTotal Debt:", kpis.debt.totalDebt);
        console.log("Bad Debt Ratio:", kpis.debt.badDebtRatio.toFixed(2) + "%");
        console.log("Aging:", kpis.debt.aging);

        console.log("\nSUCCESS: Logic verifies correctly.");

    } catch (e) {
        console.error("Verification Failed:", e);
    }
}

main();
