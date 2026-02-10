// Utility to parse currency strings: "$ 1.234,56" -> 1234.56
import { CurrencyService } from './CurrencyService';
// IMPORT SHARED UTILS (Single Source of Truth)
import { parseCurrency, detectCurrency, parseExcelDate } from './Utils';

export const processDataset = (rawDataset) => {
    const { quotes, sales, clients } = rawDataset;

    // --- AUDIT LOGGING FOR USER DEBUG (2026) ---
    // User Requirement: 
    // 1. Raw Total = Sum of "A COBRAR SIN IVA" from ALL "CONCRETADAS" sheets (already filtered by ExcelParser)
    // 2. Raw 2026 OC = Sum of "A COBRAR SIN IVA" where YEAR(ocDate) == 2026

    // A. Total Raw Read (All Years)
    const allSalesRaw = sales || [];
    const totalRawRead = allSalesRaw.reduce((acc, s) => acc + parseCurrency(s.receivableReal), 0);
    const countRawRead = allSalesRaw.length;

    // B. Filtered by OC Date 2026 (with Fallback to Quote Date)
    const salesOC2026 = allSalesRaw.filter(s => {
        // Fallback Logic: Try OC Date, then Quote Date (parsed by ExcelParser)
        const d = parseExcelDate(s.ocDate || s.quoteDate);
        if (!d) return false;
        return d.startsWith('2026'); // ISO format YYYY-MM-DD
    });
    const totalOC2026 = salesOC2026.reduce((acc, s) => acc + parseCurrency(s.receivableReal), 0);
    const countOC2026 = salesOC2026.length;

    // C. Invalid OC Dates (Potential lost data) - Actually Invalid Effective Date
    const salesInvalidOC = allSalesRaw.filter(s => !parseExcelDate(s.ocDate || s.quoteDate));
    const countInvalidOC = salesInvalidOC.length;

    console.log(`[AUDIT] Sales Data Integrity:
    - Total Rows Read (All Sheets): ${countRawRead}
    - Total Amount Read (All Sheets): $${totalRawRead.toLocaleString()}
    - Rows with OC Date in 2026: ${countOC2026}
    - Amount for OC 2026: $${totalOC2026.toLocaleString()}
    - Rows with Invalid OC Date: ${countInvalidOC}
    `);

    // -------------------------------------------

    const processed = {
        quotes: [], // Unified Quote + Sales info
        clients: [], // Client status flat list
        kpi: {
            totalPotencial: 0,
            totalVendido: 0,
            totalDeuda: 0,
        },
        audit: rawDataset.audit || {}, // Pass audit data
        debugRaw: [],
        debugAuditLogs: [],
        issues: [...rawDataset.issues], // Inherit parser issues
        allSales: sales || [] // EXPOSED FOR DEBUGGING (Correct Location)
    };

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

        // Combine Equipment + Description for the 5th Column as requested
        let combinedDescription = '-';
        if (quote) {
            const partE = quote.description || '';
            const partH = quote.observations || '';
            combinedDescription = partH ? `${partE} - ${partH}`.trim() : partE;
        } else if (sale) {
            combinedDescription = sale.workDescription || '-';
        }

        const currency = quote?.currency || sale?.currency || 'ARS';

        // Determine conversion date:
        // If Sold -> Invoice Date. If date undefined, fallback to today.
        // If Pending -> Today.
        let conversionDate = new Date();
        if (sale && sale.invoiceDate) conversionDate = new Date(sale.invoiceDate);
        else if (quote && quote.date) conversionDate = new Date(quote.date); // Use quote date if not sold? Or Today? User said "historical". Let's use Quote Date for Pending history? No, typically pending is today's value. But let's stick to invoice date for sold.

        // Actually, for Pending quotes, the "Value" is technically frozen at quote time usually?
        // But if it's USD, the ARS value fluctuates. The USD value stays.
        // For Won, the "Factura" freezes the exchange rate. 
        // User said: "en caso que sea una cotizacion ganada, la fecha para la convercion va a ser la fecha factura".
        // Implication: For NOT won, use current date? Or Quote date? 
        // Standard practice: Open Pipeline = Current Rate. Closed Won = Historic Rate.
        // Determines Status early
        const rawStatus = quote?.status?.toUpperCase() || (sale ? 'GANADA' : 'PENDIENTE');

        // Standard practice: Open Pipeline = Current Rate. Closed Won = Historic Rate.
        if (rawStatus !== 'GANADA' && rawStatus !== 'VENDIDO') conversionDate = new Date();

        return {
            // IDs
            id: quote?.id || sale?.quoteId || `V-${sale?.ocNumber || 'SIN-REF'}`, // Fallback ID for orphans
            source: source, // 'MATCH', 'QUOTE_ONLY', 'SALE_ONLY'

            // Core Data
            // USER REQUIREMENT: For Sales, use OC Date -> Fallback to Sale's Quote Date -> Fallback to Linked Quote Date
            date: parseExcelDate((sale && (sale.ocDate || sale.quoteDate)) ? (sale.ocDate || sale.quoteDate) : (quote?.date || sale?.ocDate)),

            client: quote?.client || 'Sin Cliente', // Could try to extract client from Sale description if desperate
            description: combinedDescription,
            amount: amount,
            status: rawStatus,
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
            cost: parseCurrency(sale?.cost),
            profitAmount: parseCurrency(sale?.profitAmount),
            profitPercent: parseCurrency(sale?.profitPercent),
            receivableStd: parseCurrency(sale?.receivableStd),
            receivableReal: parseCurrency(sale?.receivableReal),

            // Operational / Status
            collectionStatus: sale?.collectionStatus || '-', // ESTADO DE COBRO

            // Currency
            currency: currency,
            amountArs: CurrencyService.convert(amount, currency, conversionDate),
            exchangeRateUsed: currency === 'USD' ? CurrencyService.getRateForDisplay(conversionDate) : 1,

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
    let skippedDuplicateAmount = 0; // TRACKING FOR USER VERIFICATION
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
            let effectiveSale = null;

            if (sale) {
                // STRICT CONTENT-BASED DEDUPLICATION (Stable Key)
                const sAmount = parseCurrency(sale.receivableReal || sale.amount);
                const sDate = parseExcelDate(sale.ocDate || sale.quoteDate) || 'NODATE';
                const sClient = (sale.client || 'NOCLIENT').toString().trim().toUpperCase().replace(/\s+/g, '');
                const sId = (sale.quoteId || 'NOID').toString().trim().toUpperCase();

                // Key: ID|CLIENT|AMOUNT|DATE
                const contentKey = `${sId}|${sClient}|${sAmount}|${sDate}`;

                if (usedSalesIds.has(contentKey)) {
                    // DUPLICATE DETECTED
                    skippedDuplicateAmount += sAmount;
                    console.warn(`[KPI DEDUPE] Duplicate Content Key: ${contentKey}. Skipping $${sAmount}.`);

                    // Add visibility to User Report (Limit to top 20 to avoid spam)
                    if (processed.issues.filter(i => i.type === 'WARNING' && i.message.includes('Duplicado')).length < 20) {
                        processed.issues.push({
                            type: 'WARNING', // Visible in Report
                            sheet: 'VENTAS',
                            row: sale._originalIdx, // Approximate
                            message: `Venta Duplicada (Ignorada): $${sAmount.toLocaleString()} - Ref: ${sId}`
                        });
                    }

                } else {
                    // First time using this content
                    usedSalesIds.add(contentKey);
                    effectiveSale = sale;
                }
            }

            const model = createUnifiedModel(rawQuote, effectiveSale, effectiveSale ? 'MATCH' : 'QUOTE_ONLY');

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

    console.log(`[KPI DEDUPE SUMMARY] Total Amount Skipped due to Duplication: $${skippedDuplicateAmount.toLocaleString()}`);

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



            // HANDLE SIGNS
            let finalAmount = Number(amount); // Ensure number

            // If it's explicitly a Credit Note or Payment Type, ensure it is negative
            // But respect if Excel already provided a negative number
            if (type.includes('PAGO') || type.includes('NC') || type.includes('NOTA DE CREDITO') || type.includes('CREDITO')) {
                if (finalAmount > 0) {
                    finalAmount = -finalAmount;
                }
                // If it's already negative, leave it alone.
            }

            // DEBUG ABSA/INDUMAT
            const debugClient = row.clientSheet ? row.clientSheet.toUpperCase() : '';
            if (debugClient.includes('ABSA') || debugClient.includes('INDUMAT') || debugClient.includes('INDOOR') || debugClient.includes('AUTOMAT')) {
                console.log(`[DEBUG ${debugClient}] Row:`, row, 'FinalAmount:', finalAmount, 'Type:', type, 'PaymentDate:', row.paymentDate);
            }
            // If it's already negative in the file, KEEP IT NEGATIVE (even if Type is empty)
            else if (finalAmount < 0) {
                finalAmount = finalAmount; // No change
            }
            // Otherwise, assume it's a regular Invoice (Positive)
            else {
                finalAmount = Math.abs(finalAmount);
            }

            // CHECK PAYMENT DATE / STATUS
            // If "FECHA COBRO" has content, it is likely paid or settled ("Saldada")
            const paymentInfo = row.paymentDate ? row.paymentDate.toString().toUpperCase() : '';

            // CHECK SETTLED STATUS
            // 1. Explicit Keywords in Payment Date OR Observations
            const obsInfo = row.obs ? row.obs.toString().toUpperCase() : '';

            const hasKeyword =
                paymentInfo.includes('SALDADA') || paymentInfo.includes('PAGAD') || paymentInfo.includes('CANCEL') || paymentInfo.includes('COMPEN') ||
                obsInfo.includes('SALDADA') || obsInfo.includes('PAGAD') || obsInfo.includes('CANCEL') || obsInfo.includes('COMPEN');

            // 2. Date Detection
            const isNumericDate = !isNaN(parseInt(paymentInfo)) && parseInt(paymentInfo) > 20000;
            const isStringDate = paymentInfo.length > 5 && (paymentInfo.includes('/') || paymentInfo.includes('-'));

            const isSettled = hasKeyword || isNumericDate || isStringDate;

            // DEBUG AUTOMAT / ZERO AMOUNTS
            if (row.clientSheet && row.clientSheet.toUpperCase().includes('AUTOMAT')) {
                // Log if amount is 0 but raw amount exists
                if (finalAmount === 0 && row.amount) {
                    console.warn('[DEBUG AUTOMAT ZERO]', {
                        rawAmount: row.amount,
                        parsedAmount: finalAmount,
                        type: type,
                        isSettled,
                        rowRaw: row
                    });
                }
            }

            // Store original amount before zeroing out (Legacy comment)
            const originalAmount = finalAmount;

            // FIX: Do NOT zero out the amount here. Keep it so tables show history.
            // Downstream components (CollectionsDashboard, ClientStatus) must handle 'isSettled' logic for Debt Totals.
            if (isSettled && finalAmount > 0) {
                finalAmount = 0; // Exclude from debt, but originalAmount preserves history
            }

            const clientModel = {
                id: `${row.clientSheet}-${idx}`,
                client: row.clientSheet,
                date: parseExcelDate(row.date),
                dueDate: parseExcelDate(row.dueDate),
                paymentDate: parseExcelDate(row.paymentDate),
                type: type,
                number: row.number,
                amount: finalAmount, // Keep original amount!
                originalAmount: originalAmount,
                isSettled: isSettled, // Pass flag to helping consumers
                obs: row.obs, // Pass observations for keyword checks
                daysOverdue: 0, // Calculated later or below?
                agingBucket: 'Corriente' // Calculated below
            };
            // Default Due Date Logic (if missing, assuming 30 days form issue)
            if (!clientModel.dueDate && clientModel.date) {
                const d = new Date(clientModel.date);
                d.setDate(d.getDate() + 30);
                clientModel.dueDate = d;
            }

            // Calculate Overdue
            if (clientModel.dueDate) {
                const today = new Date();
                const diffTime = today - clientModel.dueDate;

                // Only count as overdue if Positive (Past Due)
                // If diffTime is negative, it means it's not due yet (Al día)
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                clientModel.daysOverdue = diffDays > 0 ? diffDays : 0;
            }

            // Aging Buckets
            if (clientModel.daysOverdue <= 0) clientModel.agingBucket = 'Corriente';
            else if (clientModel.daysOverdue <= 30) clientModel.agingBucket = '1-30 días';
            else if (clientModel.daysOverdue <= 60) clientModel.agingBucket = '31-60 días';
            else if (clientModel.daysOverdue <= 90) clientModel.agingBucket = '61-90 días';
            else clientModel.agingBucket = '+90 días';

            // 4. Calculate Payment Delay (User Definition: From Issue Date to Payment Date or Today)
            let paymentDelay = null;
            if (clientModel.date) {
                const startDate = new Date(clientModel.date);
                let endDate = null;

                if (clientModel.paymentDate) {
                    endDate = new Date(clientModel.paymentDate);
                } else if (!clientModel.isSettled) {
                    // If NOT settled and NO payment date, count days until today
                    endDate = new Date();
                }
                // If isSettled but NO payment date, we cannot calculate delay (unknown payment date). Leave null.

                if (endDate) {
                    const diffTime = endDate - startDate;
                    paymentDelay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
            }
            clientModel.paymentDelay = paymentDelay;

            // FILTER: Stricter validation to exclude Summary Rows
            let cleanNumber = clientModel.number ? clientModel.number.toString().trim() : '';

            // SPECIAL CASE: Some payments (PAGO A CTA) have no number.
            // If amount is negative and we have a date, we treat it as a valid payment row.
            if ((!cleanNumber || cleanNumber === '-' || cleanNumber === '.') && finalAmount < 0) {
                // Generate a temporary number for processing
                cleanNumber = `PAY-${Math.floor(Math.random() * 10000)}`;
                clientModel.number = cleanNumber;
                clientModel.isManualPayment = true;
            }

            // 1. Must have a real Document Number (or be a valid payment)
            if (!cleanNumber || cleanNumber === '-' || cleanNumber === '.') return;

            // 2. Explicitly exclude if Number or Type says "TOTAL"
            if (cleanNumber.toUpperCase().includes('TOTAL') || clientModel.type?.toUpperCase().includes('TOTAL')) {
                return;
            }

            // 3. Must have a valid Date
            if (!clientModel.date) return;

            processed.clients.push(clientModel);
            // Note: Don't add to KPI yet, wait for reconciliation
            // if (finalAmount > 0) processed.kpi.totalDeuda += finalAmount; 

        } catch (err) {
            processed.issues.push({
                type: 'ERROR',
                sheet: 'CLIENTES',
                row: idx + 2,
                message: `Error procesando cliente: ${err.message}`
            });
        }
    });

    // 3. RECONCILIATION: Apply Credit Notes / Payments to Invoices
    const reconciledClients = [];
    const clientsMap = new Map();

    // Group by Client
    processed.clients.forEach(c => {
        if (!clientsMap.has(c.client)) clientsMap.set(c.client, []);
        clientsMap.get(c.client).push(c);
    });

    clientsMap.forEach((rows, clientName) => {
        // Separate debts and credits
        const invoices = rows.filter(r => r.amount > 0);
        const credits = rows.filter(r => r.amount < 0);
        const others = rows.filter(r => r.amount === 0);

        const unappliedCredits = [];

        credits.forEach(cred => {
            let remainingCredit = Math.abs(cred.amount);
            let applied = false;

            // Normalize text
            const obs = cred.obs ? cred.obs.toString().toUpperCase() : '';

            // MATCHING LOGIC: "APLICA", "PAGO A CTA", "FC[number]"
            if (obs && (obs.includes('APLICA') || obs.includes('PAGO') || obs.includes('FC') || obs.includes('REF'))) {

                // Strategy: Find all number-like tokens that could be references
                // Matches "1433", "1433-34-35", "20001433"
                // Extract digits and ranges
                const regex = /(?:FC|FACT|NO)\s*([\d\-\.\/]+)/g;
                let matches;
                let usageCandidates = [];

                while ((matches = regex.exec(obs)) !== null) {
                    const refStr = matches[1];
                    // refStr could be "1433-34-35" or "1433"
                    const parts = refStr.split(/[\-\/]/); // Split by hyphen or slash

                    let baseNumber = parts[0]; // "1433"
                    if (baseNumber.length > 2) {
                        usageCandidates.push(baseNumber);

                        // Handle suffixes: 34, 35
                        for (let i = 1; i < parts.length; i++) {
                            let suffix = parts[i];
                            if (suffix.length < baseNumber.length && suffix.length > 0) {
                                // Reconstruct: 1433 -> 34. likely 1434. 
                                // Logic: take baseNumber, remove last X chars, append suffix
                                const prefix = baseNumber.substring(0, baseNumber.length - suffix.length);
                                usageCandidates.push(prefix + suffix);
                            } else {
                                // If it's a full number, just use it
                                usageCandidates.push(suffix);
                            }
                        }
                    }
                }

                // If regex failed but we have distinct numbers in text (fallback)
                if (usageCandidates.length === 0) {
                    const directNums = obs.match(/(\d{4,8})/g);
                    if (directNums) usageCandidates = directNums;
                }

                if (usageCandidates.length > 0) {
                    let foundAnyTarget = false;

                    // Try to apply credit to these candidates sequentially
                    for (const numRef of usageCandidates) {
                        // 1. Look in OPEN Invoices
                        const target = invoices.find(inv =>
                            inv.amount > 0 && inv.number && inv.number.toString().endsWith(numRef)
                        );

                        if (target) {
                            foundAnyTarget = true;
                            const applicationAmount = Math.min(target.amount, remainingCredit);

                            target.amount -= applicationAmount;
                            target.appliedNC = (target.appliedNC || 0) + applicationAmount;
                            remainingCredit -= applicationAmount;

                            // Cleanup dust
                            if (target.amount <= 50) {
                                target.status = 'PAID_BY_NC';
                                target.amount = 0;
                            }

                            applied = true;
                        }
                        // 2. Look in SETTLED Invoices (Others)
                        else {
                            const targetSettled = others.find(inv =>
                                inv.number && inv.number.toString().endsWith(numRef)
                            );
                            if (targetSettled) {
                                foundAnyTarget = true;
                                console.log(`[Reconcile] Credit ${cred.number} matched Settled Inv ${targetSettled.number}. Consuming credit.`);
                                applied = true;
                                // We consume the credit fully if it matches a settled invoice (assumed fully applied logic)
                                remainingCredit = 0;
                            }
                        }

                        if (remainingCredit <= 1) break; // Credit used up
                    }

                    // GHOST TARGET CHECK
                    // If we extracted valid references (like FC 1234), but found NO matching invoice (Open or Settled),
                    // then this Payment refers to something not in the file. 
                    // We assume it's an old payment for an old (deleted) invoice.
                    if (!foundAnyTarget && usageCandidates.length > 0) {
                        console.warn(`[Reconcile] Dropping Orphan Payment ${cred.number} (Refs: ${usageCandidates.join(',')}) - Targets not found.`);
                        applied = true; // Mark as handled so it doesn't float
                        remainingCredit = 0; // Kill the debt reduction
                    }
                }
            }

            // If after checking references we still have credit, check if it was meant for already settled invoices
            // (Consume credit if it points to a 0-balance invoice)
            if (applied && remainingCredit > 0) {
                // We consider it partially applied
            }

            // Update the credit row amount to show what remains unapplied (visual only)
            // Fix: ALWAYS keep the credit row visible, even if fully used.
            if (remainingCredit > 100) {
                // Partial Use
                cred.amount = -remainingCredit;
                unappliedCredits.push(cred);
            } else {
                // Fully used
                cred.amount = 0; // Contribute 0 to remaining debt sum
                cred.isOffset = true; // Mark as fully used
                unappliedCredits.push(cred); // KEEP IT IN THE LIST for display
            }
        });

        // --- SMART MATCH: Pair Identical Amounts (Fallback) ---
        // If unapplied credits remain, check for invoices with EXACT same amount
        // This handles cases like "Factura 323 ($X)" and "NC ($X)" with no linking text.
        for (let i = unappliedCredits.length - 1; i >= 0; i--) {
            const cred = unappliedCredits[i];
            const targetAmount = Math.abs(cred.amount);

            // console.log(`[SmartMatch DEBUG] Checking Credit ${cred.number || 'Unknown'} (Amt: ${cred.amount}) against ${invoices.length} invoices.`);

            // Find an OPEN invoice with this EXACT amount (fuzzy match < $5)
            const targetInv = invoices.find(inv => {
                const diff = Math.abs(inv.amount - targetAmount);
                return inv.amount > 0 && diff < 5;
            });

            if (targetInv) {
                console.log(`[SmartMatch HIT] Offset Inv ${targetInv.number} with NC ${cred.number}`);

                // 1. Mark both as OFFSET for UI
                targetInv.isOffset = true;
                cred.isOffset = true;

                // 2. Reduce Invoice to 0 (Calculations)
                targetInv.amount = 0;
                targetInv.status = 'OFFSET_BY_NC';

                // 3. Mark Credit as consumed (don't add to debt)
                cred.amount = 0; // Effectively consumed
            }
        }

        // METRIC: Historical Average Payment Delay
        // We calculate this using ALL invocies (open 'invoices' + settled 'others')
        let totalDelayDays = 0;
        let countPaidInvoices = 0;

        const allInvoices = [...invoices, ...others];

        allInvoices.forEach(inv => {
            // Only consider Fac, ND, etc (positive original amounts)
            if (inv.originalAmount > 0) {
                // CHANGED: Use Issue Date as baseline for "Days to Pay" (Días p/ Pago) per user request.
                // Was: inv.dueDate ? ... 
                let baseData = inv.date ? new Date(inv.date) : new Date(); // Fallback to now if date missing (shouldn't happen)

                let effectiveEndDate = null;
                let shouldCount = false;

                // Case A: Already Paid
                if (inv.paymentDate) {
                    effectiveEndDate = new Date(inv.paymentDate);
                    shouldCount = true;
                }
                // Case B: Unpaid (Active Debt) or Partial
                else if (inv.amount > 0) {
                    // Always count delay from Issue Date for unpaid
                    effectiveEndDate = new Date();
                    shouldCount = true;
                }

                if (shouldCount && effectiveEndDate) {
                    const diffTime = effectiveEndDate - baseData;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    inv.paymentDelayDays = diffDays;

                    totalDelayDays += diffDays;
                    countPaidInvoices++;
                }
            }
        });

        const avgPaymentDelay = countPaidInvoices > 0 ? Math.round(totalDelayDays / countPaidInvoices) : 0;

        // Add back to result with metric attached

        // 1. Remaining Debt (Invoices with balance > 0 OR fully paid by NC now 0)
        invoices.forEach(inv => {
            inv.avgPaymentDelay = avgPaymentDelay;
            reconciledClients.push(inv);
        });

        // 2. Unapplied Credits (Negative balance)
        unappliedCredits.forEach(nc => {
            nc.avgPaymentDelay = avgPaymentDelay;
            reconciledClients.push(nc);
        });

        // 3. Settled Invoices (Zero balance from start)
        others.forEach(settled => {
            settled.avgPaymentDelay = avgPaymentDelay;
            settled.amount = 0;
            reconciledClients.push(settled);
        });
    });

    // Replace and Recalculate
    processed.clients = reconciledClients;
    processed.kpi.totalDeuda = processed.clients.reduce((acc, c) => acc + (c.amount > 0 ? c.amount : 0), 0);

    // 4. SORTING
    processed.quotes.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date - a.date;
    });

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
            monthlyData[key].revenue += (q.saleAmount || 0); // Strict Sales only
            monthlyData[key].wonCount += 1;
        }
    });

    // Convert to Array and Sort
    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
};

export const calculateKPIs = (processedData) => {
    const { quotes, clients } = processedData;

    // 1. Sales
    // 1. Sales
    // STRICT REQUIREMENT: Total Vendido = Sum of "A COBRAR SIN IVA" (saleAmount).
    // Do NOT fallback to Quote Amount. Only verified sales count.
    const totalSales = quotes
        .filter(q => q.status === 'GANADA')
        .reduce((acc, q) => acc + (q.saleAmount || 0), 0);

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

    // Aggregation: Group flat invoice list into Client Objects
    const clientMap = {};

    clients.forEach(inv => {
        const name = inv.client || 'Desconocido';
        if (!clientMap[name]) {
            clientMap[name] = {
                client: name,
                amount: 0,
                invoices: [],
                totalDelay: 0,
                countDelay: 0,
                agingBucket: inv.agingBucket // Take from first invoice (approx) or recalculate?
            };
        }

        // Add to total debt if positive AND not seemingly settled
        // Double-check for "SALDADA" or Payment Date existence to prevent ghost debt
        const isSeeminglySettled =
            (inv.obs && (inv.obs.toString().toUpperCase().includes('SALDADA') || inv.obs.toString().toUpperCase().includes('PAGAD'))) ||
            (inv.paymentDate);

        if (inv.amount > 0 && !isSeeminglySettled) {
            clientMap[name].amount += inv.amount;
        }

        // Add to invoices list
        clientMap[name].invoices.push(inv);

        // Aggregate Payment Delay (only for valid delays)
        if (inv.paymentDelayDays > 0) {
            clientMap[name].totalDelay += inv.paymentDelayDays;
            clientMap[name].countDelay++;
        }
    });

    const aggregatedClients = Object.values(clientMap).map(c => ({
        ...c,
        paymentDelayDays: c.countDelay > 0 ? Math.round(c.totalDelay / c.countDelay) : 0,
        // Recalculate aging bucket based on max delay of unpaid invoices? 
        // Or keep simple. For now, let's trust the input or re-derive.
        // Actually, dashboard uses aging for color coding cards. 
        // Let's assume the max delay invoice dictates the bucket.
    }));

    // Top 5 Debtors
    const topDebtors = aggregatedClients
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    return {
        // allSales removed from here - it belongs in processedData, not KPI calc
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
            topDebtors,
            clients: aggregatedClients // USE AGGREGATED LIST
        },
        audit: processedData.audit || {} // PASS AUDIT MAP TO FRONTEND
    };
};
