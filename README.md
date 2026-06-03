# Yoon's TO-DO

A timeboxing daily planner — Elon-Musk-style time blocking in a single iPad-friendly
page. Brain-dump everything, prioritize it, lock your fixed-time jobs, and the app
packs it all into a 15-minute **time box** you check off through the day.

No build step, no server, no dependencies. One `index.html`, plain CSS + JS,
state in `localStorage`.

## The two screens

- **Plan** — brain-dump → break into tasks → set priority (P1·P2·P3) + minutes →
  add fixed-time jobs. This is the input you give it.
- **Today** — a single glanceable dashboard (built for iPad): live **digital clock**
  (KST), a rotating **tech-entrepreneur quote**, the **time box**, and the combined
  **to-do list** with iOS-style check-off and a progress bar.

## How the day is built

1. Fixed-schedule jobs are pinned to their exact clock blocks.
2. Prioritized jobs are greedily packed into the free blocks, P1 first, each taking
   its estimated minutes.
3. The result is the time box: 06:30 → midnight, in 15-minute blocks. The current
   block is highlighted **NOW** and auto-scrolled into view.

## Daily reset

Everything clears automatically at **06:00 KST** (UTC+9, no DST). The header shows a
live "resets in Xh Ym" countdown. A new quote is chosen each day.

## Style

Custom **iOS Dark** theme: native SF system font, grouped dark widget cards, iOS
system colours (blue accent, green checkmarks, red/orange priority dots), big tabular
digital clock. Designed for iPad landscape; stacks to a scroll on portrait/phone.

## Known first-shot limits

- Auto-packing is greedy and contiguous: if a prioritized job runs into a fixed block
  before its full duration fits, it takes the free run it can and the next job starts
  after the fixed block. Jobs that don't fit the day are tagged **No slot**.
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
