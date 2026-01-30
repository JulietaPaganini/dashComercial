import React, { useState, useMemo, useEffect } from 'react';
import Layout from './components/Layout/Layout';
import { parseExcelFiles } from './services/ExcelParser';
import { processDataset, calculateKPIs } from './services/DataProcessor';
import { Upload, TrendingUp, AlertTriangle, DollarSign, Clock, LayoutDashboard, Database, FileText, Filter, Wallet, FileBarChart, Activity, Users, UserX, FileWarning } from 'lucide-react';
import { RevenueAreaChart } from './components/Dashboard/RevenueAreaChart';
import { QuotesTrendChart } from './components/Dashboard/QuotesTrendChart';
import { DebtBarChart } from './components/Dashboard/DebtBarChart';
import { TopDebtorsList } from './components/Dashboard/TopDebtorsList';
import { ConversionGauge } from './components/Dashboard/ConversionGauge';
import MasterDataTable from './components/Dashboard/MasterDataTable';
import DebtDrilldownTable from './components/Dashboard/DebtDrilldownTable';
import PaymentStatusChart from './components/Dashboard/PaymentStatusChart';
import ClientDebtTable from './components/Dashboard/ClientDebtTable';
import { X } from 'lucide-react';

// --- DATA PERSISTENCE HELPER ---
const STORAGE_KEY = 'ocme_dashboard_data_v1';

const saveToStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Storage failed (quota?):', e);
  }
};

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Rehydrate Dates
    // We need to recursively traverse or just manually fix known date fields.
    // Knowing our structure is simpler:
    if (parsed.processed) {
      if (parsed.processed.quotes) {
        parsed.processed.quotes.forEach(q => {
          if (q.date) q.date = new Date(q.date);
          if (q.saleDate) q.saleDate = new Date(q.saleDate);
        });
      }
      if (parsed.processed.clients) {
        parsed.processed.clients.forEach(c => {
          if (c.date) c.date = new Date(c.date);
          if (c.dueDate) c.dueDate = new Date(c.dueDate);
        });
      }
    }
    return parsed;
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
};


// --- DATA TRANSFORMERS ---
const useChartData = (kpis) => {
  return useMemo(() => {
    if (!kpis) return { revenueTrend: [], debtAging: [] };

    // 1. Revenue Trend (Mock Monthly Distribution if no detailed dates, or aggregate real dates)
    // 1. Trends
    const revenueTrendRaw = kpis.sales.revenueTrend || [];

    // Revenue Chart Data
    const revenueTrend = revenueTrendRaw.map(item => {
      const [year, month] = item.month.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = dateObj.toLocaleDateString('es-AR', { month: 'short' });
      return {
        date: label.charAt(0).toUpperCase() + label.slice(1),
        value: item.revenue
      };
    });

    // Quotes Volume Chart Data
    const quotesTrend = revenueTrendRaw.map(item => {
      const [year, month] = item.month.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = dateObj.toLocaleDateString('es-AR', { month: 'short' });
      return {
        date: label.charAt(0).toUpperCase() + label.slice(1),
        total: item.totalCount,
        won: item.wonCount
      };
    });

    // 2. Debt
    const da = kpis.debt.aging;
    const debtAging = [
      { name: '-30 Días', value: da.current },
      { name: '30 Días', value: da.days30 },
      { name: '60 Días', value: da.days60 },
      { name: '90 Días', value: da.days90 },
      { name: '+90 Días', value: da.plus90 },
    ];

    const topDebtors = kpis.debt.topDebtors || [];

    return { revenueTrend, quotesTrend, debtAging, topDebtors };
  }, [kpis]);
};

// --- COMPONENTS ---

// Updated KPI Card: Solid vibrant colors, clean typography, absolute icon
// Helper for gradients based on color prop
const getColorStyles = (color) => {
  const styles = {
    blue: "bg-gradient-to-br from-blue-500 to-blue-600",
    indigo: "bg-gradient-to-br from-indigo-500 to-indigo-600",
    orange: "bg-gradient-to-br from-orange-400 to-orange-500", // Adjusted for better visibility
    red: "bg-gradient-to-br from-red-500 to-red-600",
    green: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    gray: "bg-gradient-to-br from-gray-600 to-gray-700",
  };
  return styles[color] || styles.blue;
};

// Updated KPI Card: Solid vibrant colors, clean typography, absolute icon
const KpiCard = ({ title, value, icon: Icon, color, isMoney, subtitle, trend }) => {
  const formattedValue = isMoney
    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0)
    : value;

  return (
    <div className={`relative overflow-hidden rounded-xl p-5 min-h-[160px] flex flex-col justify-between shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 ${getColorStyles(color)}`}>
      {/* Background Icon Decoration */}
      <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-12">
        <Icon size={100} strokeWidth={1.5} color="white" />
      </div>

      <div className="z-10 bg-white/20 w-fit p-2 rounded-lg backdrop-blur-sm">
        <Icon size={20} className="text-white" />
      </div>

      <div className="z-10 relative mt-2">
        <div className="text-2xl font-bold text-white tracking-tight mb-0.5">{formattedValue}</div>
        <div className="text-white/90 text-sm font-medium tracking-wide opacity-90">{title}</div>

        {(subtitle || trend) && (
          <div className="mt-2 text-xs text-white/70 border-t border-white/10 pt-2 flex items-center gap-1">
            {trend ? (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-white font-bold">{trend}</span>
            ) : (
              <span>{subtitle}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- FILTER COMPONENT ---
const FilterBar = ({ clients, filters, onFilterChange }) => {
  const currentYear = new Date().getFullYear();
  const startOfCurrentYear = `${currentYear}-01-01`;
  const endOfCurrentYear = `${currentYear}-12-31`;

  const startOfPrevYear = `${currentYear - 1}-01-01`;
  const endOfPrevYear = `${currentYear - 1}-12-31`;

  const isCurrentYearActive = filters.startDate === startOfCurrentYear && filters.endDate === endOfCurrentYear;
  const isPrevYearActive = filters.startDate === startOfPrevYear && filters.endDate === endOfPrevYear;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-8 flex flex-col md:flex-row gap-4 items-end shadow-sm">
      <div className="flex-1 w-full md:w-auto">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Cliente</label>
        <select
          className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
          value={filters.client}
          onChange={(e) => onFilterChange('client', e.target.value)}
        >
          <option value="">Todos los clientes</option>
          {clients.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Desde</label>
          <input
            type="date"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Hasta</label>
          <input
            type="date"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
          />
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 gap-1 h-[42px] items-center">
          <button
            onClick={() => {
              onFilterChange('startDate', startOfPrevYear);
              onFilterChange('endDate', endOfPrevYear);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 h-full
                ${isPrevYearActive
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
            title={`Ver ${currentYear - 1}`}
          >
            {currentYear - 1}
          </button>
          <button
            onClick={() => {
              onFilterChange('startDate', startOfCurrentYear);
              onFilterChange('endDate', endOfCurrentYear);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 h-full
                ${isCurrentYearActive
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
            title={`Ver ${currentYear}`}
          >
            {currentYear}
          </button>
        </div>
      </div>

      <div className="md:ml-auto pb-3">
        <button
          onClick={() => onFilterChange('reset')}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline px-2"
        >
          Limpiar Filtros
        </button>
      </div>
    </div>
  );
};

const SalesDashboard = ({ processedData, initialKpis }) => {
  if (!initialKpis) return <EmptyState msg="Sube los archivos para activar el tablero." />;

  // Local state for filters
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState({
    client: '',
    startDate: `${currentYear}-01-01`,
    endDate: `${currentYear}-12-31`
  });
  const [tableFilters, setTableFilters] = useState({}); // { key: value }

  // 1. Extract Unique Clients for Dropdown (Global)
  const clientList = useMemo(() => {
    if (!processedData?.quotes) return [];
    const unique = new Set(processedData.quotes.map(q => q.client).filter(Boolean));
    return Array.from(unique).sort();
  }, [processedData]);

  // 2. Dynamic Data Filtering
  const dashboardData = useMemo(() => {
    let filteredQuotes = [...(processedData?.quotes || [])];

    // A. Global Top Bar Filters
    if (filters.client) {
      filteredQuotes = filteredQuotes.filter(q => q.client === filters.client);
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      filteredQuotes = filteredQuotes.filter(q => q.date && q.date >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59);
      filteredQuotes = filteredQuotes.filter(q => q.date && q.date <= end);
    }

    // --- DYNAMIC TREND CALCULATION ---
    let salesTrend = null;
    let prevSales = 0;

    // Only calculate trend if DATE filters are active
    if (filters.startDate && filters.endDate) {
      const currentStart = new Date(filters.startDate);
      const currentEnd = new Date(filters.endDate);
      const duration = currentEnd - currentStart; // ms duration

      // Calculate Comparison Dates
      let comparisonEnd = new Date(currentStart);
      comparisonEnd.setDate(comparisonEnd.getDate() - 1); // Day before period start

      let comparisonStart = new Date(comparisonEnd.getTime() - duration);

      // Friendly label logic
      let trendLabel = "vs periodo anterior";
      // Heuristic: If approx 365 days, call it "vs año anterior"
      const daysDiff = duration / (1000 * 60 * 60 * 24);
      if (daysDiff > 360 && daysDiff < 370) trendLabel = "vs año anterior";
      if (daysDiff > 28 && daysDiff < 32) trendLabel = "vs mes anterior";

      // Filter Previous Period Data from RAW dataset
      const prevQuotes = (processedData?.quotes || []).filter(q => {
        if (filters.client && q.client !== filters.client) return false;
        if (!q.date) return false;
        return q.date >= comparisonStart && q.date <= comparisonEnd;
      });

      prevSales = prevQuotes
        .filter(q => q.status === 'GANADA')
        .reduce((acc, q) => acc + (q.saleAmount || q.amount), 0);

      // Calculate % Change
      const currentSales = filteredQuotes
        .filter(q => q.status === 'GANADA')
        .reduce((acc, q) => acc + (q.saleAmount || q.amount), 0);

      if (prevQuotes.length === 0) {
        salesTrend = "Sin datos históricos";
      } else if (prevSales > 0) {
        const delta = ((currentSales - prevSales) / prevSales) * 100;
        const sign = delta >= 0 ? '+' : '';
        salesTrend = `${sign}${delta.toFixed(1)}% ${trendLabel}`;
      } else if (currentSales > 0 && prevSales === 0) {
        salesTrend = `+100% ${trendLabel}`;
      } else {
        salesTrend = `0% ${trendLabel}`;
      }
    }

    // B. Table Column Filters
    // B. Table Column Filters
    if (Object.keys(tableFilters).length > 0) {
      filteredQuotes = filteredQuotes.filter(row => {
        return Object.entries(tableFilters).every(([key, val]) => {
          if (!val) return true; // Skip empty filters

          // 1. Array/MultiSelect Filter (e.g. clientList)
          if (Array.isArray(val)) {
            if (val.length === 0) return true;
            if (val.length === 1 && val[0] === '__NONE__') return false;

            // Special case logic:
            // clientList filter applies to row.client
            const targetVal = (key === 'clientList') ? row.client : row[key];

            if (!targetVal) return false;
            return val.includes(targetVal);
          }

          // 2. String Filter
          const strVal = String(val).toLowerCase().trim();
          if (!strVal) return true;

          const rowVal = row[key];
          if (rowVal === null || rowVal === undefined) return false;

          // Exact match fields
          if (key === 'status' || key === 'collectionStatus') {
            return String(rowVal).toLowerCase() === strVal;
          }

          // Broad match
          return String(rowVal).toLowerCase().includes(strVal);
        });
      });
    }

    // C. Client Filter for DEBT (Separate dataset)
    let filteredClients = [...(processedData?.clients || [])];
    if (filters.client) {
      filteredClients = filteredClients.filter(c => c.client === filters.client);
    }

    // Re-calculate KPIs
    const partialData = {
      ...processedData,
      quotes: filteredQuotes,
      clients: filteredClients, // Pass filtered clients so Debt KPI updates
      kpi: {
        ...processedData.kpi,
        totalVendido: filteredQuotes.filter(q => q.status === 'GANADA').reduce((acc, q) => acc + (q.saleAmount || q.amount), 0)
      }
    };

    const dynamicKpis = calculateKPIs(partialData);

    // Calculate Global Debt for Display Title
    const globalDebt = (processedData?.clients || []).reduce((acc, c) => acc + c.amount, 0);

    return {
      kpis: dynamicKpis,
      revenueTrend: dynamicKpis.sales.revenueTrend || [],
      filteredQuotes,
      filteredClients,
      salesTrend,
      globalDebt,

      // Extract unique options for Table Dropdowns based on CURRENT data (or ALL data? usually ALL is better for dropdowns)
      uniqueStatuses: [...new Set(processedData?.quotes?.map(q => q.status).filter(Boolean))].sort(),
      uniqueCollectionStatuses: [...new Set(processedData?.quotes?.map(q => q.collectionStatus).filter(Boolean))].sort(),
      uniqueClients: [...new Set(processedData?.quotes?.map(q => q.client).filter(Boolean))].sort()
    };

  }, [processedData, initialKpis, filters, tableFilters]);

  const { kpis, revenueTrend: rawRevenueTrend, filteredQuotes, uniqueStatuses, uniqueCollectionStatuses, uniqueClients, salesTrend, globalDebt } = dashboardData;
  const { quotes, sales, debt } = kpis;
  const { revenueTrend, quotesTrend, debtAging, topDebtors } = useChartData(kpis);

  const handleFilterChange = (key, value) => {
    if (key === 'reset') {
      setFilters({
        client: '',
        startDate: '',
        endDate: ''
      });
      setTableFilters({});
    }
    else setFilters(prev => ({ ...prev, [key]: value }));
  };

  const hasActiveTableFilters = Object.values(tableFilters).some(v => v);

  const fmtMoney = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact' }).format(v);
  const fmtMoneyFull = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v);
  const fmtPercent = (v) => `${v.toFixed(1)}%`;



  return (
    <div className="animate-fade-in pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Comercial</h1>
          <p className="text-gray-500 mt-1">Visión general del rendimiento y estado financiero.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-sm text-gray-500 flex items-center gap-2">
            <Clock size={14} />
            <span>Última actualización: Hoy</span>
          </div>
          {hasActiveTableFilters && (
            <div className="animate-pulse bg-yellow-50 text-yellow-700 px-3 py-1 rounded-md border border-yellow-200 text-xs font-bold flex items-center gap-2">
              <Filter size={12} />
              Filtros de tabla activos
              <button onClick={() => setTableFilters({})} className="hover:underline ml-1 text-yellow-800">
                (Limpiar)
              </button>
            </div>
          )}
        </div>

      </div>

      {/* FILTERS */}
      <FilterBar
        clients={clientList}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <KpiCard
          title="Total Vendido"
          value={sales.totalSales}
          icon={Wallet}
          color="green"
          trend={salesTrend}
          isMoney
        />
        <KpiCard
          title="Total Cotizado"
          value={quotes.pipelineValue}
          icon={FileBarChart}
          color="indigo"
          isMoney
          subtitle={`${quotes.count} presupuestos`}
        />
        <KpiCard
          title="Pipeline Activo"
          value={quotes.activePipeline}
          icon={Activity}
          color="orange"
          isMoney
          subtitle="Pendientes de cierre"
        />

      </div>

      {/* CHARTS GRID - 2x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            Tendencia de Ingresos
          </h3>
          <div className="h-64">
            <RevenueAreaChart data={revenueTrend} />
          </div>
        </div>

        {/* Quotes Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileBarChart size={20} className="text-indigo-600" />
            Volumen de Cotizaciones
          </h3>
          <div className="h-64">
            <QuotesTrendChart data={quotesTrend} />
          </div>
        </div>

      </div>

      {/* DETAILED TABLE */}
      <MasterDataTable
        data={filteredQuotes}
        filters={tableFilters}
        onFilterChange={setTableFilters}
        statusOptions={uniqueStatuses}
        collectionOptions={uniqueCollectionStatuses}
        clientOptions={uniqueClients}
      />

    </div >
  );
};

// ... UploadManager is mostly fine, just ensuring layout consistency ...

const ClientStatus = ({ data, clientList }) => {
  if (!data) return <EmptyState msg="No hay datos de clientes." />;

  const [filters, setFilters] = useState({ client: '', startDate: '', endDate: '', minAmount: '' });
  const [debtFilter, setDebtFilter] = useState(null);
  const [tableFilters, setTableFilters] = useState({});

  const handleFilterChange = (key, value) => {
    if (key === 'reset') setFilters({ client: '', startDate: '', endDate: '', minAmount: '' });
    else setFilters(prev => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  // 1. Apply Global Filters
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Client
      if (filters.client && item.client !== filters.client) return false;
      // Date Range (Issued Date)
      if (filters.startDate && new Date(item.date) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(item.date) > new Date(filters.endDate)) return false;
      // Min Amount
      if (filters.minAmount && item.amount < Number(filters.minAmount)) return false;
      return true;
    });
  }, [data, filters]);

  // 1.5 Apply Table Filters (Intermediate for Charts)
  const dataWithTableFilters = useMemo(() => {
    let result = filteredData;

    if (Object.keys(tableFilters).length > 0) {
      result = result.filter(row => {
        // Handle clientList specifically
        if (tableFilters.clientList && Array.isArray(tableFilters.clientList)) {
          const list = tableFilters.clientList;
          if (list.length === 1 && list[0] === '__NONE__') return false;
          if (list.length > 0 && !list.includes(row.client)) return false;
        }

        return Object.entries(tableFilters).every(([k, v]) => {
          if (k === 'clientList') return true;
          if (!v) return true;

          const cellVal = row[k];

          // Arrays handled above or ignored here
          if (Array.isArray(v)) return true;

          return cellVal && String(cellVal).toLowerCase().includes(v.toLowerCase());
        });
      });
    }
    return result;
  }, [filteredData, tableFilters]);

  // 2. Calculate KPIs & Chart Data
  const {
    totalDebt,
    avgDelay,
    debtAging,
    topDebtors,
    globalDebt,
    totalClientsCount,
    clientsWithDebtCount,
    delinquentClientsCount,
    overdueInvoicesCount,
    paymentStatusData
  } = useMemo(() => {
    const sourceData = dataWithTableFilters; // Use filtered data for KPIs

    const total = sourceData.reduce((acc, c) => acc + (c.amount > 0 ? c.amount : 0), 0);
    const overdueItems = sourceData.filter(c => c.daysOverdue > 0 && c.amount > 0);
    const avg = overdueItems.length ? Math.round(overdueItems.reduce((acc, c) => acc + c.daysOverdue, 0) / overdueItems.length) : 0;

    // Aggregations
    const clientsMap = {};
    let pagadoCount = 0;
    let vencidoCount = 0;
    let pendienteCount = 0;

    sourceData.forEach(c => {
      // Payment Status Stats
      if (c.amount <= 0) pagadoCount++;
      else if (c.daysOverdue > 0) vencidoCount++;
      else pendienteCount++;

      // Client Stats
      const name = c.client || 'Desconocido';
      if (!clientsMap[name]) clientsMap[name] = { debt: 0, maxDelay: 0 };
      clientsMap[name].debt += c.amount;
      clientsMap[name].maxDelay = Math.max(clientsMap[name].maxDelay, c.daysOverdue);
    });

    const uniqueClients = Object.values(clientsMap);

    // Aging Chart
    const aging = [
      { name: '-30 Días', value: sourceData.filter(c => c.agingBucket === 'Corriente' && c.amount > 0).reduce((acc, c) => acc + c.amount, 0) },
      { name: '30 Días', value: sourceData.filter(c => c.agingBucket === '1-30 días' && c.amount > 0).reduce((acc, c) => acc + c.amount, 0) },
      { name: '60 Días', value: sourceData.filter(c => c.agingBucket === '31-60 días' && c.amount > 0).reduce((acc, c) => acc + c.amount, 0) },
      { name: '90 Días', value: sourceData.filter(c => c.agingBucket === '61-90 días' && c.amount > 0).reduce((acc, c) => acc + c.amount, 0) },
      { name: '+90 Días', value: sourceData.filter(c => c.agingBucket === '+90 días' && c.amount > 0).reduce((acc, c) => acc + c.amount, 0) },
    ];

    // Top Debtors
    const top = Object.entries(clientsMap)
      .map(([client, d]) => ({ client, amount: d.debt }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Payment Status Chart
    const payStatus = [
      { name: 'PAGADO', count: pagadoCount },
      { name: 'PENDIENTE', count: pendienteCount },
      { name: 'VENCIDO', count: vencidoCount }
    ];

    return {
      totalDebt: total,
      avgDelay: avg,
      debtAging: aging,
      topDebtors: top,
      globalDebt: data.reduce((acc, c) => acc + (c.amount > 0 ? c.amount : 0), 0),
      totalClientsCount: uniqueClients.length,
      clientsWithDebtCount: uniqueClients.filter(c => c.debt > 0).length,
      delinquentClientsCount: uniqueClients.filter(c => c.maxDelay > 60).length,
      overdueInvoicesCount: overdueItems.length,
      paymentStatusData: payStatus
    };
  }, [dataWithTableFilters, data]);


  // 3. Handle Table Filtering (Local + Drilldown)
  const handleChartClick = (d) => {
    const map = { '-30 Días': 'Corriente', '30 Días': '1-30 días', '60 Días': '31-60 días', '90 Días': '61-90 días', '+90 Días': '+90 días' };
    if (map[d.name]) setDebtFilter(map[d.name]);
  };

  const handleTableFilterChange = (key, val) => {
    setTableFilters(prev => ({ ...prev, [key]: val }));
  };

  const finalTableData = useMemo(() => {
    // A. Drilldown just filters the already-filtered data
    return debtFilter ? dataWithTableFilters.filter(c => c.agingBucket === debtFilter) : dataWithTableFilters;
  }, [dataWithTableFilters, debtFilter]);

  const fmtMoneyFull = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v);


  return (
    <div className="animate-fade-in pb-12">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Estado de Clientes</h1>
          <p className="text-gray-500 mt-1">Gestión de cuentas corrientes y análisis de deuda.</p>
        </div>
        {hasActiveFilters && (
          <button onClick={() => handleFilterChange('reset')} className="text-xs text-red-600 font-bold bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 transition-colors">
            Limpiar Filtros
          </button>
        )}
      </div>

      <FilterBar clients={clientList} filters={filters} onFilterChange={handleFilterChange} />

      {/* KPIs GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <KpiCard title={hasActiveFilters ? `Deuda (${fmtMoneyFull(globalDebt)})` : 'Deuda Total'}
          value={totalDebt} icon={DollarSign} color="red" isMoney subtitle="Saldo pendiente actual" />
        <KpiCard title="Total Clientes" value={totalClientsCount} icon={Users} color="gray" subtitle="En selección actual" />
        <KpiCard title="Clientes con Deuda" value={clientsWithDebtCount} icon={Activity} color="gray" subtitle="Con saldo > $0" />
        <KpiCard title="Clientes Morosos" value={delinquentClientsCount} icon={UserX} color="gray" subtitle="Deuda > 60 días" />
        <KpiCard title="Facturas Vencidas" value={overdueInvoicesCount} icon={FileWarning} color="gray" subtitle="Documentos impagos" />
        <KpiCard title="Promedio Retraso" value={avgDelay} icon={Clock} color="gray" subtitle="Días de mora promedio" />
      </div>

      {/* CHARTS ROW (3 Col) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Pay Status */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><FileText size={16} /> Estado de Pagos</h4>
          <div className="h-56">
            <PaymentStatusChart data={paymentStatusData} />
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-1">Distribución global</p>
        </div>
        {/* Aging */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Clock size={16} /> Antigüedad de Deuda</h4>
          <div className="h-56">
            <DebtBarChart data={debtAging} onBarClick={handleChartClick} />
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-1">Click para filtrar detalle</p>
        </div>
        {/* Top Debtors */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><AlertTriangle size={16} /> Top 5 Deudores</h4>
          <div className="h-56">
            <TopDebtorsList clients={topDebtors} />
          </div>
        </div>
      </div>

      {/* TABLE */}
      {Object.values(tableFilters).some(v => Array.isArray(v) ? (v.length > 0 && v[0] !== '__NONE__') : v) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r shadow-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center">
            <Filter size={20} className="text-yellow-500 mr-3" />
            <div>
              <h5 className="font-bold text-yellow-800">Filtros Activos en Tabla</h5>
              <p className="text-sm text-yellow-700">Se están ocultando algunos resultados.</p>
            </div>
          </div>
          <button
            onClick={() => setTableFilters({})}
            className="text-sm font-semibold text-yellow-700 hover:text-yellow-900 underline"
          >
            Limpiar Filtros
          </button>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {debtFilter && (
          <div className="flex justify-between items-center bg-red-50 p-4 rounded-lg border border-red-100 animate-fade-in">
            <h3 className="font-bold text-red-800">Filtro Activo: {debtFilter === 'Corriente' ? 'A Vencer' : debtFilter}</h3>
            <button onClick={() => setDebtFilter(null)} className="flex items-center gap-1 text-sm font-bold text-red-600 hover:text-red-800"><X size={16} /> Cerrar</button>
          </div>
        )}

        <ClientDebtTable
          data={finalTableData}
          filters={tableFilters}
          onFilterChange={handleTableFilterChange}
          clientOptions={clientList}
        />
      </div>

    </div>
  );
};


const ProcessingReport = ({ issues, onClose }) => {
  if (!issues || issues.length === 0) return null;

  // Group issues by type
  const errors = issues.filter(i => i.type === 'ERROR');
  const warnings = issues.filter(i => i.type === 'WARNING');
  const others = issues.filter(i => i.type !== 'ERROR' && i.type !== 'WARNING');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={20} />
              Reporte de Carga de Datos
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Se encontraron {issues.length} observaciones durante el procesamiento.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto p-6 flex-1">
          {/* SUMMARY STATS */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 border border-red-100 p-4 rounded-lg text-center">
              <span className="block text-2xl font-bold text-red-700">{errors.length}</span>
              <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Errores Críticos</span>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-center">
              <span className="block text-2xl font-bold text-yellow-700">{warnings.length}</span>
              <span className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Advertencias</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-center">
              <span className="block text-2xl font-bold text-blue-700">{others.length}</span>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Info / Huérfanos</span>
            </div>
          </div>

          <table className="w-full text-xs text-left">
            <thead className="bg-gray-100 uppercase tracking-wider font-semibold text-gray-600 sticky top-0">
              <tr>
                <th className="p-3">Tipo</th>
                <th className="p-3">Hoja / Archivo</th>
                <th className="p-3">Fila</th>
                <th className="p-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border border-gray-100 rounded">
              {issues.map((issue, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase
                                          ${issue.type === 'ERROR' ? 'bg-red-100 text-red-800 border-red-200'
                        : issue.type === 'WARNING' ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
                      {issue.type}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-gray-700">{issue.sheet}</td>
                  <td className="p-3 font-mono text-gray-500">{issue.row || '-'}</td>
                  <td className="p-3 text-gray-600">{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors"
          >
            Entendido, continuar
          </button>
        </div>
      </div>
    </div>
  );
};

const UploadManager = ({ onDataLoaded, history }) => {
  const [quotesFile, setQuotesFile] = useState(null);
  const [clientsFile, setClientsFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportIssues, setReportIssues] = useState(null);

  // Generic process handler that picks up whatever is in state
  const handleProcess = async () => {
    if (!quotesFile && !clientsFile) return;
    setLoading(true);

    setTimeout(async () => {
      try {
        const filesToProcess = [];
        if (quotesFile) filesToProcess.push(quotesFile);
        if (clientsFile) filesToProcess.push(clientsFile);

        const rawDataset = await parseExcelFiles(filesToProcess);
        const processed = processDataset(rawDataset);
        const kpis = calculateKPIs(processed);

        // Add to history
        onDataLoaded({ processed, kpis }, {
          date: new Date().toISOString(),
          files: filesToProcess.map(f => f.name).join(', '),
          status: 'success',
          rows: (processed.quotes?.length || 0) + (processed.clients?.length || 0)
        });

        // Show report if issues exist
        if (processed.issues && processed.issues.length > 0) {
          setReportIssues(processed.issues);
        } else {
          // Only clear files if no issues, otherwise wait for user to close report
          setQuotesFile(null);
          setClientsFile(null);
        }

      } catch (e) {
        console.error(e);
        alert("Error al procesar: " + e.message);
      } finally {
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="animate-fade-in max-w-6xl mx-auto pt-8 pb-12 px-6">

      {/* PROCESSING REPORT MODAL */}
      {reportIssues && (
        <ProcessingReport
          issues={reportIssues}
          onClose={() => {
            setReportIssues(null);
            // Clear files on close
            setQuotesFile(null);
            setClientsFile(null);
          }}
        />
      )}

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cargar Datos desde Excel</h1>
        <p className="text-gray-500 mt-2 text-base">Importa archivos de cotizaciones y estados de cuentas de clientes</p>
      </div>

      {/* INFO BANNER */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-10 flex items-start gap-3 shadow-sm">
        <div className="text-gray-400 mt-0.5">
          <AlertTriangle size={20} />
        </div>
        <div className="text-sm text-gray-600 leading-relaxed">
          <span className="font-bold text-gray-800 block mb-1">Importante:</span>
          Los archivos Excel deben mantener la estructura original. Al cargar un nuevo archivo, los datos anteriores del mismo tipo serán reemplazados.
        </div>
      </div>

      {/* UPLOAD CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <UploadCard
          title="Archivo de Cotizaciones"
          subtitle="Archivo: 'ESTADOS DE COTIZACIONES.xlsx'"
          icon={FileText}
          file={quotesFile}
          onFileSelect={setQuotesFile}
          onProcess={handleProcess}
          loading={loading}
          color="blue"
          placeholderFile="ESTADOS DE COTIZACIONES.xlsx"
        />
        <UploadCard
          title="Archivo de Cuentas de Clientes"
          subtitle="Archivo: 'ESTADOS CUENTAS DE CLIENTES.xlsx'"
          icon={Database}
          file={clientsFile}
          onFileSelect={setClientsFile}
          onProcess={handleProcess}
          loading={loading}
          color="blue"
          placeholderFile="ESTADOS CUENTAS DE CLIENTES.xlsx"
        />
      </div>

      {/* HISTORY SECTION */}
      <div className="border border-gray-200 rounded-xl bg-white p-6 shadow-sm min-h-[200px]">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Historial de Cargas</h3>
        <p className="text-sm text-gray-500 mb-6">Registro de archivos procesados recientemente</p>

        {history && history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4 font-semibold">Fecha</th>
                  <th className="py-3 px-4 font-semibold">Archivos</th>
                  <th className="py-3 px-4 font-semibold text-center">Registros</th>
                  <th className="py-3 px-4 font-semibold text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((log, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(log.date).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-500" />
                        {log.files}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600 font-mono">
                      {log.rows}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100 uppercase tracking-wide">
                        {log.status === 'success' ? 'Exitoso' : 'Error'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400 h-40 bg-gray-50/50 rounded-lg border-2 border-dashed border-gray-100">
            <Clock size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">No hay archivos cargados aún</p>
          </div>
        )}
      </div>
    </div>
  );
};

const UploadCard = ({ title, subtitle, icon: Icon, file, onFileSelect, onProcess, loading, color, placeholderFile }) => {
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) onFileSelect(e.dataTransfer.files[0]);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col h-full hover:shadow-md transition-shadow duration-300">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Icon size={24} className="text-gray-700 mt-1" />
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`flex-1 border-2 border-dashed rounded-lg mb-6 flex flex-col transition-colors relative ${file
          ? 'border-indigo-200 bg-indigo-50/10'
          : 'border-gray-200 hover:border-gray-300 bg-gray-50/30'
          }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{ minHeight: '200px' }}
      >
        {file ? (
          <div className="flex flex-col items-center justify-center h-full w-full p-8 animate-fade-in text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
              <FileText size={32} />
            </div>
            <p className="text-sm font-bold text-gray-800 break-all mb-2 px-4">{file.name}</p>
            <button
              onClick={() => onFileSelect(null)}
              className="text-xs text-gray-500 hover:text-red-500 underline transition-colors z-10 relative cursor-pointer"
            >
              Cambiar archivo
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-full w-full cursor-pointer p-8">
            <div className="mb-4 text-gray-300 mx-auto w-fit">
              <Upload size={40} strokeWidth={1.5} />
            </div>
            <p className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wide text-center">
              {placeholderFile || 'Seleccionar Archivo'}
            </p>
            <span className="hidden">Elegir archivo</span>
            <input
              type="file"
              className="hidden"
              accept=".xlsx, .xls"
              onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
            />
          </label>
        )}
      </div>

      {/* Action Button */}
      <button
        onClick={onProcess}
        disabled={!file || loading}
        className={`w-full py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${!file || loading
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
          }`}
      >
        {loading ? (
          <span className="flex items-center gap-2">Processing...</span>
        ) : (
          <>
            <Upload size={18} />
            Cargar y Procesar
          </>
        )}
      </button>
    </div>
  );
};


const EmptyState = ({ msg }) => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
    <div className="bg-gray-100 p-6 rounded-full mb-4">
      <LayoutDashboard size={48} className="opacity-50" />
    </div>
    <p className="uppercase tracking-widest text-xs font-bold text-gray-500">{msg}</p>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto mt-10 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle /> Algo salió mal
          </h2>
          <p className="mb-4">Se ha producido un error al renderizar el tablero.</p>
          <div className="bg-white p-4 rounded border border-red-100 font-mono text-sm overflow-auto mb-4">
            {this.state.error && this.state.error.toString()}
          </div>
          <p className="text-sm opacity-80 mb-6">
            Por favor, comparte este mensaje con soporte técnico.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('ocme_dashboard_data_v1');
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold"
          >
            Borrar Datos y Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [currentModule, setCurrentModule] = useState('dashboard');
  const [appData, setAppData] = useState(null);

  // Load from storage on mount
  useEffect(() => {
    try {
      const stored = loadFromStorage();
      if (stored) {
        setAppData(stored);
      }
    } catch (err) {
      console.error("Storage load error", err);
    }
  }, []);

  const clientList = useMemo(() => {
    if (!appData?.processed) return [];
    const qClients = appData.processed.quotes?.map(q => q.client) || [];
    const cClients = appData.processed.clients?.map(c => c.client) || [];
    return [...new Set([...qClients, ...cClients])].sort();
  }, [appData]);

  const handleDataLoaded = (dataAndKpis, logEntry) => {
    const newHistory = [logEntry, ...(appData?.history || [])].slice(0, 50); // Keep last 50
    const newData = {
      ...dataAndKpis,
      history: newHistory
    };

    setAppData(newData);
    saveToStorage(newData); // PERSIST
    setCurrentModule('dashboard');
  };

  const renderModule = () => {
    switch (currentModule) {
      case 'dashboard': return <SalesDashboard initialKpis={appData?.kpis} processedData={appData?.processed} />;
      case 'clients': return <ClientStatus data={appData?.processed?.clients} clientList={clientList} />;
      case 'upload': return <UploadManager onDataLoaded={handleDataLoaded} history={appData?.history || []} />;
      default: return <SalesDashboard kpis={appData?.kpis} />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout currentModule={currentModule} onModuleChange={setCurrentModule}>
        {renderModule()}
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
