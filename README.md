# Vacuum Card

![Vacuum Card](https://raw.githubusercontent.com/BarBaar44/vacuum-card/main/shot.png)

One Lovelace card for a robot vacuum with a dock: what it is doing, where it is cleaning and how far along, when the next clean is, the battery, and whether the robot or the dock needs attention. One JavaScript file, no build step, no dependencies, no card_mod, no Jinja. Built for a Roborock Q Revo on the core Roborock integration; every entity can be replaced.

* **Header:** icon, name, status in readable words, battery with a charging indicator. Colour by status group: cleaning, returning, dock work, paused, error, docked or idle.
* **While cleaning:** the current room and cleaning mode (Vacuum, Vacuum & mop, Mop), a progress bar with percentage, area and minutes so far. The robot sways a little while it drives.
* **While docked:** "Next clean today 21:30" with the mode icon, "Schedule off" when the schedule is paused, or else the last clean ("Last clean 3 h ago · 42 m²"). Times are in Home Assistant's time zone.
* **Mop drying:** a small countdown while the dock dries the mop.
* **Attention:** one badge, most important first (see below), in the progress bar's place, so the card does not grow. Tap it for the sensor behind it.
* **Controls:** Start, Pause, Return to dock and Locate, showing only the ones that make sense right now. Each is an ordinary Home Assistant action you can change or remove.
* All animations stop when the system asks for reduced motion. Re-renders only when one of its own entities changes, plus a refresh every 30 s so "3 h ago" and the drying countdown stay current.

![Animation](https://raw.githubusercontent.com/BarBaar44/vacuum-card/main/animation.gif)

## Install

HACS > three dots > Custom repositories > add `https://github.com/BarBaar44/vacuum-card`, type **Dashboard**. Install, then reload the browser.

Needs HA 2024.11 or newer.

## Use

```yaml
type: custom:vacuum-card
```

That uses the default entities below. For another robot, override what differs, and set an entity to `null` to switch that part off:

```yaml
type: custom:vacuum-card
name: Robot
entities:
  vacuum: vacuum.my_robot
  water_box_attached: null
tap_action:
  action: navigate
  navigation_path: "#vacuum"
```

A full example with every option is in [vacuum.yaml](vacuum.yaml).

### Options

| Option                  | Default                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `name`                  | `Vacuum`                                                      |
| `entities`              | see below                                                     |
| `controls`              | all four buttons, see below. `false` hides them all           |
| `maintenance_threshold` | `10` (hours left before a part gets a badge)                  |
| `tap_action`            | `more-info` on the vacuum                                     |
| `hold_action`           | `more-info` on the vacuum                                     |
| `colors`                | see below                                                     |

A misspelled option, entity role or button shows an error card instead of being ignored.

### Entities

`…` is `roborock_q_revo`.

| Role                   | Default                                              | Used for |
| ---------------------- | ---------------------------------------------------- | -------- |
| `vacuum`               | `vacuum.…` (required)                                | state, target of the default buttons and more-info |
| `status`               | `sensor.…_status`                                    | status words and group |
| `battery`              | `sensor.…_battery`                                   | battery % |
| `charging`             | `binary_sensor.…_charging`                           | charging indicator |
| `cleaning`             | `binary_sensor.…_cleaning`                           | not shown; accepted so it can be set or switched off |
| `progress`             | `sensor.…_cleaning_progress`                         | progress % |
| `current_room`         | `sensor.…_current_room`                              | room while cleaning |
| `cleaning_area`        | `sensor.…_cleaning_area`                             | m², current or last run |
| `cleaning_time`        | `sensor.…_cleaning_time`                             | minutes so far (sensor unit wins) |
| `last_clean_begin`     | `sensor.…_last_clean_begin`                          | last clean, if there is no end |
| `last_clean_end`       | `sensor.…_last_clean_end`                            | last clean |
| `cleaning_mode`        | `select.living_room_…_cleaning_mode`                 | Vacuum / Vacuum & mop / Mop |
| `next_clean`           | `sensor.vacuum_next_scheduled_clean`                 | state `vacuum` or `vacuum+mop`, attribute `next_time`; anything else is no next clean |
| `schedule_disabled`    | `input_boolean.disable_vacuum_cleaner_schedule`      | on: "Schedule off" |
| `vacuum_error`         | `sensor.…_vacuum_error`                              | badge; `none` is fine |
| `dock_error`           | `sensor.…_dock_error`                                | badge; `ok` is fine |
| `water_shortage`       | `binary_sensor.…_water_shortage`                     | badge |
| `clean_water_box`      | `binary_sensor.…_dock_clean_water_box`               | badge |
| `dirty_water_box`      | `binary_sensor.…_dock_dirty_water_box`               | badge |
| `mop_attached`         | `binary_sensor.…_mop_attached`                       | badge when off |
| `water_box_attached`   | `binary_sensor.…_water_box_attached`                 | badge when off |
| `mop_drying`           | `binary_sensor.…_mop_drying`                         | "Drying the mop" and the countdown |
| `mop_drying_remaining` | `sensor.…_mop_drying_remaining_time`                 | countdown (seconds; sensor unit wins) |
| `main_brush_left`      | `sensor.…_main_brush_time_left`                      | maintenance badge (hours) |
| `side_brush_left`      | `sensor.…_side_brush_time_left`                      | maintenance badge |
| `filter_left`          | `sensor.…_filter_time_left`                          | maintenance badge |
| `sensor_left`          | `sensor.…_sensor_time_left`                          | maintenance badge |
| `dock_strainer_left`   | `sensor.…_dock_strainer_time_left`                   | maintenance badge |

### Status groups

The status sensor decides the group and the words; about 40 Roborock values have readable words, and an unknown value shows in Title Case with the group taken from the vacuum state. A vacuum state of `error` always wins.

| Group     | Colour      | Examples                                              | Buttons shown |
| --------- | ----------- | ----------------------------------------------------- | ------------- |
| cleaning  | `cleaning`  | Cleaning, Room cleaning, Zone mopping, Mapping        | Pause, Return, Locate |
| returning | `returning` | Returning to dock, Docking, Going to wash the mop     | Start, Pause, Locate |
| dock      | `dock`      | Washing the mop, Emptying the bin, Drying the mop     | Locate |
| paused    | `paused`    | Paused                                                | Resume, Return, Locate |
| error     | `error`     | Error, Charging problem, Locked                       | Start, Return, Locate |
| docked    | `idle`      | Charging, Charged, Updating                           | Start, Locate |
| idle      | `idle`      | Idle, Off the dock                                    | Start, Return, Locate |
| offline   | `idle`      | Offline (vacuum unavailable)                          | none |

While the mop dries the status sensor usually says Charged; the card shows "Drying the mop" in the dock colour instead.

### Badge order

First match wins. The badge shows whenever the progress bar does not (cleaning and paused show progress).

| # | When                                    | Badge                        |
| - | --------------------------------------- | ---------------------------- |
| 1 | `vacuum_error` is not `none`            | Error: Main brush jammed (red) |
| 2 | `dock_error` is not `ok`                | Dock: Duct blocked (red)     |
| 3 | `water_shortage` on                     | Water shortage               |
| 4 | `clean_water_box` on                    | Refill clean water tank      |
| 5 | `dirty_water_box` on                    | Empty dirty water tank       |
| 6 | `mop_attached` off                      | Mop missing                  |
| 7 | `water_box_attached` off                | Water box missing            |
| 8 | a part below `maintenance_threshold`    | Filter: 6 h left (the part with the least time left; "due" at 0) |

### Controls

Each button defaults to a `perform-action` on the vacuum entity and can be overridden or removed:

| Button           | Default action          |
| ---------------- | ----------------------- |
| `start`          | `vacuum.start` (shown as Resume while paused) |
| `pause`          | `vacuum.pause`          |
| `return_to_base` | `vacuum.return_to_base` |
| `locate`         | `vacuum.locate`         |

```yaml
controls:
  locate: null                 # remove
  start:
    icon: mdi:broom
    label: Clean now
    tap_action:
      action: perform-action
      perform_action: script.vacuum_clean_now
```

### Colors

Each key takes any CSS color (`"#ff9800"`, `orange`, `var(--orange-color)`).

| Key           | Used for                                | Default                 |
| ------------- | --------------------------------------- | ----------------------- |
| `cleaning`    | cleaning, progress bar                  | `var(--green-color)`    |
| `returning`   | returning to the dock                   | `var(--blue-color)`     |
| `dock`        | dock work and the drying countdown      | `var(--cyan-color)`     |
| `paused`      | paused                                  | `var(--amber-color)`    |
| `error`       | error state and error badges            | `var(--error-color)`    |
| `idle`        | docked, idle, offline                   | `var(--disabled-color)` |
| `badge`       | other attention badges                  | `var(--amber-color)`    |
| `battery_low` | battery at 20% or less, not charging    | `var(--error-color)`    |

## Sizing

Full width by default (12 columns, height follows the content), at most about 117px: 2 rows in a sections view, like the Heating Control Card with one room.

## Development

The card needs nothing to run. Tests use jsdom:

```sh
npm install
npm test
```

A release is made by bumping `VERSION` in `vacuum-card.js`, adding a `## vX.Y.Z` section to [CHANGELOG.md](CHANGELOG.md), committing, and pushing a matching tag. The Release workflow checks the tag against `VERSION`, runs the tests and publishes the GitHub release with that changelog section as its notes.

## Licence

MIT
