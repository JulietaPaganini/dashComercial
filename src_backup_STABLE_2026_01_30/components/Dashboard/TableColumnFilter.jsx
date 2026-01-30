
import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Filter, Search, Check, X } from 'lucide-react';

const TableColumnFilter = ({ options, selectedValues = [], onFilterChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Local state for deferred application
    const [tempSelected, setTempSelected] = useState(selectedValues);

    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Sync temp state when opening
    useEffect(() => {
        if (isOpen) {
            setTempSelected(selectedValues);
            setSearchTerm('');
        }
    }, [isOpen, selectedValues]);

    // Toggle Dropdown & Calculate Position
    const handleToggle = () => {
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Basic Check for Screen Edge (Right side)
            let left = rect.left;
            if (left + 280 > window.innerWidth) {
                left = window.innerWidth - 290;
            }

            setPosition({
                top: rect.bottom + 5,
                left: left
            });
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    // Close on click outside (Handling Portal)
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if click is inside Button OR inside Dropdown (via ref)
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        // Also close on scroll to avoid detached floating elements
        const handleScroll = (event) => {
            // Ignore scroll events originating from inside the dropdown (the list)
            if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
                return;
            }
            if (isOpen) setIsOpen(false);
        };
        window.addEventListener('scroll', handleScroll, true); // Capture phase for all scrollables

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    // Filter Options based on search
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(opt =>
            String(opt).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    // Handlers (Modify LOCAL state)
    const toggleOption = (val) => {
        let newSelected;
        // Logic: Empty means ALL. If clicking, switch to specific list.
        // Use tempSelected as source
        const currentEffective = (!tempSelected || tempSelected.length === 0) ? options : tempSelected;

        if (currentEffective.includes(val)) {
            newSelected = currentEffective.filter(v => v !== val);
        } else {
            newSelected = [...currentEffective, val];
        }

        // If newSelected matches all options, reset to Null (All)
        if (newSelected.length === options.length) {
            setTempSelected(null);
        } else {
            setTempSelected(newSelected);
        }
    };

    const handleSelectAllToggle = () => {
        // If All currently selected (null/empty) -> Deselect All (matches logic of unchecking "All")
        // If Partial/None selected -> Select All (null)

        const isAll = !tempSelected || tempSelected.length === 0;

        if (isAll) {
            setTempSelected(['__NONE__']); // Select None
        } else {
            setTempSelected(null); // Select All
        }
    };

    const applyFilter = () => {
        onFilterChange(tempSelected);
        setIsOpen(false);
    };

    // Render Helpers
    // NOTE: We check selectedValues for the BUTTON ICON state, but tempSelected for DROPDOWN state.
    const isGlobalAllSelected = !selectedValues || selectedValues.length === 0;

    // For Dropdown Checkboxes
    const isTempAll = !tempSelected || tempSelected.length === 0;
    const isTempNone = tempSelected && tempSelected.length === 1 && tempSelected[0] === '__NONE__';
    const effectiveTemp = isTempAll ? options : (isTempNone ? [] : tempSelected);

    return (
        <div className="relative inline-block" ref={containerRef}>
            <button
                onClick={handleToggle}
                className={`p-1 rounded hover:bg-gray-100 transition-colors ${!isGlobalAllSelected ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                title="Filtrar"
            >
                <Filter size={14} strokeWidth={!isGlobalAllSelected ? 2.5 : 2} />
            </button>

            {isOpen && ReactDOM.createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed w-72 bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: position.top, left: position.left }}
                >
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
                                checked={effectiveTemp.length === options.length}
                                onChange={handleSelectAllToggle}
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
                                        checked={effectiveTemp.includes(opt)}
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

                    {/* Footer / Actions */}
                    <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg flex justify-between items-center">
                        <button
                            onClick={() => setTempSelected(null)} // Local Clear
                            className="text-xs text-gray-500 hover:text-red-500 font-medium hover:underline"
                        >
                            Limpiar
                        </button>
                        <button
                            onClick={applyFilter}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded shadow-sm transition-colors"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TableColumnFilter;
