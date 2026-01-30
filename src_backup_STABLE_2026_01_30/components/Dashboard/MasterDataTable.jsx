import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import TableColumnFilter from './TableColumnFilter';
import Tooltip from '../UI/Tooltip';

// Moved HeaderCell outside
const HeaderCell = ({
    label,
    field,
    widthClass,
    isSticky = false,
    stickyLeft = false,
    isDropdown = false,
    options = [],
    filters,
    onFilterChange,
    sortConfig,
    handleSort,
    clientOptions
}) => (
    <th className={`p-2 bg-gray-50 border-b border-gray-200 align-top ${widthClass} ${isSticky ? 'sticky top-0 z-30' : ''} ${stickyLeft ? 'left-0 z-40' : ''} ${stickyLeft ? 'border-r' : ''}`}>
        <div className="flex flex-col gap-2">
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

            {isDropdown ? (
                <select
                    className="w-full text-[10px] border border-gray-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-blue-500 text-gray-600"
                    value={filters[field] || ''}
                    onChange={(e) => onFilterChange(field, e.target.value)}
                >
                    <option value="">Todo</option>
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            ) : field === 'client' ? (
                // DUAL FILTER: List + Text
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

const MasterDataTable = ({ data, filters = {}, onFilterChange, statusOptions = [], collectionOptions = [], clientOptions = [] }) => {
    // Local Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Unique Clients for Filter
    const uniqueClients = React.useMemo(() => [...new Set(data.map(d => d.client))].sort(), [data]);

    // Options to use for filter (prop or derived)
    const optionsToUse = useMemo(() => {
        if (clientOptions && clientOptions.length > 0) return clientOptions;
        return uniqueClients;
    }, [clientOptions, uniqueClients]);

    if (!data || data.length === 0) {
        if (Object.keys(filters).length > 0) {
            // Show message if empty BUT filters are active
            return (
                <div className="card-panel mt-8 p-12 text-center border-2 border-dashed border-yellow-200 bg-yellow-50 rounded-xl">
                    <p className="text-yellow-800 font-bold text-lg mb-2">⚠️ No se encontraron resultados</p>
                    <p className="text-yellow-600 mb-4">Intenta ajustar los filtros o el término de búsqueda.</p>
                    <button
                        onClick={() => onFilterChange({})}
                        className="text-blue-600 hover:text-blue-800 text-sm font-bold underline"
                    >
                        Limpiar todos los filtros
                    </button>
                </div>
            );
        }
        // Show original empty if truly empty
        return (
            <div className="card-panel mt-8 p-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <p>No hay datos disponibles para mostrar.</p>
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

        // Numeric-aware comparison
        const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });

        return sortConfig.direction === 'asc' ? cmp : -cmp;
    });

    const handleFilterInput = (key, val) => {
        onFilterChange(prev => ({ ...prev, [key]: val }));
    };

    // Formatters
    const fmtMoney = (v, currency = 'ARS') => {
        if (!v) return '-';
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: currency === 'USD' ? 'USD' : (currency === 'EUR' ? 'EUR' : 'ARS')
        }).format(v);
    };
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
    const fmtStr = (s) => s || '-';



    return (
        <div className="card-panel p-0 overflow-hidden mt-8 shadow-md border border-gray-200 rounded-xl bg-white">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Detalle de Operaciones</h3>
                    <p className="text-sm text-gray-500">Listado unificado de presupuestos y seguimiento de ventas</p>
                </div>
                <div className="text-xs font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                    {data.length} Registros
                </div>
            </div>

            <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-600 shadow-sm sticky top-0 z-20">
                        <tr>
                            {/* HEADER GROUP: COTIZACION (Orange Pastel) */}
                            <HeaderCell label="N° Cot" field="id" widthClass="min-w-[80px] bg-orange-50" stickyLeft isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Fecha Cot" field="date" widthClass="min-w-[90px] bg-orange-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Cliente" field="client" widthClass="min-w-[150px] bg-orange-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} clientOptions={optionsToUse} />
                            <HeaderCell label="Equipo" field="equipment" widthClass="min-w-[120px] bg-orange-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Descripción" field="description" widthClass="max-w-[150px] bg-orange-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Monto a Fact." field="amount" widthClass="min-w-[100px] text-right bg-orange-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="USD a $" field="amountArs" widthClass="min-w-[100px] text-right bg-orange-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Estado" field="status" widthClass="min-w-[100px] bg-orange-50" isSticky isDropdown options={statusOptions}
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />

                            {/* HEADER GROUP: VENTAS (Green Pastel) */}
                            <HeaderCell label="F. OC" field="ocDate" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="F. Factura" field="invoiceDate" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="F. Cobro" field="paymentDate" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="F. Entrega" field="deliveryDate" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Costo" field="cost" widthClass="text-right bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Ben %" field="profitPercent" widthClass="text-right bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Ben $" field="profitAmount" widthClass="text-right bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Cobrar Std" field="receivableStd" widthClass="text-right bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Cobrar Real" field="receivableReal" widthClass="text-right bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />

                            <HeaderCell
                                label="Est. Cobro"
                                field="collectionStatus"
                                widthClass="bg-green-50 min-w-[100px]"
                                isSticky
                                isDropdown
                                options={collectionOptions}
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort}
                            />

                            <HeaderCell label="Desc Trabajo" field="finalDescription" widthClass="max-w-[150px] bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Hs Cot" field="hoursQuoted" widthClass="text-center bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Hs Uso" field="hoursUsed" widthClass="text-center bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Póliza" field="policyIndex" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="Est. Póliza" field="policyStatus" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="OC N°" field="ocNumber" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                            <HeaderCell label="FC N°" field="invoiceNumber" widthClass="bg-green-50" isSticky
                                filters={filters} onFilterChange={handleFilterInput} sortConfig={sortConfig} handleSort={handleSort} />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedData.map((row) => (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                                {/* COTIZACION DATA */}
                                <td className="py-2.5 px-4 font-mono font-medium text-gray-900 bg-white sticky left-0 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    {row.id}
                                </td>
                                <td className="py-2.5 px-4">{fmtDate(row.date)}</td>
                                <td className="py-2.5 px-4 font-medium text-gray-800">{fmtStr(row.client)}</td>
                                <td className="py-2.5 px-4 text-gray-600">{fmtStr(row.equipment)}</td>
                                <td className="py-2.5 px-4 text-gray-500 max-w-xs">
                                    <Tooltip content={row.description} className="truncate w-full block">
                                        {fmtStr(row.description)}
                                    </Tooltip>
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono text-gray-700">{row.amount ? fmtMoney(row.amount, row.currency) : ''}</td>
                                <td className="py-2.5 px-4 text-right font-mono text-gray-600 border-r border-gray-100/50">
                                    {row.currency === 'USD' ? (
                                        <div className="flex flex-col items-end">
                                            <span>{fmtMoney(row.amountArs, 'ARS')}</span>
                                            <span className="text-[10px] text-gray-400">Tipo: {row.exchangeRateUsed}</span>
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="py-2.5 px-4 border-r border-gray-100">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                    ${row.status === 'GANADA' ? 'bg-green-100 text-green-700'
                                            : row.status === 'PERDIDA' ? 'bg-red-100 text-red-700'
                                                : 'bg-gray-100 text-gray-600'}`}>
                                        {row.status}
                                    </span>
                                </td>

                                {/* VENTAS DATA (Conditionally Rendered or Empty) */}
                                {row.isSold ? (
                                    <>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtDate(row.ocDate)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtDate(row.invoiceDate)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtDate(row.paymentDate)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtDate(row.deliveryDate)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-right font-mono text-xs text-red-600">{fmtMoney(row.cost, row.currency)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-right font-mono text-xs">{typeof row.profitPercent === 'number' ? (Math.abs(row.profitPercent) > 1 ? row.profitPercent : row.profitPercent * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '-'}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-right font-mono font-medium text-green-600">{fmtMoney(row.profitAmount, row.currency)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-right font-mono text-xs text-gray-600">{fmtMoney(row.receivableStd, row.currency)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-right font-mono text-xs text-gray-600">{fmtMoney(row.receivableReal, row.currency)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtStr(row.collectionStatus)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-500 max-w-xs">
                                            <Tooltip content={row.finalDescription} className="truncate w-full block">
                                                {fmtStr(row.finalDescription)}
                                            </Tooltip>
                                        </td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-center">{row.hoursQuoted || '-'}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-center">{row.hoursUsed || '-'}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtStr(row.policyIndex)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtStr(row.policyStatus)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtStr(row.ocNumber)}</td>
                                        <td className="py-2.5 px-4 bg-blue-50/5 text-gray-600">{fmtStr(row.invoiceNumber)}</td>
                                    </>
                                ) : (
                                    <>
                                        {/* Empty cells for non-sold quotes */}
                                        <td colSpan={17} className="py-2.5 px-4 text-center text-gray-300 italic bg-gray-50/20">
                                            -
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MasterDataTable;
