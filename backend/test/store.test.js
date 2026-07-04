import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';

test('summary totals match the sum of ON device wattages', () => {
  const store = createStore();
  const summary = store.getSummary();
  const expected = store
    .getDevices()
    .filter((d) => d.status === 'on')
    .reduce((s, d) => s + d.watts, 0);
  assert.equal(summary.totalWatts, expected);
  assert.equal(summary.counts.total, 15);
  assert.equal(summary.counts.on + summary.counts.off, 15);
});

test('setDeviceStatus flips status and updates lastChanged', async () => {
  const store = createStore();
  const device = store.getDevices()[0];
  const target = device.status === 'on' ? 'off' : 'on';
  const before = store.getDevice(device.id).lastChanged;
  await new Promise((r) => setTimeout(r, 5));
  const changed = store.setDeviceStatus(device.id, target);
  assert.equal(changed, true);
  assert.equal(store.getDevice(device.id).status, target);
  assert.notEqual(store.getDevice(device.id).lastChanged, before);
});

test('setDeviceStatus is a no-op when status is unchanged', () => {
  const store = createStore();
  const device = store.getDevices()[0];
  assert.equal(store.setDeviceStatus(device.id, device.status), false);
});

test('accrueEnergy increases today usage in proportion to load', () => {
  const store = createStore();
  const watts = store._currentWatts();
  const before = store.getUsage().todayKwh;
  store.accrueEnergy(1); // one hour at the current load
  const after = store.getUsage().todayKwh;
  // watts/1000 is always an exact multiple of 0.001, so this is exact.
  assert.ok(Math.abs(after - before - watts / 1000) < 1e-6);
});
