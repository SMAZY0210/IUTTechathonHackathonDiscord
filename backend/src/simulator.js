// Advances device state over time: accrues energy for the elapsed interval
// and randomly switches devices on/off using probabilities that depend on
// office hours.
//
// `tick()` does exactly one step and is the shared primitive. Two different
// callers drive it:
//   - startSimulator(): a real setInterval, for long-running processes
//     (local dev, or any host that keeps a Node process alive).
//   - catchup.js: replays N ticks synchronously at the start of a request,
//     for serverless platforms (Vercel) that freeze the process between
//     requests, where a setInterval would never actually fire.

import { TICK_INTERVAL_MS, TRANSITION } from './config.js';
import { isOfficeHours } from './alerts.js';

export const TICK_HOURS = TICK_INTERVAL_MS / 3_600_000;

export function tick(store) {
  // 1) Energy for the interval that just elapsed, at the current load.
  store.accrueEnergy(TICK_HOURS);

  // 2) Randomly flip devices toward the time-appropriate pattern.
  const rates = isOfficeHours() ? TRANSITION.office : TRANSITION.afterHours;
  for (const device of store.getDevices()) {
    const roll = Math.random();
    if (device.status === 'off' && roll < rates.turnOn) {
      store.setDeviceStatus(device.id, 'on');
    } else if (device.status === 'on' && roll < rates.turnOff) {
      store.setDeviceStatus(device.id, 'off');
    }
  }
}

export function startSimulator(store, onTick) {
  const timer = setInterval(() => {
    tick(store);
    if (onTick) onTick();
  }, TICK_INTERVAL_MS);

  // Don't let this timer alone keep the process alive; the HTTP server does.
  if (timer.unref) timer.unref();

  // Return a stop function for graceful shutdown / tests.
  return () => clearInterval(timer);
}
