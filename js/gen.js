// Question generators — Tier A of the sourcing pipeline (docs/PACK-PIPELINE.md).
// Everything is made AND checkable by code: no sourced content, no AI.
// makeItem(concept, rung) -> { key, conceptId, rung, kind:'num'|'mcq',
//   stem, answer, options?, unit?, hint, explain, speak }
// 'num'  -> numeric keypad input; answer is a number
// 'mcq'  -> 4 options; answer is a string equal to exactly one option

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const fmt = (n) => n.toLocaleString('en-GB');
const NAMES = ['Sam', 'Maya', 'Ada', 'Tom', 'Zoe', 'Ben', 'Aisha', 'Leo', 'Nia', 'Ravi'];

// build MCQ with distractors that mirror typical slips
function mcq(correct, distractors, opts = {}) {
  const uniq = [];
  const cs = String(correct);
  for (const d of distractors) {
    const ds = String(d);
    if (ds !== cs && !uniq.includes(ds)) uniq.push(ds);
  }
  let pad = 1;
  const abs = (x) => (typeof correct === 'number' ? Math.abs(x - correct) : null);
  while (uniq.length < 3 && typeof correct === 'number') {
    for (const delta of [pad * 10, -pad * 10, pad, -pad, pad * 2]) {
      const cand = correct + delta;
      const s = String(cand);
      if (s !== cs && !uniq.includes(s) && (abs(cand) < 100000)) { uniq.push(s); if (uniq.length >= 3) break; }
    }
    pad++;
    if (pad > 6) { uniq.push(cs + '0', cs + '00', '0'); break; }
  }
  while (uniq.length < 3) uniq.push(pick(['12', '30', '100']) + 'x');
  return { kind: 'mcq', options: shuffle([cs, ...uniq.slice(0, 3)]), answer: cs };
}

const H = {}; // handlers by kind; each returns { stem, answer(number|string), kind, options?, unit?, hint, explain, speak? }
export const HANDLERS = H;

H.bonds = (p, r) => {
  const max = r <= 1 ? 10 : r === 2 ? 20 : r === 3 ? 100 : 1000;
  const b = rnd(1, max - 1); const a = rnd(1, max - b);
  const t = a + b;
  const missingB = r >= 2;
  return { stem: missingB ? `${a} + ? = ${t}` : `? + ${b} = ${t}`, answer: missingB ? b : a,
    hint: 'How many more to reach the total?', explain: `${a} + ${b} = ${t}, so the missing number is ${missingB ? b : a}.` };
};

H.mental = (p, r) => {
  const d = p.digits + (r >= 3 ? 1 : 0);
  const max = 10 ** d - 1;
  const add = Math.random() < 0.6;
  let a = rnd(10, max), b = rnd(10, Math.min(max, 99));
  if (!add) [a, b] = [Math.max(a, b), Math.min(a, b)];
  const ans = add ? a + b : a - b;
  return { stem: `${fmt(a)} ${add ? '+' : '−'} ${fmt(b)} = ?`, answer: ans,
    hint: add ? 'Add the tens first, then the ones.' : 'Subtract the tens, adjust the ones.',
    explain: `${fmt(a)} ${add ? '+' : '−'} ${fmt(b)} = ${fmt(ans)}.` };
};

H.placevalue = (p, r) => {
  const places = ['ones', 'tens', 'hundreds', 'thousands'];
  const n = rnd(10 ** (p.digits - 1), 10 ** p.digits - 1);
  const s = fmt(n);
  const ri = rnd(0, p.digits - 1); // index from right: 0=ones,1=tens...
  const place = places[ri]; const digit = Number(String(n).padStart(p.digits, '0')[p.digits - 1 - ri]);
  if (r <= 2) {
    const q = mcq(digit, [digit + 1, digit - 1, Math.abs(digit - 5)]);
    return { stem: `In ${s}, which digit is in the ${place} place?`, ...q,
      hint: 'Count from the right: ones, tens, hundreds, thousands.', explain: `${s} → the ${place} digit is ${digit}.` };
  }
  if (r <= 4) {
    const value = digit * (10 ** ri);
    const q = mcq(value, [digit, digit * 10 ** (ri === 0 ? 1 : ri + 1), value * 10]);
    return { stem: `In ${s}, what is the ${place} digit worth?`, ...q,
      hint: 'Its value is the digit × its place.', explain: `${digit} in the ${place} place is worth ${fmt(value)}.` };
  }
  // rung 5: apply place value across a boundary (add 100 to 3 means 9 hundreds)
  const n2 = rnd(111, 1999); const ans2 = n2 + 100;
  return { stem: `What is 100 more than ${fmt(n2)}?`, answer: ans2,
    hint: 'Only the hundreds digit changes — unless it crosses over.',
    explain: `${fmt(n2)} + 100 = ${fmt(ans2)}.` };
};

H.round = (p, r) => {
  const to = r <= 2 ? 10 : r === 3 ? 100 : 1000;
  const n = rnd(to + 2, to * 9 + rnd(0, 9));
  const ans = Math.round(n / to) * to;
  return { stem: `Round ${fmt(n)} to the nearest ${fmt(to)}.`, answer: ans,
    hint: `Is the last kept digit's neighbour 5+? Round up!`,
    explain: `${fmt(n)} rounds to ${fmt(ans)} (nearest ${fmt(to)}).` };
};

H.negative = (p, r) => {
  if (r <= 2) {
    const a = -rnd(1, 5), b = rnd(1, 8); const ans = a - b;
    return { stem: `What is ${b} less than ${a}?`, answer: ans,
      hint: 'Below zero keep counting down.', explain: `${a} − ${b} = ${ans}.` };
  }
  if (r === 3) {
    const a = rnd(-15, 20), b = rnd(-15, 20);
    const lower = Math.min(a, b);
    const uniq = [...new Set([String(a), String(b), String(a + 5), String(b - 5), String(lower + 10)])];
    const opts = uniq.slice(0, 4);
    if (!opts.includes(String(lower))) opts[opts.length - 1] = String(lower);
    return { stem: `Which is lower: ${a} or ${b}?`, kind: 'mcq', options: opts, answer: String(lower),
      hint: 'Negative numbers are below zero.', explain: `${a} vs ${b}: ${lower} is lower.` };
  }
  let t = rnd(-5, 3), step = rnd(2, 4); const seq = []; for (let i = 0; i < 4; i++) { seq.push(t); t -= step; }
  const q = mcq(t, [t + step, t - step, t + 1]);
  return { stem: `Continue the sequence: ${seq.join(', ')}, ?`, ...q,
    hint: `The step is ${step} down each time.`, explain: `Each time it goes down ${step}: next is ${t}.` };
};

H.roman = (p, r) => {
  const toRoman = (n) => {
    const map = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = ''; for (const [v, s] of map) while (n >= v) { out += s; n -= v; } return out;
  };
  const n = r <= 1 ? rnd(1, 12) : r === 2 ? rnd(10, 39) : r === 3 ? rnd(40, 89) : rnd(90, 100);
  const rom = toRoman(n);
  if (r % 2 === 1) { const q = mcq(n, [n + 10, n - 1, n + 5]); return { stem: `${rom} = ?`, ...q, hint: 'I=1, V=5, X=10, L=50, C=100', explain: `${rom} is ${n}.` }; }
  const wrongs = new Set(); while (wrongs.size < 3) {
    const m = toRoman(Math.max(1, n + pick([-10, -5, 5, 10, 9, 1])));
    if (m !== rom) wrongs.add(m);
  }
  return { stem: `What is ${n} in Roman numerals?`, kind: 'mcq', options: shuffle([rom, ...wrongs]), answer: rom,
    hint: 'Biggest values first.', explain: `${n} = ${rom}.` };
};

H.coladd = (p, r) => {
  const d = p.digits + (r >= 4 ? 0 : 0);
  const carries = !!p.carries || r >= 2;
  const a = rnd(10 ** (d - 1), 10 ** d - 1);
  let b = rnd(10 ** (d - 1), 10 ** d - 1);
  if (!carries) { // avoid carries: max digit sums <= 9
    b = Number(String(b).split('').map((dg, i) => Math.min(Number(dg), 9 - Number(String(a).padStart(d, '0')[i]))).join('')) || b;
  } else if (r === 5) { // 3 addends
    const c = rnd(100, 999); const sum = a + b + c;
    return { stem: `${fmt(a)} + ${fmt(b)} + ${fmt(c)} = ?`, answer: sum, unit: null,
      hint: 'Add the ones, carry the tens.', explain: `${fmt(a)} + ${fmt(b)} + ${fmt(c)} = ${fmt(sum)}.` };
  }
  const sum = a + b;
  const oA = a % 10, oB = b % 10;
  return { stem: `${fmt(a)} + ${fmt(b)} = ?`, answer: sum,
    hints: [`Line up ones under ones, tens under tens. Start with the ones.`, `Ones: ${oA} + ${oB} = ${oA + oB}${oA + oB >= 10 ? ' — carry 1 into the tens!' : ''}`],
    hint: 'Line up the columns, add from the ones.', explain: `${fmt(a)} + ${fmt(b)} = ${fmt(sum)}.` };
};

H.colsub = (p, r) => {
  const d = p.digits;
  // count digit-wise borrows (b sits on the low d-1 columns)
  const cntBorrows = (a, b) => {
    const A = String(a).padStart(d, '0').split('').map(Number);
    const B = String(b).padStart(d, '0').split('').map(Number);
    let c = 0;
    for (let k = 1; k < d; k++) if (B[k] > A[k]) c++;
    return c;
  };
  // r1: guaranteed no borrowing. r2: 1–2 borrows. r3+: borrows, incl. zeros.
  let a = 0, b = 1;
  for (let t = 0; t < 80; t++) {
    a = rnd(10 ** (d - 1), 10 ** d - 1);
    if (p.zeroCross && r >= 3 && Math.random() < 0.5) a = Number(String(a)[0] + '0'.repeat(d - 1)) + rnd(0, 9);
    b = rnd(10 ** (d - 2), 10 ** (d - 1) - 1);
    if (a <= b) continue;
    const c = cntBorrows(a, b);
    if (r <= 1 && c === 0) break;
    if (r === 2 && c >= 1 && c <= 2) break;
    if (r >= 3 && c >= 1) break;
  }
  if (a <= b) a = b + rnd(100, 1000);
  const ans = a - b;
  const oA = a % 10, oB = b % 10;
  return { stem: `${fmt(a)} − ${fmt(b)} = ?`, answer: ans,
    hints: r <= 1 ? [`Subtract the ones, then the tens. No borrowing needed.`]
      : [`Start with the ones. ${oA} − ${oB}${oA < oB ? `: borrow from the tens!` : ` = ${oA - oB}`}`],
    hint: r <= 1 ? 'No borrowing needed — subtract each column.' :
      (p.zeroCross && r >= 3) ? 'Careful with zeros — you may need to borrow twice.' :
      'Subtract the ones first; borrow if needed.',
    explain: `${fmt(a)} − ${fmt(b)} = ${fmt(ans)}.` };
};

H.word = (p, r) => {
  const name = pick(NAMES); const max = 10 ** (r <= 1 ? 2 : r === 2 ? 3 : 4) - 1;
  const have = rnd(20, max); const gave = rnd(10, Math.min(have - 2, 1500)); const bought = rnd(10, 1800);
  if (r <= 3) {
    const ans = have - gave + bought;
    return { stem: `${name} has ${fmt(have)} star stickers. ${name} gives away ${fmt(gave)} and earns ${fmt(bought)} more. How many now?`,
      answer: ans, hint: 'Take away first, then add.', explain: `${fmt(have)} − ${fmt(gave)} + ${fmt(bought)} = ${fmt(ans)}.` };
  }
  const boxes = rnd(3, 12); const each = rnd(4, 25); const eaten = rnd(3, each * boxes - 2);
  const total = boxes * each; const ans = total - eaten;
  return { stem: `${name} packs ${boxes} boxes with ${each} berries each. A bird eats ${eaten}. How many berries are left?`,
    answer: ans, hint: 'Multiply first, then subtract.', explain: `${boxes} × ${each} = ${fmt(total)}; ${fmt(total)} − ${eaten} = ${fmt(ans)}.` };
};

H.tt = (p, r) => {
  const t = pick(p.tables);
  if (r <= 2) { const m = rnd(1, 12); return { stem: `${t} × ${m} = ?`, answer: t * m, hint: `${t} times ${m}.`, explain: `${t} × ${m} = ${t * m}.` }; }
  if (r === 3) { // inverse
    const m = rnd(2, 12); const prod = t * m;
    return { stem: `${prod} ÷ ${t} = ?`, answer: m, hint: 'Which number times the table makes the product?', explain: `${prod} ÷ ${t} = ${m} because ${t} × ${m} = ${prod}.` };
  }
  if (r === 4) { const m = rnd(2, 12); const prod = t * m; return { stem: `${t} × ? = ${prod}`, answer: m, hint: 'Division undoes it.', explain: `${prod} ÷ ${t} = ${m}.` }; }
  // rung 5: inverse/missing-element reasoning on the hardest facts
  const a = pick([11, 12]), b = pick([6, 7, 8, 9, 11, 12]); const prod = a * b;
  if (Math.random() < 0.5) return { stem: `? × ${a} = ${prod}`, answer: b, hint: `How many ${a}s make ${prod}?`, explain: `${b} × ${a} = ${prod}.` };
  return { stem: `${prod} ÷ ? = ${b}`, answer: a, hint: `What times ${b} makes ${prod}?`, explain: `${a} × ${b} = ${prod}.` };
};

H.lm = (p, r) => {
  const aD = r <= 1 ? 2 : r === 2 ? 3 : r === 3 ? 4 : p.aDigits;
  const bD = r <= 3 ? 1 : 2;
  const a = rnd(10 ** (aD - 1), 10 ** aD - 1);
  const b = rnd(10 ** (bD - 1), 10 ** bD - 1);
  // computed hints: the generator knows its own decomposition
  const tens = Math.floor(a / 10) * 10, ones = a % 10;
  const hints = [];
  if (bD === 1) {
    hints.push(`Split ${fmt(a)} into ${fmt(tens)} + ${ones}`);
    hints.push(`${fmt(tens)} × ${b} = ${fmt(tens * b)} and ${ones} × ${b} = ${ones * b} — add them`);
  } else {
    const bTens = Math.floor(b / 10) * 10, bOnes = b % 10;
    hints.push(`Partition the ${b}: ${b} = ${bTens} + ${bOnes}`);
    hints.push(`${fmt(a)} × ${bTens} = ${fmt(a * bTens)}; ${fmt(a)} × ${bOnes} = ${fmt(a * bOnes)} — add them`);
  }
  return { stem: `${fmt(a)} × ${b} = ?`, answer: a * b, hints,
    hint: bD === 2 ? 'Partition the second number: × tens, × ones, then add.' : 'Partition the big number: hundreds, tens, ones.',
    explain: `${fmt(a)} × ${b} = ${fmt(a * b)}.` };
};

H.div = (p, r) => {
  const d = r <= 2 ? 2 : 3;
  const divisor = pick(r === 1 ? [2] : r === 2 ? [3, 4, 5] : [6, 7, 8, 9]);
  let q = rnd(2, 10 ** (d - 1) + 20);
  const dividend = divisor * q;
  return { stem: `${fmt(dividend)} ÷ ${divisor} = ?`, answer: q,
    hints: [`Use your tables: ${divisor} × 5 = ${divisor * 5} and ${divisor} × 10 = ${divisor * 10} — where does ${fmt(dividend)} sit?`],
    hint: 'Use your times tables.', explain: `${fmt(dividend)} ÷ ${divisor} = ${q}.` };
};

H.pfa = (p, r) => {
  if (r <= 1) { const m = pick([2, 5, 10]); const isMult = Math.random() < 0.5;
    const q = isMult ? m * rnd(2, 12) : m * rnd(2, 12) + pick([1, 2, 3]);
    return { stem: `Is ${q} a multiple of ${m}?`, kind: 'mcq', options: ['yes', 'no'], answer: isMult ? 'yes' : 'no',
      hint: 'Count in steps of the number.', explain: isMult ? `It's in the ${m} times table.` : `It's NOT in the ${m} times table.` }; }
  if (r === 2) { const a = rnd(12, 30); const q = mcq(a / 2, [a / 2 + 1, a / 2 - 2, a - 10]); return { stem: `Half of ${a * 2} is…`, ...q, hint: 'Half = split into 2 equal parts.', explain: `${a * 2} ÷ 2 = ${a}.` }; }
  if (r === 3) { const n = pick([24, 36, 48]); const non = pick([5, 7, 9, 11].filter((x) => n % x !== 0)); const q = mcq(String(n / pick([2, 3, 4, 6, 8, 12].filter((x) => n % x === 0))), [String(non), String(n), String(n - 1)], { text: true }); return { stem: `Which of these is a factor pair partner for ${n}?`, options: shuffle([String(n / 2), String(n / 3), String(non), String(n + 1)]), answer: String(n / 2), hint: 'A factor divides exactly.', explain: `${n} ÷ 2 = ${n / 2}.` }; }
  if (r === 4) { const comps = [4, 6, 9, 15, 21, 25, 27, 33]; const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]; const prime = pick(primes);
    return { stem: `Which number is prime?`, kind: 'mcq', options: shuffle([String(prime), ...shuffle(comps).slice(0, 3).map(String)]), answer: String(prime),
      hint: 'Prime = only 1 and itself divide it.', explain: `${prime} has no factors except 1 and ${prime}.` }; }
  const a = rnd(10, 30) * 2, b = pick([4, 6, 8, 12]); const distractors = [pick([3, 5, 7, 9]), pick([10, 15, 20]), String(a + b)].filter((d) => String(d) !== '2');
  return { stem: `Which is a common factor of ${a} and ${b}?`, kind: 'mcq', options: shuffle(['2', ...new Set(distractors.map(String))].slice(0, 4).length >= 3 ? ['2', ...new Set(distractors.map(String))].slice(0, 4) : ['2', '3', '5', '7']), answer: '2', hint: 'Try small numbers first.', explain: `2 divides both ${a} and ${b}.` };
};

H.fracof = (p, r) => {
  if (p.unit) { const den = pick([2, 3, 4, 5, 10]); const whole = den * rnd(2, r <= 2 ? 4 : 9); const ans = whole / den;
    return { stem: `What is 1/${den} of ${whole}?`, answer: ans, hint: `Share ${whole} into ${den} equal groups.`, explain: `${whole} ÷ ${den} = ${ans}.` }; }
  const num = pick(r <= 2 ? [1, 2, 3] : [3, 4, 5]); const den = pick([4, 5, 6, 8, 10].filter((x) => x > num));
  const k = rnd(2, r <= 2 ? 4 : 10); const whole = den * k; const ans = (whole / den) * num;
  return { stem: `What is ${num}/${den} of ${whole}?`, answer: ans,
    hint: `First find 1/${den}, then multiply by ${num}.`, explain: `${whole} ÷ ${den} = ${whole / den}; × ${num} = ${ans}.` };
};

H.fracCmp = (p, r) => {
  const fs = (a, b) => `${a}/${b}`;
  if (r <= 2) { const den = pick([3, 4, 5, 8]); const a1 = rnd(1, den - 1), a2 = rnd(1, den - 1); if (a1 === a2) return H.fracCmp(p, r);
    const hi = Math.max(a1, a2); const ans = fs(hi, den);
    const pool = [];
    for (const n of [a1 + a2 > den ? den - 1 : a1 + a2, den, hi === den - 1 ? 1 : hi + 1]) {
      const f = fs(n, den);
      if (f !== ans && !pool.includes(f)) pool.push(f);
    }
    for (let x = 1; x <= den && pool.length < 2; x++) { const f = fs(x, den); if (f !== ans && !pool.includes(f)) pool.push(f); }
    return { stem: `Which is bigger: ${fs(a1, den)} or ${fs(a2, den)}?`, kind: 'mcq', options: shuffle([ans, ...pool]), answer: ans,
      hint: 'Same bottom number? Compare tops.', explain: `${ans} is bigger (same denominator, ${hi} is the larger numerator).` }; }
  if (r === 3) {
    const den = pick([6, 8, 10, 12]); const half = den / 2;
    const others = shuffle([...Array(den - 1).keys()].map((x) => x + 1).filter((x) => x !== half)).slice(0, 3);
    return { stem: `Which of these equals 1/2?`, kind: 'mcq',
      options: shuffle([fs(half, den), ...others.map((d) => fs(d, den))]), answer: fs(half, den),
      hint: 'Half means the denominator is double the numerator.', explain: `${fs(half, den)} = 1/2.` }; }
  // ordering three fractions with same denominator (distinct numerators)
  const den = pick([6, 8, 10]); // den-1 >= 5 so pool[3] is free
  const pool = shuffle([...Array(den - 1).keys()].map((x) => x + 1));
  const nums = pool.slice(0, 3);
  const extra = pool[3];
  const sorted = [...nums].sort((x, y) => y - x);
  return { stem: `Which of these is the smallest fraction?`, kind: 'mcq',
    options: shuffle([fs(sorted[2], den), fs(sorted[0], den), fs(sorted[1], den), fs(extra, den)]), answer: fs(sorted[2], den),
    hint: 'Same denominator: the smallest top number is the smallest fraction.',
    explain: `Order: ${fs(sorted[2], den)} < ${fs(sorted[1], den)} < ${fs(sorted[0], den)}.` };
};

H.decimals = (p, r) => {
  if (r <= 1) { const t = rnd(1, 9); const q = mcq(`${t} tenths`, [`${t} hundredths`, `${t * 10} tenths`, `${t} ones`], { text: true });
    return { stem: `0.${t} means…`, options: shuffle([`${t} tenths`, `${t} hundredths`, `${t * 10} hundredths`, `${t} ones`]), answer: `${t} tenths`, hint: 'First decimal place = tenths.', explain: `0.${t} = ${t}/10 = ${t} tenths.` }; }
  if (r === 2) { const a = rnd(1, 9), b = rnd(1, 9); const q = mcq(Number(`0.${a}${b}`), [Number(`${a}.${b}`), Number(`0.${b}${a}`), a + b]);
    return { stem: `What is ${a} tenths and ${b} hundredths as one decimal?`, ...q, hint: 'Tenths then hundredths.', explain: `${a}/10 + ${b}/100 = 0.${a}${b}.` }; }
  if (r === 3) { const x = Math.floor(rnd(11, 99)) / 100, y = Math.floor(rnd(11, 99)) / 100; const f2 = (v) => v.toFixed(2);
    const big = Math.max(x, y), small = Math.min(x, y); const ans = f2(big);
    const opts = [ans];
    const round2 = (v) => f2(Math.round(v * 100) / 100);
    for (const c of [small % 1, (x + y) % 1, big / 2, big - 0.05, big + 0.05, 1 - small]) {
      if (opts.length >= 4) break;
      const s2 = round2(c);
      if (s2 !== ans && !opts.includes(s2)) opts.push(s2);
    }
    for (let m = 1; opts.length < 4; m += 3) { const s2 = round2(Math.min(0.99, big + m / 100)); if (s2 !== ans && !opts.includes(s2)) opts.push(s2); }
    return { stem: `Which is bigger: ${f2(x)} or ${f2(y)}?`, kind: 'mcq', options: shuffle(opts), answer: ans,
      hint: 'Compare tenths first, then hundredths.', explain: `${ans} is the bigger decimal.` }; }
  let n, ones, t_, h_, adj;
  let guard = 0;
  do {
    n = rnd(111, 999) / 100;
    ones = Math.floor(n); t_ = Math.round((n * 10) % 10); h_ = Math.round((n * 100) % 10); adj = (h_ + 1) % 10;
    guard++;
  } while ((new Set([ones, t_, h_]).size < 3 || [ones, t_].includes(adj)) && guard < 200);
  return { stem: `In ${n.toFixed(2)} — what is the HUNDREDTHS digit?`, kind: 'mcq',
    options: shuffle([String(h_), String(t_), String(ones), String(adj)]), answer: String(h_),
    hint: 'Two places after the point: tenths, hundredths.', explain: `In ${n.toFixed(2)}, the hundredths digit is ${h_}.` };

};

H.decAS = (p, r) => {
  const money = (v) => `£${v.toFixed(2)}`;
  const r2 = (v) => Math.round(v * 100) / 100;
  // Ladder: whole pounds → pence → tenths → two decimals → change from notes
  if (r === 1) { const a = rnd(2, 20), b = rnd(2, 39); const ans = a + b;
    return { stem: `£${a} + £${b} = £?`, answer: ans, unit: '£',
      hint: 'Just add the whole pounds.', explain: `£${a} + £${b} = £${ans}.` }; }
  if (r === 2) { const a = rnd(10, 49), b = rnd(10, 49); const ans = a + b;
    return { stem: `${a}p + ${b}p = ? (in pence)`, answer: ans, unit: 'p',
      hint: 'Add the two pence numbers.', explain: `${a}p + ${b}p = ${ans}p.` }; }
  if (r === 3) { const a = rnd(11, 49) / 10, b = rnd(11, 49) / 10; const ans = r2(a + b);
    return { stem: `£${a.toFixed(2)} + £${b.toFixed(2)} = £?`, answer: ans, unit: '£',
      hint: 'Add the 10ps, then the pounds.', explain: `£${a.toFixed(2)} + £${b.toFixed(2)} = £${ans.toFixed(2)}.` }; }
  if (r === 4) { const a = rnd(199, 4999) / 100, b = rnd(199, 4999) / 100; const ans = r2(a + b);
    const pA = Math.round(a * 100) % 100, pB = Math.round(b * 100) % 100;
    return { stem: `${money(a)} + ${money(b)} = £?`, answer: ans, unit: '£',
      hints: [`Add the pence first: ${pA}p + ${pB}p = ${pA + pB}p${pA + pB >= 100 ? ' — carry the pound!' : ''}`],
      hint: 'Add the pence; carry into the pounds.', explain: `${money(a)} + ${money(b)} = ${money(ans)}.` }; }
  const paid = rnd(20, 50); const cost = rnd(199, 4999) / 100; const ans = r2(paid - cost);
  return { stem: `A book costs ${money(cost)}. You pay with £${paid}. How much change?`, answer: ans, unit: '£',
    hint: 'Subtract the price from what you paid.', explain: `£${paid} − ${money(cost)} = ${money(ans)}.` };
};

H.pct = (p, r) => {
  const pct = r <= 1 ? 50 : r === 2 ? 10 : r === 3 ? 25 : r === 4 ? 20 : pick([5, 15, 75]);
  const base = r <= 2 ? rnd(2, 20) * (r === 1 ? 2 : 10) : rnd(4, 40) * 10;
  const ans = (base * pct) / 100;
  return { stem: `What is ${pct}% of ${fmt(base)}?`, answer: ans,
    hint: r === 1 ? '50% is half.' : r === 2 ? '10% then ×.' : r === 3 ? '25% is a quarter.' : 'Find 10% × 2, or 5% pieces.',
    explain: `${pct}% of ${fmt(base)} = ${ans}.` };
};

H.money = H.decAS; // money concept reuses the decimal money generator

H.perim = (p, r) => {
  const w = rnd(2, r <= 2 ? 9 : 20), h = rnd(2, r <= 2 ? 9 : 20);
  if (r <= 2) { const ans = 2 * (w + h);
    return { stem: `A rectangle is ${w} cm by ${h} cm. What is its perimeter (cm)?`, answer: ans,
      hint: 'Perimeter = all the way round: 2 lengths + 2 widths.', explain: `2×${w} + 2×${h} = ${ans} cm.` }; }
  if (r === 3) { const per = 4 * w;
    return { stem: `A square has perimeter ${per} cm. How long is one side (cm)?`, answer: w, hint: 'All 4 sides equal.', explain: `${per} ÷ 4 = ${w} cm.` }; }
  if (r === 4) { const per = 2 * (w + h);
    return { stem: `A rectangle has perimeter ${per} m. One side is ${w} m. How long is the other side (m)?`, answer: h,
      hint: 'Half the perimeter is length + width.', explain: `${per} ÷ 2 = ${w + 6 > 0 ? w + h : h}... subtract ${w}: ${h} m.` }; }
  // rung 5: two rectangles joined — apply perimeter to a composite shape
  const w2 = rnd(2, 5), h2 = rnd(6, 9); // h2 is always the long side
  return { stem: `Two identical rectangles, each ${w2} cm by ${h2} cm, are joined along the long side. What is the perimeter of the new shape (cm)?`,
    answer: 2 * (w2 + 2 * h2), hint: 'Joined along the long side: the new shape is the same width but twice as tall.',
    explain: `New size: ${w2} by ${2 * h2} → 2 × ${w2} + 2 × ${2 * h2} = ${2 * (w2 + 2 * h2)} cm.` };
};

H.area = (p, r) => {
  const w = rnd(2, 12), h = rnd(2, 12);
  if (r <= 2) { const ans = w * h;
    return { stem: `A rectangle is ${w} cm by ${h} cm. What is its area (cm²)?`, answer: ans,
      hint: 'Area = length × width.', explain: `${w} × ${h} = ${ans}.` }; }
  if (r === 3) { const ar = w * h;
    return { stem: `A rectangle has area ${ar} cm² and one side ${w} cm. How long is the other side (cm)?`, answer: h,
      hint: 'Area ÷ one side.', explain: `${ar} ÷ ${w} = ${h}.` }; }
  const big = pick([9, 12, 15]); const cut = pick([4, 6, 8]);
  const ans = big * big - cut * cut;
  return { stem: `A square photo ${big} cm a side has a square corner ${cut} cm a side cut off. What is the area left (cm²)?`,
    answer: ans, hint: 'Both are squares: big area − small area.', explain: `${big}² − ${cut}² = ${big * big} − ${cut * cut} = ${ans}.` };
};

H.duration = (p, r) => {
  const mh = (m) => `${Math.floor(m / 60) > 0 ? Math.floor(m / 60) + 'h ' : ''}${m % 60 > 0 ? (m % 60) + 'min' : ''}`.trim() || '0';
  if (r <= 2) { const a = rnd(10, 55), b = rnd(10, 40); const ans = a + b;
    return { stem: `A film runs ${mh(a)} then ${mh(b)} more. How many minutes in total?`, answer: ans, hint: 'Add the minutes.', explain: `${a} + ${b} = ${ans} minutes.` }; }
  if (r === 3) { const start = rnd(7, 12) * 60 + pick([0, 15, 30, 45]); const dur = rnd(40, 130); const end = start + dur;
    const t = (min) => `${String(Math.floor((min % (24 * 60)) / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    const opts = [t(end)];
    for (const c of [end + 60, end - 60, end + 30, end - 45, end + 90]) {
      if (opts.length >= 4) break;
      const s2 = t(c);
      if (!opts.includes(s2)) opts.push(s2);
    }
    for (let m = 5; opts.length < 4; m += 20) { const s2 = t((end + m) % (24 * 60)); if (!opts.includes(s2)) opts.push(s2); }
    return { stem: `A bus leaves at ${t(start)} and the journey takes ${mh(dur)}. When does it arrive?`,
      kind: 'mcq', options: shuffle(opts), answer: t(end),
      hint: 'Add minutes past the hour.', explain: `${t(start)} + ${mh(dur)} = ${t(end)}.` }; }
  const d1 = rnd(1, 27), m1 = rnd(1, 12); const add = rnd(3, 25);
  const ans = add;
  return { stem: `A holiday starts on day ${d1} of a month and lasts ${add} days. On which day of the month does it end?`,
    answer: d1 + add - 1, hint: 'Counting the first day, the end day is start + length − 1.', explain: `${d1} + ${add} − 1 = ${d1 + add - 1}.` };
};

// ---------------------------------------------------------------------------
export function makeItem(concept, rung) {
  const r = Math.max(1, Math.min(5, rung));
  const h = HANDLERS[concept.gen.kind];
  if (!h) throw new Error(`no generator for kind ${concept.gen.kind}`);
  const out = h(concept.gen.params || {}, r);
  const isMcq = out.kind === 'mcq' || Array.isArray(out.options);
  const item = {
    key: `${concept.id}#r${r}#${Math.floor(Math.random() * 1e9)}`,
    conceptId: concept.id, rung: r,
    kind: isMcq ? 'mcq' : 'num',
    stem: out.stem, answer: out.answer, hint: out.hint || '', explain: out.explain || '',
    hints: Array.isArray(out.hints) ? out.hints.filter(Boolean) : [],
    unit: out.unit || null,
  };
  if (item.kind === 'mcq') {
    if (!out.options || !Array.isArray(out.options) || out.options.length < 2) throw new Error(`bad MCQ options for ${concept.id}`);
    if (!out.options.includes(String(out.answer))) throw new Error(`MCQ answer missing from options: ${concept.id} r${r}: ${out.answer} ∉ ${JSON.stringify(out.options)}`);
    item.options = out.options;
    const corrects = out.options.filter((o) => o === String(out.answer)).length;
    if (corrects !== 1) throw new Error(`MCQ has ${corrects} correct options for ${concept.id}`);
  } else {
    item.answer = Number(out.answer);
    if (!Number.isFinite(item.answer)) throw new Error(`non-numeric answer for ${concept.id}`);
  }
  return item;
}
