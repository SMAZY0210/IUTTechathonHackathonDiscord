// Alerts are *derived* from the current device state plus the clock — never
// stored. Given the same state and time you always get the same alerts, which
// makes this trivially testable.

import { ROOMS, OFFICE_HOURS, ROOM_ALL_ON_HOURS } from './config.js';

// Are we within office hours [start, end) in local time?
export function isOfficeHours(now = new Date()) {
  const hour = now.getHours();
  return hour >= OFFICE_HOURS.start && hour < OFFICE_HOURS.end;
}

function fmtDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

// Return the list of currently-active alerts.
export function getActiveAlerts(devices, now = new Date()) {
  const alerts = [];
  const nowIso = now.toISOString();
  const afterHours = !isOfficeHours(now);

  for (const room of ROOMS) {
    const roomDevices = devices.filter((d) => d.room === room.id);
    const onDevices = roomDevices.filter((d) => d.status === 'on');

    // 1) Anything left on outside office hours.
    if (afterHours && onDevices.length > 0) {
      alerts.push({
        id: `after_hours-${room.id}`,
        type: 'after_hours',
        severity: 'warning',
        room: room.id,
        roomName: room.name,
        message: `${room.name} has ${onDevices.length} device(s) ON outside office hours.`,
        timestamp: nowIso,
      });
    }

    // 2) A whole room left on for too long, continuously. Because lastChanged
    // updates on every flip, the most recent lastChanged among the room's
    // devices is the moment the room last became fully ON.
    if (roomDevices.length > 0 && onDevices.length === roomDevices.length) {
      const since = onDevices
        .map((d) => new Date(d.lastChanged).getTime())
        .reduce((a, b) => Math.max(a, b), 0);
      const onForMs = now.getTime() - since;
      if (onForMs >= ROOM_ALL_ON_HOURS * 3600 * 1000) {
        alerts.push({
          id: `room_all_on-${room.id}`,
          type: 'room_all_on',
          severity: 'warning',
          room: room.id,
          roomName: room.name,
          message: `All ${roomDevices.length} devices in ${room.name} have been ON for ${fmtDuration(onForMs)}.`,
          since: new Date(since).toISOString(),
          timestamp: nowIso,
        });
      }
    }
  }

  return alerts;
}
