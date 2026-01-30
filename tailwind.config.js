/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Mapping our custom "Professional" palette to Tailwind
                gray: {
                    50: '#F9FAFB',
                    100: '#F3F4F6',
                    200: '#E5E7EB', // Border light
                    300: '#D1D5DB',
                    400: '#9CA3AF', // Text dim
                    500: '#6B7280', // Text secondary
                    600: '#4B5563',
                    700: '#374151',
                    800: '#1F2937',
                    900: '#111827', // Text main
                },
                blue: {
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    200: '#BFDBFE',
                    500: '#3B82F6',
                    600: '#2563EB', // Primary
                    700: '#1D4ED8',
                },
                sidebar: '#1C2434',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            }
        },
    },
    plugins: [],
}
