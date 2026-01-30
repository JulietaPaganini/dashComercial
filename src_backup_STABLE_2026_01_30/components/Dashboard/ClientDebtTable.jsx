import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import TableColumnFilter from './TableColumnFilter';

// Helper for Header Cell with Filter - Outside component to prevent focus loss
const HeaderCell = ({
    label,
    field,
    widthClass,
    isSticky = false,
    stickyLeft = false,
    filters,
    onFilterChange,
    sortConfig,
    handleSort,
    clientOptions
}) => (
    <th className={`p-2 bg-gray-50 border-b border-gray-200 align-top ${widthClass} ${isSticky ? 'sticky top-0 z-30' : ''} ${stickyLeft ? 'left-0 z-40' : ''} ${stickyLeft ? 'border-r' : ''}`}>
        <div className="flex flex-col gap-2">
            {/* Title & Sort */}
            <button
                onClick={() => handleSort(field)}
                className="flex items-center justify-between w-full text-xs font-bold text-gray-700 uppercase tracking-wide hover:text-blue-600 transition-colors"
            >
                <span>{label}</span>
                <div className="ml-1 text-gray-400">
                    {sortConfig.key === field ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
                    ) : (
                        <ArrowUpDown size={12} />
                    )}
                </div>
            </button>

            {/* Filter Input */}
            {field === 'client' ? (
                <div className="flex items-center gap-1">
                    <TableColumnFilter
                        options={clientOptions}
                        selectedValues={filters.clientList || []}
                        onFilterChange={(val) => onFilterChange('clientList', val)}
                    />
                    <input
                        type="text"
                        placeholder="..."
                        className="w-full text-[10px] border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-blue-500 placeholder-gray-300 font-normal"
                        value={filters[field] || ''}
                        onChange={(e) => onFilterChange(field, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ) : (
                <input
                    type="text"
                    placeholder="..."
                    className="w-full text-[10px] border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-blue-500 placeholder-gray-300 font-normal"
                    value={filters[field] || ''}
                    onChange={(e) => onFilterChange(field, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
            )}
        </div>
    </th>
);

const ClientDebtTable = ({ data, filters = {}, onFilterChange, clientOptions = [] }) => {
    // Local Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Fallback options
    const optionsToUse = useMemo(() => {
        if (clientOptions && clientOptions.length > 0) return clientOptions;
        return [...new Set(data?.map(d => d.client) || [])].sort();
    }, [clientOptions, data]);

    if (!data || data.length === 0) {
        if (Object.keys(filters).length > 0 && !Object.values(filters).every(x => !x)) {
            return (
                <div className="card-panel mt-8 p-6 text-center text-gray-400 border border-dashed border-gray-300">
                    <p>No se encontraron facturas con los filtros actuales.</p>
                </div>
            );
        }
        return (
            <div className="card-panel mt-8 p-6 text-center text-gray-400 border border-dashed border-gray-300">
                <p>No hay datos de clientes disponibles.</p>
            </div>
        );
    }

    // Handle Sort
    const handleSort = (field) => {
        setSortConfig(prev => ({
            key: field,
            direction: prev.key === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Derived Sorted Data
    const sortedData = [...data].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        // Numeric comparison for known numeric fields
        if (['amount', 'daysOverdue', 'originalAmount'].includes(sortConfig.key)) {
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        // Date comparison
        if (['date', 'dueDate'].includes(sortConfig.key)) {
            const dateA = new Date(valA);
            const dateB = new Date(valB);
            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }

        // String comparison
        const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? cmp : -cmp;
    });

    const handleFilterInput = (key, val) => {
        onFilterChange(key, val);
    };

    // Formatters
    const fmtMoney = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v);
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-';

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full animate-fade-in">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
                    <h2 className="font-bold text-gray-800">Detalle de Comprobantes</h2>
                </div>
                <span className="text-xs text-gray-500 font-medium bg-white px-2 py-1 rounded border border-gray-200">
                    {sortedData.length} registros
                </span>
            </div>

            {/* RAW VIEW TABLE - NO HORIZONTAL SCROLL */}
            <div className="overflow-hidden border-t border-gray-200">
                <table className="w-full table-fixed text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                        <tr>
                            <HeaderCell label="Cliente" field="client" widthClass="w-[15%]" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} clientOptions={optionsToUse} />
                            <HeaderCell label="Tipo" field="type" widthClass="w-[6%]"
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="N° Comp." field="number" widthClass="w-[8%]"
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="F. Emisión" field="date" widthClass="w-[8%]"
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Vencimiento" field="dueDate" widthClass="w-[8%]"
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Días Atraso" field="paymentDelayDays" widthClass="w-[8%] text-center"
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Observaciones" field="obs" widthClass="w-[32%]"
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Importe" field="amount" widthClass="w-[15%] text-right"
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedData.map((row, idx) => (
                            <tr key={`${row.client}-${idx}`} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="py-2 px-3 font-medium text-gray-900 truncate" title={row.client}>
                                    {row.client}
                                </td>
                                <td className="py-2 px-3 text-gray-500 truncate">{row.type}</td>
                                <td className="py-2 px-3 text-gray-600 font-mono truncate" title={row.number}>{row.number || '-'}</td>
                                <td className="py-2 px-3 text-gray-600 truncate">{fmtDate(row.date)}</td>
                                <td className="py-2 px-3 text-gray-600 truncate">{fmtDate(row.dueDate)}</td>
                                <td className={`py-2 px-3 text-center font-medium ${row.amount > 0.1 ? 'text-red-700' : 'text-gray-600'}`}>
                                    {row.paymentDelayDays != null ? `${row.paymentDelayDays}d` : '-'}
                                </td>
                                <td className="py-2 px-3 text-gray-400 text-[10px] truncate" title={row.obs}>
                                    {row.obs || '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-medium text-gray-800 truncate">
                                    {fmtMoney(row.originalAmount || row.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default ClientDebtTable;
