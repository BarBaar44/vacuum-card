/*
 * Vacuum Card
 * One Lovelace card for a robot vacuum with a dock: what it is doing, where
 * it is cleaning and how far along, when the next clean is, the battery,
 * and whether the robot or the dock needs attention.
 *
 * Built for a Roborock Q Revo on the core Roborock integration, but every
 * entity is overridable. Status, colour, words and the attention badge are
 * worked out here in plain JS: no Jinja, no template sensors.
 *
 * The card never hardcodes service calls: the control buttons, the card's
 * tap and hold, and the badge all go through Home Assistant's own action
 * handler (hass-action), and every button can be changed or removed.
 *
 * https://github.com/BarBaar44/vacuum-card  (MIT)
 */

const VERSION = "0.1.0";

const HOLD_MS = 500;
const MOVE_TOLERANCE_PX = 10;
const TICK_MS = 30000; // refreshes "today 14:00" around midnight, past sessions and the drying countdown

const ROBOT = "roborock_q_revo";
const DEFAULTS = {
  name: "Vacuum",
  maintenance_threshold: 10, // hours
  entities: {
    vacuum: `vacuum.${ROBOT}`,
    status: `sensor.${ROBOT}_status`,
    battery: `sensor.${ROBOT}_battery`,
    charging: `binary_sensor.${ROBOT}_charging`,
    cleaning: `binary_sensor.${ROBOT}_cleaning`,
    progress: `sensor.${ROBOT}_cleaning_progress`,
    current_room: `sensor.${ROBOT}_current_room`,
    cleaning_area: `sensor.${ROBOT}_cleaning_area`,
    cleaning_time: `sensor.${ROBOT}_cleaning_time`,
    cleaning_mode: `select.living_room_${ROBOT}_cleaning_mode`,
    schedule_paused: "input_boolean.disable_vacuum_cleaner_schedule",
    vacuum_error: `sensor.${ROBOT}_vacuum_error`,
    dock_error: `sensor.${ROBOT}_dock_error`,
    water_shortage: `binary_sensor.${ROBOT}_water_shortage`,
    clean_water_box: `binary_sensor.${ROBOT}_dock_clean_water_box`,
    dirty_water_box: `binary_sensor.${ROBOT}_dock_dirty_water_box`,
    mop_attached: `binary_sensor.${ROBOT}_mop_attached`,
    water_box_attached: `binary_sensor.${ROBOT}_water_box_attached`,
    mop_drying: `binary_sensor.${ROBOT}_mop_drying`,
    mop_drying_remaining: `sensor.${ROBOT}_mop_drying_remaining_time`,
    main_brush_left: `sensor.${ROBOT}_main_brush_time_left`,
    side_brush_left: `sensor.${ROBOT}_side_brush_time_left`,
    filter_left: `sensor.${ROBOT}_filter_time_left`,
    sensor_left: `sensor.${ROBOT}_sensor_time_left`,
    dock_strainer_left: `sensor.${ROBOT}_dock_strainer_time_left`,
  },
  // Scheduler-card schedule switches: on while active, attribute next_trigger = next run.
  schedules: [
    { entity: "switch.schedule_vacuum_clean", type: "vacuum" },
    { entity: "switch.schedule_vacuum_clean_with_mop", type: "mop" },
  ],
};

/* Session types for schedules. mdi has no mop icon, so mop sessions show a water drop. */
const SESSION = {
  vacuum: { label: "Vacuum", icon: "mdi:robot-vacuum" },
  mop: { label: "Vacuum & mop", icon: "mdi:water" },
};

/* Maintenance roles, in badge order when several are equally low. */
const PARTS = {
  main_brush_left: "Main brush",
  side_brush_left: "Side brush",
  filter_left: "Filter",
  sensor_left: "Sensors",
  dock_strainer_left: "Dock strainer",
};

/* Control buttons, left to right. Each default runs a vacuum service on the vacuum entity. */
const CONTROLS = {
  start: { icon: "mdi:play", label: "Start", service: "vacuum.start" },
  pause: { icon: "mdi:pause", label: "Pause", service: "vacuum.pause" },
  return_to_base: { icon: "mdi:home-import-outline", label: "Return to dock", service: "vacuum.return_to_base" },
  locate: { icon: "mdi:map-marker-radius", label: "Locate", service: "vacuum.locate" },
};

/* Which buttons make sense in which status group. */
const SHOW_CONTROLS = {
  cleaning: ["pause", "return_to_base", "locate"],
  returning: ["start", "pause", "locate"],
  dock: ["locate"],
  paused: ["start", "return_to_base", "locate"],
  error: ["start", "return_to_base", "locate"],
  docked: ["start", "locate"],
  idle: ["start", "return_to_base", "locate"],
  offline: [],
};

/* colors key -> CSS variable and default. */
const COLORS = {
  cleaning: ["--vc-cleaning", "var(--green-color, #4caf50)"],
  returning: ["--vc-returning", "var(--blue-color, #2196f3)"],
  dock: ["--vc-dock", "var(--cyan-color, #00bcd4)"],
  paused: ["--vc-paused", "var(--amber-color, #ffc107)"],
  error: ["--vc-error", "var(--error-color, #db4437)"],
  idle: ["--vc-idle", "var(--disabled-color, #9e9e9e)"],
  badge: ["--vc-badge", "var(--amber-color, #ffc107)"],
  battery_low: ["--vc-battery-low", "var(--error-color, #db4437)"],
};

/* Status sensor value -> [group, words]. Unknown values: Title Case, group from the vacuum state. */
const STATUS = {
  starting: ["cleaning", "Starting"],
  cleaning: ["cleaning", "Cleaning"],
  spot_cleaning: ["cleaning", "Spot cleaning"],
  zoned_cleaning: ["cleaning", "Zone cleaning"],
  segment_cleaning: ["cleaning", "Room cleaning"],
  going_to_target: ["cleaning", "Going to target"],
  manual_mode: ["cleaning", "Manual mode"],
  remote_control_active: ["cleaning", "Remote control"],
  mapping: ["cleaning", "Mapping"],
  patrol: ["cleaning", "Patrolling"],
  robot_status_mopping: ["cleaning", "Mopping"],
  clean_mop_cleaning: ["cleaning", "Vacuuming and mopping"],
  clean_mop_mopping: ["cleaning", "Mopping"],
  segment_mopping: ["cleaning", "Room mopping"],
  segment_clean_mop_cleaning: ["cleaning", "Room cleaning"],
  segment_clean_mop_mopping: ["cleaning", "Room mopping"],
  zoned_mopping: ["cleaning", "Zone mopping"],
  zoned_clean_mop_cleaning: ["cleaning", "Zone cleaning"],
  zoned_clean_mop_mopping: ["cleaning", "Zone mopping"],
  returning_home: ["returning", "Returning to dock"],
  docking: ["returning", "Docking"],
  going_to_wash_the_mop: ["returning", "Going to wash the mop"],
  back_to_dock_washing_duster: ["returning", "Returning to wash the mop"],
  washing_the_mop: ["dock", "Washing the mop"],
  emptying_the_bin: ["dock", "Emptying the bin"],
  air_drying_stopping: ["dock", "Stopping mop drying"],
  attaching_the_mop: ["dock", "Attaching the mop"],
  detaching_the_mop: ["dock", "Detaching the mop"],
  paused: ["paused", "Paused"],
  error: ["error", "Error"],
  charging_problem: ["error", "Charging problem"],
  locked: ["error", "Locked"],
  charging: ["docked", "Charging"],
  charging_complete: ["docked", "Charged"],
  idle: ["idle", "Idle"],
  charger_disconnected: ["idle", "Off the dock"],
  shutting_down: ["idle", "Shutting down"],
  updating: ["docked", "Updating"],
  in_call: ["idle", "In call"],
  device_offline: ["offline", "Offline"],
};
const STATE_GROUP = {
  cleaning: "cleaning", returning: "returning", paused: "paused", error: "error",
  docked: "docked", idle: "idle",
};
const GROUP_WORDS = {
  cleaning: "Cleaning", returning: "Returning to dock", dock: "Dock busy", paused: "Paused",
  error: "Error", docked: "Docked", idle: "Idle", offline: "Offline",
};
const MODES = { vacuum: "Vacuum", vac_and_mop: "Vacuum & mop", mop: "Mop", custom: "Custom" };

/* Error words that read better than their Title Case fallback. */
const ERROR_WORDS = {
  lidar_blocked: "LiDAR blocked", nogo_zone_detected: "No-go zone detected",
  clear_water_box_hoare: "Clean water tank", dirty_water_box_hoare: "Dirty water tank",
  sink_strainer_hoare: "Strainer blocked", up_water_exception: "Water intake problem",
  drain_water_exception: "Drain problem", waste_water_tank_full: "Dirty water tank full",
  cleaning_tank_full_or_blocked: "Wash tray full or blocked", water_empty: "Clean water tank empty",
  duct_blockage: "Duct blocked", dirty_tank_latch_open: "Dirty tank latch open",
};

const BAD = ["unknown", "unavailable", "none", ""];
const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));
const key = (v) => String(v == null ? "" : v).trim().toLowerCase();
const title = (v) => {
  const s = String(v).replace(/[_.]+/g, " ").replace(/\s+/g, " ").trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
};
const sentence = (v) => {
  const k = key(v);
  if (ERROR_WORDS[k]) return ERROR_WORDS[k];
  const s = String(v).replace(/[_.]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

const STYLE = `
  :host {
${Object.values(COLORS).map(([v, d]) => `    ${v}: ${d};`).join("\n")}
    --vc-soft: var(--secondary-background-color, rgba(127,127,127,.15));
  }
  ha-card { padding: 10px 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; }
  .main { cursor: pointer; outline: none;
    -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
  .main.pressed { opacity: .7; }
  .main:focus-visible { box-shadow: 0 0 0 2px var(--primary-color); border-radius: 8px; }

  .head { display: flex; align-items: center; gap: 10px; }
  .icon {
    width: 44px; height: 44px; border-radius: 50%; flex: none;
    display: flex; align-items: center; justify-content: center;
    color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent);
    transition: background-color .3s, color .3s;
  }
  .icon ha-icon { --mdc-icon-size: 26px; display: flex; }
  .htext { min-width: 0; flex: 1; }
  .name { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { font-size: 18px; font-weight: 600; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .error .status { color: var(--c); }

  .battery { flex: none; display: none; align-items: center; gap: 2px; font-size: 14px; font-weight: 500; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
  .battery.show { display: flex; }
  .battery ha-icon { --mdc-icon-size: 20px; display: flex; color: var(--secondary-text-color); }
  .battery.charging ha-icon { color: var(--vc-cleaning); }
  .battery.low ha-icon, .battery.low span { color: var(--vc-battery-low); }

  .info { display: flex; align-items: center; gap: 6px; min-height: 16px; font-size: 12px; color: var(--secondary-text-color); }
  .info .text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .info .mode { --mdc-icon-size: 15px; display: none; flex: none; order: -1; }
  .info .mode.show { display: flex; }
  .drying { display: none; flex: none; align-items: center; gap: 3px; color: var(--vc-dock); font-variant-numeric: tabular-nums; }
  .drying.show { display: flex; }
  .drying ha-icon { --mdc-icon-size: 15px; display: flex; }

  /* Body: info line and progress or badge on the left, controls on the right. */
  .foot { display: flex; align-items: center; gap: 10px; }
  .left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .slot { min-width: 0; }
  .slot:empty, .slot.empty { display: none; }
  .prog { display: none; }
  .prog.show { display: block; }
  .bar { height: 5px; border-radius: 3px; background: var(--vc-soft); overflow: hidden; }
  .bar i { display: block; height: 100%; width: 0; background: var(--c); border-radius: 3px; transition: width .4s; }
  .pl { font-size: 11px; line-height: 14px; padding-top: 3px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }

  .badge {
    display: none; align-items: center; gap: 5px; font-size: 12px; font-weight: 500;
    padding: 4px 8px; border-radius: 8px; max-width: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden;
    color: var(--b, var(--vc-badge)); background: color-mix(in srgb, var(--b, var(--vc-badge)) 15%, transparent);
    cursor: pointer; border: none; font-family: inherit;
  }
  .badge.show { display: inline-flex; }
  .badge.err { --b: var(--vc-error); }
  .badge ha-icon { --mdc-icon-size: 15px; display: flex; flex: none; }
  .badge span { overflow: hidden; text-overflow: ellipsis; }

  .controls { display: flex; gap: 6px; flex: none; }
  .ctl {
    width: 32px; height: 32px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
    display: none; align-items: center; justify-content: center;
    background: var(--vc-soft); color: var(--primary-text-color); -webkit-tap-highlight-color: transparent;
  }
  .ctl.show { display: flex; }
  .ctl ha-icon { --mdc-icon-size: 18px; display: flex; }
  .ctl:active { transform: scale(.92); }
  .ctl:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }

  /* Driving: the robot sways a little. Unknown sensors never animate. */
  .driving .icon ha-icon { animation: drive 1.4s ease-in-out infinite; }
  @keyframes drive {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    25% { transform: translateX(-2px) rotate(-6deg); }
    75% { transform: translateX(2px) rotate(6deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .icon ha-icon { animation: none !important; }
    .icon, .bar i, .ctl { transition: none; }
    .ctl:active { transform: none; }
  }
`;

class VacuumCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._seen = Object.create(null);
    this._ids = [];
    this._tick = null;
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    const c = config || {};
    const known = ["type", "name", "entities", "schedules", "controls", "maintenance_threshold", "tap_action", "hold_action",
      "colors", "grid_options", "layout_options", "view_layout", "visibility", "card_mod"];
    for (const k of Object.keys(c)) {
      if (!known.includes(k)) throw new Error(`Unknown option '${k}'. Known: ${known.slice(1, 9).join(", ")}`);
    }
    const ent = c.entities == null ? {} : c.entities;
    if (typeof ent !== "object" || Array.isArray(ent)) throw new Error("entities must be a map, e.g. vacuum: vacuum.my_robot");
    for (const [k, v] of Object.entries(ent)) {
      if (!(k in DEFAULTS.entities)) throw new Error(`entities: unknown role '${k}'. Known: ${Object.keys(DEFAULTS.entities).join(", ")}`);
      if (v !== null && (typeof v !== "string" || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(v))) {
        throw new Error(`entities.${k}: '${v}' is not an entity id (null switches it off)`);
      }
    }
    const entities = { ...DEFAULTS.entities, ...ent };
    if (!entities.vacuum) throw new Error("entities.vacuum is required");

    let controls;
    if (c.controls === false || c.controls === null) controls = {};
    else {
      const raw = c.controls == null ? {} : c.controls;
      if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("controls must be a map of buttons, or false");
      for (const k of Object.keys(raw)) {
        if (!CONTROLS[k]) throw new Error(`controls: unknown button '${k}'. Known: ${Object.keys(CONTROLS).join(", ")}`);
        if (raw[k] !== null && raw[k] !== false && (typeof raw[k] !== "object" || Array.isArray(raw[k]))) {
          throw new Error(`controls.${k} must be a map (icon, label, tap_action), or null to remove it`);
        }
      }
      controls = {};
      for (const [k, d] of Object.entries(CONTROLS)) {
        if (raw[k] === null || raw[k] === false) continue;
        const o = raw[k] || {};
        controls[k] = {
          icon: o.icon || d.icon,
          label: o.label || d.label,
          tap_action: o.tap_action || {
            action: "perform-action", perform_action: d.service, target: { entity_id: entities.vacuum },
          },
        };
      }
    }

    const rawSched = c.schedules == null ? DEFAULTS.schedules : c.schedules;
    if (!Array.isArray(rawSched)) throw new Error("schedules must be a list of { entity, type }");
    const schedules = rawSched.map((sc, i) => {
      if (!sc || typeof sc !== "object" || Array.isArray(sc)) throw new Error(`schedules[${i}] must be a map with entity and type`);
      for (const k of Object.keys(sc)) {
        if (!["entity", "type", "icon"].includes(k)) throw new Error(`schedules[${i}]: unknown option '${k}'. Known: entity, type, icon`);
      }
      if (typeof sc.entity !== "string" || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(sc.entity)) {
        throw new Error(`schedules[${i}].entity: '${sc.entity}' is not an entity id`);
      }
      if (!SESSION[sc.type]) throw new Error(`schedules[${i}].type must be one of: ${Object.keys(SESSION).join(", ")}`);
      return { entity: sc.entity, type: sc.type, icon: sc.icon || SESSION[sc.type].icon, label: SESSION[sc.type].label };
    });

    const threshold = c.maintenance_threshold == null ? DEFAULTS.maintenance_threshold : num(c.maintenance_threshold);
    if (threshold === null || threshold < 0) throw new Error("maintenance_threshold must be a number of hours");
    if (c.colors != null && (typeof c.colors !== "object" || Array.isArray(c.colors))) {
      throw new Error("colors must be a map, e.g. cleaning: green");
    }

    this._config = {
      name: c.name || DEFAULTS.name,
      entities,
      schedules,
      controls,
      threshold,
      tap_action: c.tap_action || { action: "more-info" },
      hold_action: c.hold_action || { action: "more-info" },
      colors: c.colors || {},
    };
    this._applyColors(this._config.colors);
    this._ids = [...new Set([...Object.values(entities), ...schedules.map((x) => x.entity)].filter(Boolean))];
    this._seen = Object.create(null);
    this._build();
    if (this._hass) this._update();
  }

  _applyColors(colors) {
    Object.keys(colors).forEach((k) => {
      if (!COLORS[k]) console.warn(`vacuum-card: unknown colors key "${k}". Known: ${Object.keys(COLORS).join(", ")}`);
    });
    Object.entries(COLORS).forEach(([k, [v]]) => {
      const val = typeof colors[k] === "string" && colors[k].trim() ? colors[k].trim() : null;
      if (val) this.style.setProperty(v, val);
      else this.style.removeProperty(v);
    });
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._config) return;
    let changed = first;
    for (const id of this._ids) {
      const s = hass.states[id];
      if (s !== this._seen[id]) {
        this._seen[id] = s;
        changed = true;
      }
    }
    if (changed) this._update();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    clearInterval(this._tick);
    this._tick = setInterval(() => this._update(), TICK_MS);
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._tick = null;
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  /* ---- DOM, built once per config ---------------------------------------- */

  _build() {
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <ha-card>
        <div class="main head-area" role="button" tabindex="0">
          <div class="head">
            <div class="icon"><ha-icon icon="mdi:robot-vacuum"></ha-icon></div>
            <div class="htext"><div class="name"></div><div class="status"></div></div>
            <div class="battery"><ha-icon></ha-icon><span></span></div>
          </div>
        </div>
        <div class="foot">
          <div class="main left">
            <div class="info">
              <span class="text"></span>
              <ha-icon class="mode"></ha-icon>
              <span class="drying" title="Mop drying"><ha-icon icon="mdi:fan-clock"></ha-icon><span></span></span>
            </div>
            <div class="slot">
              <div class="prog"><div class="bar"><i></i></div><div class="pl"></div></div>
              <button class="badge"><ha-icon></ha-icon><span></span></button>
            </div>
          </div>
          <div class="controls"></div>
        </div>
      </ha-card>`;
    const $ = (s) => this.shadowRoot.querySelector(s);
    this._el = {
      card: $("ha-card"), main: $(".head-area"), left: $(".left"), icon: $(".icon ha-icon"), name: $(".name"), status: $(".status"),
      battery: $(".battery"), batteryIcon: $(".battery ha-icon"), batteryText: $(".battery span"),
      info: $(".info .text"), mode: $(".info .mode"), drying: $(".drying"), dryingText: $(".drying span"),
      foot: $(".foot"), prog: $(".prog"), fill: $(".bar i"), pl: $(".pl"),
      badge: $(".badge"), badgeIcon: $(".badge ha-icon"), badgeText: $(".badge span"),
      controls: $(".controls"),
    };
    this._el.name.textContent = this._config.name;

    this._buttons = {};
    for (const [k, b] of Object.entries(this._config.controls)) {
      const btn = document.createElement("button");
      btn.className = `ctl ${k}`;
      btn.title = b.label;
      btn.setAttribute("aria-label", b.label);
      btn.innerHTML = `<ha-icon icon="${b.icon}"></ha-icon>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._run(b.tap_action, "tap");
      });
      this._el.controls.appendChild(btn);
      this._buttons[k] = btn;
    }

    this._bindPress(this._el.main);
    this._bindPress(this._el.left);
    ["pointerdown", "pointerup", "keydown"].forEach((t) => this._el.badge.addEventListener(t, (e) => e.stopPropagation()));
    this._el.badge.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = this._el.badge.dataset.entity;
      if (id) this._run({ action: "more-info", entity: id }, "tap", id);
    });
  }

  /* ---- actions ------------------------------------------------------------ */

  _bindPress(el) {
    let timer = null;
    let start = null;
    let held = false;
    const cancel = () => {
      clearTimeout(timer);
      timer = null;
      start = null;
      el.classList.remove("pressed");
    };
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      held = false;
      start = { x: e.clientX, y: e.clientY };
      el.classList.add("pressed");
      timer = setTimeout(() => {
        timer = null;
        held = true;
        el.classList.remove("pressed");
        this._run(this._config.hold_action, "hold");
      }, HOLD_MS);
    });
    el.addEventListener("pointermove", (e) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
    });
    el.addEventListener("pointerup", () => {
      if (!start) return;
      const wasHeld = held;
      cancel();
      if (!wasHeld) this._run(this._config.tap_action, "tap");
    });
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      this._run(this._config.tap_action, "tap");
    });
  }

  /* Hands an action to Home Assistant's own handler, like built-in cards do. */
  _run(conf, kind, entity) {
    if (!conf || conf.action === "none") return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind === "hold" ? "medium" : "light" }));
    const config = { entity: entity || this._config.entities.vacuum };
    config[kind === "hold" ? "hold_action" : "tap_action"] = conf;
    this.dispatchEvent(new CustomEvent("hass-action", {
      bubbles: true, composed: true, detail: { config, action: kind },
    }));
  }

  /* ---- state -------------------------------------------------------------- */

  _s(role) {
    const id = this._config.entities[role];
    return id && this._hass ? this._hass.states[id] : undefined;
  }

  _val(role) {
    const s = this._s(role);
    return s && !BAD.includes(key(s.state)) ? s.state : null;
  }

  _on(role) {
    const s = this._s(role);
    return !!s && s.state === "on";
  }

  _off(role) {
    const s = this._s(role);
    return !!s && s.state === "off";
  }

  _lang() {
    const h = this._hass;
    return (h && h.locale && h.locale.language) || (h && h.language) || "en";
  }

  _fmt(ms, opts) {
    const tz = this._hass && this._hass.config && this._hass.config.time_zone;
    try {
      return new Intl.DateTimeFormat(this._lang(), tz ? { ...opts, timeZone: tz } : opts).format(new Date(ms));
    } catch (_) {
      return new Intl.DateTimeFormat("en-GB", opts).format(new Date(ms));
    }
  }

  /* Calendar day in HA's time zone, as YYYY-MM-DD, for today / tomorrow. */
  _day(ms) {
    return this._fmt(ms, { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  /* "today 14:00", "tomorrow 02:30", "Fri 14:00" */
  _when(ms) {
    const time = this._fmt(ms, { hour: "2-digit", minute: "2-digit", hour12: false });
    const now = Date.now();
    if (this._day(ms) === this._day(now)) return `today ${time}`;
    if (this._day(ms) === this._day(now + 86400000)) return `tomorrow ${time}`;
    return `${this._fmt(ms, { weekday: "short" })} ${time}`;
  }

  /* The earliest future run among active schedules, or null. */
  _nextSession() {
    let best = null;
    const now = Date.now();
    for (const sc of this._config.schedules) {
      const s = this._hass.states[sc.entity];
      if (!s || s.state !== "on") continue;
      const t = Date.parse(s.attributes && s.attributes.next_trigger);
      if (isNaN(t) || t <= now) continue;
      if (!best || t < best.at) best = { ...sc, at: t };
    }
    return best;
  }

  /* Seconds, from a sensor in s, min or h. The sensor's own unit wins over the default. */
  _seconds(role, defaultUnit) {
    const s = this._s(role);
    const n = s && !BAD.includes(key(s.state)) ? num(s.state) : null;
    if (n === null) return null;
    const unit = key((s.attributes && s.attributes.unit_of_measurement) || defaultUnit);
    if (unit === "min") return n * 60;
    if (unit === "h") return n * 3600;
    return n;
  }

  /* Status group, words and icon, from the status sensor with the vacuum state as fallback. */
  _status() {
    const vac = this._s("vacuum");
    const vstate = vac ? key(vac.state) : "unavailable";
    const raw = this._val("status");
    const mapped = raw ? STATUS[key(raw)] : null;
    let group = mapped ? mapped[0] : STATE_GROUP[vstate] || (BAD.includes(vstate) ? "offline" : "idle");
    let words = mapped ? mapped[1] : raw ? title(raw) : GROUP_WORDS[group];
    if (vstate === "error" && group !== "error") {
      group = "error";
      words = "Error";
    }
    if (!vac || vstate === "unavailable") {
      group = "offline";
      words = "Offline";
    }
    // Roborock keeps reporting "charging" on the dock at 100 %: that is charged.
    if (key(raw) === "charging" && group === "docked" && num(this._val("battery")) >= 100) words = STATUS.charging_complete[1];
    // Drying runs for hours after a clean while the status says charged.
    if ((group === "docked" || group === "idle") && this._on("mop_drying")) {
      group = "dock";
      words = "Drying the mop";
    }
    let icon = "mdi:robot-vacuum";
    if (group === "error") icon = "mdi:robot-vacuum-alert";
    else if (group === "offline") icon = "mdi:robot-vacuum-off";
    return { group, words, icon };
  }

  /* One badge, first match wins. Returns [icon, text, role, isError] or null. */
  _badge() {
    const ve = this._val("vacuum_error");
    if (ve && key(ve) !== "none") return ["mdi:alert-circle-outline", `Error: ${sentence(ve)}`, "vacuum_error", true];
    const de = this._val("dock_error");
    if (de && key(de) !== "ok") return ["mdi:home-alert", `Dock: ${sentence(de)}`, "dock_error", true];
    if (this._on("water_shortage")) return ["mdi:water-off", "Water shortage", "water_shortage"];
    if (this._on("clean_water_box")) return ["mdi:water-off", "Refill clean water tank", "clean_water_box"];
    if (this._on("dirty_water_box")) return ["mdi:water-alert", "Empty dirty water tank", "dirty_water_box"];
    if (this._off("mop_attached")) return ["mdi:alert-circle-outline", "Mop missing", "mop_attached"];
    if (this._off("water_box_attached")) return ["mdi:alert-circle-outline", "Water box missing", "water_box_attached"];
    let worst = null;
    for (const [role, label] of Object.entries(PARTS)) {
      const s = this._s(role);
      let h = s ? num(s.state) : null;
      if (h === null) continue;
      const unit = key(s.attributes && s.attributes.unit_of_measurement);
      if (unit === "min") h /= 60;
      else if (unit === "s") h /= 3600;
      if (h < this._config.threshold && (!worst || h < worst.h)) worst = { h, role, label };
    }
    if (worst) {
      const left = worst.h <= 0 ? "due" : `${Math.max(1, Math.round(worst.h))} h left`;
      return ["mdi:wrench-clock", `${worst.label}: ${left}`, worst.role];
    }
    return null;
  }

  _battery() {
    const b = num(this._val("battery"));
    if (b === null) return null;
    // The charging sensor stays on for as long as the robot is docked, also when full.
    const charging = (this._on("charging") || key(this._val("status")) === "charging") && b < 100;
    const step = Math.min(100, Math.max(0, Math.round(b / 10) * 10));
    let icon;
    if (charging) icon = step >= 100 ? "mdi:battery-charging-100" : step <= 0 ? "mdi:battery-charging-outline" : `mdi:battery-charging-${step}`;
    else icon = step >= 100 ? "mdi:battery" : step <= 0 ? "mdi:battery-outline" : `mdi:battery-${step}`;
    return { level: Math.round(b), icon, charging, low: !charging && b <= 20 };
  }

  _update() {
    if (!this._hass || !this._el) return;
    const e = this._el;
    const st = this._status();
    const g = st.group;

    e.card.style.setProperty("--c", `var(${COLORS[g === "docked" || g === "offline" ? "idle" : g][0]})`);
    e.card.classList.toggle("error", g === "error");
    e.card.classList.toggle("driving", g === "cleaning" || g === "returning");
    if (e.icon.getAttribute("icon") !== st.icon) e.icon.setAttribute("icon", st.icon);
    if (e.status.textContent !== st.words) e.status.textContent = st.words;
    e.main.setAttribute("aria-label", `${this._config.name}: ${st.words}`);

    // Battery
    const bat = this._battery();
    e.battery.classList.toggle("show", !!bat);
    if (bat) {
      e.battery.classList.toggle("charging", bat.charging);
      e.battery.classList.toggle("low", bat.low);
      e.batteryIcon.setAttribute("icon", bat.icon);
      e.batteryText.textContent = `${bat.level}%`;
      e.battery.title = bat.charging ? "Charging" : "Battery";
    }

    // Info line
    let info = "";
    let modeIcon = null;
    // A session is under way while cleaning or paused, and during trips to the dock mid-session.
    const active = g === "cleaning" || g === "paused" || (g === "returning" && this._on("cleaning"));
    if (active) {
      const room = this._val("current_room");
      const mode = this._val("cleaning_mode");
      info = [room, mode ? MODES[key(mode)] || title(mode) : null].filter(Boolean).join(" · ");
    } else if (this._on("schedule_paused")) {
      info = "Schedule paused";
    } else if (this._config.schedules.length) {
      const next = this._nextSession();
      if (next) {
        info = `Next: ${next.label} · ${this._when(next.at)}`;
        modeIcon = next.icon;
        e.mode.title = next.label;
      } else {
        info = "No session planned";
      }
    }
    if (e.info.textContent !== info) e.info.textContent = info;
    e.mode.classList.toggle("show", !!modeIcon);
    if (modeIcon && e.mode.getAttribute("icon") !== modeIcon) e.mode.setAttribute("icon", modeIcon);

    // Mop drying countdown
    const drySec = this._on("mop_drying") ? this._seconds("mop_drying_remaining", "s") : null;
    const dryLeft = drySec !== null ? this._dryLeft(drySec) : null;
    e.drying.classList.toggle("show", dryLeft !== null);
    if (dryLeft !== null) e.dryingText.textContent = dryLeft;

    // Progress while cleaning, else the badge in the same place.
    const showProg = g === "cleaning" || g === "paused";
    e.prog.classList.toggle("show", showProg);
    if (showProg) {
      const pct = num(this._val("progress"));
      const area = num(this._val("cleaning_area"));
      const secs = this._seconds("cleaning_time", "min");
      e.fill.style.width = `${pct === null ? 0 : Math.max(0, Math.min(100, Math.round(pct)))}%`;
      const minText = secs === null ? null : `${Math.round(secs / 60)} min`;
      e.pl.textContent = [pct !== null ? `${Math.round(pct)}%` : null, area !== null ? `${Math.round(area)} m²` : null, minText]
        .filter(Boolean).join(" · ");
    }
    const badge = showProg ? null : this._badge();
    e.badge.classList.toggle("show", !!badge);
    if (badge) {
      e.badgeIcon.setAttribute("icon", badge[0]);
      e.badgeText.textContent = badge[1];
      e.badge.classList.toggle("err", !!badge[3]);
      e.badge.dataset.entity = this._config.entities[badge[2]] || "";
      e.badge.title = badge[1];
    }

    // Controls that make sense right now
    const allowed = SHOW_CONTROLS[g] || [];
    let any = false;
    for (const [k, btn] of Object.entries(this._buttons)) {
      const show = allowed.includes(k);
      btn.classList.toggle("show", show);
      any = any || show;
    }
    if (this._buttons.start) {
      const label = g === "paused" ? "Resume" : this._config.controls.start.label;
      this._buttons.start.title = label;
      this._buttons.start.setAttribute("aria-label", label);
    }
    this.shadowRoot.querySelector(".slot").classList.toggle("empty", !showProg && !badge);
  }

  /* Remaining drying time as h:mm, counted down from when the sensor last reported. */
  _dryLeft(sec) {
    const s = this._s("mop_drying_remaining");
    const at = s && s.last_updated ? Date.parse(s.last_updated) : NaN;
    const left = isNaN(at) ? sec : sec - (Date.now() - at) / 1000;
    const m = Math.max(0, Math.ceil(left / 60));
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  }
}

if (!customElements.get("vacuum-card")) {
  customElements.define("vacuum-card", VacuumCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "vacuum-card")) {
  window.customCards.push({
    type: "vacuum-card",
    name: "Vacuum Card",
    description: "Robot vacuum with dock: status, room and progress, next clean, battery, attention badge and controls.",
    preview: true,
    documentationURL: "https://github.com/BarBaar44/vacuum-card",
  });
}

console.info(`%c VACUUM-CARD %c ${VERSION} `, "background:#2196f3;color:#fff", "");
