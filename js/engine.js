// Engine — deterministic adaptivity. No AI here, ever.
//  quickPlace(state)        -> probe items for the first mission
//  applyPlacement(state, results)
//  buildDailySession(state) -> today's 10-minute plan
//  updateAttempt(state, item, correct, timestamp)
// Placement model: one probe chain per strand (anchor -> one branch up/down).
// Mastery: per-concept {rung, streak}; 3-in-a-row climbs a rung;
// two misses in a row drops a rung; rung 5 + streak = mastered.
// Reviews: mastered/seen concepts come back on a widening ladder [1,3,7,14,30] days.

import { GRAPH, ANCHORS, STRANDS } from './graph.js';
import { makeItem } from './gen.js';

const DAY = 86_400_000;
export const LADDER = [1, 3, 7, 14, 30];

export function defaultState(name, year) {
  const state = {
    child: { name, year, created: Date.now() },
    placement: { done: false, probes: [] },
    strands: {},      // strandId -> { frontier: conceptId }
    concepts: {},     // conceptId -> { rung, streak, misses, attempts, correct, stability, nextDue, lastSeen, mastered }
    frontierRung: {}, // strandId -> rung hint for frontier items
    ledger: [],       // { t, type, coins, note }
    coins: 0, streakDays: 0, lastDay: null, sessions: [],
  };
  for (const s of STRANDS) {
    const a = ANCHORS[s.id];
    state.strands[s.id] = { frontier: a.anchor };
    state.frontierRung[s.id] = 2;
  }
  return state;
}

const dayStamp = (d) => new Date(d).toISOString().slice(0, 10);

function concept(state, id) {
  if (!state.concepts[id]) {
    state.concepts[id] = { rung: 1, streak: 0, misses: 0, attempts: 0, correct: 0, stability: 0, nextDue: null, lastSeen: null, mastered: false };
  }
  return state.concepts[id];
}

function addCoins(state, n, type, note) {
  state.coins += n;
  state.ledger.push({ t: Date.now(), type, coins: n, note: note || '' });
  if (state.ledger.length > 500) state.ledger.splice(0, state.ledger.length - 500);
}

// ---------------- placement ----------------
export function quickPlace(state) {
  const items = [];
  for (const s of STRANDS) {
    const a = ANCHORS[s.id];
    const c = GRAPH.byId.get(a.anchor);
    for (let i = 0; i < 2; i++) items.push(makeItem(c, 3));
  }
  return items;
}

export function applyPlacement(state, results) {
  // results: [{ conceptId, correct }]
  const byStrand = {};
  for (const r of results) {
    const c = GRAPH.byId.get(r.conceptId);
    byStrand[c.strand] = byStrand[c.strand] || [];
    byStrand[c.strand].push(r.correct);
  }
  for (const s of STRANDS) {
    const a = ANCHORS[s.id];
    const res = byStrand[s.id];
    const score = res ? res.filter(Boolean).length : 0;
    let target = a.anchor;
    if (res && res.length >= 2 && score === 2) target = a.up;         // strong → reach up
    if (res && res.length >= 2 && score === 0) target = a.down;        // shaky → step down
    state.strands[s.id].frontier = target;
    // record evidence as first mastery state
    const c = concept(state, target);
    c.attempts = 1;
    if (score >= 1) { c.correct = 1; c.streak = 1; }
    state.frontierRung[s.id] = 2;
  }
  state.placement.done = true;
  addCoins(state, 5, 'placement', 'First mission complete');
}

// ---------------- daily session ----------------
function nextConceptInStrand(strandId, conceptId) {
  const order = GRAPH.strandOrder.get(strandId);
  const i = order.indexOf(conceptId);
  // advance only when prereqs are satisfied (mastered or attempted)
  for (let j = i + 1; j < order.length; j++) {
    const cand = GRAPH.byId.get(order[j]);
    const ok = cand.prereqs.every((p) => { const cs = stateLookup[p]; return cs && (cs.mastered || cs.attempts > 0); });
    if (ok) return order[j];
  }
  return null;
}
let stateLookup = null;
export function _setLookup(m) { stateLookup = m; }

export function buildDailySession(state) {
  _setLookup(state.concepts);
  const today = dayStamp(Date.now());
  const plan = [];
  const counts = { review: 0, frontier: 0, stretch: 0 };

  // 1. due reviews (seen concepts past nextDue), capped at 4
  const reviewIds = Object.entries(state.concepts)
    .filter(([id, c]) => c.attempts > 0 && !isFrontier(state, id) && c.nextDue && dayStamp(c.nextDue) <= today)
    .sort((a, b) => new Date(a[1].nextDue) - new Date(b[1].nextDue))
    .slice(0, 4);
  for (const [id] of reviewIds) {
    plan.push({ mode: 'review', item: makeItem(GRAPH.byId.get(id), Math.max(1, state.concepts[id].rung)) });
    counts.review++;
  }

  // 2. frontier work: budget for 9–11 total items
  const open = STRANDS.map((s) => s.id)
    .filter((sid) => { const f = state.strands[sid].frontier; const c = state.concepts[f]; return !c || !c.mastered; })
    .slice(0, 3);
  const frontierBudget = Math.max(5, 9 - counts.review);
  const perStrand = Math.max(2, Math.ceil(frontierBudget / Math.max(1, open.length)));
  for (const sid of open) {
    const fid = state.strands[sid].frontier;
    const fc = concept(state, fid);
    for (let i = 0; i < perStrand; i++) {
      plan.push({ mode: 'frontier', item: makeItem(GRAPH.byId.get(fid), Math.min(fc.rung + Math.floor(i / 2), 5)), strand: sid });
      counts.frontier++;
    }
  }

  // 3. stretch: strongest strand gets 1–2 items one rung above frontier level
  const stretchable = STRANDS.map((s) => s.id)
    .filter((sid) => state.strands[sid].frontier && !state.concepts[state.strands[sid].frontier]?.mastered)
    .slice(0, 1);
  for (const sid of stretchable) {
    const fid = state.strands[sid].frontier;
    plan.push({ mode: 'stretch', item: makeItem(GRAPH.byId.get(fid), Math.min((state.concepts[fid]?.rung || 2) + 2, 5)), strand: sid });
    counts.stretch++;
  }

  // dedupe identical stems (re-rolls)
  const seen = new Set();
  return plan.filter((p) => {
    if (seen.has(p.item.stem)) { return false; }
    seen.add(p.item.stem); return true;
  });
}

function isFrontier(state, conceptId) {
  return STRANDS.some((s) => state.strands[s.id].frontier === conceptId);
}

// ---------------- mastery update ----------------
export function updateAttempt(state, item, correct, now = Date.now()) {
  const c = concept(state, item.conceptId);
  c.attempts++;
  c.lastSeen = now;
  if (correct) {
    c.correct++;
    c.streak++;
    c.misses = 0;
    c.stability++;
    if (c.streak >= 3 && c.rung < 5) {
      c.rung++;
      c.streak = 0;
      addCoins(state, 2, 'rung_up', `${item.conceptId} → rung ${c.rung}`);
    }
    if (c.rung >= 5 && c.stability >= 6 && !c.mastered) {
      c.mastered = true;
      addCoins(state, 5, 'concept_mastered', GRAPH.byId.get(item.conceptId).title);
      // advance the strand frontier if this was it
      for (const s of STRANDS) {
        if (state.strands[s.id].frontier === item.conceptId) {
          const nxt = nextInStrand(state, s.id, item.conceptId);
          if (nxt) state.strands[s.id].frontier = nxt;
          state.frontierRung[s.id] = 2;
        }
      }
    }
  } else {
    c.streak = 0;
    c.stability = Math.max(0, c.stability - 1);
    c.misses++;
    // gentle: three misses (not two) steps back a rung — and the child never
    // sees this; they just notice the next question is friendlier.
    if (c.misses >= 3 && c.rung > 1) { c.rung--; c.misses = 0; }
  }
  // review scheduling: any seen concept gets a due date on the ladder
  const idx = Math.min(c.stability, LADDER.length - 1);
  c.nextDue = now + LADDER[idx] * DAY;
}

function nextInStrand(state, strandId, conceptId) {
  const order = GRAPH.strandOrder.get(strandId);
  const i = order.indexOf(conceptId);
  for (let j = i + 1; j < order.length; j++) {
    const cand = GRAPH.byId.get(order[j]);
    const ok = cand.prereqs.every((p) => {
      const cs = state.concepts[p];
      return cs && (cs.mastered || cs.attempts > 0);
    });
    if (ok) return order[j];
  }
  return null;
}

// ---------------- session finish ----------------
export function finishSession(state, results) {
  const correct = results.filter(Boolean).length;
  const total = results.length;
  const pct = total ? correct / total : 0;
  let coins = correct; // 1 per correct
  if (pct >= 0.8) coins += 3;
  addCoins(state, coins, 'session', `${correct}/${total} today`);

  const today = dayStamp(Date.now());
  const yest = dayStamp(Date.now() - DAY);
  if (state.lastDay === yest) state.streakDays++;
  else if (state.lastDay !== today) state.streakDays = 1;
  state.lastDay = today;

  state.sessions.push({ t: Date.now(), correct, total });
  if (state.sessions.length > 90) state.sessions.splice(0, state.sessions.length - 90);
  return { coins, pct };
}

// ---------------- parent dashboard helpers ----------------
export function parentSummary(state) {
  const childYear = state.child?.year || 4;
  const rows = STRANDS.map((s) => {
    const fid = state.strands[s.id].frontier;
    const fc = state.concepts[fid] || { rung: 1, mastered: false };
    const dueIds = Object.keys(state.concepts).filter((id) => {
      const c = state.concepts[id];
      return c.attempts > 0 && c.nextDue && dayStamp(c.nextDue) <= dayStamp(Date.now());
    });
    const fGrade = GRAPH.byId.get(fid)?.grade || childYear;
    const position =
      fGrade > childYear ? { label: `stretching ahead (Year ${fGrade} content)`, cls: 'ok' } :
      fGrade === childYear ? { label: `on track (Year ${fGrade})`, cls: 'new' } :
      { label: `building foundations (Year ${fGrade})`, cls: 'due' };
    return {
      strand: s.title, emoji: s.emoji, frontier: GRAPH.byId.get(fid)?.title || fid,
      rung: fc.rung, mastered: !!fc.mastered, frontierYear: fGrade, position,
      due: dueIds.length, total: GRAPH.strandOrder.get(s.id).length,
    };
  });
  const week = state.ledger.filter((l) => l.t > Date.now() - 7 * DAY);
  const weekCoins = week.reduce((a, l) => a + l.coins, 0);
  const masteredCount = Object.values(state.concepts).filter((c) => c.mastered).length;
  const rungUps = week.filter((l) => l.type === 'rung_up').length;
  return { rows, weekCoins, masteredCount, rungUps, sessions: state.sessions.slice(-14) };
}
