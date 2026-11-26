// Fuzz: 500 draws per concept per rung — hunts rare generator violations.
import { CONCEPTS } from '../js/graph.js';
import { makeItem } from '../js/gen.js';

let bad = 0;
for (const c of CONCEPTS) {
  for (let r = 1; r <= 5; r++) {
    for (let i = 0; i < 500; i++) {
      try {
        const it = makeItem(c, r);
        if (it.kind === 'mcq') {
          const n = it.options.filter((o) => o === String(it.answer)).length;
          if (n !== 1) { bad++; console.log(`DUP-CORRECT ${c.id} r${r}: ${it.stem} options=${JSON.stringify(it.options)} ans=${it.answer}`); }
          if (new Set(it.options).size !== it.options.length) { bad++; console.log(`DUP-OPTION ${c.id} r${r}: ${it.stem} options=${JSON.stringify(it.options)}`); }
        } else {
          if (typeof it.answer !== 'number' || !Number.isFinite(it.answer)) { bad++; console.log(`BAD-NUM ${c.id} r${r}`); }
          if (it.answer < 0 && !/less|lower|−|-|temperature|freez|neg/i.test(it.stem)) { /* negative answer without context — warn only */ }
        }
      } catch (e) {
        bad++; console.log(`THROW ${c.id} r${r}: ${e.message}`);
      }
    }
  }
}
console.log(bad === 0 ? 'FUZZ CLEAN: 0 violations in ' + CONCEPTS.length * 5 * 500 + ' draws' : `FUZZ: ${bad} violations`);
process.exit(bad ? 1 : 0);
