
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const DebtBarChart = ({ data, onBarClick }) => {
    // Data expected: [ { name: 'Corriente', value: 100 }, { name: '30 Días', value: 200 }, ... ]

    if (!data) return null;

    const getBarColor = (name) => {
        if (name.includes('-30')) return '#00D26A'; // Green explicitly for -30
        if (name.includes('90')) return '#FF2E63'; // Red
        if (name.includes('60')) return '#FF2E63';
        if (name.includes('30')) return '#FFB000'; // Orange
        return '#00D26A'; // Default Green
    };

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={data} barSize={20}>
                    <XAxis type="number" hide />
                    <YAxis
                        dataKey="name"
                        type="category"
                        width={70}
                        tick={{ fill: '#888', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ color: '#374151', fontSize: '12px', fontWeight: 'bold' }}
                        formatter={(value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact' }).format(value)}
                    />
                    <Bar
                        dataKey="value"
                        radius={[0, 4, 4, 0]}
                        onClick={(data) => onBarClick && onBarClick(data)}
                        cursor="pointer"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry.name)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
