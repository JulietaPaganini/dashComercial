
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PaymentStatusChart = ({ data }) => {
    // Data expected: [ { name: 'PAGADO', count: 10 }, { name: 'PENDIENTE', count: 5 }, ... ]

    if (!data || data.length === 0) return null;

    const getColor = (name) => {
        if (name === 'VENCIDO') return '#EF4444'; // Red-500
        if (name === 'PENDIENTE') return '#F59E0B'; // Amber-500
        if (name === 'PAGADO' || name === 'SALDADA') return '#10B981'; // Emerald-500
        return '#6B7280';
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                />
                <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

export default PaymentStatusChart;
