// Builds the fixed fleet of office devices. With 2 fans + 3 lights in each of
// the 3 rooms this produces 15 devices total.

import { ROOMS, ROOM_DEVICES, WATTAGE } from './config.js';

// Human-friendly label, e.g. "Fan 1" / "Light 3".
function label(type, index) {
  return `${type[0].toUpperCase()}${type.slice(1)} ${index}`;
}

// Random ISO timestamp between `maxAgoMs` ago and now. Used so devices don't all
// share the same lastChanged at startup, and so some rooms can already qualify
// for the "on too long" alert when the demo begins.
function recentTimestamp(maxAgoMs) {
  const ago = Math.floor(Math.random() * maxAgoMs);
  return new Date(Date.now() - ago).toISOString();
}

// Create all 15 devices with a randomized initial on/off state.
export function createDevices() {
  const devices = [];

  for (const room of ROOMS) {
    for (const spec of ROOM_DEVICES) {
      for (let i = 1; i <= spec.count; i++) {
        const status = Math.random() < 0.5 ? 'on' : 'off';
        devices.push({
          id: `${room.id}-${spec.type}-${i}`,
          type: spec.type,
          room: room.id,
          roomName: room.name,
          label: label(spec.type, i),
          status,
          watts: WATTAGE[spec.type],
          // ON devices get a timestamp up to 3h in the past; OFF ones just now.
          lastChanged:
            status === 'on'
              ? recentTimestamp(3 * 60 * 60 * 1000)
              : new Date().toISOString(),
        });
      }
    }
  }

  return devices;
}
