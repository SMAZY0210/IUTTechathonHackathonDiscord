/* =========================================================================
   Office Power Monitor — dashboard client
   Polls the backend's /api/state endpoint on an interval and re-renders on
   every snapshot. Plain fetch rather than a persistent socket, so this works
   the same way locally and on serverless hosts like Vercel.
   ========================================================================= */

// Full office = 6 fans x 60W + 9 lights x 15W. Used to scale the hero bar.
const OFFICE_MAX_WATTS = 6 * 60 + 9 * 15; // 495

// Fixture positions within a room cell (percent). Lights across the top,
// fans in the middle — assigned by device type + its index in the room.
const LIGHT_POS = [
  { x: 24, y: 24 },
  { x: 50, y: 20 },
  { x: 76, y: 24 },
];
const FAN_POS = [
  { x: 34, y: 56 },
  { x: 66, y: 56 },
];

// Simple 3-blade ceiling-fan SVG (rotated via CSS when running).
const FAN_SVG = `
  <svg class="fan__blades" viewBox="0 0 100 100" aria-hidden="true">
    <g fill="currentColor">
      <path d="M50 50 C58 30 58 14 50 8 C42 14 42 30 50 50 Z" transform="rotate(0 50 50)"/>
      <path d="M50 50 C58 30 58 14 50 8 C42 14 42 30 50 50 Z" transform="rotate(120 50 50)"/>
      <path d="M50 50 C58 30 58 14 50 8 C42 14 42 30 50 50 Z" transform="rotate(240 50 50)"/>
    </g>
    <circle class="fan__hub" cx="50" cy="50" r="5.5" stroke="currentColor" stroke-width="2"/>
  </svg>`;

const WARN_SVG = `
  <svg class="alert__icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
  </svg>`;

// ---- element cache ----
const el = {
  conn: document.getElementById("conn"),
  connLabel: document.getElementById("conn-label"),
  clock: document.getElementById("clock"),
  totalWatts: document.getElementById("total-watts"),
  loadFill: document.getElementById("load-fill"),
  todayKwh: document.getElementById("today-kwh"),
  devicesOn: document.getElementById("devices-on"),
  floorplan: document.getElementById("floorplan"),
  rooms: document.getElementById("rooms"),
  alerts: document.getElementById("alerts"),
  alertCount: document.getElementById("alert-count"),
  devices: document.getElementById("devices"),
  lastUpdate: document.getElementById("last-update"),
};

let builtLayout = false; // build the static scaffold once, then only toggle

// ---- clock ----
setInterval(() => {
  el.clock.textContent = new Date().toLocaleTimeString();
}, 1000);

// ---- theme toggle (persisted; initial theme is set in <head> before paint) ----
const SUN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>`;
const themeToggle = document.getElementById("theme-toggle");

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}
function paintToggle(theme) {
  // Show the icon for the mode you'll switch TO.
  themeToggle.innerHTML = theme === "light" ? MOON_ICON : SUN_ICON;
  themeToggle.setAttribute(
    "aria-label",
    theme === "light" ? "Switch to dark mode" : "Switch to light mode",
  );
}
paintToggle(currentTheme());
themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  paintToggle(next);
  try {
    localStorage.setItem("opm-theme", next);
  } catch (e) {}
});

// ---- connection status ----
function setConn(label, cls) {
  el.connLabel.textContent = label;
  el.conn.classList.remove("is-live", "is-down");
  el.conn.classList.add(cls);
}

// ---- the one function that drives everything ----
function applySnapshot(snapshot) {
  if (!builtLayout) {
    buildFloorplan(snapshot.devices);
    buildRoomBars(snapshot.summary);
    buildDeviceGroups(snapshot.devices);
    builtLayout = true;
  }
  renderMeter(snapshot.summary, snapshot.usage);
  renderFloorplan(snapshot.devices, snapshot.summary);
  renderRoomBars(snapshot.summary);
  renderDevices(snapshot.devices);
  renderAlerts(snapshot.alerts);
  el.lastUpdate.textContent =
    "Updated " + new Date(snapshot.timestamp).toLocaleTimeString();
}

// ---- poll the backend on an interval ----
const POLL_MS = 4000;

async function pollState() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    applySnapshot(await res.json());
    setConn("Live", "is-live");
  } catch (err) {
    setConn("Reconnecting…", "is-down");
  } finally {
    setTimeout(pollState, POLL_MS);
  }
}
setConn("Connecting…", "is-down");
pollState();

// ---- hero meter ----
function renderMeter(summary, usage) {
  el.totalWatts.textContent = summary.totalWatts;
  el.devicesOn.textContent = summary.counts.on;
  el.todayKwh.textContent = usage.todayKwh.toFixed(2);
  const pct = Math.min(100, (summary.totalWatts / OFFICE_MAX_WATTS) * 100);
  el.loadFill.style.width = pct + "%";
}

// ---- floor plan (built once, then class toggles) ----
function roomsFromDevices(devices) {
  const order = ["drawing", "work1", "work2"];
  const map = new Map();
  for (const d of devices) {
    if (!map.has(d.room)) map.set(d.room, { id: d.room, name: d.roomName, devices: [] });
    map.get(d.room).devices.push(d);
  }
  return order.filter((id) => map.has(id)).map((id) => map.get(id));
}

function buildFloorplan(devices) {
  el.floorplan.innerHTML = "";
  for (const room of roomsFromDevices(devices)) {
    const cell = document.createElement("div");
    cell.className = "room";
    cell.dataset.room = room.id;

    // quiet furniture hints
    cell.appendChild(furniture(room.id));

    let lightIdx = 0;
    let fanIdx = 0;
    for (const d of room.devices) {
      const node = document.createElement("div");
      node.className = `fixture ${d.type}`;
      node.dataset.id = d.id;
      node.title = `${d.roomName} — ${d.label}`;
      const pos =
        d.type === "light" ? LIGHT_POS[lightIdx++ % 3] : FAN_POS[fanIdx++ % 2];
      node.style.left = pos.x + "%";
      node.style.top = pos.y + "%";
      if (d.type === "fan") node.innerHTML = FAN_SVG;
      cell.appendChild(node);
    }

    const label = document.createElement("span");
    label.className = "room__label";
    label.textContent = room.name;
    cell.appendChild(label);

    const watts = document.createElement("span");
    watts.className = "room__watts";
    watts.dataset.roomWatts = room.id;
    watts.textContent = "0 W";
    cell.appendChild(watts);

    el.floorplan.appendChild(cell);
  }
}

function furniture(roomId) {
  const wrap = document.createDocumentFragment();
  const add = (x, y, w, h) => {
    const f = document.createElement("div");
    f.className = "furniture";
    f.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%;`;
    wrap.appendChild(f);
  };
  if (roomId === "drawing") {
    add(12, 74, 44, 12); // sofa
    add(64, 76, 20, 10); // chair
  } else {
    add(14, 76, 20, 12); // desks
    add(64, 76, 20, 12);
  }
  const container = document.createElement("div");
  container.appendChild(wrap);
  return container;
}

function renderFloorplan(devices, summary) {
  for (const d of devices) {
    const node = el.floorplan.querySelector(`[data-id="${d.id}"]`);
    if (node) node.classList.toggle("on", d.status === "on");
  }
  for (const [roomId, data] of Object.entries(summary.perRoom)) {
    const w = el.floorplan.querySelector(`[data-room-watts="${roomId}"]`);
    if (w) w.textContent = data.watts + " W";
  }
}

// ---- per-room bars ----
const ROOM_MAX_WATTS = 2 * 60 + 3 * 15; // 165 per room

function buildRoomBars(summary) {
  el.rooms.innerHTML = "";
  for (const [roomId, data] of Object.entries(summary.perRoom)) {
    const row = document.createElement("div");
    row.className = "roomrow";
    row.innerHTML = `
      <div class="roomrow__top">
        <span class="roomrow__name">${data.name}</span>
        <span class="roomrow__val" data-room-val="${roomId}">0 W</span>
      </div>
      <div class="roomrow__bar"><div class="roomrow__fill" data-room-fill="${roomId}"></div></div>`;
    el.rooms.appendChild(row);
  }
}

function renderRoomBars(summary) {
  for (const [roomId, data] of Object.entries(summary.perRoom)) {
    const val = el.rooms.querySelector(`[data-room-val="${roomId}"]`);
    const fill = el.rooms.querySelector(`[data-room-fill="${roomId}"]`);
    if (val) val.textContent = data.watts + " W";
    if (fill) fill.style.width = Math.min(100, (data.watts / ROOM_MAX_WATTS) * 100) + "%";
  }
}

// ---- device status groups ----
function buildDeviceGroups(devices) {
  el.devices.innerHTML = "";
  for (const room of roomsFromDevices(devices)) {
    const group = document.createElement("div");
    group.className = "devgroup";
    const name = document.createElement("div");
    name.className = "devgroup__name";
    name.textContent = room.name;
    group.appendChild(name);

    const list = document.createElement("div");
    list.className = "devgroup__list";
    for (const d of room.devices) {
      const row = document.createElement("div");
      row.className = "dev";
      row.dataset.id = d.id;
      row.innerHTML = `
        <span class="dev__dot"></span>
        <span class="dev__label">${d.label}</span>
        <span class="dev__state" data-state="${d.id}">off</span>`;
      list.appendChild(row);
    }
    group.appendChild(list);
    el.devices.appendChild(group);
  }
}

function renderDevices(devices) {
  for (const d of devices) {
    const row = el.devices.querySelector(`.dev[data-id="${d.id}"]`);
    const state = el.devices.querySelector(`[data-state="${d.id}"]`);
    if (row) row.classList.toggle("on", d.status === "on");
    if (state) state.textContent = d.status;
  }
}

// ---- alerts ----
function renderAlerts(alerts) {
  el.alertCount.textContent = alerts.length;
  el.alertCount.classList.toggle("is-hot", alerts.length > 0);

  if (alerts.length === 0) {
    el.alerts.innerHTML =
      '<li class="alerts__empty">All clear — nothing left on out of hours.</li>';
    return;
  }
  el.alerts.innerHTML = "";
  for (const a of alerts) {
    const li = document.createElement("li");
    li.className = "alert";
    const time = new Date(a.timestamp).toLocaleTimeString();
    li.innerHTML = `
      ${WARN_SVG}
      <div>
        <div class="alert__msg">${a.message}</div>
        <span class="alert__time">${time}</span>
      </div>`;
    el.alerts.appendChild(li);
  }
}
