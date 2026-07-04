import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOfficeHours, getActiveAlerts } from '../src/alerts.js';

// Build a device with an explicit lastChanged.
function dev(room, type, i, status, lastChanged) {
  return {
    id: `${room}-${type}-${i}`,
    type,
    room,
    roomName: room,
    label: `${type} ${i}`,
    status,
    watts: type === 'fan' ? 60 : 15,
    lastChanged: lastChanged.toISOString(),
  };
}

// A full room (2 fans + 3 lights) all sharing one status/time.
function fullRoom(room, status, lastChanged) {
  return [
    dev(room, 'fan', 1, status, lastChanged),
    dev(room, 'fan', 2, status, lastChanged),
    dev(room, 'light', 1, status, lastChanged),
    dev(room, 'light', 2, status, lastChanged),
    dev(room, 'light', 3, status, lastChanged),
  ];
}

test('isOfficeHours respects the 9-17 window', () => {
  const at = (h) => new Date(2025, 0, 1, h, 0, 0);
  assert.equal(isOfficeHours(at(8)), false);
  assert.equal(isOfficeHours(at(9)), true);
  assert.equal(isOfficeHours(at(16)), true);
  assert.equal(isOfficeHours(at(17)), false);
  assert.equal(isOfficeHours(at(22)), false);
});

test('after-hours: ON devices outside office hours raise an alert', () => {
  const now = new Date(2025, 0, 1, 22, 0, 0); // 10 PM
  const devices = fullRoom('work2', 'on', new Date(2025, 0, 1, 21, 50, 0));
  const alerts = getActiveAlerts(devices, now);
  assert.ok(alerts.some((a) => a.type === 'after_hours' && a.room === 'work2'));
});

test('after-hours: no alert during office hours', () => {
  const now = new Date(2025, 0, 1, 11, 0, 0); // 11 AM
  const devices = fullRoom('work2', 'on', new Date(2025, 0, 1, 10, 55, 0));
  const alerts = getActiveAlerts(devices, now);
  assert.equal(
    alerts.some((a) => a.type === 'after_hours'),
    false,
  );
});

test('room_all_on: fires only when every device has been on 2h+', () => {
  const now = new Date(2025, 0, 1, 14, 0, 0); // 2 PM (office hours)
  const threeHoursAgo = new Date(2025, 0, 1, 11, 0, 0);
  const tenMinAgo = new Date(2025, 0, 1, 13, 50, 0);

  // All on for 3h -> alert.
  let alerts = getActiveAlerts(fullRoom('work1', 'on', threeHoursAgo), now);
  assert.ok(alerts.some((a) => a.type === 'room_all_on' && a.room === 'work1'));

  // All on but only 10 min -> no alert.
  alerts = getActiveAlerts(fullRoom('work1', 'on', tenMinAgo), now);
  assert.equal(
    alerts.some((a) => a.type === 'room_all_on'),
    false,
  );

  // One device off -> no alert.
  const mixed = fullRoom('work1', 'on', threeHoursAgo);
  mixed[0].status = 'off';
  alerts = getActiveAlerts(mixed, now);
  assert.equal(
    alerts.some((a) => a.type === 'room_all_on'),
    false,
  );
});
