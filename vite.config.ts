/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';


export default defineConfig(({ command }) => ({
    plugins: [react()],
    define: command === 'build'
        ? { 'import.meta.env.VITE_BUILD_DATE': JSON.stringify(new Date().toISOString()) }
        : undefined,
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test-setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/main.tsx',
                'src/polyfills.ts',
                'src/index.css',
                'src/test-setup.ts',
                'src/**/*.test.{ts,tsx}',
                'src/**/__tests__/**'
            ]
        }
    }
}));
