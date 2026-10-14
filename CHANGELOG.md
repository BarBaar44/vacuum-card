# Changelog

## v0.1.0

First release. One card for the robot vacuum and its dock, in the style of the Appliance, Room and Heating Control cards.

### Added
* **Header:** status in readable words for about 40 Roborock states (unknown values in Title Case), coloured by group: cleaning, returning, dock work, paused, error, docked or idle. Battery with a charging indicator, red when low.
* **While cleaning:** room, cleaning mode in words, progress bar with percentage, area and minutes. The robot sways while it drives.
* **Next session:** whenever the robot isn't cleaning, the earliest upcoming run among the active Scheduler-card schedule switches (`schedules`, default the vacuum and the vacuum-and-mop schedule), with its type and "today", "tomorrow" or the weekday. "Schedule paused" while `schedule_paused` is on, "No session planned" when no schedule is active. Read straight from the switches' `next_trigger`, so it works at any distance.
* **Mop drying:** "Drying the mop" with a countdown.
* **Attention badge**, first match wins: vacuum error, dock error, water shortage, clean water tank, dirty water tank, mop or water box missing, then the part with the least time left below `maintenance_threshold` (default 10 h). Uses the progress bar's place, so the card does not grow. Tap it for the sensor behind it.
* **Controls:** Start (Resume while paused), Pause, Return to dock and Locate, shown only when they make sense. Each is a configurable Home Assistant action and can be removed.
* **Actions:** card tap and hold through Home Assistant's own action handler, more-info on the vacuum by default.
* Every entity overridable or switched off with `null`; every colour configurable with `colors`.
* Fits 2 rows in a sections view (at most about 117px). All animations stop under reduced motion.
