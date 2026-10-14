# Vacuum Card: notes for working on this repo

HACS dashboard card (Lovelace) for a robot vacuum with a dock (the owner's Roborock Q Revo on the core Roborock integration). Owner: BarBaar44 (Bb). Sister repos with the same conventions: [appliance-card](https://github.com/BarBaar44/appliance-card) (the reference), [room-card](https://github.com/BarBaar44/room-card) and [Heating-Control-Card](https://github.com/BarBaar44/Heating-Control-Card).

## Files

| File | Purpose |
|---|---|
| `vacuum-card.js` | The whole card: plain custom element, no build step, no dependencies. `DEFAULTS` holds the owner's entities, `STATUS` the status words and groups, `CONTROLS` the buttons, `COLORS` the colours. |
| `tests/vacuum-card.test.js` | jsdom tests: every status group, every badge in order, docked info line, controls, actions, config errors. `npm test`. |
| `hacs.json` | HACS manifest (HA 2024.11+). |
| `README.md` | User docs, also the HACS info page. Keep the entity, status group, badge order, controls and colour tables in sync with the code. |
| `CHANGELOG.md` | One `## vX.Y.Z` section per release; the Release workflow uses it as the release notes. |
| `shot.png`, `animation.gif` | README images, linked by absolute raw URL so they render in HACS. |
| `vacuum.yaml` | Minimal and full example configs. |

## Rules to keep

* The card never hardcodes service calls. Buttons, card tap/hold and the badge all go through `hass-action` (HA's own handler). Button defaults are `perform-action` with `vacuum.*` services on the vacuum entity, overridable or removable per button.
* Status: the status sensor decides words and group; an unknown value gets Title Case words and its group from the vacuum state. A vacuum state of `error` always wins; an unavailable vacuum is "Offline".
* While `mop_drying` is on and the robot is docked or idle, the status reads "Drying the mop" in the dock colour (the status sensor says charged for hours).
* Badge order is first-match-wins and documented in the README. The badge only shows when the progress bar does not (cleaning and paused show progress), so the card never grows. Tapping it opens more-info for its own sensor, not the card action.
* Next session: read straight from the Scheduler-card switches in `schedules` (state `on`, attribute `next_trigger`), earliest valid future run wins. `schedule_paused` on shows "Schedule paused". Do not go back to `sensor.vacuum_next_scheduled_clean`: it says `none` when the run is more than 10 hours away.
* mdi has no mop icon (checked against @mdi/js 7.4.47): mop sessions default to `mdi:water`, overridable per schedule with `icon`.
* Controls per group are in `SHOW_CONTROLS`.
* Re-render only when one of the card's own entities changes, plus a 30 s refresh (started in `connectedCallback`, stopped in `disconnectedCallback`) for today/tomorrow, sessions that pass and the drying countdown. The DOM is built once per config and updated in place.
* Max height about 117px, so it fits 2 rows like its sisters. Measure in a real browser (Playwright) after layout changes.
* Top-level names are shared with other cards when the file is loaded as a classic script: avoid short generic names.

## Releasing

1. Bump `VERSION`, add the CHANGELOG section, commit, push to `main`, check Validate is green.
2. The owner pushes the `vX.Y.Z` tag. **Never tag or release without the owner's explicit go.** Claude sessions here cannot push tags or create releases anyway.
3. Changes marked "no release yet" go to `main` without a version bump.
