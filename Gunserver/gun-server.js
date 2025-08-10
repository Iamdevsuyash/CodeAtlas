const express = require('express');
const cors = require('cors');
const Gun = require('gun');
const http = require('http');

// --- Server Setup ---
const app = express();
const port = process.env.PORT || 8765; // Use Render's port, fallback for local dev

// --- CORS Configuration ---
const corsOriginsEnv = process.env.CORS_ORIGINS || 'http://localhost:3000';
const allowedOrigins = corsOriginsEnv.split(',').map(origin => origin.trim());

console.log(`🔫 Gun.js server allowing origins: ${allowedOrigins.join(', ')}`);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

// --- Health Check ---
// A simple endpoint for Render to check if the service is alive.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Gun.js server is healthy.' });
});

// --- Gun.js Setup ---
// Serve the gun.js client file.
app.use(Gun.serve);

// Create an HTTP server instance from the Express app.
const server = http.createServer(app);

// Initialize Gun and attach it to the HTTP server.
const gun = Gun({
  web: server,
  peers: [],
  radisk: false,
  localStorage: false,
});

// Start the server.
server.listen(port, () => {
  console.log(`🚀 Gun.js server is live and listening on port ${port}`);
});

console.log('✨ Gun.js relay peer initialized.');
