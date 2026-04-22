/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';


const config = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}'
    ],
    darkMode: 'media',
    theme: {
        extend: {
            typography: {
                DEFAULT: {
                    css: {
                        'ol > li': { marginTop: '0', marginBottom: '0' },
                        'ul > li': { marginTop: '0', marginBottom: '0' },
                        'li > ol': { marginTop: '0', marginBottom: '0' },
                        'li > ul': { marginTop: '0', marginBottom: '0' }
                    }
                }
            }
        }
    },
    plugins: [typography]
};

export default config;
