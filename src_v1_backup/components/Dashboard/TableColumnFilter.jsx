
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, Search, Check, X } from 'lucide-react';

const TableColumnFilter = ({ options, selectedValues = [], onFilterChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter Options based on search
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(opt =>
            String(opt).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    // Handlers
    const toggleOption = (val) => {
        let newSelected;
        if (selectedValues.includes(val)) {
            newSelected = selectedValues.filter(v => v !== val);
        } else {
            newSelected = [...selectedValues, val];
        }
        // If all selected or none selected (which means all effectively), logic might vary.
        // Usually, empty selectedValues means "All". 
        // But here, if user unchecks one, we need to know.
        // Let's assume: Empty Array = All selected (Initial State).
        // If user clicks one, we switch to Specific Selection.

        // Wait, "Select All" logic:
        // If currently empty (ALL), and user clicks one items, what happens?
        // Excel Logic: Initially all checked. Unchecking one makes it specific list.
        // So we should verify if `selectedValues` is empty -> treat as ALL options are selected.

        // Revised Logic:
        // Internal State might be needed if we want "Apply" button, but for instant update:
        // We need to distinguish "Active Filter" vs "No Filter".
        // Let's use `null` or `[]` for No Filter.
        // But if I have 10 options and I deselect 1, I need to store the other 9.

        // If `selectedValues` is empty/null, it means ALL.
        // If I click separate option when ALL are selected: it should become the ONLY selected one? 
        // OR deselecting it from the full list?
        // Excel Behavior: Everything is checked. Unchecking one removes it.
        // So if `selectedValues` is empty, we act as if it contains ALL options.

        const currentEffectiveSelection = (selectedValues.length === 0) ? options : selectedValues;

        if (currentEffectiveSelection.includes(val)) {
            newSelected = currentEffectiveSelection.filter(v => v !== val);
        } else {
            newSelected = [...currentEffectiveSelection, val];
        }

        // If newSelected has same length as options, reset to empty (All)
        if (newSelected.length === options.length) {
            onFilterChange(null);
        } else {
            onFilterChange(newSelected);
        }
    };

    const handleSelectAll = () => {
        // If currently filtering (some selected) -> Select All (Reset to null)
        // If currently ALL selected (null/empty) -> Deselect All (empty array that is NOT null? Or just empty array?)
        // If we send [], it matches nothing. If we send null, it matches everything.

        if (selectedValues.length === 0) {
            // Currently All -> Deselect All (Matches None)
            // But wait, we usually want to clear filter.
            // If I click (Select All) checkbox:
            // Toggle between All and None.
            // If I set to [], table shows nothing. 
            // If I set to options, table shows everything (aka null).

            // Let's simulate:
            // State: All Selected (null). Click -> All Deselected ([]).
            // State: Some Selected. Click -> All Selected (null).
            onFilterChange(['__NONE__']); // Special marker for "None"? Or just []
        } else {
            // Currently specific or None -> Select All
            onFilterChange(null);
        }
    };

    // Check if "Select All" is checked
    const isAllSelected = selectedValues.length === 0;
    const isNoneSelected = selectedValues.length === 1 && selectedValues[0] === '__NONE__';

    // Derived effective list for rendering checkboxes
    const effectiveSelected = isAllSelected ? options : (isNoneSelected ? [] : selectedValues);

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1 rounded hover:bg-gray-100 transition-colors ${!isAllSelected ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                title="Filtrar"
            >
                <Filter size={14} strokeWidth={!isAllSelected ? 2.5 : 2} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    {/* Header / Search */}
                    <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                className="w-full pl-8 pr-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-500 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto p-1">
                        {/* Select All Option */}
                        <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700 font-medium border-b border-dashed border-gray-100 mb-1">
                            <input
                                type="checkbox"
                                className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                checked={effectiveSelected.length === options.length}
                                onChange={() => {
                                    if (effectiveSelected.length === options.length) onFilterChange(['__NONE__']);
                                    else onFilterChange(null);
                                }}
                            />
                            <span className="truncate">(Seleccionar todo)</span>
                        </label>

                        {/* Individual Options */}
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <label key={opt} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 cursor-pointer rounded text-sm text-gray-600">
                                    <input
                                        type="checkbox"
                                        className="rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                        checked={effectiveSelected.includes(opt)}
                                        onChange={() => toggleOption(opt)}
                                    />
                                    <span className="truncate">{opt}</span>
                                </label>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-gray-400">
                                No se encontraron resultados
                            </div>
                        )}
                    </div>

                    {/* Footer / Actions (Optional but good for clearing) */}
                    {!isAllSelected && (
                        <div className="p-2 border-t border-gray-100 bg-gray-50 rounded-b-lg flex justify-end">
                            <button
                                onClick={() => onFilterChange(null)}
                                className="text-xs text-blue-600 font-bold hover:underline"
                            >
                                Borrar Filtro
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TableColumnFilter;
