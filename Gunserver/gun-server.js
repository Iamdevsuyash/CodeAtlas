const Gun = require('gun');
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8765;
console.log(`🔧 Using port: ${port} (from ${process.env.PORT ? 'environment' : 'default'})`);

// Enable CORS for all routes
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(origin => origin.trim())
  : [
      "https://gitatlas.netlify.app",
      "https://codeatlas.netlify.app", 
      "http://localhost:3000",
      "http://localhost:3001"
    ];

console.log("🔒 CORS allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Serve Gun.js client library
app.use(Gun.serve);

// Create server and Gun instance
const server = app.listen(port, () => {
  console.log(`🔫 Gun.js server running on port ${port}`);
  console.log(`📡 Real-time collaboration backend ready!`);
  console.log(`🔌 WebSocket support enabled for real-time sync`);
});

Gun({ web: server });

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Gun.js server is running",
    timestamp: new Date().toISOString(),
  });
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Shutting down Gun.js server...");
  server.close(() => {
    console.log("✅ Gun.js server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down Gun.js server...");
  server.close(() => {
    console.log("✅ Gun.js server closed");
    process.exit(0);
  });
});
