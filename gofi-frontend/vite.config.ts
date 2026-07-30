import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // 检查是否为演示模式
    const isDemoMode = mode === 'demo' || process.env.VITE_IS_PREVIEW_MODE === 'true'

    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        define: {
            // 在开发环境下也支持演示模式
            'import.meta.env.VITE_IS_PREVIEW_MODE': JSON.stringify(isDemoMode ? 'true' : 'false'),
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                        'vendor-i18n': ['i18next', 'react-i18next'],
                        'vendor-data': ['axios', 'swr', 'jotai'],
                    },
                },
            },
        },
        server: {
            port: 3000,
            host: true,
        },
    }
})
