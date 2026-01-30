export const findPotentialDuplicates = (clients) => {
    const groups = [];
    const visited = new Set();
    // const threshold = 0.6; // Inlined below

    // Helper: Levenshtein Distance
    const levenshtein = (a, b) => {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1,   // insertion
                            matrix[i - 1][j] + 1    // deletion
                        )
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    };

    // Helper: Similarity Score
    const getSimilarity = (s1, s2) => {
        const longer = s1.length > s2.length ? s1 : s2;
        if (longer.length === 0) return 1.0;
        return (longer.length - levenshtein(s1, s2)) / longer.length;
    };

    // Main Logic
    const sortedClients = [...clients].sort();

    for (let i = 0; i < sortedClients.length; i++) {
        const current = sortedClients[i];
        if (visited.has(current)) continue;

        const group = [current];
        visited.add(current);

        for (let j = i + 1; j < sortedClients.length; j++) {
            const candidate = sortedClients[j];
            if (visited.has(candidate)) continue;

            // Optimizations before expensive calc
            // Relaxed length check to allow for suffixes like " S.A." (4-5 chars)
            if (Math.abs(current.length - candidate.length) > 8) continue;

            // Case-insensitive start char check
            if (candidate[0].toLowerCase() !== current[0].toLowerCase()) continue;

            const score = getSimilarity(current.toLowerCase(), candidate.toLowerCase());
            // Lowered threshold to catch more variations
            if (score >= 0.6) {
                group.push(candidate);
                visited.add(candidate);
            }
        }

        if (group.length > 1) {
            groups.push({
                id: `group-${i}`,
                candidates: group,
                selected: group[0] // Default to first (usually shortest or alphabetical)
            });
        }
    }

    return groups;
};

export const unifyClientNames = (data, mergeMap) => {
    // mergeMap: { "Coca-Cola": "Coca Cola", "CocaCola SA": "Coca Cola" } (Incorrect -> Correct)

    const newData = JSON.parse(JSON.stringify(data)); // Deep copy

    // 1. Unify Quotes
    if (newData.quotes) {
        newData.quotes.forEach(q => {
            if (q.date) q.date = new Date(q.date);
            if (q.saleDate) q.saleDate = new Date(q.saleDate);
            if (mergeMap[q.client]) {
                q.client = mergeMap[q.client]; // IN-PLACE Update
            }
        });
    }

    // 2. Unify Clients (Debt)
    if (newData.clients) {
        newData.clients.forEach(c => {
            if (c.date) c.date = new Date(c.date);
            if (c.dueDate) c.dueDate = new Date(c.dueDate);
            if (mergeMap[c.client]) {
                c.client = mergeMap[c.client];
            }
        });

        // 3. Merge Debt Records (Important! If we merge "A" into "B", "B" might now have 2 rows)
        const mergedClients = [];
        const clientMap = new Map();

        newData.clients.forEach(c => {
            const key = c.client; // Already unified name
            if (!clientMap.has(key)) {
                clientMap.set(key, { ...c }); // Copy
                mergedClients.push(clientMap.get(key));
            } else {
                const existing = clientMap.get(key);
                // Merge logic
                existing.amount += c.amount;
                // Keep max delay, worst aging bucket, etc. if needed, or re-calculate later using raw invoices
                // For this simple view, Amount is critical. 
                // Note: Ideally we'd re-process from Raw Invoices, but we might not have them here if we just have summary.
                // Assuming 'clients' IS the detailed list, we might just be summing duplicate rows. 
                // If 'clients' is LIST of invoices, this is fine (we just renamed them). 
                // If 'clients' is AGGREGATED list, we DO need to sum.
                // Based on previous code: 'processed.clients' seems to be a list of debt ITEMS (invoices/unpaid). 
                // So renaming is enough, the Dashboard aggregations will handle the summing by name.

                // Actually, let's just PUSH the renamed item. The dashboard logic (ClientStatus) does `reduce` by client name.
                // So we don't need to physically merge rows here, just rename them.
            }
        });
        // So actually step 3 is handled by the dashboard's `useMemo` that groups by name.
        // We just need to make sure we don't return the 'merged' list if it's meant to be raw items.
        // Let's assume 'clients' array are distinct debt items.
    }

    return newData;
};
