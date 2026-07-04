import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDevices } from '../src/devices.js';
import { WATTAGE } from '../src/config.js';

test('creates 15 devices: 6 fans and 9 lights', () => {
  const devices = createDevices();
  assert.equal(devices.length, 15);
  assert.equal(devices.filter((d) => d.type === 'fan').length, 6);
  assert.equal(devices.filter((d) => d.type === 'light').length, 9);
});

test('each room has 2 fans and 3 lights', () => {
  const devices = createDevices();
  for (const room of ['drawing', 'work1', 'work2']) {
    const roomDevices = devices.filter((d) => d.room === room);
    assert.equal(roomDevices.filter((d) => d.type === 'fan').length, 2);
    assert.equal(roomDevices.filter((d) => d.type === 'light').length, 3);
  }
});

test('device ids are unique and wattages are correct', () => {
  const devices = createDevices();
  const ids = new Set(devices.map((d) => d.id));
  assert.equal(ids.size, devices.length);
  for (const d of devices) {
    assert.equal(d.watts, WATTAGE[d.type]);
  }
});
