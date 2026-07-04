# Office Power Monitor

A system that monitors an office's lights and fans (their on/off state and power
usage) and surfaces it through **two interfaces over one shared backend**: a
live web dashboard and a Discord bot. A simulator keeps the 15 devices changing
over time, so there's always something live to watch.

The office has **3 rooms** (Drawing Room, Work Room 1, Work Room 2), each with
**2 fans + 3 lights = 15 devices** total.

- **Backend**: one source of truth: a REST API plus a device simulator. It also serves the dashboard locally, and runs as a Vercel serverless function in production.
- **Dashboard**: a live web UI, polling the backend for updates: power meter, animated floor plan, alerts, and a per-device panel. Dark and light themes.
- **Bot**: a Discord bot with slash commands (`/status`, `/room`, `/usage`) that reply with rich embeds, plus optional proactive alerts. Runs as a long-lived process on Render.

## Live deployment

- **Dashboard**: https://iut-techathon-hackathon.vercel.app/
- **Discord bot host**: https://iuttechathonhackathondiscord.onrender.com/
- **GitHub repo**: https://github.com/SMAZY0210/IUTTechathonHackathonDiscord
- **Invite the bot to your server**: https://discord.com/oauth2/authorize?client_id=1522767627334717471&integration_type=0&scope=applications.commands

---

## Prerequisites

- **Node.js 18 or newer**, check with `node -v`. Get it from https://nodejs.org.
- **Git** (to clone), or just download the project as a ZIP.
- For the Discord bot: a **Discord account** and a **server where you can add bots** (you need the *Manage Server* permission).

---

## 1. Get the code

**Option A, clone with Git:**

```bash
git clone https://github.com/SMAZY0210/IUTTechathonHackathonDiscord
cd office-monitor
```

**Option B, download the ZIP**, then unzip it and `cd` into the folder.

The project has four parts:

```
office-monitor/
├── backend/      REST API + simulator (also serves the dashboard locally)
│   └── api/      Vercel serverless entry point
├── dashboard/    the web UI (static HTML/CSS/JS, polls the backend)
├── bot/          the Discord bot
└── docs/         system diagram + hardware/circuit spec
```

---

## 2. Run the backend + dashboard

The backend serves the dashboard, so this one step gets you both.

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:3001** in your browser.

You should see the live dashboard: a power meter that updates on its own, a floor
plan with glowing lights and spinning fans, per-room power bars, an alerts panel,
and the full 15-device status grid. Use the **sun/moon button** (top-right) to
switch between dark and light themes, your choice is remembered.

The dashboard polls the backend's `/api/state` endpoint every few seconds rather
than holding a persistent connection open, so it works the same way locally and
once deployed.

> Leave this terminal running. The bot (next step) reads from it.

To use a different port: `PORT=4000 npm start`.

### How the backend runs differently depending on where it's hosted

- **Locally** (`npm start`, `backend/src/server.js`): a normal long-running Node
  process. A background timer ticks the simulator every 5 seconds.
- **On Vercel** (`backend/api/index.js`): a serverless function invoked per
  request. Since serverless instances freeze between requests, there's no
  background timer; instead the simulator "catches up" to the current time at
  the start of every request, replaying whatever ticks elapsed since the last
  request that warm instance handled.

Both paths share the same store, API routes, and simulation logic, so the two
behave identically from the outside.

---

## 3. Run the Discord bot

### 3a. Create the bot and get its token

1. Go to the **Discord Developer Portal**: https://discord.com/developers/applications
2. **New Application**, give it a name, **Create**.
3. In the sidebar, open **Bot**, **Reset Token**, **Copy**. This is your `DISCORD_TOKEN` (keep it secret).

Slash commands do **not** need the privileged "Message Content" intent, so you can
leave that off.

### 3b. Invite the bot to your server

The bot must be invited with the `bot` **and** `applications.commands` scopes, or
the slash commands won't appear. Replace `YOUR_APP_ID` (Developer Portal,
General Information, **Application ID**) and open this URL:

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot+applications.commands&permissions=68608
```

Pick your server, **Authorize**. The bot now shows up in the member list (grey
until you start it in the next step). `68608` = View Channels + Send Messages +
Read Message History.

### 3c. Configure the bot

```bash
cd bot
npm install
cp .env.example .env
```

Open `.env` and fill in:

- `DISCORD_TOKEN`: the token from step 3a (**required**).
- `GUILD_ID`: your server's ID, so commands register **instantly**. Enable
  Developer Mode (Discord Settings → Advanced), then right-click your server icon
  and **Copy Server ID**. (Leave blank to register globally, which can take about an hour.)
- `BACKEND_URL`: where the backend is running. Use `http://localhost:3001` for
  local testing, or your deployed Vercel URL (for example
  `https://iut-techathon-hackathon.vercel.app`) once the backend is live.

Optional:

- `ALERT_CHANNEL_ID`: a channel ID (right-click a channel, Copy Channel ID) to
  have the bot post alerts proactively.
- `LLM_PROVIDER`: set to `anthropic` or `openai` with the matching API key to
  have replies phrased by an LLM. Left as `none`, the bot uses friendly built-in
  wording and needs no keys. The numbers always come from real data either way.

### 3d. Start the bot

```bash
npm start
```

You should see `Bot online as <name>` and `Registered 3 slash commands...`. In
your server, type `/` and pick `/status`, `/room` (with a room dropdown), or
`/usage`.

**No Discord token yet?** Preview exactly what the bot would reply, straight in
your terminal, with the backend running:

```bash
npm run dryrun            # or: node src/dryrun.js room work2
```

---

## Deploying it yourself

**Backend + dashboard, on Vercel:**

1. Push the repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo.
3. Leave **Root Directory** as the repo root; `vercel.json` at the root routes
   `/api/*` to the backend function and everything else to the static
   dashboard. Framework preset: **Other**, no build command needed.
4. Deploy. Check `https://your-project.vercel.app/api/health` and the root URL.

**Discord bot, on Render (or any host that can run a long-lived Node process):**

Vercel cannot host the bot; a Discord client needs a persistent connection,
which doesn't fit the serverless request/response model. Deploy `bot/` to
Render, Railway, Fly.io, or a small VPS instead, set the same environment
variables as in step 3c, and point `BACKEND_URL` at the Vercel deployment.

---

## Using it

**Dashboard** (`http://localhost:3001` locally, or the Vercel URL):
- **Live power**: total watts, refreshed on each poll, with today's kWh and a device count.
- **Floor plan**: top-view of the 3 rooms; lights glow amber when on, fans spin when running.
- **Alerts**: timestamped warnings when devices are left on.
- **Per-room power** and **Device status**: every device grouped by room.
- **Theme toggle**: sun/moon button, top-right.

**Bot** (slash commands):
- `/status`: how the whole office looks right now.
- `/room <name>`: one room in detail (pick from a dropdown).
- `/usage`: current power draw and today's usage.

**Alerts** fire when devices are on outside office hours (9 AM to 5 PM) or when a
whole room has been on for 2+ hours. They show on the dashboard and, if you set
`ALERT_CHANNEL_ID`, get posted by the bot.

---

## Running the tests

```bash
cd backend && npm test     # 11 tests: device model, alerts, store
cd bot && npm test         # 5 tests: embed builders, room resolver
```

---

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Bot crashes with **"Used disallowed intents"** | You're on an old version needing Message Content. Pull the latest (slash-command) code, it doesn't use that intent. |
| Bot isn't in the server / nothing to message | It was added without the `bot` scope. Re-invite using the URL in step 3b (with `bot`+`applications.commands`). |
| Slash commands don't show up | Make sure you invited with `applications.commands`, set `GUILD_ID` for instant registration, and restarted the bot. |
| Bot replies "I couldn't reach the office backend" | The backend isn't running, or `BACKEND_URL` is wrong. Start it locally with `cd backend && npm start`, or check your Vercel URL. |
| Dashboard shows "Reconnecting..." | The `/api/state` poll failed. Check the backend is deployed and reachable, and that CORS isn't being blocked by a browser extension. |
| `npm install` shows vulnerability warnings | They come from Discord's dependency tree, not this code. Don't run `npm audit fix --force`, it can break the bot. Safe to ignore. |
| Bot shows an **"App"** tag instead of "Bot" | Normal, Discord renamed the label in 2024. Every bot is an app. |

---

## How it maps to the brief

| Deliverable | Where |
| ----------- | ----- |
| System diagram | `docs/system-diagram.svg` |
| Circuit / schematic | `docs/HARDWARE.md` (buildable spec for Wokwi/Tinkercad) |
| Simulated, dynamic device data | `backend/src/simulator.js` + `store.js` |
| Live web dashboard | `dashboard/` (served locally at `localhost:3001`, deployed on Vercel) |
| Discord bot | `bot/` (deployed on Render) |
| Bonus, animated floor plan | dashboard floor-plan panel |
| Bonus, proactive bot alerts | `bot/src/alerts-watcher.js` |

---

## Notes

- **15 devices** (2 fans + 3 lights x 3 rooms). The brief was internally
  inconsistent (one line said 18), so this was confirmed as the physical count.
- **In-memory state**: data is simulated and ephemeral; zero setup, clean resets.
  On Vercel this resets on a cold start, the same way a local restart would.
- **Polling, not sockets**: the dashboard polls `/api/state` on an interval
  instead of holding a Socket.IO connection open. Serverless platforms freeze
  a function between requests, so a persistent socket or background timer
  wouldn't keep running there; polling works identically on both a local
  long-running server and a serverless deployment.
- **Circuit as a spec, not an exported file**: `docs/HARDWARE.md` gives the pin
  maps, wiring, and reasoning so the schematic stays yours to build in
  Wokwi/Tinkercad.
- **Dummy data**: device states are simulator-generated (the brief requires
  dynamic data). The two supplied person records aren't used, as the device model
  has no person field; they're reserved for any future sample-people field.
