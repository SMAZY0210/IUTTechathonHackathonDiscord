// Wires everything together for local/long-running hosting: REST API on one
// HTTP server, backed by a single in-memory store that the simulator keeps
// updating in the background via setInterval.
//
// This file is NOT used on Vercel — see ../api/index.js for the serverless
// entry point, which has no listen()/setInterval and instead catches the
// store up to "now" on each request.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import { PORT } from './config.js';
import { createStore } from './store.js';
import { createApiRouter } from './api.js';
import { startSimulator } from './simulator.js';

const store = createStore();

const app = express();
app.use(cors()); // permissive for local dev; restrict origins for production
app.use('/api', createApiRouter(store));

// Serve the web dashboard from the same origin, so one process runs the API
// and the UI together (no CORS friction for local dev). The dashboard polls
// /api/state on an interval to stay live.
const dashboardDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../dashboard/public',
);
if (fs.existsSync(dashboardDir)) {
  app.use(express.static(dashboardDir));
  console.log(`Serving dashboard from ${dashboardDir}`);
}

const server = http.createServer(app);
const stopSimulator = startSimulator(store);

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log(`  Dashboard: http://localhost:${PORT}/`);
  console.log(`  REST:      http://localhost:${PORT}/api/summary`);
  console.log(`  Poll:      http://localhost:${PORT}/api/state`);
});

// Graceful shutdown.
function shutdown() {
  console.log('\nShutting down...');
  stopSimulator();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
