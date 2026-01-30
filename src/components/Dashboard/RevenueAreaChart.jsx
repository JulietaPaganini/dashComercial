
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const RevenueAreaChart = ({ data }) => {
    // Mock data generation if real data is too sparse for a nice curve
    // Ideally, 'data' should be an array of { date: 'Jan', value: 1000 }

    if (!data || data.length === 0) return <div className="text-center text-gray-500 py-10">No Data</div>;

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFB000" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#FFB000" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
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
                        contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                        itemStyle={{ color: '#FFB000' }}
                        formatter={(value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact' }).format(value)}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#FFB000"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
