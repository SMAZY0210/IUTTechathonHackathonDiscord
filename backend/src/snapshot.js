// Builds the full "everything the dashboard needs" snapshot. Used by the
// /api/state endpoint, which the dashboard polls.
import { getActiveAlerts } from './alerts.js';

export function getSnapshot(store) {
  const devices = store.getDevices();
  return {
    devices,
    summary: store.getSummary(),
    usage: store.getUsage(),
    alerts: getActiveAlerts(devices),
    timestamp: new Date().toISOString(),
  };
}
