// Smoke test — runs in Node (no browser needed).
// 1. graph builds & is sane
// 2. every generator: 5 rungs x 4 draws produce valid, checkable items
// 3. engine: placement applies, sessions build, mastery advances
import { CONCEPTS, GRAPH, STRANDS, ANCHORS, buildGraph } from '../js/graph.js';
import { makeItem } from '../js/gen.js';
import { defaultState, startPlacement, placementFollowUp, applyPlacementResult, finishPlacement, buildDailySession, updateAttempt, finishSession } from '../js/engine.js';

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

// 3. engine — placement: one friendly probe per strand + one follow-up
const st = defaultState('TestKid', 4);
const probes = startPlacement(st);
ok(probes.length === STRANDS.length, `probe count ${probes.length}`);
ok(probes.every((p) => p.mode === 'probe' && p.item), 'probes well-formed');
// path A: all probes right → follow-ups at rung 1 of the up concept; confirm → up
for (const p of probes) {
  const fu = placementFollowUp(st, p.strand, true);
  ok(fu && fu.item && fu.item.rung === 1, `up follow-up easy rung (${p.strand})`);
  applyPlacementResult(st, p.strand, fu.targetIfCorrect);
}
finishPlacement(st);
ok(st.placement.done, 'placement done');
ok(STRANDS.every((s) => st.strands[s.id].frontier === ANCHORS[s.id].up), 'all-right path reaches up concepts');
// path B: probes wrong → follow-ups at down concept; confirm right → anchor
const st2 = defaultState('TestKid2', 4);
for (const p of startPlacement(st2)) {
  const fu = placementFollowUp(st2, p.strand, false);
  applyPlacementResult(st2, p.strand, fu.targetIfCorrect);
  const fu2 = null;
}
finishPlacement(st2);
ok(STRANDS.every((s) => st2.strands[s.id].frontier === ANCHORS[s.id].anchor), 'wrong-probe + good-confirm lands at anchor');
// path C: probes wrong, confirm wrong → down
const st3 = defaultState('TestKid3', 4);
for (const p of startPlacement(st3)) {
  const fu = placementFollowUp(st3, p.strand, false);
  applyPlacementResult(st3, p.strand, fu.targetIfWrong);
}
ok(STRANDS.every((s) => st3.strands[s.id].frontier === ANCHORS[s.id].down), 'double-wrong lands down');

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
