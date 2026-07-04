// Resolves whatever the user typed after `!room` to a real room, so `work1`,
// `work 1`, `wr1`, `Work Room 1`, and `waiting` all land in the right place.
// Pure and data-driven: it matches against the room list from the backend plus
// a few friendly aliases.

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES = {
  drawing: ['drawing', 'draw', 'waiting', 'lobby', 'reception'],
  work1: ['work1', 'workroom1', 'wr1', 'w1', 'room1'],
  work2: ['work2', 'workroom2', 'wr2', 'w2', 'room2'],
};

export function resolveRoom(input, rooms) {
  if (!input) return null;
  const key = norm(input);

  for (const room of rooms) {
    if (norm(room.id) === key || norm(room.name) === key) return room;
    const aliases = ALIASES[room.id] || [];
    if (aliases.includes(key)) return room;
  }
  return null;
}
