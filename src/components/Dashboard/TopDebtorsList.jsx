
import React from 'react';

export const TopDebtorsList = ({ clients }) => {
    if (!clients || clients.length === 0) return <div className="text-center text-gray-400 py-10 text-sm">Sin deudas registradas</div>;

    const maxDebt = Math.max(...clients.map(c => c.amount));
    const fmtMoney = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact' }).format(v);

    return (
        <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
            {clients.map((c, i) => (
                <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-gray-700 truncate max-w-[150px]" title={c.client}>
                            {i + 1}. {c.client}
                        </span>
                        <span className="font-bold text-gray-900">{fmtMoney(c.amount)}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-red-500 h-full rounded-full"
                            style={{ width: `${(c.amount / maxDebt) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};
