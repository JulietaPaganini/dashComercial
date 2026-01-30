
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const QuotesTrendChart = ({ data }) => {
    if (!data || data.length === 0) return <div className="text-center text-gray-500 py-10">No Data</div>;

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666', fontSize: 10 }}
                        dy={10}
                        interval={0}
                        padding={{ left: 10, right: 10 }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="total"
                        name="Total Cotizado"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                    />
                    <Area
                        type="monotone"
                        dataKey="won"
                        name="Ganadas"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorWon)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
