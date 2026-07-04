// The single source of truth for device state and energy usage. The REST API,
// the realtime broadcaster, and the simulator all read and write through this
// one object. Nothing else mutates device state directly.

import { createDevices } from './devices.js';
import { ROOMS, SEED_USAGE } from './config.js';

export function createStore() {
  const devices = createDevices();

  // Energy bookkeeping for "today's usage".
  let todayKwh = 0;
  let usageDate = localDateKey(new Date());

  // Optionally seed today's usage so the demo shows a realistic number right
  // away: assume the current load has been constant since local midnight.
  if (SEED_USAGE) {
    const now = new Date();
    const hoursSinceMidnight =
      (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 3600;
    todayKwh = (currentWatts() * hoursSinceMidnight) / 1000;
  }

  // ---- internal helpers (hoisted) ----
  function currentWatts() {
    return devices
      .filter((d) => d.status === 'on')
      .reduce((sum, d) => sum + d.watts, 0);
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  return {
    // ---- reads ----
    getDevices(roomId) {
      return roomId ? devices.filter((d) => d.room === roomId) : devices.slice();
    },

    getDevice(id) {
      return devices.find((d) => d.id === id) || null;
    },

    getRooms() {
      return ROOMS.slice();
    },

    getSummary() {
      const perRoom = {};
      for (const room of ROOMS) {
        const roomDevices = devices.filter((d) => d.room === room.id);
        const on = roomDevices.filter((d) => d.status === 'on');
        perRoom[room.id] = {
          name: room.name,
          watts: on.reduce((s, d) => s + d.watts, 0),
          on: on.length,
          off: roomDevices.length - on.length,
          total: roomDevices.length,
        };
      }
      const onCount = devices.filter((d) => d.status === 'on').length;
      return {
        totalWatts: currentWatts(),
        perRoom,
        counts: {
          on: onCount,
          off: devices.length - onCount,
          total: devices.length,
        },
      };
    },

    getUsage() {
      return {
        totalWatts: currentWatts(),
        todayKwh: Number(todayKwh.toFixed(3)),
        asOf: new Date().toISOString(),
      };
    },

    // ---- writes (simulator only) ----
    setDeviceStatus(id, status) {
      const device = devices.find((d) => d.id === id);
      if (!device || device.status === status) return false;
      device.status = status;
      device.lastChanged = new Date().toISOString();
      return true;
    },

    // Add energy for an elapsed interval at the current load. Resets the
    // accumulator when the local day rolls over.
    accrueEnergy(hours) {
      const key = localDateKey(new Date());
      if (key !== usageDate) {
        usageDate = key;
        todayKwh = 0;
      }
      todayKwh += (currentWatts() * hours) / 1000;
    },

    // Exposed for tests.
    _currentWatts: currentWatts,
  };
}
