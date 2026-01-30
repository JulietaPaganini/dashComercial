
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export const ConversionGauge = ({ value }) => {
    // Value is percentage 0-100
    const data = [
        { name: 'Won', value: value },
        { name: 'Lost', value: 100 - value },
    ];

    const COLORS = ['#00E5FF', '#222']; // Cyan vs Dark

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="70%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="70%"
                        outerRadius="90%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-[60%] left-0 w-full text-center">
                <div className="text-2xl font-bold text-white shadow-glow">{value.toFixed(1)}%</div>
                <div className="text-xs text-gray-500 font-medium">CONVERSIÓN</div>
            </div>
        </div>
    );
};
