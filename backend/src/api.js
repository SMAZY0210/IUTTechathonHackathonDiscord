// REST endpoints. Both the web dashboard (for its first load) and the Discord
// bot read from these — one backend, one source of truth.

import { Router } from 'express';
import { getActiveAlerts } from './alerts.js';
import { getSnapshot } from './snapshot.js';

export function createApiRouter(store) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  router.get('/rooms', (req, res) => {
    res.json(store.getRooms());
  });

  router.get('/devices', (req, res) => {
    const { room } = req.query;
    if (room && !store.getRooms().some((r) => r.id === room)) {
      return res.status(404).json({ error: `Unknown room: ${room}` });
    }
    res.json(store.getDevices(room));
  });

  router.get('/devices/:id', (req, res) => {
    const device = store.getDevice(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  router.get('/summary', (req, res) => {
    res.json(store.getSummary());
  });

  router.get('/usage', (req, res) => {
    res.json(store.getUsage());
  });

  router.get('/alerts', (req, res) => {
    res.json(getActiveAlerts(store.getDevices()));
  });

  // Everything the dashboard needs in one shot. The dashboard polls this
  // instead of using Socket.IO, so it works the same way locally and on
  // serverless hosts like Vercel.
  router.get('/state', (req, res) => {
    res.json(getSnapshot(store));
  });

  return router;
}
