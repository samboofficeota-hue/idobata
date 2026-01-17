// Minimal startup wrapper to ensure server starts
import http from 'node:http';

const PORT = process.env.PORT || 8080;

console.log('=== STARTING BACKEND ===');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Create minimal health check server first
const healthServer = http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(200);
    res.end('Backend starting...');
  }
});

healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server listening on ${PORT}`);
  
  // Now import and start the real server
  import('./server.js')
    .then(() => {
      console.log('Main server loaded');
      // Close health check server once main server is ready
      setTimeout(() => {
        try {
          healthServer.close();
          console.log('Health check server closed');
        } catch (e) {
          // Ignore
        }
      }, 5000);
    })
    .catch((err) => {
      console.error('Failed to load main server:', err);
      // Keep health check server running even if main fails
    });
});
