// Concept graph — maths, Years 2–6 band centred on Year 4 (England NC).
// Concepts are data: { id, grade, title, strand, prereqs:[], gen:{kind, params, byRung?} }
// Difficulty rungs are 1..5 inside each concept (rung 5 = mastered).
// Sources: DfE NC programmes of study; sequence cross-checked with Oak's
// maths spine. Hand-authored for the prototype; the Oak ontology converter
// replaces this file in the real pipeline (docs/PACK-PIPELINE.md stage 1).

export const STRANDS = [
  { id: 'place', title: 'Numbers & place value', emoji: '🔢' },
  { id: 'addsub', title: 'Adding & subtracting', emoji: '➕' },
  { id: 'multdiv', title: 'Times tables & multiplying', emoji: '✖️' },
  { id: 'frac', title: 'Fractions, decimals & percentages', emoji: '🥧' },
  { id: 'measure', title: 'Measures, money & time', emoji: '📏' },
];

export const CONCEPTS = [
  // ---- Numbers & place value -------------------------------------------
  { id: 'nb20', grade: 2, strand: 'place', title: 'Number bonds to 20', prereqs: [],
    gen: { kind: 'bonds', params: {} } },
  { id: 'pv3', grade: 3, strand: 'place', title: '3-digit place value', prereqs: ['nb20'],
    gen: { kind: 'placevalue', params: { digits: 3 } } },
  { id: 'pv4', grade: 4, strand: 'place', title: '4-digit place value', prereqs: ['pv3'],
    gen: { kind: 'placevalue', params: { digits: 4 } } },
  { id: 'round4', grade: 4, strand: 'place', title: 'Rounding to 10, 100, 1000', prereqs: ['pv4'],
    gen: { kind: 'round', params: {} } },
  { id: 'neg4', grade: 4, strand: 'place', title: 'Negative numbers', prereqs: ['pv3'],
    gen: { kind: 'negative', params: {} } },
  { id: 'roman4', grade: 4, strand: 'place', title: 'Roman numerals', prereqs: ['pv3'],
    gen: { kind: 'roman', params: {} } },

  // ---- Adding & subtracting --------------------------------------------
  { id: 'as2', grade: 2, strand: 'addsub', title: 'Mental add & subtract (2-digit)', prereqs: ['nb20'],
    gen: { kind: 'mental', params: { digits: 2 } } },
  { id: 'coladd3', grade: 3, strand: 'addsub', title: 'Column addition (3-digit)', prereqs: ['as2', 'pv3'],
    gen: { kind: 'coladd', params: { digits: 3 } } },
  { id: 'colsub3', grade: 3, strand: 'addsub', title: 'Column subtraction (3-digit)', prereqs: ['coladd3'],
    gen: { kind: 'colsub', params: { digits: 3 } } },
  { id: 'coladd4', grade: 4, strand: 'addsub', title: 'Column addition (4-digit)', prereqs: ['coladd3'],
    gen: { kind: 'coladd', params: { digits: 4, carries: true } } },
  { id: 'colsub4', grade: 4, strand: 'addsub', title: 'Column subtraction (4-digit)', prereqs: ['colsub3', 'pv4'],
    gen: { kind: 'colsub', params: { digits: 4, zeroCross: true } } },
  { id: 'word5', grade: 5, strand: 'addsub', title: 'Multi-step word problems', prereqs: ['coladd4', 'colsub4'],
    gen: { kind: 'word', params: { digits: 4, steps: 2 } } },

  // ---- Times tables & multiplying ---------------------------------------
  { id: 'tt2', grade: 2, strand: 'multdiv', title: '2, 5 and 10 times tables', prereqs: ['nb20'],
    gen: { kind: 'tt', params: { tables: [2, 5, 10] } } },
  { id: 'tt348', grade: 3, strand: 'multdiv', title: '3, 4 and 8 times tables', prereqs: ['tt2'],
    gen: { kind: 'tt', params: { tables: [3, 4, 8] } } },
  { id: 'tt12', grade: 4, strand: 'multdiv', title: 'All tables to 12', prereqs: ['tt348'],
    gen: { kind: 'tt', params: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } } },
  { id: 'lm1', grade: 4, strand: 'multdiv', title: 'Multiplying bigger numbers', prereqs: ['tt12'],
    gen: { kind: 'lm', params: { aDigits: 3, bDigits: 1 } } },
  { id: 'lm2', grade: 5, strand: 'multdiv', title: 'Long multiplication (2-digit ×)', prereqs: ['lm1'],
    gen: { kind: 'lm', params: { aDigits: 3, bDigits: 2 } } },
  { id: 'sd5', grade: 5, strand: 'multdiv', title: 'Short division', prereqs: ['tt12'],
    gen: { kind: 'div', params: {} } },
  { id: 'pfa5', grade: 5, strand: 'multdiv', title: 'Factors, multiples & primes', prereqs: ['tt12'],
    gen: { kind: 'pfa', params: {} } },

  // ---- Fractions, decimals & percentages -------------------------------
  { id: 'frac3', grade: 3, strand: 'frac', title: 'Fractions of amounts', prereqs: ['tt2'],
    gen: { kind: 'fracof', params: { unit: true } } },
  { id: 'frac4', grade: 4, strand: 'frac', title: 'Non-unit fractions', prereqs: ['frac3', 'tt348'],
    gen: { kind: 'fracof', params: { unit: false } } },
  { id: 'fracCmp5', grade: 5, strand: 'frac', title: 'Comparing fractions', prereqs: ['frac4'],
    gen: { kind: 'fracCmp', params: {} } },
  { id: 'dec4', grade: 4, strand: 'frac', title: 'Tenths & hundredths', prereqs: ['frac3'],
    gen: { kind: 'decimals', params: {} } },
  { id: 'decAS5', grade: 5, strand: 'frac', title: 'Adding with decimals', prereqs: ['dec4', 'coladd4'],
    gen: { kind: 'decAS', params: {} } },
  { id: 'pct5', grade: 5, strand: 'frac', title: 'Percentages of amounts', prereqs: ['frac4', 'dec4'],
    gen: { kind: 'pct', params: {} } },

  // ---- Measures, money & time ------------------------------------------
  { id: 'money4', grade: 4, strand: 'measure', title: 'Money: totals & change', prereqs: ['colsub3', 'frac3'],
    gen: { kind: 'money', params: {} } },
  { id: 'time3', grade: 3, strand: 'measure', title: 'Time & durations', prereqs: ['nb20'],
    gen: { kind: 'duration', params: {} } },
  { id: 'perim4', grade: 4, strand: 'measure', title: 'Perimeter', prereqs: ['as2', 'pv3'],
    gen: { kind: 'perim', params: {} } },
  { id: 'area5', grade: 5, strand: 'measure', title: 'Area of rectangles', prereqs: ['perim4', 'lm1'],
    gen: { kind: 'area', params: {} } },
];

// Build graph: validations mirror tutor-engine's buildGraph (dup ids,
// missing prereqs, acyclicity). Exported for tests.
export function buildGraph(concepts) {
  const byId = new Map();
  for (const c of concepts) {
    if (byId.has(c.id)) throw new Error(`duplicate concept: ${c.id}`);
    byId.set(c.id, c);
  }
  for (const c of concepts) {
    for (const p of c.prereqs) {
      if (!byId.has(p)) throw new Error(`${c.id} lists missing prereq ${p}`);
    }
  }
  // acyclicity via DFS
  const state = new Map(); // 0 unvisited, 1 in-stack, 2 done
  const visit = (id) => {
    const s = state.get(id) ?? 0;
    if (s === 1) throw new Error(`cycle detected at ${id}`);
    if (s === 2) return;
    state.set(id, 1);
    for (const p of byId.get(id).prereqs) visit(p);
    state.set(id, 2);
  };
  for (const c of concepts) visit(c.id);
  // dependents index
  const dependents = new Map(concepts.map((c) => [c.id, []]));
  for (const c of concepts) for (const p of c.prereqs) dependents.get(p).push(c.id);
  // strand order (teaching sequence within strand)
  const strandOrder = new Map(STRANDS.map((s) => [s.id, []]));
  for (const c of concepts) strandOrder.get(c.strand).push(c.id);
  return { byId, dependents, strandOrder, concepts };
}

// Placement anchors: per strand — the Y3/Y4 boundary concept to probe first
// (at a FRIENDLY rung), with one step down / up for branching. Anchors are
// chosen for quick, low-working-memory probes: no long column arithmetic.
export const ANCHORS = {
  place: { anchor: 'pv4', down: 'pv3', up: 'round4' },
  addsub: { anchor: 'coladd3', down: 'as2', up: 'colsub3' },
  multdiv: { anchor: 'tt12', down: 'tt348', up: 'lm1' },
  frac: { anchor: 'frac4', down: 'frac3', up: 'dec4' },
  measure: { anchor: 'perim4', down: 'time3', up: 'money4' },
};

export const GRAPH = buildGraph(CONCEPTS);
