# Yoon's TO-DO

A timeboxing daily planner — Elon-Musk-style time blocking in a single iPad-friendly
page. Brain-dump everything, prioritize it, lock your fixed-time jobs, and the app
packs it all into a 15-minute **time box** you check off through the day.

No build step, no server, no dependencies. One `index.html`, plain CSS + JS,
state in `localStorage`.

## The two screens (separate pages)

- **`plan.html` — Plan** — brain-dump → "Break into tasks" → **drag rows (≡) to rank**
  them (top = P1; the order *is* the priority) + set minutes → add fixed-time jobs.
- **`index.html` — Today** — a single glanceable dashboard (built for iPad): live
  **digital clock** (KST), a rotating **tech-entrepreneur quote**, the **time box**
  calendar, and the combined **to-do list** with iOS check-off + progress bar.

## How the day is built

1. Fixed-schedule jobs are pinned to their exact clock blocks.
2. Prioritized jobs are greedily packed into the free blocks, in your drag-ranked
   order (P1 first), each taking its estimated minutes.
3. The result is the **time box** calendar: 06:30 → midnight, 15-minute grid, hour
   labels, a red **now** line. **Drag any block up/down to reschedule it** (snaps to
   15 min); dragging a fixed job moves its time. The view centers on "now" at load.

## Daily reset

Everything clears automatically at **06:00 KST** (UTC+9, no DST). The header shows a
live "resets in Xh Ym" countdown. A new quote is chosen each day.

## Style

Custom **iOS Dark** theme: native SF system font, grouped dark widget cards, iOS
system colours (blue accent, green checkmarks, red/orange priority dots), big tabular
digital clock. Designed for iPad landscape; stacks to a scroll on portrait/phone.

## Known limits

- Auto-packing is greedy and contiguous: a prioritized job that runs into a fixed
  block takes the free run it can; the next job starts after. Jobs that don't fit the
  day are tagged **No slot** (drag them onto the calendar to place them by hand).
- A block dragged onto an occupied time is allowed to overlap — overlaps lay out
  side-by-side like a calendar. No "un-pin" button yet (re-rank in Plan to reset).
- State is per-browser (`localStorage`). No sync across devices yet.

## Config

Time window lives at the top of `js/app.js`:

```js
const DAY_START_MIN = 6 * 60 + 30; // 06:30
const DAY_END_MIN   = 24 * 60;     // midnight — set to 12 * 60 for noon
```

## Run

Open `index.html` in a browser, or serve the folder (e.g. `python3 -m http.server`)
and open it on your iPad. Add to Home Screen for a full-screen app feel.
