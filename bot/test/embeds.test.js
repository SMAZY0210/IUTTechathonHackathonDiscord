import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusEmbed, roomEmbed, usageEmbed } from '../src/embeds.js';
import { resolveRoom } from '../src/rooms.js';

// Minimal schema fixtures for exercising the builders (not app demo data).
function dev(room, roomName, type, i, status) {
  return {
    id: `${room}-${type}-${i}`,
    type,
    room,
    roomName,
    label: `${type[0].toUpperCase()}${type.slice(1)} ${i}`,
    status,
    watts: type === 'fan' ? 60 : 15,
  };
}

function room(id, name, fanStates, lightStates) {
  return [
    ...fanStates.map((s, i) => dev(id, name, 'fan', i + 1, s)),
    ...lightStates.map((s, i) => dev(id, name, 'light', i + 1, s)),
  ];
}

function field(embed, name) {
  return embed.data.fields.find((f) => f.name === name);
}

test('statusEmbed shows the correct total and per-room watts', () => {
  const devices = [
    ...room('drawing', 'Drawing Room', ['on', 'off'], ['on', 'on', 'off']), // 60 + 30 = 90
    ...room('work1', 'Work Room 1', ['off', 'off'], ['off', 'off', 'off']), // 0
    ...room('work2', 'Work Room 2', ['on', 'on'], ['on', 'on', 'on']), // 120 + 45 = 165
  ];
  const embed = statusEmbed(devices);
  // total = 255 W, 8 of 15 devices on (3 in drawing + 5 in work2)
  assert.match(embed.data.description, /8 of 15 devices on/);
  assert.match(field(embed, 'Total draw').value, /255 W/);
  assert.match(field(embed, 'Work Room 2').value, /165 W/);
  assert.match(field(embed, 'Work Room 1').value, /0 W/);
});

test('statusEmbed reports an all-off office', () => {
  const devices = room('drawing', 'Drawing Room', ['off', 'off'], ['off', 'off', 'off']);
  assert.match(statusEmbed(devices).data.description, /Everything is off/);
});

test('roomEmbed lists fans and lights and the room load', () => {
  const devices = room('work1', 'Work Room 1', ['on', 'off'], ['off', 'off', 'off']);
  const embed = roomEmbed(devices, 'Work Room 1');
  assert.match(field(embed, 'Power').value, /60 W/);
  assert.match(field(embed, 'Fans').value, /Fan 1/);
  assert.match(field(embed, 'Fans').value, /Fan 2/);
  assert.match(field(embed, 'Lights').value, /Light 1/);
});

test('usageEmbed includes live watts and today kWh', () => {
  const embed = usageEmbed({ totalWatts: 465, todayKwh: 4.2, asOf: 'x' });
  assert.match(field(embed, 'Live draw').value, /465 W/);
  assert.match(field(embed, "Today's usage").value, /4\.2 kWh/);
});

test('resolveRoom accepts ids, names, and aliases', () => {
  const rooms = [
    { id: 'drawing', name: 'Drawing Room' },
    { id: 'work1', name: 'Work Room 1' },
    { id: 'work2', name: 'Work Room 2' },
  ];
  assert.equal(resolveRoom('work1', rooms).id, 'work1');
  assert.equal(resolveRoom('Work Room 1', rooms).id, 'work1');
  assert.equal(resolveRoom('wr2', rooms).id, 'work2');
  assert.equal(resolveRoom('waiting', rooms).id, 'drawing');
  assert.equal(resolveRoom('kitchen', rooms), null);
});
