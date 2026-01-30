
const API_URL = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial';
const CACHE_KEY = 'ocme_currency_history_v1';
const CACHE_TTL = 1000 * 60 * 60; // 1 Hour

export const CurrencyService = {
    history: [],

    async init() {
        // Try load from cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TTL) {
                console.log('[CurrencyService] Loaded from cache');
                this.history = data;
                return;
            }
        }

        try {
            console.log('[CurrencyService] Fetching from API...');
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            // Data format: [{ fecha: "2011-01-03", compra: 3.97, venta: 4.01 }, ...]

            // Sort by date just in case
            this.history = data.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: this.history
            }));

        } catch (error) {
            console.error('[CurrencyService] Failed to load rates:', error);
            // Fallback: If cache exists (even expired), use it
            if (cached) {
                this.history = JSON.parse(cached).data;
            }
        }
    },

    getRate(dateInput) {
        if (!this.history.length) return 0;

        const targetDate = dateInput ? new Date(dateInput) : new Date();
        targetDate.setHours(0, 0, 0, 0);

        // Find binary search or simple find (history is usually few thousand records, find is fast enough)
        // We want the rate of that day, or the closest PREVIOUS day (if weekend/holiday)

        // Iterate backwards from end
        for (let i = this.history.length - 1; i >= 0; i--) {
            const entryDate = new Date(this.history[i].fecha + 'T12:00:00'); // Avoid timezone shift
            if (entryDate <= targetDate) {
                return this.history[i].venta;
            }
        }

        // If date is before all history, current (oldest) rate? Or return first available.
        return this.history[0].venta;
    },

    convert(amount, currency, date) {
        if (!amount) return 0;
        if (currency === 'ARS') return amount;

        // Assume USD if not ARS (handle EUR later if needed)
        // If EUR, we might need cross rate, but for now assuming USD dominant.

        const rate = this.getRate(date);
        return amount * rate;
    },

    // For UI display
    getRateForDisplay(date) {
        return this.getRate(date);
    }
};
