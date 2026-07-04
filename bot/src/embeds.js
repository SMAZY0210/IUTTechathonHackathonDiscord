// Rich Discord embeds — the "graphical" layer. Each builder turns real backend
// data into a colored card with emoji device indicators and a text bar-gauge for
// power. The bars and numbers are computed from the data, so nothing here is
// decorative or faked. The plain-sentence description is the only part the
// optional LLM layer rephrases.

import { EmbedBuilder } from 'discord.js';

const OFFICE_MAX = 6 * 60 + 9 * 15; // 495 W, whole office
const ROOM_MAX = 2 * 60 + 3 * 15; // 165 W, one room
const ROOM_ORDER = ['drawing', 'work1', 'work2'];

const ICON = { fanOn: '🌀', lightOn: '💡', off: '⚪' };
const COLOR = {
  idle: 0x5f7288, // grey — nothing on
  active: 0xf5b14c, // amber — normal load
  high: 0xff6f5e, // coral — heavy load
  alert: 0xff6f5e,
};
const FOOTER = 'Office Power Monitor';

// A segmented bar, e.g. ▰▰▰▱▱▱▱▱.
function bar(value, max, size = 12) {
  const filled = Math.max(0, Math.min(size, Math.round((value / max) * size)));
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

function loadColor(watts, max) {
  if (watts <= 0) return COLOR.idle;
  if (watts / max >= 0.75) return COLOR.high;
  return COLOR.active;
}

function onWatts(devices) {
  return devices.filter((d) => d.status === 'on').reduce((s, d) => s + d.watts, 0);
}

function byRoom(devices) {
  const map = new Map();
  for (const d of devices) {
    if (!map.has(d.room)) {
      map.set(d.room, { id: d.room, name: d.roomName, devices: [] });
    }
    map.get(d.room).devices.push(d);
  }
  const known = ROOM_ORDER.filter((id) => map.has(id)).map((id) => map.get(id));
  const extra = [...map.values()].filter((r) => !ROOM_ORDER.includes(r.id));
  return [...known, ...extra];
}

// Icons for a set of devices, in order, e.g. "🌀⚪  💡💡⚪".
function fixtureIcons(roomDevices) {
  const fans = roomDevices.filter((d) => d.type === 'fan');
  const lights = roomDevices.filter((d) => d.type === 'light');
  const f = fans.map((d) => (d.status === 'on' ? ICON.fanOn : ICON.off)).join('');
  const l = lights.map((d) => (d.status === 'on' ? ICON.lightOn : ICON.off)).join('');
  return `${f}  ${l}`;
}

// /status — whole office.
export function statusEmbed(devices) {
  const total = onWatts(devices);
  const onCount = devices.filter((d) => d.status === 'on').length;

  const embed = new EmbedBuilder()
    .setTitle('⚡ Office — Live Status')
    .setColor(loadColor(total, OFFICE_MAX))
    .setDescription(
      onCount === 0
        ? 'Everything is off — the office is quiet.'
        : `${onCount} of 15 devices on, drawing about ${total} W.`,
    )
    .addFields({
      name: 'Total draw',
      value: `${bar(total, OFFICE_MAX, 16)}  **${total} W** / ${OFFICE_MAX} W`,
      inline: false,
    })
    .setTimestamp(new Date())
    .setFooter({ text: FOOTER });

  for (const room of byRoom(devices)) {
    const watts = onWatts(room.devices);
    embed.addFields({
      name: room.name,
      value: `${fixtureIcons(room.devices)}\n${bar(watts, ROOM_MAX, 8)} \`${watts} W\``,
      inline: true,
    });
  }
  return embed;
}

// /room — one room in detail.
export function roomEmbed(devices, roomName) {
  const watts = onWatts(devices);
  const fans = devices.filter((d) => d.type === 'fan');
  const lights = devices.filter((d) => d.type === 'light');
  const line = (arr, onIcon) =>
    arr.map((d) => `${d.status === 'on' ? onIcon : ICON.off} ${d.label}`).join('\n') || '—';

  return new EmbedBuilder()
    .setTitle(roomName)
    .setColor(loadColor(watts, ROOM_MAX))
    .setDescription(
      watts === 0 ? `${roomName} is all quiet.` : `${roomName} is drawing about ${watts} W.`,
    )
    .addFields(
      {
        name: 'Power',
        value: `${bar(watts, ROOM_MAX, 14)}  **${watts} W** / ${ROOM_MAX} W`,
        inline: false,
      },
      { name: 'Fans', value: line(fans, ICON.fanOn), inline: true },
      { name: 'Lights', value: line(lights, ICON.lightOn), inline: true },
    )
    .setTimestamp(new Date())
    .setFooter({ text: FOOTER });
}

// /usage — power now + today's energy.
export function usageEmbed(usage) {
  const total = usage.totalWatts;
  return new EmbedBuilder()
    .setTitle('⚡ Power Usage')
    .setColor(loadColor(total, OFFICE_MAX))
    .setDescription(`Right now the office is pulling about ${total} W.`)
    .addFields(
      {
        name: 'Live draw',
        value: `${bar(total, OFFICE_MAX, 16)}  **${total} W** / ${OFFICE_MAX} W`,
        inline: false,
      },
      { name: "Today's usage", value: `📊 **${usage.todayKwh} kWh**`, inline: true },
    )
    .setTimestamp(new Date())
    .setFooter({ text: FOOTER });
}

// Proactive alert post.
export function alertEmbed(alert) {
  return new EmbedBuilder()
    .setTitle('⚠️ Alert')
    .setColor(COLOR.alert)
    .setDescription(alert.message)
    .setTimestamp(new Date(alert.timestamp))
    .setFooter({ text: FOOTER });
}
