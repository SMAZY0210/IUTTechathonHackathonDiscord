// Single place for every tunable constant. The API, the realtime broadcaster,
// and the simulator all read from here so behaviour stays consistent.

export const PORT = process.env.PORT || 3001;

// The three rooms, in display order.
export const ROOMS = [
  { id: 'drawing', name: 'Drawing Room' },
  { id: 'work1', name: 'Work Room 1' },
  { id: 'work2', name: 'Work Room 2' },
];

// Devices present in every room -> 2 fans + 3 lights = 5 per room, 15 total.
export const ROOM_DEVICES = [
  { type: 'fan', count: 2 },
  { type: 'light', count: 3 },
];

// Rated power draw (watts) when a device is ON.
export const WATTAGE = {
  fan: 60,
  light: 15,
};

// Office hours are [start, end) in 24h local time: 9 AM–5 PM.
export const OFFICE_HOURS = { start: 9, end: 17 };

// How often the simulator advances, in milliseconds.
export const TICK_INTERVAL_MS = 5000;

// A room is "left on" once every device in it has been ON continuously for at
// least this many hours.
export const ROOM_ALL_ON_HOURS = 2;

// Per-tick transition probabilities, split by whether we're inside office hours.
// During the day devices switch on and mostly stay on; after hours they tend to
// switch off — but not always, which is how the "someone forgot" alerts arise.
export const TRANSITION = {
  office: { turnOn: 0.15, turnOff: 0.05 },
  afterHours: { turnOn: 0.02, turnOff: 0.2 },
};

// If true, seed "today's usage" at startup by assuming the current load has been
// roughly constant since local midnight, so the demo shows a realistic kWh
// figure immediately instead of starting near zero.
export const SEED_USAGE = true;
