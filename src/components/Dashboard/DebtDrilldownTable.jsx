
import React from 'react';

const DebtDrilldownTable = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="card-panel p-6 text-center text-gray-400">
                No hay facturas/deudas en este rango.
            </div>
        );
    }

    const fmtMoney = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-';

    // Sort by amount desc
    const sortedData = [...data].sort((a, b) => b.amount - a.amount);

    return (
        <div className="card-panel p-0 overflow-hidden animate-fade-in">
            <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-700 font-semibold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-3">Cliente</th>
                            <th className="p-3">N° Comprobante</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Fecha Emisión</th>
                            <th className="p-3">Vencimiento</th>
                            <th className="p-3 text-center">Días Atraso</th>
                            <th className="p-3 text-right">Monto Pendiente</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="p-3 font-medium text-gray-900">{row.client}</td>
                                <td className="p-3 text-gray-600">{row.number || '-'}</td>
                                <td className="p-3 text-gray-500">{row.type}</td>
                                <td className="p-3 text-gray-500">{fmtDate(row.date)}</td>
                                <td className="p-3 text-gray-500">{fmtDate(row.dueDate)}</td>
                                <td className="p-3 text-center">
                                    <span className={`px-2 py-1 rounded font-bold ${row.daysOverdue > 90 ? 'bg-red-100 text-red-700' :
                                            row.daysOverdue > 30 ? 'bg-orange-100 text-orange-700' :
                                                row.daysOverdue > 0 ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-green-100 text-green-700'
                                        }`}>
                                        {row.daysOverdue}
                                    </span>
                                </td>
                                <td className="p-3 text-right font-mono font-medium text-gray-800">
                                    {fmtMoney(row.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DebtDrilldownTable;
