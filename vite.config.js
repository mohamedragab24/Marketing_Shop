import { defineConfig } from 'vite';

function localHealthRoute() {
  const handler = (_request, response) => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ status: 'ok', service: 'dbguide-api', runtime: 'Node.js' }));
  };

  return {
    name: 'dbguide-local-health-route',
    configureServer(server) {
      server.middlewares.use('/api/health', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/health', handler);
    },
  };
}

export default defineConfig({
  plugins: [localHealthRoute()],
  server: { host: '0.0.0.0', port: 3000, strictPort: true, proxy: { '/api/(?!health)': 'http://localhost:4000' } },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { main: 'index.html', app: 'app.html', seller: 'seller.html', marketing: 'marketing.html' } },
    // The Firebase SDK is a deliberate on-demand chunk, loaded only when saving progress.
    chunkSizeWarningLimit: 600,
  },
});
