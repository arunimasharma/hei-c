import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, '/v1/messages'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Extract Bearer token from Authorization header and
            // re-map it to Anthropic's x-api-key header server-side.
            // This keeps the raw API key out of the client-side x-api-key header.
            const authHeader = req.headers['authorization'];
            if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
              const apiKey = authHeader.slice(7);
              proxyReq.setHeader('x-api-key', apiKey);
              proxyReq.setHeader('anthropic-version', '2023-06-01');
              // Remove the Authorization header so it doesn't reach Anthropic
              proxyReq.removeHeader('authorization');
            }
          });
        },
      },
    },
  },
})
