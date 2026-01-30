import React from 'react';
import { LayoutDashboard, Users, UploadCloud, PieChart, Mail } from 'lucide-react';

const Sidebar = ({ currentModule, onModuleChange }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Ventas & Cotizaciones', icon: LayoutDashboard },
        { id: 'clients', label: 'Estado de Clientes', icon: Users },
        { id: 'collections', label: 'Gestión de Cobranzas', icon: Mail },
        { id: 'upload', label: 'Gestor de Subida', icon: UploadCloud },
    ];

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col p-6 z-10">
            {/* BRAND HEADER */}
            {/* BRAND HEADER */}
            <div className="flex items-center justify-center mb-10 px-2 mt-6">
                <img
                    src="/ocme_logo.png"
                    alt="OCME Dashboard"
                    className="h-16 w-auto object-contain"
                />
            </div>

            {/* NAVIGATION */}
            <nav className="flex flex-col gap-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentModule === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onModuleChange(item.id)}
                            className={`
                                w-full text-left whitespace-nowrap flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                }
                            `}
                        >
                            <Icon
                                size={20}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={isActive ? 'text-blue-600' : 'text-gray-400'}
                            />
                            {item.label}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
