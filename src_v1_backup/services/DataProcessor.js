
// Utility to parse currency strings: "$ 1.234,56" -> 1234.56
const parseCurrency = (value) => {
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    // Generic Null Check
    if (!value) return 0;

    // FOREIGN CURRENCY EXCLUSION
    // If it contains indicators of US Dollars, return 0 (treat as empty/invalid for this dashboard)
    const strVal = value.toString().toUpperCase();
    if (strVal.includes('USD') || strVal.includes('U$S') || strVal.includes('US$') || strVal.includes('DL') || strVal.includes('DOLARES')) {
        return 0;
    }

    // Remove symbols and generic validation
    const clean = value.toString().replace(/[$\s]|[a-zA-Z]/g, '');

    let res = 0;
    // Handle European/Argentine format: 1.000,00 -> 1000.00
    // If it has commas and dots, we assume dot is thousand separator and comma is decimal
    if (clean.includes(',') && clean.includes('.')) {
        res = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    } else if (clean.includes(',')) {
        // If only comma, assume it's decimal separator
        res = parseFloat(clean.replace(',', '.'));
    } else {
        res = parseFloat(clean);
    }

    return isNaN(res) ? 0 : res;
};

// Utility to parse Excel dates
const parseExcelDate = (value) => {
    if (!value) return null;
    let date = null;

    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
        // Excel base date correction
        date = new Date(Math.round((value - 25569) * 86400 * 1000));
    } else {
        // If it's a string dd/mm/yy or yyyy-mm-dd
        const dateStr = value.toString().trim();
        // Try simplistic parsing for DD/MM/YYYY
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
            // Assume DD/MM/YYYY or DD/MM/YY
            // If first part > 1000, assume YYYY-MM-DD
            if (parseInt(parts[0]) > 1000) {
                date = new Date(dateStr);
            } else {
                // Else DD/MM/YY
                date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
        } else {
            date = new Date(value); // Fallback
        }
    }

    // Check validity
    return (date && !isNaN(date.getTime())) ? date : null;
};

export const processDataset = (rawDataset) => {
    const processed = {
        quotes: [], // Unified Quote + Sales info
        clients: [], // Client status flat list
        kpi: {
            totalPotencial: 0,
            totalVendido: 0,
            totalDeuda: 0,
        },
        issues: [...rawDataset.issues] // Inherit parser issues
    };

    // 1. Process Quotes & Link Sales
    // Map Sales by Quote ID for fast lookup
    const salesMap = new Map();
    const usedSalesIds = new Set(); // Track which sales are linked

    rawDataset.sales.forEach((sale, idx) => {
        // Use QuoteId if available, otherwise we can't link, but we will process as orphan later if needed
        if (sale.quoteId) {
            // Normalizing ID for map key
            const key = sale.quoteId.toString().trim();
            // Store with original index to track usage unique
            salesMap.set(key, { ...sale, _originalIdx: idx });
        }
    });

    // Helper to create the Unified Model
    const createUnifiedModel = (quote, sale, source) => {
        const amount = quote ? parseCurrency(quote.amount) : 0;

        return {
            // IDs
            id: quote?.id || sale?.quoteId || `V-${sale?.ocNumber || 'SIN-REF'}`, // Fallback ID for orphans
            source: source, // 'MATCH', 'QUOTE_ONLY', 'SALE_ONLY'

            // Core Data
            date: parseExcelDate(quote?.date || sale?.ocDate), // Fallback to sale date if quote missing
            client: quote?.client || 'Sin Cliente', // Could try to extract client from Sale description if desperate
            description: quote?.description || sale?.workDescription || '-',
            amount: amount,
            status: quote?.status?.toUpperCase() || (sale ? 'GANADA' : 'PENDIENTE'),
            equipment: quote?.equipment || sale?.domain || '-',

            // Sales Data Merged
            isSold: !!sale,

            // Dates
            saleDate: sale ? parseExcelDate(sale.invoiceDate) : null,
            ocDate: sale ? parseExcelDate(sale.ocDate) : null,
            deliveryDate: sale ? parseExcelDate(sale.deliveryDate) : null,
            paymentDate: sale ? parseExcelDate(sale.paymentDate) : null,

            // Financials (Sales Sheet)
            saleAmount: sale ? parseCurrency(sale.receivableReal || sale.amount) : 0,
            cost: sale ? parseCurrency(sale.cost) : 0,
            profitAmount: sale ? parseCurrency(sale.profitAmount) : 0,
            profitPercent: sale ? (typeof sale.profitPercent === 'number' ? sale.profitPercent : 0) : 0,
            receivableStd: sale ? parseCurrency(sale.receivableStd) : 0,
            receivableReal: sale ? parseCurrency(sale.receivableReal) : 0,

            // Operational / Status
            collectionStatus: sale ? (sale.collectionStatus || '-') : '-',
            hoursQuoted: sale ? (sale.hoursQuoted || 0) : 0,
            hoursUsed: sale ? (sale.hoursUsed || 0) : 0,
            policyIndex: sale ? (sale.policyIndex || '-') : '-',
            policyStatus: sale ? (sale.policyStatus || '-') : '-',

            // Docs
            ocNumber: sale ? (sale.ocNumber || '-') : '-',
            invoiceNumber: sale ? (sale.invoiceNumber || '-') : '-',

            // Extra
            finalDescription: sale ? (sale.workDescription || '-') : '-',
            saleDomain: sale ? (sale.domain || '-') : '-',

            originalRow: quote || sale // Keep for raw view
        };
    };

    // PASS 1: Iterate Quotes
    rawDataset.quotes.forEach((rawQuote, idx) => {
        try {
            const id = rawQuote.id?.toString().trim();
            if (!id) {
                // Should have been caught by parser but double check
                processed.issues.push({
                    type: 'WARNING',
                    sheet: 'PRESUPUESTOS',
                    row: idx + 2,
                    message: 'Fila con datos pero sin ID de Cotización. Se omitió.'
                });
                return;
            }

            const sale = salesMap.get(id);
            if (sale) {
                usedSalesIds.add(sale._originalIdx);
            }

            const model = createUnifiedModel(rawQuote, sale, sale ? 'MATCH' : 'QUOTE_ONLY');

            // Determine Status Logic (Centralized)
            if (model.status.includes('APROBADO') || model.status.includes('VENDIDO') || model.status.includes('OK') || sale) {
                model.status = 'GANADA';
            } else if (model.status.includes('NO') || model.status.includes('RECHAZADO') || model.status.includes('BAJA')) {
                model.status = 'PERDIDA';
            } else if (!model.status || model.status === '-') {
                model.status = 'PENDIENTE';
            }

            processed.quotes.push(model);
            processed.kpi.totalPotencial += model.amount;
            if (model.status === 'GANADA') processed.kpi.totalVendido += (model.saleAmount || model.amount);

        } catch (err) {
            processed.issues.push({
                type: 'ERROR',
                sheet: 'PRESUPUESTOS',
                row: idx + 2,
                message: `Error procesando cotización: ${err.message}`
            });
        }
    });

    // PASS 2: Find Orphan Sales (Sales not linked to any Quote)
    rawDataset.sales.forEach((sale, idx) => {
        if (!usedSalesIds.has(idx)) {
            try {
                // This is an orphan sale
                const model = createUnifiedModel(null, sale, 'SALE_ONLY');
                model.status = 'GANADA (Sin Presupuesto)'; // Distinct status

                processed.quotes.push(model);
                processed.kpi.totalVendido += (model.saleAmount || 0);

                processed.issues.push({
                    type: 'INFO',
                    sheet: 'VENTAS',
                    row: idx + 2,
                    message: `Venta (Cot #${sale.quoteId || '?'}) agregada sin Presupuesto original.`
                });

            } catch (err) {
                processed.issues.push({
                    type: 'ERROR',
                    sheet: 'VENTAS',
                    row: idx + 2,
                    message: `Error procesando venta huérfana: ${err.message}`
                });
            }
        }
    });


    // 2. Process Client Status
    rawDataset.clients.forEach((row, idx) => {
        try {
            const amount = parseCurrency(row.amount);
            const type = row.type?.toUpperCase() || '';

            let finalAmount = amount;
            if (type.includes('PAGO') || type.includes('NC') || type.includes('NOTA DE CREDITO')) {
                finalAmount = -Math.abs(amount);
            } else {
                finalAmount = Math.abs(amount);
            }

            const clientModel = {
                id: `${row.clientSheet}-${idx}`,
                client: row.clientSheet,
                date: parseExcelDate(row.date),
                dueDate: parseExcelDate(row.dueDate),
                type: type,
                number: row.number,
                amount: finalAmount,
                originalAmount: amount,
                daysOverdue: 0
            };

            // Default Due Date Logic
            if (!clientModel.dueDate && clientModel.date) {
                const d = new Date(clientModel.date);
                d.setDate(d.getDate() + 30);
                clientModel.dueDate = d;
            }

            // Calculate Overdue
            const today = new Date();
            const refDate = clientModel.dueDate || today;
            const diffTime = today - refDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            clientModel.daysOverdue = diffDays;

            // Aging Buckets
            if (diffDays <= 0) clientModel.agingBucket = 'Corriente';
            else if (diffDays <= 30) clientModel.agingBucket = '1-30 días';
            else if (diffDays <= 60) clientModel.agingBucket = '31-60 días';
            else if (diffDays <= 90) clientModel.agingBucket = '61-90 días';
            else clientModel.agingBucket = '+90 días';

            processed.clients.push(clientModel);
            if (finalAmount > 0) processed.kpi.totalDeuda += finalAmount;

        } catch (err) {
            processed.issues.push({
                type: 'ERROR',
                sheet: 'CLIENTES',
                row: idx + 2,
                message: `Error procesando cliente: ${err.message}`
            });
        }
    });

    // 3. SORTING
    // Quotes: Newest First
    processed.quotes.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date - a.date;
    });

    // Clients: Highest Overdue Days First (Criticality)
    processed.clients.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return processed;
};

const calculateRevenueTrend = (quotes) => {
    if (!quotes || quotes.length === 0) return [];

    // Group by Month (YYYY-MM)
    const monthlyData = {};

    quotes.forEach(q => {
        if (!q.date) return;

        const date = new Date(q.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

        if (!monthlyData[key]) {
            monthlyData[key] = { month: key, revenue: 0, wonCount: 0, totalCount: 0 };
        }

        monthlyData[key].totalCount += 1;

        // Only count WON sales for Revenue Trend
        if (q.status === 'GANADA') {
            monthlyData[key].revenue += (q.saleAmount || q.amount);
            monthlyData[key].wonCount += 1;
        }
    });

    // Convert to Array and Sort
    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
};

export const calculateKPIs = (processedData) => {
    const { quotes, clients } = processedData;

    // 1. Sales
    const totalSales = quotes
        .filter(q => q.status === 'GANADA')
        .reduce((acc, q) => acc + (q.saleAmount || q.amount), 0);

    // 2. Total Quoted (Pipeline Volume) - ALL QUOTES
    const pipelineValue = quotes.reduce((acc, q) => acc + (q.amount || 0), 0);

    // 3. Active Pipeline (Pending / In Progress)
    // Filter out finalized statuses to count only open opportunities
    const activePipeline = quotes
        .filter(q => !['GANADA', 'PERDIDA', 'EFECTUADA', 'RECHAZADA', 'CERRADA'].includes(q.status))
        .reduce((acc, q) => acc + (q.amount || 0), 0);

    // 4. Conversion Rate
    const wonCount = quotes.filter(q => q.status === 'GANADA').length;
    const totalCount = quotes.length;
    const conversionRate = totalCount > 0 ? (wonCount / totalCount) * 100 : 0;

    // 5. Debt
    const totalDebt = clients.reduce((acc, c) => acc + c.amount, 0);

    const overdueClients = clients.filter(c => c.daysOverdue > 0);
    const averageDaysDelinquent = overdueClients.length > 0
        ? Math.round(overdueClients.reduce((acc, c) => acc + c.daysOverdue, 0) / overdueClients.length)
        : 0;

    // Debt Aging Calculation
    const aging = {
        current: clients.filter(c => c.agingBucket === 'Corriente').reduce((acc, c) => acc + c.amount, 0),
        days30: clients.filter(c => c.agingBucket === '1-30 días').reduce((acc, c) => acc + c.amount, 0),
        days60: clients.filter(c => c.agingBucket === '31-60 días').reduce((acc, c) => acc + c.amount, 0),
        days90: clients.filter(c => c.agingBucket === '61-90 días').reduce((acc, c) => acc + c.amount, 0),
        plus90: clients.filter(c => c.agingBucket === '+90 días').reduce((acc, c) => acc + c.amount, 0),
    };

    // Top 5 Debtors (Aggregated)
    const debtByClient = {};
    clients.forEach(c => {
        const name = c.client || 'Desconocido';
        if (!debtByClient[name]) debtByClient[name] = 0;
        debtByClient[name] += c.amount;
    });

    const topDebtors = Object.entries(debtByClient)
        .map(([client, amount]) => ({ client, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    return {
        sales: {
            totalSales,
            revenueTrend: calculateRevenueTrend(quotes)
        },
        quotes: {
            pipelineValue,
            activePipeline,
            conversionRate,
            count: totalCount
        },
        debt: {
            totalDebt,
            averageDaysDelinquent,
            aging,
            topDebtors
        }
    };
};
