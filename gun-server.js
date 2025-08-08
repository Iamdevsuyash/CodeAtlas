const Gun = require('gun');
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
const port = process.env.PORT || 8765;

// Enable CORS for all routes
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Create HTTP server
const server = http.createServer(app);

// Create Gun instance with proper WebSocket support
const gun = Gun({
  web: server,
  file: 'gun-data'
});

// Serve Gun.js client library
app.use(Gun.serve);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Gun.js server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(port, () => {
  console.log(`🔫 Gun.js server running on http://localhost:${port}`);
  console.log(`📡 Real-time collaboration backend ready!`);
  console.log(`🌐 CORS enabled for frontend at http://localhost:3000`);
  console.log(`🔌 WebSocket support enabled for real-time sync`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down Gun.js server...');
  server.close(() => {
    console.log('✅ Gun.js server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Gun.js server...');
  server.close(() => {
    console.log('✅ Gun.js server closed');
    process.exit(0);
  });
});
