// Thin client for the shared backend. The bot never holds its own copy of the
// state — it reads the same REST API the dashboard's first load uses, so both
// interfaces always reflect the same reality.

const BASE = process.env.BACKEND_URL || 'http://localhost:3001';

async function get(pathname) {
  const res = await fetch(BASE + pathname);
  if (!res.ok) {
    throw new Error(`Backend ${pathname} responded ${res.status}`);
  }
  return res.json();
}

export const BACKEND_URL = BASE;
export const getSummary = () => get('/api/summary');
export const getUsage = () => get('/api/usage');
export const getAlerts = () => get('/api/alerts');
export const getRooms = () => get('/api/rooms');
export const getDevices = (room) =>
  get('/api/devices' + (room ? `?room=${encodeURIComponent(room)}` : ''));
