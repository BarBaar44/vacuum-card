// Tests for vacuum-card.js in a simulated browser. Run: npm test
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const dom = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", pretendToBeVisual: true });
const w = dom.window;
w.eval(fs.readFileSync(path.join(__dirname, "..", "vacuum-card.js"), "utf8"));
const Card = w.customElements.get("vacuum-card");
assert(Card, "registered");

const R = "roborock_q_revo";
const VAC = `vacuum.${R}`;
const st = (state, attributes = {}, last_updated) =>
  ({ state: String(state), attributes, last_changed: "x", last_updated: last_updated || new Date().toISOString() });

/* A docked, charged robot with nothing to report; override what a test needs. */
const base = (o = {}) => ({
  [VAC]: st(o.vac || "docked"),
  [`sensor.${R}_status`]: st(o.status || "charging_complete"),
  [`sensor.${R}_battery`]: st(o.bat ?? 100, { unit_of_measurement: "%" }),
  [`binary_sensor.${R}_charging`]: st(o.charging || "off"),
  [`binary_sensor.${R}_cleaning`]: st(o.cleaning || "off"),
  [`sensor.${R}_cleaning_progress`]: st(o.pct ?? 0),
  [`sensor.${R}_current_room`]: st(o.room || "unknown"),
  [`sensor.${R}_cleaning_area`]: st(o.area ?? 42, { unit_of_measurement: "m²" }),
  [`sensor.${R}_cleaning_time`]: st(o.time ?? 38, o.timeUnit === null ? {} : { unit_of_measurement: o.timeUnit || "min" }),
  [`select.living_room_${R}_cleaning_mode`]: st(o.mode || "vac_and_mop"),
  "switch.schedule_vacuum_clean": st(o.vacSched || "off", o.vacAt === undefined ? {} : { next_trigger: o.vacAt }),
  "switch.schedule_vacuum_clean_with_mop": st(o.mopSched || "off", o.mopAt === undefined ? {} : { next_trigger: o.mopAt }),
  "input_boolean.disable_vacuum_cleaner_schedule": st(o.paused || "off"),
  [`sensor.${R}_vacuum_error`]: st(o.verr || "none"),
  [`sensor.${R}_dock_error`]: st(o.derr || "ok"),
  [`binary_sensor.${R}_water_shortage`]: st(o.short || "off"),
  [`binary_sensor.${R}_dock_clean_water_box`]: st(o.cleanBox || "off"),
  [`binary_sensor.${R}_dock_dirty_water_box`]: st(o.dirty || "off"),
  [`binary_sensor.${R}_mop_attached`]: st(o.mop || "on"),
  [`binary_sensor.${R}_water_box_attached`]: st(o.waterBox || "on"),
  [`binary_sensor.${R}_mop_drying`]: st(o.drying || "off"),
  [`sensor.${R}_mop_drying_remaining_time`]: st(o.dryLeft ?? 0, { unit_of_measurement: "s" }),
  [`sensor.${R}_main_brush_time_left`]: st(o.mainBrush ?? 200, { unit_of_measurement: "h" }),
  [`sensor.${R}_side_brush_time_left`]: st(o.sideBrush ?? 150, { unit_of_measurement: "h" }),
  [`sensor.${R}_filter_time_left`]: st(o.filter ?? 120, { unit_of_measurement: "h" }),
  [`sensor.${R}_sensor_time_left`]: st(o.sensors ?? 30, { unit_of_measurement: "h" }),
  [`sensor.${R}_dock_strainer_time_left`]: st(o.strainer ?? 60, { unit_of_measurement: "h" }),
});
const hass = (states) => ({ states, language: "en", locale: { language: "en" }, config: { time_zone: "UTC" } });

const cards = [];
function render(states, config = {}) {
  const c = new Card();
  w.document.body.appendChild(c);
  cards.push(c);
  c.setConfig(config);
  c.hass = hass(states);
  return c;
}
/* What the card shows. */
function read(c) {
  const e = c._el;
  const shown = (el) => el.classList.contains("show");
  return {
    status: e.status.textContent,
    icon: e.icon.getAttribute("icon"),
    colour: e.card.style.getPropertyValue("--c"),
    driving: e.card.classList.contains("driving"),
    info: e.info.textContent,
    mode: shown(e.mode) ? e.mode.getAttribute("icon") : null,
    drying: shown(e.drying) ? e.dryingText.textContent : null,
    prog: shown(e.prog) ? e.pl.textContent : null,
    width: e.fill.style.width,
    badge: shown(e.badge) ? e.badgeText.textContent : null,
    badgeErr: e.badge.classList.contains("err"),
    badgeEntity: e.badge.dataset.entity,
    battery: shown(e.battery) ? e.batteryText.textContent : null,
    batteryIcon: e.batteryIcon.getAttribute("icon"),
    charging: e.battery.classList.contains("charging"),
    low: e.battery.classList.contains("low"),
    controls: Object.entries(c._buttons).filter(([, b]) => shown(b)).map(([k]) => k),
  };
}
const col = (k) => `var(--vc-${k})`;
const v = (states, config) => read(render(states, config));

/* ---- status groups ----------------------------------------------------------- */

let r = v(base({ vac: "cleaning", status: "segment_cleaning", bat: 72, pct: 45, room: "Living Room", area: 24, time: 18 }));
assert.equal(r.status, "Room cleaning");
assert.equal(r.colour, col("cleaning"));
assert(r.driving, "drives while cleaning");
assert.equal(r.info, "Living Room · Vacuum & mop");
assert.equal(r.prog, "45% · 24 m² · 18 min");
assert.equal(r.width, "45%");
assert.equal(r.badge, null, "no badge while cleaning");
assert.deepEqual(r.controls, ["pause", "return_to_base", "locate"]);
assert.equal(r.battery, "72%");
assert.equal(r.batteryIcon, "mdi:battery-70");

r = v(base({ vac: "cleaning", status: "cleaning", mode: "mop", time: 1200, timeUnit: "s" }));
assert.equal(r.info, "Mop", "no room: mode only");
assert.match(r.prog, /20 min$/, "cleaning time in seconds is converted");

r = v(base({ vac: "returning", status: "returning_home", bat: 31 }));
assert.equal(r.status, "Returning to dock");
assert.equal(r.colour, col("returning"));
assert(r.driving);
assert.equal(r.prog, null);
assert.deepEqual(r.controls, ["start", "pause", "locate"]);

r = v(base({ vac: "docked", status: "washing_the_mop" }));
assert.equal(r.status, "Washing the mop");
assert.equal(r.colour, col("dock"));
assert(!r.driving);
assert.deepEqual(r.controls, ["locate"]);

r = v(base({ vac: "docked", status: "emptying_the_bin" }));
assert.equal(r.status, "Emptying the bin");
assert.equal(r.colour, col("dock"));

r = v(base({ drying: "on", dryLeft: 8100 }));
assert.equal(r.status, "Drying the mop", "drying wins over Charged");
assert.equal(r.colour, col("dock"));
assert.equal(r.drying, "2:15");

r = v(base({ vac: "paused", status: "paused", pct: 60, room: "Kitchen" }));
assert.equal(r.status, "Paused");
assert.equal(r.colour, col("paused"));
assert(!r.driving);
assert.equal(r.prog, "60% · 42 m² · 38 min");
assert.deepEqual(r.controls, ["start", "return_to_base", "locate"]);
assert.equal(cards.at(-1)._buttons.start.title, "Resume");

r = v(base({ vac: "error", status: "error", verr: "main_brush_jammed" }));
assert.equal(r.status, "Error");
assert.equal(r.colour, col("error"));
assert.equal(r.icon, "mdi:robot-vacuum-alert");
assert.deepEqual(r.controls, ["start", "return_to_base", "locate"]);

r = v(base({ vac: "error", status: "charging" }));
assert.equal(r.status, "Error", "vacuum state error wins over the status sensor");

r = v(base({ status: "charging", charging: "on", bat: 88 }));
assert.equal(r.status, "Charging");
assert.equal(r.colour, col("idle"));
assert(r.charging);
assert.equal(r.batteryIcon, "mdi:battery-charging-90");
assert.deepEqual(r.controls, ["start", "locate"]);

r = v(base({ vac: "idle", status: "idle", bat: 15 }));
assert.equal(r.status, "Idle");
assert(r.low, "low battery when not charging");
assert.deepEqual(r.controls, ["start", "return_to_base", "locate"]);

r = v(base({ status: "some_new_state" }));
assert.equal(r.status, "Some New State", "unknown status: Title Case");
assert.equal(r.colour, col("idle"), "group from the vacuum state");

r = v(base({ vac: "cleaning", status: "unknown" }));
assert.equal(r.status, "Cleaning", "status unknown: words from the vacuum state");

r = v(base({ vac: "unavailable" }));
assert.equal(r.status, "Offline");
assert.equal(r.icon, "mdi:robot-vacuum-off");
assert.deepEqual(r.controls, []);

/* ---- upcoming session --------------------------------------------------------- */

const now = new Date();
const at = (h, m, days = 0) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, h, m)).toISOString();
const later = (min) => new Date(Date.now() + min * 60e3).toISOString();
const soon = later(5); // safely in the future whatever the time of day

// earliest of two active schedules wins, with its own type
r = v(base({ vacSched: "on", vacAt: at(9, 0, 3), mopSched: "on", mopAt: at(1, 0, 1) }));
assert.equal(r.info, "Next: Vacuum & mop · tomorrow 01:00");
assert.equal(r.mode, "mdi:water");
r = v(base({ vacSched: "on", vacAt: at(1, 0, 1), mopSched: "on", mopAt: at(9, 0, 3) }));
assert.equal(r.info, "Next: Vacuum · tomorrow 01:00");
assert.equal(r.mode, "mdi:robot-vacuum");

// one schedule off: the earlier but switched-off one is skipped
r = v(base({ vacSched: "off", vacAt: at(1, 0, 1), mopSched: "on", mopAt: at(9, 0, 3) }));
assert.match(r.info, /^Next: Vacuum & mop · [A-Z][a-z]{2} 09:00$/, "further away: short weekday");

// both off
r = v(base({ vacSched: "off", vacAt: at(1, 0, 1), mopSched: "off", mopAt: at(2, 0, 1) }));
assert.equal(r.info, "No session planned");
assert.equal(r.mode, null);

// paused wins over active schedules
r = v(base({ vacSched: "on", vacAt: at(1, 0, 1), paused: "on" }));
assert.equal(r.info, "Schedule paused");
assert.equal(r.mode, null);

// next_trigger missing, invalid or in the past
r = v(base({ vacSched: "on", mopSched: "on" }));
assert.equal(r.info, "No session planned", "missing next_trigger");
r = v(base({ vacSched: "on", vacAt: "not a time", mopSched: "on", mopAt: later(-60) }));
assert.equal(r.info, "No session planned", "invalid or past");
r = v(base({ vacSched: "on", vacAt: later(-60), mopSched: "on", mopAt: at(1, 0, 1) }));
assert.equal(r.info, "Next: Vacuum & mop · tomorrow 01:00", "past one skipped, future one shown");

// today / tomorrow / weekday, in HA's time zone
r = v(base({ vacSched: "on", vacAt: soon }));
const todayExpected = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(soon));
const soonIsTomorrow = new Date(soon).getUTCDate() !== now.getUTCDate();
assert.equal(r.info, `Next: Vacuum · ${soonIsTomorrow ? "tomorrow" : "today"} ${todayExpected}`);
r = v(base({ vacSched: "on", vacAt: at(2, 30, 1) }));
assert.equal(r.info, "Next: Vacuum · tomorrow 02:30");
{
  // Amsterdam: 23:30 UTC the day after tomorrow is already the next local day
  const c = new Card();
  w.document.body.appendChild(c);
  cards.push(c);
  c.setConfig({});
  const h = hass(base({ vacSched: "on", vacAt: at(23, 30, 5) }));
  h.config.time_zone = "Europe/Amsterdam";
  c.hass = h;
  assert.match(read(c).info, /^Next: Vacuum · [A-Z][a-z]{2} 0[01]:30$/, "time in HA's zone");
}

// shown while returning after a session, not during a mid-session trip to the dock
r = v(base({ vac: "returning", status: "returning_home", vacSched: "on", vacAt: at(1, 0, 1) }));
assert.equal(r.info, "Next: Vacuum · tomorrow 01:00");
r = v(base({ vac: "returning", status: "going_to_wash_the_mop", cleaning: "on", room: "Hall", vacSched: "on", vacAt: at(1, 0, 1) }));
assert.equal(r.info, "Hall · Vacuum & mop");
// hidden while cleaning
r = v(base({ vac: "cleaning", status: "cleaning", room: "Hall", vacSched: "on", vacAt: at(1, 0, 1) }));
assert.equal(r.info, "Hall · Vacuum & mop");

// custom schedule list and icon; no schedules: nothing
r = v(base({ vacSched: "on", vacAt: at(1, 0, 1) }), { schedules: [{ entity: "switch.schedule_vacuum_clean", type: "mop", icon: "mdi:spray-bottle" }] });
assert.equal(r.info, "Next: Vacuum & mop · tomorrow 01:00");
assert.equal(r.mode, "mdi:spray-bottle");
r = v(base(), { schedules: [] });
assert.equal(r.info, "");

// a schedule switch change re-renders
{
  const states = base({ vacSched: "off", vacAt: at(1, 0, 1) });
  const c = render(states);
  assert.equal(read(c).info, "No session planned");
  c.hass = hass({ ...states, "switch.schedule_vacuum_clean": st("on", { next_trigger: at(1, 0, 1) }) });
  assert.equal(read(c).info, "Next: Vacuum · tomorrow 01:00");
  c.hass = hass({ ...states, "input_boolean.disable_vacuum_cleaner_schedule": st("on") });
  assert.equal(read(c).info, "Schedule paused");
}

/* ---- attention badges, first match wins ---------------------------------------- */

const all = { verr: "lidar_blocked", derr: "duct_blockage", short: "on", cleanBox: "on", dirty: "on", mop: "off", waterBox: "off", filter: 6 };
const order = [
  [{}, "Error: LiDAR blocked", "vacuum_error", true],
  [{ verr: "none" }, "Dock: Duct blocked", "dock_error", true],
  [{ verr: "none", derr: "ok" }, "Water shortage", "water_shortage"],
  [{ verr: "none", derr: "ok", short: "off" }, "Refill clean water tank", "dock_clean_water_box"],
  [{ verr: "none", derr: "ok", short: "off", cleanBox: "off" }, "Empty dirty water tank", "dock_dirty_water_box"],
  [{ verr: "none", derr: "ok", short: "off", cleanBox: "off", dirty: "off" }, "Mop missing", "mop_attached"],
  [{ verr: "none", derr: "ok", short: "off", cleanBox: "off", dirty: "off", mop: "on" }, "Water box missing", "water_box_attached"],
  [{ verr: "none", derr: "ok", short: "off", cleanBox: "off", dirty: "off", mop: "on", waterBox: "on" }, "Filter: 6 h left", "filter_time_left"],
];
for (const [o, text, role, err] of order) {
  r = v(base({ ...all, ...o }));
  assert.equal(r.badge, text);
  assert(r.badgeEntity.endsWith(role), `${text} -> ${role}`);
  assert.equal(r.badgeErr, !!err);
}
r = v(base({ sensors: 3, filter: 6 }));
assert.equal(r.badge, "Sensors: 3 h left", "lowest part wins");
r = v(base({ mainBrush: 0 }));
assert.equal(r.badge, "Main brush: due");
r = v(base({ filter: 12 }, ), { maintenance_threshold: 15 });
assert.equal(r.badge, "Filter: 12 h left", "configurable threshold");
r = v(base({ derr: "some_new_error" }));
assert.equal(r.badge, "Dock: Some new error");
r = v(base({ verr: "unknown", derr: "unknown" }));
assert.equal(r.badge, null, "unknown errors are not errors");
r = v(base({ vac: "cleaning", status: "cleaning", short: "on" }));
assert.equal(r.badge, null, "badge hidden while the progress shows");

/* ---- config ------------------------------------------------------------------ */

r = v(base({ dirty: "on" }), { entities: { dirty_water_box: null } });
assert.equal(r.badge, null, "null switches a part off");
assert(!cards.at(-1)._ids.includes(`binary_sensor.${R}_dock_dirty_water_box`));

r = v(base({ vac: "cleaning", status: "cleaning" }), { controls: { pause: null, return_to_base: { icon: "mdi:home" } } });
assert.deepEqual(r.controls, ["return_to_base", "locate"], "removed button");
assert.equal(cards.at(-1)._buttons.return_to_base.querySelector("ha-icon").getAttribute("icon"), "mdi:home");
r = v(base(), { controls: false });
assert.deepEqual(r.controls, []);

const bad = [
  [{ entities: { vaccum: "vacuum.x" } }, /unknown role 'vaccum'/],
  [{ entities: { battery: "battery" } }, /not an entity id/],
  [{ entities: { vacuum: null } }, /vacuum is required/],
  [{ controls: { dock: {} } }, /unknown button 'dock'/],
  [{ controls: { start: "vacuum.start" } }, /must be a map/],
  [{ controls: [] }, /controls must be a map/],
  [{ maintenance_threshold: "soon" }, /maintenance_threshold/],
  [{ schedules: "switch.x" }, /schedules must be a list/],
  [{ schedules: [{ entity: "switch.x", type: "wash" }] }, /type must be one of: vacuum, mop/],
  [{ schedules: [{ entity: "x", type: "mop" }] }, /not an entity id/],
  [{ schedules: [{ entity: "switch.x", type: "mop", when: 1 }] }, /unknown option 'when'/],
  [{ entities: { next_clean: "sensor.x" } }, /unknown role 'next_clean'/],
  [{ colors: "red" }, /colors must be a map/],
  [{ entitys: {} }, /Unknown option 'entitys'/],
];
for (const [cfg, re] of bad) assert.throws(() => new Card().setConfig(cfg), re);
assert.deepEqual(Card.getStubConfig(), {});

{
  const c = render(base(), { colors: { cleaning: "teal" } });
  assert.equal(c.style.getPropertyValue("--vc-cleaning"), "teal");
}

/* ---- re-render only for own entities ----------------------------------------- */
{
  const states = base();
  const c = render(states);
  let n = 0;
  const orig = c._update.bind(c);
  c._update = () => { n++; orig(); };
  c.hass = hass({ ...states, "sensor.other": st(1) });
  assert.equal(n, 0, "foreign entity ignored");
  c.hass = hass({ ...states, [`sensor.${R}_battery`]: st(99) });
  assert.equal(n, 1, "own entity re-renders");
}

/* ---- actions ---------------------------------------------------------------- */
{
  const c = render(base({ vac: "cleaning", status: "cleaning", short: "on" }), {
    tap_action: { action: "navigate", navigation_path: "#vacuum" },
    controls: { locate: { tap_action: { action: "perform-action", perform_action: "script.find_robot" } } },
  });
  const got = [];
  c.addEventListener("hass-action", (e) => got.push(e.detail));
  c._buttons.pause.click();
  assert.equal(got[0].action, "tap");
  assert.deepEqual(got[0].config.tap_action, { action: "perform-action", perform_action: "vacuum.pause", target: { entity_id: VAC } });
  c._buttons.locate.click();
  assert.deepEqual(got[1].config.tap_action, { action: "perform-action", perform_action: "script.find_robot" }, "overridden button");
  c._el.main.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" }));
  assert.deepEqual(got[2].config.tap_action, { action: "navigate", navigation_path: "#vacuum" });
  assert.equal(got[2].config.entity, VAC);
  assert.equal(got.length, 3, "buttons do not also fire the card tap");

  // badge opens its own sensor
  const d = render(base({ dirty: "on" }));
  const got2 = [];
  d.addEventListener("hass-action", (e) => got2.push(e.detail));
  d._el.badge.click();
  assert.equal(got2.length, 1);
  assert.equal(got2[0].config.tap_action.action, "more-info");
  assert.equal(got2[0].config.entity, `binary_sensor.${R}_dock_dirty_water_box`);

  // hold on the card: more-info on the vacuum by default
  const PE = w.PointerEvent || w.MouseEvent;
  d._el.main.dispatchEvent(new PE("pointerdown", { button: 0, clientX: 1, clientY: 1 }));
  setTimeout(() => {
    d._el.main.dispatchEvent(new PE("pointerup", { button: 0 }));
    assert.equal(got2.length, 2);
    assert.equal(got2[1].action, "hold");
    assert.deepEqual(got2[1].config.hold_action, { action: "more-info" });
    assert.equal(got2[1].config.entity, VAC);
    cards.forEach((x) => x.remove()); // stops the refresh timers
    console.log("ALL OK");
    process.exit(0);
  }, 600);
}
