// Smoke test — runs in Node (no browser needed).
// 1. graph builds & is sane
// 2. every generator: 5 rungs x 4 draws produce valid, checkable items
// 3. engine: placement applies, sessions build, mastery advances
import { CONCEPTS, GRAPH, STRANDS, ANCHORS, buildGraph } from '../js/graph.js';
import { makeItem } from '../js/gen.js';
import { defaultState, quickPlace, applyPlacement, buildDailySession, updateAttempt, finishSession } from '../js/engine.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL:', msg); } };

// 1. graph
ok(CONCEPTS.length >= 25, `concept count ${CONCEPTS.length}`);
for (const s of STRANDS) {
  const a = ANCHORS[s.id];
  ok(GRAPH.byId.has(a.anchor) && GRAPH.byId.has(a.down) && GRAPH.byId.has(a.up), `anchor set complete for ${s.id}`);
  ok(GRAPH.byId.get(a.anchor).strand === s.id, `anchor in right strand ${s.id}`);
}
try { buildGraph(CONCEPTS); pass++; } catch (e) { fail++; console.error('FAIL: graph build', e.message); }

// 2. generators
let mcqCount = 0, numCount = 0;
for (const c of CONCEPTS) {
  for (let r = 1; r <= 5; r++) {
    for (let n = 0; n < 4; n++) {
      try {
        const it = makeItem(c, r);
        ok(it.stem && it.stem.length > 3, `stem exists ${c.id} r${r}`);
        if (it.kind === 'mcq') {
          mcqCount++;
          ok(it.options.length >= 2, `mcq >=2 options ${c.id} r${r}`);
          ok(it.options.filter((o) => o === String(it.answer)).length === 1, `exactly 1 correct ${c.id} r${r}`);
        } else {
          numCount++;
          ok(typeof it.answer === 'number' && Number.isFinite(it.answer), `numeric answer ${c.id} r${r}`);
        }
        ok(!!it.explain, `explain exists ${c.id} r${r}`);
      } catch (e) {
        fail++; console.error(`FAIL: gen ${c.id} r${r}: ${e.message}`);
      }
    }
  }
}
console.log(`generators: ${mcqCount} mcq + ${numCount} numeric items produced ok`);

// 3. engine
const st = defaultState('TestKid', 4);
const probes = quickPlace(st);
ok(probes.length === STRANDS.length * 2, `probe count ${probes.length}`);
const res = probes.map((p) => ({ conceptId: p.conceptId, correct: p.conceptId !== 'money4#fail' }));
applyPlacement(st, probes.map((p, i) => ({ conceptId: p.conceptId, correct: i % 3 !== 0 })));
ok(st.placement.done, 'placement done');
ok(STRANDS.every((s) => st.strands[s.id].frontier), 'frontiers set');

let sess = buildDailySession(st);
ok(sess.length >= 5 && sess.length <= 14, `session size ${sess.length}`);

// mastery: 3 correct in a row climbs a rung
const c0 = st.strands.place.frontier;
const it0 = makeItem(GRAPH.byId.get(c0), 1);
for (let i = 0; i < 3; i++) updateAttempt(st, it0, true);
ok(st.concepts[c0].rung === 2, `rung up after streak (was 1, now ${st.concepts[c0].rung})`);
// three misses drops a rung (gentle rule: 3, not 2)
const before = st.concepts[c0].rung;
updateAttempt(st, it0, false); updateAttempt(st, it0, false); updateAttempt(st, it0, false);
ok(st.concepts[c0].rung < before, `rung drops on three misses (${before} → ${st.concepts[c0].rung})`);

// simulate a week of sessions to reach mastery + review scheduling
for (let day = 0; day < 8; day++) {
  const daily = buildDailySession(st);
  for (const p of daily) updateAttempt(st, p.item, Math.random() < 0.8, Date.now());
  finishSession(st, daily.map(() => Math.random() < 0.8));
}
ok(st.coins > 0, `coins accrue (${st.coins})`);
ok(st.sessions.length === 8, 'sessions recorded');
const dueSoon = Object.values(st.concepts).some((c) => c.nextDue);
ok(dueSoon, 'review scheduling active');

// session plan mixes modes
const modes = new Set(buildDailySession(st).map((p) => p.mode));
console.log('modes seen:', [...modes].join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
