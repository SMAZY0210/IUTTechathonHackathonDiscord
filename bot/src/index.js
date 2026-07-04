// Discord bot (slash commands, rich embeds). Lives in a server and answers
// questions about the office on demand, reading everything from the shared
// backend REST API.
//   /status         whole-office snapshot
//   /room <name>    one room in detail (pick from a dropdown)
//   /usage          power now + today's energy
//
// Replies are colored embeds with emoji indicators and bar-gauges (embeds.js).
// Slash commands mean we do NOT need the privileged Message Content intent.

import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

import * as backend from './backend.js';
import { statusEmbed, roomEmbed, usageEmbed } from './embeds.js';
import { humanize } from './humanize.js';
import { startAlertWatcher } from './alerts-watcher.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// Command definitions. The /room choices mirror the backend's fixed rooms, so
// the user picks from a dropdown instead of typing.
const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('How the whole office looks right now'),
  new SlashCommandBuilder()
    .setName('room')
    .setDescription('Show one room in detail')
    .addStringOption((o) =>
      o
        .setName('name')
        .setDescription('Which room')
        .setRequired(true)
        .addChoices(
          { name: 'Drawing Room', value: 'drawing' },
          { name: 'Work Room 1', value: 'work1' },
          { name: 'Work Room 2', value: 'work2' },
        ),
    ),
  new SlashCommandBuilder()
    .setName('usage')
    .setDescription("Current power draw and today's usage"),
].map((c) => c.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot online as ${c.user.tag}`);
  console.log(`Reading from backend: ${backend.BACKEND_URL}`);
  await registerCommands(c.user.id);
  startAlertWatcher(
    client,
    process.env.ALERT_CHANNEL_ID,
    Number(process.env.ALERT_POLL_MS) || 60_000,
  );
});

// Register slash commands. Guild-scoped (via GUILD_ID) appear instantly — best
// for development. Without GUILD_ID we register globally (up to ~1h to appear).
async function registerCommands(appId) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const guildId = process.env.GUILD_ID;
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log(`Registered ${commands.length} slash commands to guild ${guildId} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log(
        `Registered ${commands.length} global slash commands ` +
          '(can take up to 1h to appear — set GUILD_ID for instant updates).',
      );
    }
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
}

// If an LLM is configured, warm up only the embed's plain-sentence description;
// the graphical fields (bars, icons, numbers) always stay exact.
async function warm(embed) {
  const desc = embed.data.description;
  if (desc) embed.setDescription(await humanize(desc));
  return embed;
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Defer immediately: building a reply may involve an LLM call, and Discord
  // expects an acknowledgement within 3 seconds.
  await interaction.deferReply();

  try {
    if (interaction.commandName === 'status') {
      const embed = await warm(statusEmbed(await backend.getDevices()));
      await interaction.editReply({ embeds: [embed] });
    } else if (interaction.commandName === 'room') {
      const roomId = interaction.options.getString('name');
      const devices = await backend.getDevices(roomId);
      const roomName = devices[0]?.roomName || roomId;
      const embed = await warm(roomEmbed(devices, roomName));
      await interaction.editReply({ embeds: [embed] });
    } else if (interaction.commandName === 'usage') {
      const embed = await warm(usageEmbed(await backend.getUsage()));
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Command error:', err);
    await interaction.editReply(
      "I couldn't reach the office backend just now — is it running?",
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
