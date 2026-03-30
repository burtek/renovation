/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';


const config = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}'
    ],
    darkMode: 'media',
    theme: { extend: {} },
    plugins: [typography]
};

export default config;
