# Office Monitor — Backend

The shared backend for the office lights & fans monitor. It holds **one source of
truth** for device state and serves it to two clients: the web dashboard (over
Socket.IO, live) and the Discord bot (over REST). A built-in simulator keeps the
15 devices changing over time so there is always something live to show.

```
[Simulator] → [In-memory store] → [REST API]  → Discord bot
                                 ↘ [Socket.IO] → Web dashboard
```

## Requirements

- Node.js **18+** (uses ES modules and the built-in test runner)

## Setup & run

```bash
cd backend
npm install
npm start        # starts on http://localhost:3001
npm run dev      # same, with auto-restart on file changes
```

Override the port with `PORT=4000 npm start`.

## REST API

Base URL: `http://localhost:3001/api`

| Method & path         | Returns                                                        |
| --------------------- | ------------------------------------------------------------- |
| `GET /health`         | `{ ok, time }` liveness check                                 |
| `GET /rooms`          | The three room definitions                                    |
| `GET /devices`        | All 15 devices; `?room=work1` filters (unknown room → 404)    |
| `GET /devices/:id`    | A single device (unknown id → 404)                            |
| `GET /summary`        | Total watts, per-room breakdown, on/off counts                |
| `GET /usage`          | Current watts + today's estimated kWh                         |
| `GET /alerts`         | Currently-active alerts (see below)                           |

Example `GET /summary`:

```json
{
  "totalWatts": 195,
  "perRoom": {
    "drawing": { "name": "Drawing Room", "watts": 90, "on": 3, "off": 2, "total": 5 },
    "work1":   { "name": "Work Room 1",  "watts": 75, "on": 2, "off": 3, "total": 5 },
    "work2":   { "name": "Work Room 2",  "watts": 30, "on": 2, "off": 3, "total": 5 }
  },
  "counts": { "on": 7, "off": 8, "total": 15 }
}
```

Example device shape:

```json
{
  "id": "work1-fan-1",
  "type": "fan",
  "room": "work1",
  "roomName": "Work Room 1",
  "label": "Fan 1",
  "status": "off",
  "watts": 60,
  "lastChanged": "2026-07-04T00:22:51.320Z"
}
```

These map directly onto the bot commands: `!status` → `/summary`, `!room <name>`
→ `/devices?room=<id>`, `!usage` → `/usage`.

## Realtime (Socket.IO)

The server emits a single event, **`state`**, to every connected client:

- once immediately on connection (initial snapshot), and
- again on every simulator tick.

Payload:

```json
{ "devices": [...], "summary": {...}, "usage": {...}, "alerts": [...], "timestamp": "..." }
```

Because there are only 15 devices, the full snapshot is sent each tick — no diffing
needed, and the dashboard just replaces its state. Minimal client:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001');
socket.on('state', (snapshot) => render(snapshot)); // updates with no page refresh
```

## Simulator & configuration

Every `TICK_INTERVAL_MS` (default 5s) the simulator (1) accrues energy for the
elapsed interval at the current load, and (2) randomly switches devices on/off
using probabilities that depend on office hours — devices come on and stay on
during the day, and mostly switch off after hours (but not always, which is how
"someone forgot" alerts get triggered).

All knobs live in `src/config.js`: rooms, per-device wattages, office hours, tick
interval, the 2-hour alert threshold, transition probabilities, and a
`SEED_USAGE` flag that seeds today's kWh at startup (assuming the current load has
run since local midnight) so the demo isn't showing zero.

## Alerts

Alerts are **derived** from the current state and clock, never stored, so they are
consistent everywhere and easy to test:

- **`after_hours`** — a room has devices ON outside office hours (9 AM–5 PM).
- **`room_all_on`** — every device in a room has been ON continuously for 2h+.
  The room's "on since" is the most recent `lastChanged` among its devices, since
  that field updates on every flip.

Each alert is timestamped and carries a stable `id` so clients can de-duplicate.

## Tests

```bash
npm test
```

Unit tests (Node's built-in runner, no extra deps) cover the device factory
(counts, wattages, unique ids), the alert logic (office-hours boundaries,
after-hours firing, the all-on-2h condition and its negatives), and the store
(summary math, status flips updating `lastChanged`, energy accrual).

## Design notes

- **15 devices** — 2 fans + 3 lights × 3 rooms. (The brief was internally
  contradictory — parts said 18 — so this was confirmed as the physical count.)
- **In-memory store** — the data is simulated and ephemeral; zero setup and clean
  resets. A JSON snapshot could be added later if restart-persistence is wanted.
- **Config lives in the backend, not a shared package.** The bot reads constants
  (wattages, rooms) from the API rather than importing them — no workspace tooling
  and a stricter single-source-of-truth.
- **Dummy data:** the supplied person records (Nafisa Rahman, Tanvir Hossain) are
  people, and the device backend has no person field, so they are not used here.
  Device *states* are generated by the simulator, which the brief explicitly
  requires to be dynamic. The person records are reserved for wherever we later
  add sample people (e.g. an occupant or "toggled by" field).

## Next steps

- **Web dashboard** — consumes `state` over Socket.IO for the device panel, power
  meter, and alerts panel.
- **Discord bot** — separate process calling the REST API for `!status`, `!room`,
  `!usage`; the `/alerts` endpoint (or a pushed alert event) backs the proactive
  after-hours message.
