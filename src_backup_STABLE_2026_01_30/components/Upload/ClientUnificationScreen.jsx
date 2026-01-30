import React, { useState } from 'react';
import { UserCheck, Check, ArrowRight, AlertTriangle, GitMerge, Trash2, History, X } from 'lucide-react';

const ClientUnificationScreen = ({ duplicates, activeRules = {}, onConfirm, onCancel, onDeleteRule }) => {
    // State: { [groupId]: "Selected Name" }
    const [selections, setSelections] = useState(() => {
        const initial = {};
        duplicates.forEach(g => {
            initial[g.id] = g.selected;
        });
        return initial;
    });

    const handleSelect = (groupId, name) => {
        setSelections(prev => ({ ...prev, [groupId]: name }));
    };

    const [enabledGroups, setEnabledGroups] = useState(() => {
        const initial = {};
        duplicates.forEach(g => {
            initial[g.id] = false; // Default: Deselected (User opts-in)
        });
        return initial;
    });

    const toggleGroup = (groupId) => {
        setEnabledGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    // State: { [groupId]: { [name]: true } } -> true means EXCLUDED
    const [exclusions, setExclusions] = useState({});

    const toggleExclusion = (groupId, name, e) => {
        e.stopPropagation(); // Prevent selecting as target
        setExclusions(prev => {
            const groupExclusions = prev[groupId] || {};
            return {
                ...prev,
                [groupId]: {
                    ...groupExclusions,
                    [name]: !groupExclusions[name]
                }
            };
        });
    };

    const handleConfirm = () => {
        // Transform selections into a detailed Map: Incorrect -> Correct
        const mergeMap = {};

        duplicates.forEach(group => {
            if (!enabledGroups[group.id]) return; // Skip if disabled

            const correctName = selections[group.id];

            // Get exclusions for this group
            const groupExclusions = exclusions[group.id] || {};

            group.candidates.forEach(candidate => {
                // Skip if it's the target name OR if it's strictly excluded
                if (candidate !== correctName && !groupExclusions[candidate]) {
                    mergeMap[candidate] = correctName;
                }
            });
        });

        onConfirm(mergeMap);
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto pb-12">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-indigo-50/50 flex items-start gap-4">
                    <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                        <GitMerge size={24} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">Unificación de Clientes</h2>
                        <p className="text-gray-500 mt-1">
                            Hemos detectado nombres de clientes que parecen ser el mismo.
                            Por favor, selecciona cuál es e nombre correcto para unificarlos.
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-full transition-colors"
                        title="Cerrar sin guardar"
                    >
                        <X size={24} />
                    </button>
                </div>



                {/* Content */}
                <div className="flex flex-col md:flex-row h-[70vh]">

                    {/* LEFT: Active Rules History */}
                    {Object.keys(activeRules).length > 0 && (
                        <div className="w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
                            <div className="p-4 border-b border-gray-200 bg-gray-100/50">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <History size={16} /> Reglas Activas ({Object.keys(activeRules).length})
                                </h3>
                            </div>
                            <div className="overflow-y-auto p-4 space-y-3 flex-1">
                                {Object.entries(activeRules).map(([original, unified]) => (
                                    <div key={original} className="bg-white p-3 rounded border border-gray-200 shadow-sm flex justify-between items-center group">
                                        <div className="text-xs">
                                            <div className="text-gray-500 line-through">{original}</div>
                                            <div className="font-bold text-gray-800 flex items-center gap-1">
                                                <ArrowRight size={10} /> {unified}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onDeleteRule(original)}
                                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                            title="Eliminar regla (Restaurar original)"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* RIGHT: New Detection */}
                    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/30">
                        {duplicates.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                                <Check size={48} className="mb-4 text-green-500 bg-green-50 p-2 rounded-full" />
                                <p className="font-medium text-center">No se encontraron nuevas similitudes.</p>
                                <p className="text-sm mt-2">Tus reglas activas se están aplicando correctamente.</p>
                            </div>
                        ) : (
                            <div className="p-6 overflow-y-auto space-y-4">
                                {duplicates.map((group) => (
                                    <div key={group.id} className={`bg-white p-4 rounded-lg border shadow-sm flex flex-col md:flex-row md:items-center gap-4 transition-colors ${enabledGroups[group.id] ? 'border-indigo-200' : 'border-gray-200 opacity-60'}`}>

                                        {/* Toggle Checkbox */}
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={enabledGroups[group.id]}
                                                onChange={() => toggleGroup(group.id)}
                                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                            />
                                        </div>

                                        {/* Visual Connector */}
                                        <div className="flex-1">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                                                Variantes Detectadas
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {group.candidates.map((name) => {
                                                    const isSelected = selections[group.id] === name;
                                                    const isExcluded = exclusions[group.id]?.[name];

                                                    return (
                                                        <div
                                                            key={name}
                                                            className={`px-3 py-1.5 rounded-md border text-sm flex items-center gap-2 cursor-pointer transition-all 
                                                            ${isSelected
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-100'
                                                                    : isExcluded
                                                                        ? 'bg-gray-100 text-gray-400 border-gray-200 decoration-slice line-through'
                                                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                                                }`}
                                                            onClick={() => !isExcluded && handleSelect(group.id, name)}
                                                        >
                                                            {isSelected && <Check size={14} />}

                                                            <span className={isExcluded ? 'opacity-50' : ''}>{name}</span>

                                                            {/* Exclude Action */}
                                                            {!isSelected && (
                                                                <button
                                                                    onClick={(e) => toggleExclusion(group.id, name, e)}
                                                                    className={`ml-1 p-0.5 rounded-full hover:bg-gray-200 ${isExcluded ? 'text-gray-500 hover:text-green-600' : 'text-gray-300 hover:text-red-500'}`}
                                                                    title={isExcluded ? "Incluir de nuevo" : "Excluir de esta unificación"}
                                                                >
                                                                    {isExcluded ? <Check size={12} /> : <X size={12} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="hidden md:block text-gray-300">
                                            <ArrowRight size={24} />
                                        </div>

                                        {/* Result Preview */}
                                        <div className="w-full md:w-1/3 bg-gray-50 p-3 rounded border border-gray-100">
                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Nombre Final</span>
                                            <div className="font-bold text-gray-800 text-lg break-words">
                                                {selections[group.id]}
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>



                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        Omitir y Mantener Originales
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                    >
                        <UserCheck size={18} />
                        Confirmar Unificación
                    </button>
                </div>

            </div >
        </div >
    );
};

export default ClientUnificationScreen;
