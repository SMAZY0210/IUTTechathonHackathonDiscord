// Local preview of what the bot would reply, run against a live backend without
// needing a Discord token. It builds the same embeds the bot sends and renders
// them as plain text (colors and emoji still show; layout is approximate).
//
//   node src/dryrun.js            # runs /status, /room work1, /usage
//   node src/dryrun.js room work2

import * as backend from './backend.js';
import { statusEmbed, roomEmbed, usageEmbed } from './embeds.js';
import { humanize } from './humanize.js';
import { resolveRoom } from './rooms.js';

// Flatten an embed into readable text for the terminal.
function embedToText(embed) {
  const d = embed.data;
  const lines = [];
  if (d.title) lines.push(d.title);
  if (d.description) lines.push(d.description);
  for (const f of d.fields ?? []) {
    lines.push('');
    lines.push(f.name);
    lines.push(f.value);
  }
  return lines.join('\n');
}

async function build(cmd, arg) {
  let embed;
  if (cmd === 'status') {
    embed = statusEmbed(await backend.getDevices());
  } else if (cmd === 'usage') {
    embed = usageEmbed(await backend.getUsage());
  } else if (cmd === 'room') {
    const room = resolveRoom(arg, await backend.getRooms());
    if (!room) return `Unknown room: ${arg}`;
    const devices = await backend.getDevices(room.id);
    embed = roomEmbed(devices, room.name);
  } else {
    return `Unknown command: ${cmd}`;
  }
  const desc = embed.data.description;
  if (desc) embed.setDescription(await humanize(desc));
  return embedToText(embed);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  console.log(`Backend: ${backend.BACKEND_URL}\n`);

  const jobs = cmd
    ? [[cmd, arg]]
    : [
        ['status', undefined],
        ['room', 'work1'],
        ['usage', undefined],
      ];

  for (const [c, a] of jobs) {
    const label = a ? `/${c} ${a}` : `/${c}`;
    console.log(`──────── ${label} ────────`);
    console.log(await build(c, a));
    console.log('');
  }
}

main().catch((err) => {
  console.error('Dry run failed:', err.message);
  console.error('Is the backend running? (cd backend && npm start)');
  process.exit(1);
});
