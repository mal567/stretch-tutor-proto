# Maths Stretch — prototype PWA

A 10-minutes-a-day adaptive maths practice app for a UK Year 4 child
(reaches Y3–Y5). Subject-agnostic architecture — maths is the first strand;
spelling/SPaG and other subjects slot in as packs. Prototype — deliberately
thin, deliberately local.

**Live:** https://mal567.github.io/stretch-tutor-proto/ (installable on
Android/iOS home screens; works fully offline after first load)

## What it does

- **First mission (~4 min):** a quick placement — 2 probe questions per
  strand (Numbers, Add/Sub, Tables, Fractions, Measures) that locates the
  child's starting point on the concept graph.
- **Daily 10-minute mission:** due reviews (forgetting-curve ladder
  1→3→7→14→30 days) + new frontier work + one stretch ("challenge") item
  a couple of rungs above current level.
- **Kid UI:** big buttons, on-screen keypad, read-aloud (🔊), 10-min timer,
  streak 🔥 and coin 🪙 counters (stubs of the rewards ledger).
- **Parent area** (behind a grown-up question): per-strand frontier and rung,
  mastered concepts, reviews due, recent sessions, coin summary, JSON export,
  full reset.
- **All local:** state lives in IndexedDB on the device. No server, no
  account, no cloud, no AI at runtime.

## Design sources

- Concept graph hand-authored from the DfE National Curriculum programmes
  of study (Crown copyright/OGL); sequence cross-checked with Oak's maths spine.
- Question generators are pure code (Tier A of the sourcing pipeline):
  every item is made *and* checked by the same code, no AI, no sourced
  content. Curriculum sourcing design (SATs/OGL material, open data,
  reviewed AI-drafted packs for other subjects) is specified in the parent
  project's PACK-PIPELINE doc.

## Run it

```bash
cd proto
python3 -m http.server 8799
# open http://localhost:8799
```

Tests (no browser needed): `npm test` (runs `node test/smoke.mjs`)
Icons: `npm run icons`

## Getting it onto an Android tablet

Service workers (the "install to home screen" part) need a **secure
context**: fine on localhost, fine on HTTPS, blocked on plain http://LAN-IP.
So for the tablet:

1. **Easiest:** push `proto/` to a GitHub repo and enable **GitHub Pages** —
   the tablet opens the https URL, taps ⋮ → *Add to Home screen*, done.
   (Cloudflare Pages works the same way if you prefer your existing account.)
2. Dev inside your own network only: Chrome flag
   `unsafely-treat-insecure-origin-as-secure` — fine for a quick look,
   annoying for daily use; use the Pages route instead.

## Prototype scope (what is deliberately NOT here)

- Only maths, only Year 3–5 band (the real band centre is set by the
  child's year at signup — that's the placement centre).
- ~29 concepts; "mastered" requires ramping a rung ladder — calibrate
  with a real child before trusting it.
- No wrong-answer diagnosis beyond rung-down; no SATs item import; no
  Tier D reviewed items; no rewards cash-out; no AI coach. All are
  specified in ../docs/PACK-PIPELINE.md for the next build stages.
