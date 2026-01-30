import React, { useState, useEffect, useMemo } from 'react';
import { Mail, Phone, Calendar, Clock, AlertCircle, CheckCircle, Search, Edit2, Send, Save, X, ChevronDown, ChevronUp, ArrowUpDown, DollarSign, ListFilter } from 'lucide-react';
import { ContactService } from '../../../services/ContactService';

const CollectionsDashboard = ({ data }) => {
    // State
    const [contacts, setContacts] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingClient, setEditingClient] = useState(null); // Which client is being edited
    const [expandedClients, setExpandedClients] = useState(new Set()); // Which cards are open

    // Sort State: 'debt-desc' | 'days-desc' | 'alpha-asc'
    const [sortMode, setSortMode] = useState('debt-desc');

    // Derived Data: Process debts and merge with contacts - CLIENT CENTRIC
    const clientsData = useMemo(() => {
        if (!data?.clients) return [];

        const now = new Date();
        const clientMap = {};
        const auditMap = data.audit || {}; // Get audit data

        // 1. Group Invoices by Client
        data.clients.forEach(invoice => {
            const clientName = invoice.client || 'Sin Nombre';
            if (!clientMap[clientName]) {
                clientMap[clientName] = {
                    client: clientName,
                    invoices: [],
                    totalDebt: 0,
                    maxDelay: 0,
                    avgPaymentDelay: 0, // NEW: Historical Average
                    status: 'ok', // ok, warning, critical
                    contact: contacts[clientName] || {}
                };
            }

            // Calculate Invoice specifics
            // DataProcessor sends 'date' as Date object. Safely handle it.
            const invoiceDate = invoice.date ? new Date(invoice.date) : null;

            // Failsafe Filter: Exclude if no number or invalid date (keeps Summary rows out)
            if (!invoice.number || !invoiceDate) return;

            const diffSinceInvoice = Math.floor((now - invoiceDate) / (1000 * 60 * 60 * 24));

            // Per Invoice Status
            let invoiceStatus = 'ok';
            if (diffSinceInvoice >= 25 && diffSinceInvoice < 37) invoiceStatus = 'warning';
            if (diffSinceInvoice >= 37) invoiceStatus = 'critical';

            // Amount field is 'amount' in DataProcessor, NOT 'debt'
            // SAFEGUARD: If invoice appears settled (keywords or payment date), force amount to 0 for Dashboard calculations
            // This prevents "Ghost Debt" from appearing in the total.
            const isSettled = (invoice.paymentDate) ||
                (invoice.obs && (
                    invoice.obs.toString().toLowerCase().includes('saldada') ||
                    invoice.obs.toString().toLowerCase().includes('pagad') ||
                    invoice.obs.toString().toLowerCase().includes('cancel')
                ));

            const amount = isSettled ? 0 : (invoice.amount || 0);

            clientMap[clientName].invoices.push({
                ...invoice,
                daysSinceInvoice: diffSinceInvoice,
                status: invoiceStatus,
                amount: amount // Normalize
            });

            // Update Aggregates
            clientMap[clientName].totalDebt += amount;
            clientMap[clientName].maxDelay = Math.max(clientMap[clientName].maxDelay, diffSinceInvoice);
            // Capture Average Delay (it's the same on all rows for this client)
            if (invoice.avgPaymentDelay) clientMap[clientName].avgPaymentDelay = invoice.avgPaymentDelay;

            // Upgrade Client Status if this invoice is worse
            if (invoiceStatus === 'critical') clientMap[clientName].status = 'critical';
            else if (invoiceStatus === 'warning' && clientMap[clientName].status !== 'critical') clientMap[clientName].status = 'warning';
        });

        // 2. Convert to Array and AUDIT
        let results = Object.values(clientMap).map(c => {
            // LOGIC FIX: If total debt is 0 or negative (credit balance), they are effectively up to date.
            // This prevents clients with old invoices fully offset by credit notes from appearing as "Critical" delays.
            if (c.totalDebt <= 0.1) { // 0.1 tolerance for floating point
                c.maxDelay = 0;
                c.status = 'ok';
            }

            // AUDIT LOGIC
            const auditValue = auditMap[c.client]; // Renamed from auditVal to auditValue for consistency with instruction
            let auditStatus = 'NONE'; // Default status
            let auditDiff = 0;

            // Explicitly check for undefined/null to allow 0 as a valid value
            if (auditValue !== undefined && auditValue !== null) {
                const dashboardValue = c.totalDebt || 0; // Use c.totalDebt for comparison
                auditDiff = dashboardValue - auditValue;

                // Allow small floating point diff (< 0.1 pesos)
                if (Math.abs(auditDiff) < 0.1) { // 0.1 tolerance
                    auditStatus = 'MATCH'; // Changed from 'ok' to 'MATCH' to align with existing logic
                } else {
                    auditStatus = 'MISMATCH'; // Changed from 'error' to 'MISMATCH' to align with existing logic
                }
            } else {
                auditStatus = 'PENDING'; // Changed from 'pending' to 'PENDING' for consistency
            }

            return {
                ...c,
                auditStatus,
                auditExpected: auditValue, // Keep auditExpected for context
                auditDiff,
                // Sort invoices internally by delay desc
                invoices: c.invoices.sort((a, b) => b.daysSinceInvoice - a.daysSinceInvoice)
            };
        });

        // 3. Apply Global Sorting
        if (sortMode === 'debt-desc') {
            results.sort((a, b) => b.totalDebt - a.totalDebt);
        } else if (sortMode === 'debt-asc') {
            results.sort((a, b) => a.totalDebt - b.totalDebt);
        } else if (sortMode === 'days-desc') {
            results.sort((a, b) => b.maxDelay - a.maxDelay);
        } else if (sortMode === 'days-asc') {
            results.sort((a, b) => a.maxDelay - b.maxDelay);
        } else if (sortMode === 'alpha-asc') {
            results.sort((a, b) => a.client.localeCompare(b.client));
        }

        return results;

    }, [data, contacts, sortMode]);

    // Initial Load
    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setLoading(true);
        const map = await ContactService.getAllContacts();
        setContacts(map);
        setLoading(false);
    };

    const handleSaveContact = async (clientName, formData) => {
        try {
            await ContactService.saveContact(clientName, formData);
            await loadContacts(); // Refresh
            setEditingClient(null);
        } catch (error) {
            alert('Error al guardar contacto: ' + error.message);
        }
    };

    // Modal State
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailCandidates, setEmailCandidates] = useState([]);
    const [selectedForEmail, setSelectedForEmail] = useState(new Set());

    // 1. Prepare Batch: Open Modal
    const handleProcessEmails = () => {
        const candidates = filteredList.filter(c =>
            c.status !== 'ok' &&
            c.contact && c.contact.contact_email &&
            c.totalDebt > 0.1
        );

        if (candidates.length === 0) {
            alert('No hay clientes con deuda y email configurado para enviar.');
            return;
        }

        // Initialize all as selected by default
        const initialSet = new Set(candidates.map(c => c.client));
        setEmailCandidates(candidates);
        setSelectedForEmail(initialSet);
        setEmailModalOpen(true);
    };

    // 2. toggle individual checkbox
    const toggleEmailSelection = (clientName) => {
        const newSet = new Set(selectedForEmail);
        if (newSet.has(clientName)) newSet.delete(clientName);
        else newSet.add(clientName);
        setSelectedForEmail(newSet);
    };

    // 3. toggle all
    const toggleAllEmails = () => {
        if (selectedForEmail.size === emailCandidates.length) {
            setSelectedForEmail(new Set()); // Deselect all
        } else {
            setSelectedForEmail(new Set(emailCandidates.map(c => c.client))); // Select all
        }
    };

    const [isSending, setIsSending] = useState(false);

    const executeBatchSend = async () => {
        // Final filter based on selection
        const finalBatch = emailCandidates.filter(c => selectedForEmail.has(c.client));

        if (finalBatch.length === 0) {
            alert("No has seleccionado ningún cliente.");
            return;
        }

        if (!confirm(`¿Estás seguro de enviar correos a ${finalBatch.length} clientes?`)) return;

        setIsSending(true);
        let sentCount = 0;
        let errorCount = 0;
        let lastError = '';

        try {
            for (const client of finalBatch) {
                try {
                    const response = await ContactService.sendCollectionEmail(
                        client.contact.contact_email,
                        client.client,
                        {
                            totalFormatted: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(client.totalDebt),
                            invoiceCount: client.invoices.length,
                            // FIX: Only send Active Debt invoices (Amount > 0) in the email body
                            invoices: client.invoices
                                .filter(inv => inv.amount > 0.1)
                                .map(inv => ({
                                    ...inv,
                                    days: inv.daysOverdue
                                }))
                        }
                    );

                    // Diagnostic check
                    if (response && response.debug_invoices_count === 0) {
                        console.warn(`Warning: Backend received 0 invoices for ${client.client}`);
                    }

                    sentCount++;
                } catch (err) {
                    console.error(`Error sending to ${client.client}:`, err);
                    lastError = err.message || JSON.stringify(err);
                    errorCount++;
                }
            }
        } catch (criticalError) {
            console.error("Critical batch error:", criticalError);
            lastError = "Error crítico: " + criticalError.message;
        } finally {
            setIsSending(false);
            setEmailModalOpen(false);
            let msg = `Proceso finalizado.\n✅ Enviados: ${sentCount}\n❌ Errores: ${errorCount}`;
            if (lastError) msg += `\n\nÚltimo error: ${lastError}`;
            alert(msg);
        }
    };



    const toggleExpand = (clientName) => {
        const newSet = new Set(expandedClients);
        if (newSet.has(clientName)) newSet.delete(clientName);
        else newSet.add(clientName);
        setExpandedClients(newSet);
    };

    // Prepare Filtered List
    const filteredList = clientsData.filter(item =>
        item.client.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const readyToEmailCount = filteredList.filter(c => c.status !== 'ok' && c.contact.contact_email).length;

    // Helper to toggle sorts
    const toggleSort = (field) => {
        if (field === 'debt') {
            setSortMode(prev => prev === 'debt-desc' ? 'debt-asc' : 'debt-desc');
        } else if (field === 'days') {
            setSortMode(prev => prev === 'days-desc' ? 'days-asc' : 'days-desc');
        } else if (field === 'alpha') {
            setSortMode('alpha-asc');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header / Summary */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Gestión de Cobranzas</h2>
                    <p className="text-gray-500 mt-1">
                        Semaforización inteligente por cliente.
                        <span className="ml-2 font-medium text-indigo-600">
                            {filteredList.filter(c => c.totalDebt > 100).length} clientes con deuda activa.
                        </span>
                    </p>
                </div>

                {/* Robot Action Button */}
                <button
                    disabled={readyToEmailCount === 0 || isSending}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold shadow-lg transition-all transform hover:-translate-y-0.5
                        ${readyToEmailCount > 0 && !isSending
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-indigo-500/30'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    onClick={handleProcessEmails}
                >
                    {isSending ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                        <Send size={20} />
                    )}
                    <div className="text-left">
                        <div className="text-xs font-normal opacity-90">Robot de Envíos</div>
                        <div className="text-sm leading-none">
                            {isSending ? 'Enviando...' : `Procesar (${readyToEmailCount})`}
                        </div>
                    </div>
                </button>
            </div>

            {/* Controls Bar: Search & Sort */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar cliente por nombre..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all font-medium whitespace-nowrap flex items-center gap-2"
                        >
                            <X size={18} />
                            Limpiar
                        </button>
                    )}
                </div>

                {/* Sorting Buttons Group */}
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                    <span className="text-xs font-bold text-gray-400 uppercase ml-2 mr-2">Ordenar por:</span>

                    <button
                        onClick={() => toggleSort('debt')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                            ${sortMode.includes('debt') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <DollarSign size={16} />
                        Monto
                        {sortMode === 'debt-desc' && <ChevronDown size={14} />}
                        {sortMode === 'debt-asc' && <ChevronUp size={14} />}
                    </button>

                    <button
                        onClick={() => toggleSort('days')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                            ${sortMode.includes('days') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Clock size={16} />
                        Días Atraso
                        {sortMode === 'days-desc' && <ChevronDown size={14} />}
                        {sortMode === 'days-asc' && <ChevronUp size={14} />}
                    </button>

                    <button
                        onClick={() => toggleSort('alpha')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                            ${sortMode.includes('alpha') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <ListFilter size={16} />
                        A-Z
                    </button>
                </div>
            </div>

            {/* Client Cards Grid - Stacked Layout for clarity */}
            <div className="flex flex-col gap-4">
                {filteredList.map((client, idx) => {
                    const isExpanded = expandedClients.has(client.client);
                    const statusColor = client.status === 'critical' ? 'red' : client.status === 'warning' ? 'orange' : 'green';

                    return (
                        <div key={idx} className={`bg-white rounded-xl shadow-sm border transition-all ${client.status === 'critical' ? 'border-red-100 ring-1 ring-red-50' : 'border-gray-200'}`}>

                            {/* Main Card Row */}
                            <div className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                {/* 1. Client Info & Status Icon */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`p-3 rounded-full flex-shrink-0 ${client.status === 'critical' ? 'bg-red-100 text-red-600' : client.status === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                        {client.status === 'critical' ? <AlertCircle size={24} /> : client.status === 'warning' ? <Clock size={24} /> : <CheckCircle size={24} />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-lg text-gray-900 truncate">{client.client}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <span>{client.invoices.length} facturas pendientes</span>
                                            <span>•</span>
                                            <span className={`font-medium ${client.avgPaymentDelay > 45 ? 'text-red-600' : 'text-gray-600'}`}>
                                                Promedio Pago: {client.avgPaymentDelay} días
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Debt Summary & Audit */}
                                <div className="text-right px-4 border-l border-gray-100 min-w-[180px]">
                                    <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Deuda Total</span>

                                    <div className="flex items-center justify-end gap-2">
                                        <span className="block text-xl font-bold text-gray-900">
                                            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(client.totalDebt)}
                                        </span>

                                        {/* AUDIT BADGE */}
                                        {client.auditStatus === 'MATCH' && (
                                            <div title="Coincide con Excel (TOTAL DEUDA)" className="text-gray-400 bg-gray-50 p-1 rounded-full">
                                                <CheckCircle size={16} />
                                            </div>
                                        )}
                                        {client.auditStatus === 'MISMATCH' && (
                                            <div title={`Difiere de Excel. Esperado: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(client.auditExpected)}`} className="text-red-500 bg-red-50 p-1 rounded-full cursor-help relative group">
                                                <AlertCircle size={16} />
                                                {/* Tooltip on hover */}
                                                <div className="absolute hidden group-hover:block right-0 mt-2 w-64 bg-gray-800 text-white text-xs p-3 rounded shadow-lg z-50">
                                                    <div className="font-bold border-b border-gray-600 pb-1 mb-1">Auditoría:</div>
                                                    <div className="flex justify-between">
                                                        <span>Excel:</span>
                                                        <span>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(client.auditExpected)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Sistema:</span>
                                                        <span>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(client.totalDebt)}</span>
                                                    </div>
                                                    <div className={`flex justify-between font-bold mt-1 pt-1 border-t border-gray-600 ${client.auditDiff > 0 ? 'text-red-300' : 'text-green-300'}`}>
                                                        <span>Dif:</span>
                                                        <span>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(client.auditDiff)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {/* MISSING AUDIT STATE (Debug Check) */}
                                        {!client.auditStatus && (
                                            <div title="No se encontró fila de Totales en Excel" className="text-gray-300 bg-gray-50 p-1 rounded-full cursor-help">
                                                <Search size={16} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 3. Contact Actions */}
                                <div className="flex-1 border-l border-gray-100 px-4">
                                    {editingClient === client.client ? (
                                        <ContactForm
                                            initialData={client.contact}
                                            onSave={(data) => handleSaveContact(client.client, data)}
                                            onCancel={() => setEditingClient(null)}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-gray-50 p-2 rounded-lg text-gray-400">
                                                    <Mail size={18} />
                                                </div>
                                                <div>
                                                    {client.contact.contact_email ? (
                                                        <>
                                                            <p className="font-bold text-sm text-gray-800">{client.contact.contact_name || 'Sin Nombre'}</p>
                                                            <p className="text-xs text-gray-500">{client.contact.contact_email}</p>
                                                        </>
                                                    ) : (
                                                        <span className="text-sm text-gray-400 italic">Sin contacto asignado</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setEditingClient(client.client)}
                                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-gray-100 rounded-lg text-indigo-600 transition-all"
                                                title="Editar Contacto"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* 4. Expand Toggle */}
                                <button
                                    onClick={() => toggleExpand(client.client)}
                                    className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
                                >
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>

                            {/* Expanded Invoice List */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-fade-in">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold">
                                            <tr>
                                                <th className="py-2 text-left">Factura</th>
                                                <th className="py-2 text-left w-24">Tipo</th>
                                                <th className="py-2 text-left">Fecha Emisión</th>
                                                <th className="py-2 text-left">Fecha Cobro</th>
                                                <th className="py-2 text-left">Días p/ Pago</th>
                                                <th className="py-2 text-left">Detalle</th>
                                                <th className="py-2 text-right pr-2">Importe</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm">
                                            {client.invoices.map((inv, idx) => (
                                                <tr key={idx} className={`${inv.amount > 0.1 ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-gray-50'} transition-colors`}>
                                                    <td className="py-2 text-gray-900 font-medium">
                                                        {inv.number === 'SIN-REF' ? '' : (inv.branch ? `${inv.branch}-` : '') + inv.number}
                                                    </td>
                                                    <td className="py-2 text-xs text-gray-500 font-mono">
                                                        {inv.type || '-'}
                                                    </td>
                                                    <td className="py-2 text-gray-600">
                                                        {inv.date ? new Date(inv.date).toLocaleDateString('es-AR') : '-'}
                                                    </td>
                                                    <td className="py-2 text-gray-600 font-medium">
                                                        {inv.paymentDate
                                                            ? new Date(inv.paymentDate).toLocaleDateString('es-AR')
                                                            : (inv.obs && (inv.obs.toLowerCase().includes('saldada') || inv.obs.toLowerCase().includes('pagad')))
                                                                ? <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">SALDADA</span>
                                                                : '-'
                                                        }
                                                    </td>
                                                    <td className="py-2">
                                                        {(inv.isOffset || inv.type === 'NC') ? (
                                                            <span className="text-gray-400 font-bold" title="Compensado / Sin plazo">-</span>
                                                        ) : (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                                                    ${inv.amount <= 0.1
                                                                    ? (inv.paymentDelayDays > 45 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600')
                                                                    : (inv.paymentDelayDays > 45 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')}
                                                                `}>
                                                                {inv.amount <= 0.1 ? `Pagada (${inv.paymentDelayDays || 0}d)` : `${inv.paymentDelayDays || inv.daysSinceInvoice} días`}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 text-xs text-gray-500 truncate max-w-[200px]" title={inv.obs}>
                                                        {inv.obs || '-'}
                                                    </td>
                                                    <td className="py-2 text-right pr-2 font-medium text-gray-900">
                                                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(inv.amount > 0.1 ? inv.amount : (inv.originalAmount || 0))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="border-t border-gray-200">
                                            <tr>
                                                <td colSpan="6" className="pt-3 text-right font-bold text-gray-500">TOTAL A RECLAMAR:</td>
                                                <td className="pt-3 text-right font-bold text-lg text-gray-900 pr-2">
                                                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(client.totalDebt)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* Action Footer within Card */}
                                    <div className="mt-4 flex justify-end">
                                        {client.status !== 'ok' && client.contact.contact_email && (
                                            <button className="text-sm bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-2">
                                                <Mail size={14} />
                                                Enviar reclamo individual
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}


                {filteredList.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                        <Search size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No se encontraron clientes con ese nombre.</p>
                    </div>
                )}
            </div>

            {/* EMAIL CONFIRMATION MODAL */}
            {emailModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Confirmar Envíos</h3>
                                <p className="text-sm text-gray-500">Selecciona los clientes a quienes deseas notificar</p>
                            </div>
                            <button onClick={() => setEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-600">
                                    {selectedForEmail.size} seleccionados de {emailCandidates.length}
                                </span>
                                <button
                                    onClick={toggleAllEmails}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                    {selectedForEmail.size === emailCandidates.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                            {emailCandidates.map((client) => {
                                const isSelected = selectedForEmail.has(client.client);
                                return (
                                    <div
                                        key={client.client}
                                        onClick={() => toggleEmailSelection(client.client)}
                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                                                }`}>
                                                {isSelected && <CheckCircle size={14} className="text-white" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800">{client.client}</div>
                                                <div className="text-xs text-gray-500">{client.contact.contact_email}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-gray-700">
                                                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(client.totalDebt)}
                                            </div>
                                            <div className="text-xs text-red-600 font-medium">
                                                {client.invoices.filter(i => i.amount > 0.1).length} facturas
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                            <button
                                onClick={() => setEmailModalOpen(false)}
                                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeBatchSend}
                                disabled={isSending || selectedForEmail.size === 0}
                                className={`px-6 py-2.5 rounded-lg text-white font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2 ${isSending || selectedForEmail.size === 0
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/30'
                                    }`}
                            >
                                {isSending ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Confirmar Envíos ({selectedForEmail.size})
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};



// Sub-component for inline editing
const ContactForm = ({ initialData, onSave, onCancel }) => {
    // Handle both potential property formats (processed vs raw DB)
    const [formData, setFormData] = useState({
        name: initialData.contactName || initialData.contact_name || '',
        email: initialData.contactEmail || initialData.contact_email || '',
        notes: initialData.notes || ''
    });

    return (
        <div className="space-y-2 animate-fade-in bg-white border border-indigo-100 p-3 rounded-lg shadow-sm">
            <input
                className="w-full text-sm p-2 border border-gray-200 rounded focus:ring-2 ring-indigo-500 outline-none"
                placeholder="Nombre de contacto"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                autoFocus
            />
            <input
                className="w-full text-sm p-2 border border-gray-200 rounded focus:ring-2 ring-indigo-500 outline-none"
                placeholder="Email corporativo (@empresa.com)"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
            <div className="flex justify-end gap-2 mt-2">
                <button
                    onClick={onCancel}
                    className="p-1 px-3 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded"
                >
                    Cancelar
                </button>
                <button
                    onClick={() => onSave(formData)}
                    className="p-1 px-3 text-xs font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-sm"
                >
                    Guardar
                </button>
            </div>
        </div>
    );
};

export default CollectionsDashboard;
