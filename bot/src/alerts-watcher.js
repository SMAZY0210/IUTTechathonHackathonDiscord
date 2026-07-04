// Proactive alerts (bonus). Polls the backend's /alerts endpoint and posts to a
// designated channel whenever a condition *newly* becomes active. It keys off
// the stable alert ids so a standing condition isn't reposted every poll.

import { getAlerts } from './backend.js';
import { alertEmbed } from './embeds.js';
import { humanize } from './humanize.js';

export function startAlertWatcher(client, channelId, intervalMs = 60_000) {
  if (!channelId) {
    console.log('[alerts] No ALERT_CHANNEL_ID set — proactive alerts disabled.');
    return () => {};
  }

  let seen = new Set(); // ids currently active and already announced

  async function poll() {
    let alerts;
    try {
      alerts = await getAlerts();
    } catch (err) {
      console.warn('[alerts] poll failed:', err.message);
      return;
    }

    const activeIds = new Set(alerts.map((a) => a.id));

    // Announce anything newly active.
    for (const alert of alerts) {
      if (!seen.has(alert.id)) {
        try {
          const channel = await client.channels.fetch(channelId);
          const embed = alertEmbed(alert);
          const desc = embed.data.description;
          if (desc) embed.setDescription(await humanize(desc));
          await channel.send({ embeds: [embed] });
        } catch (err) {
          console.warn('[alerts] could not post:', err.message);
        }
      }
    }

    // Reset to the current set so cleared conditions can alert again later.
    seen = activeIds;
  }

  poll(); // run once on startup
  const timer = setInterval(poll, intervalMs);
  return () => clearInterval(timer);
}
