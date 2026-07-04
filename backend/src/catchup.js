// Serverless platforms (Vercel) freeze the process between invocations, so a
// setInterval-based simulator never actually ticks in the background — it
// only runs while a request is being handled. This replaces that with a
// "catch up to now" step run at the start of every request: it replays
// however many 5s ticks elapsed since the last request handled by this warm
// instance.
//
// State only persists for as long as the instance stays warm (Node module
// scope). A cold start reseeds the store from scratch, same as a local
// restart. That's an accepted tradeoff of running this on serverless rather
// than a long-running host.

import { TICK_INTERVAL_MS } from './config.js';
import { tick } from './simulator.js';

// Cap how many ticks we'll ever replay in one request, so a request that
// arrives after a long-idle instance doesn't spin through hours of history
// synchronously and blow the function's time limit.
const MAX_CATCHUP_TICKS = 720; // 720 * 5s = 1 hour of simulated time per request

export function createCatchup(store) {
  let lastTick = Date.now();

  return function catchUp() {
    const now = Date.now();
    let elapsedTicks = Math.floor((now - lastTick) / TICK_INTERVAL_MS);
    if (elapsedTicks <= 0) return;
    if (elapsedTicks > MAX_CATCHUP_TICKS) elapsedTicks = MAX_CATCHUP_TICKS;

    for (let i = 0; i < elapsedTicks; i++) tick(store);
    lastTick = now;
  };
}
