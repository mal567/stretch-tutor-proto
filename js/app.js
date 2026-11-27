// App — view routing, kid UI, mission flow, parent dashboard.
import { STRANDS, GRAPH } from './graph.js';
import { makeItem } from './gen.js';
import {
  defaultState, startPlacement, placementFollowUp, applyPlacementResult, finishPlacement,
  buildDailySession, updateAttempt, finishSession, parentSummary, sessionsToday,
} from './engine.js';
import { loadState, saveState, clearAll } from './db.js';

const $app = document.getElementById('app');
let state = null;
let wsDemos = 0; // workspace ghost-demo counter (first 2 opens per app launch)

// ---- The voice of Stretch McGroo: whimsy in the framing, never in the maths.
// Garnish fires sporadically (~1 in 5 items); praise often; jokes on a miss
// are rare and always self-deprecating (never at the child). Probes stay plain.
const GARNISH = [
  'The Sovereign of the Slightly Suspected Realms demands to know:',
  'Sir Stretch McGroo, Master of All Beasts of the Earth, requests:',
  'The Supreme Architect of Grandiosity wonders:',
  'By royal decree of McGroo, answer this:',
  "Stretch's fish cabinet has debated and agreed to ask:",
];
const PRAISE = [
  'Royal approval! 👑', 'McGroo is impressed. Very.', 'The Beasts of the Earth salute you! 🦁',
  'Grandiose. Utterly grandiose.', 'The fish cabinet applauds (bubbles). 🫧', 'The Realms are nourished. 🏰',
];
const MISS = [
  "Even the Supreme Architect gets that wrong sometimes.",
  "McGroo once said 4007. We don't talk about it.",
  "The realms forgive. Look at the how. 🧭",
];
const DONE = [
  'Magnificent. McGroo bows. Actually bows. 🎩',
  'The Known and Slightly Suspected Realms are in your debt. 🏰',
  'McGroo has written this down in the Grand Book of Grandiosity. 📜',
  'The fish cabinet has declared today a holiday. 🐟',
];
const maybe = (arr, p) => (Math.random() < p ? arr[Math.floor(Math.random() * arr.length)] : null);

// Never fail silently while a child is testing this.
window.addEventListener('error', (e) => {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#b91c1c;color:#fff;padding:10px 14px;font-size:.9rem;z-index:99';
  bar.textContent = `⚠️ Something broke: ${e.message} — tell the grown-up.`;
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 6000);
});

// ---------- tiny view helper ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
function render(html) { $app.innerHTML = html; }
function el(id) { return document.getElementById(id); }
const speak = (text) => { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} };
// Speech engines mangle maths symbols — say the question in words.
const speakable = (s) => s
  .replace(/×/g, ' times ')
  .replace(/÷/g, ' divided by ')
  .replace(/−/g, ' minus ')
  .replace(/\+/g, ' plus ')
  .replace(/(\d+)\/(\d+)/g, '$1 over $2')
  .replace(/£/g, ' ')
  .replace(/=/g, ' ')
  .replace(/\?/g, ' ')
  .replace(/−|^-(\d)/g, (_, d) => (d ? `negative ${d}` : 'negative '))
  .replace(/-(\d)/g, ' negative $1')
  .replace(/\s+/g, ' ')
  .trim();

// ---------- boot ----------
async function boot() {
  state = await loadState();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (!localStorage.getItem('stretchIntroSeen')) { viewIntro(); return; }
  if (!state) viewWelcome();
  else if (!state.placement.done) viewPlacementIntro();
  else viewHome();
}

// First-launch McGroo intro: pompous title → forced "Hmmmm" → deflation.
function viewIntro() {
  render(`
    <div class="view" style="justify-content:center;text-align:center;gap:18px">
      <div style="font-size:5rem" id="masc">🦁</div>
      <h1 id="it1" style="opacity:1;transition:opacity .9s">Hi, I'm Stretch McGroo.</h1>
      <div id="it2" style="display:none;transition:opacity .9s">
        <h2>But you can call me</h2>
        <p style="font-size:1.05rem;line-height:1.6"><b>His Royal Highness, the Eminent, Imperial, and
        Magnanimous Excellency, Sovereign of the Known and Slightly Suspected Realms,
        Supreme Architect of Grandiosity, Master of All Beasts of the Earth and
        Fishes of the Seas, Sir Stretch McGroo</b></p>
        <button class="big" id="hmm" style="width:100%;max-width:300px;margin:0 auto">Hmmmm</button>
      </div>
      <div id="it3" style="display:none;transition:opacity .9s">
        <h2>…okay, since it's you — you can just call me Stretch.</h2>
        <button class="big" id="go" style="width:100%;max-width:300px;margin:0 auto">Let's go ➡️</button>
      </div>
    </div>`);
  const fadeOut = (id) => { const e = el(id); e.style.opacity = 0; return new Promise((r) => setTimeout(r, 900)); };
  setTimeout(async () => {
    await fadeOut('it1');
    el('it1').style.display = 'none';
    el('it2').style.display = 'block';
    el('hmm').onclick = async () => {
      await fadeOut('it2');
      el('it2').style.display = 'none';
      el('it3').style.display = 'block';
      el('go').onclick = () => { localStorage.setItem('stretchIntroSeen', '1'); viewWelcome(); };
    };
  }, 1800);
}

// ---------- welcome ----------
function viewWelcome() {
  render(`
    <div class="view" style="justify-content:center; text-align:center; gap:14px;">
      <div style="font-size:4rem">🚀</div>
      <h1>Maths Stretch</h1>
      <p class="muted">10 minutes a day. It finds your level, then gently pushes.</p>
      <div class="card" style="text-align:left">
        <label style="font-weight:700">What's your name?</label>
        <input id="nm" style="width:100%;font-size:1.4rem;padding:12px;border-radius:12px;border:2px solid #c7d2fe;margin-top:6px" maxlength="14" placeholder="first name">
        <label style="font-weight:700;margin-top:12px;display:block">Your year at school</label>
        <div class="opts" id="yr" style="grid-template-columns:1fr 1fr 1fr">
          ${[3, 4, 5].map((y) => `<button data-y="${y}" style="${y === 4 ? '' : 'opacity:.85'}">Year&nbsp;${y}</button>`).join('')}
        </div>
      </div>
      <button class="big" id="go" disabled style="width:100%">Let's go ➡️</button>
      <p class="muted" style="font-size:.8rem">Everything stays on this device. No accounts, no cloud.</p>
    </div>`);
  let chosenYear = 4;
  const nm = el('nm');
  nm.oninput = () => el('go').disabled = nm.value.trim().length < 1;
  el('yr').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    chosenYear = Number(b.dataset.y);
    [...el('yr').children].forEach((x) => x.style.background = '');
    b.style.background = '#16a34a';
  };
  el('go').onclick = async () => {
    state = defaultState(nm.value.trim(), chosenYear);
    await saveState(state);
    viewPlacementIntro();
  };
}

// ---------- placement ----------
function viewPlacementIntro() {
  const name = state.child ? state.child.name : '';
  render(`
    <div class="view" style="justify-content:center;text-align:center;gap:12px">
      <div style="font-size:3.5rem">🧭</div>
      <h1>Hi ${esc(name)} — first, a quick explore!</h1>
      <p class="muted" style="max-width:480px;margin:0 auto">About 10 questions so we can find what's easy, what's just right, and what's next. Don't worry about wrong answers — they help us!</p>
      <button class="big" id="pl" style="width:100%;max-width:420px;margin:0 auto">Start exploring</button>
    </div>`);
  el('pl').onclick = () => runMission(startPlacement(state), { placement: true });
}

// ---------- home ----------
function viewHome() {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = sessionsToday(state);
  const doneToday = todayCount > 0;
  const bonusLeft = state.settings.bonus && todayCount >= 1 && todayCount < 3;
  render(`
    <div class="view" style="justify-content:center;text-align:center;gap:12px">
      <div class="chips">
        <div class="chip">🔥 ${state.streakDays} day streak</div>
        <div class="chip coins">🪙 ${state.coins} coins</div>
      </div>
      <h1>Hey ${esc(state.child.name)} 👋</h1>
      ${!doneToday
        ? `<button class="big" id="strt" style="width:100%">▶️ Today's 10 minutes</button>`
        : `<div class="card"><div class="stars">⭐️⭐️⭐️</div><p>Today's mission is done — brilliant!</p></div>
           ${bonusLeft ? `<button class="big" id="bonus" style="width:100%;background:#16a34a;box-shadow:0 3px 0 #15803d">➕ Bonus round</button>` : ''}`}
      <button class="ghost" id="prog" style="max-width:260px;margin:0 auto;font-size:1rem">🌟 My progress</button>
      <button class="ghost" id="par" style="max-width:260px;margin:0 auto;font-size:1rem">Parent area</button>
    </div>`);
  if (el('strt')) el('strt').onclick = () => runMission(buildDailySession(state), { placement: false });
  if (el('bonus')) el('bonus').onclick = () => runMission(buildDailySession(state), { placement: false });
  el('prog').onclick = viewKidProgress;
  el('par').onclick = viewParentGate;
}

// kid-facing progress: coins, streak, and per-strand rungs as dots.
// No year labels, no curriculum language (Principle 4) — just climbing.
function viewKidProgress() {
  const sum = parentSummary(state);
  const mastered = Object.values(state.concepts).filter((c) => c.mastered).length;
  render(`
    <div class="view" style="gap:14px">
      <h2>🌟 ${esc(state.child.name)}'s progress</h2>
      <div class="kv" style="justify-content:center">
        <div class="stat"><b>🪙 ${state.coins}</b><span>coins</span></div>
        <div class="stat"><b>🔥 ${state.streakDays}</b><span>days in a row</span></div>
        <div class="stat"><b>🏅 ${mastered}</b><span>mastered skills</span></div>
      </div>
      ${sum.rows.map((r) => {
        const dots = [1, 2, 3, 4, 5].map((n) => n <= r.rung ? '●' : '○').join(' ');
        return `<div class="card" style="padding:12px 16px">
          <div class="row spread"><b>${r.emoji} ${esc(r.strand)}</b><span style="letter-spacing:.15em">${dots}</span></div>
        </div>`;
      }).join('')}
      <button id="bk" style="width:100%">⬅️ Back</button>
    </div>`);
  el('bk').onclick = viewHome;
}

// ---------- mission runner ----------
function runMission(plan, opts = {}) {
  if (!plan.length) { viewHome(); return; }
  const t0 = Date.now();
  const LIMIT = 10 * 60 * 1000;
  let i = 0, results = [], correctCount = 0;
  let pokeTimer = null;

  function over() {
    const spent = Date.now() - t0;
    if (opts.placement) {
      finishPlacement(state);
      saveState(state);
      viewPlacementDone();
    } else {
      const fin = finishSession(state, results);
      saveState(state);
      viewDone(fin, spent);
    }
  }

  // Staged scaffolding: question alone → nudge to workspace (✏️) → hint 1
  // → worked example on a SIBLING question (different numbers, so her item
  // still measures). Any activity resets the current stage timer; stages
  // advance only on stillness. Placement keeps the simple nudge.
  let stage = 0, hintShown = 0, hintLevels = [];
  function armNudge() {
    clearTimeout(pokeTimer);
    const t = opts.placement ? 30_000 : [20_000, 20_000, 25_000][Math.min(stage, 2)];
    pokeTimer = setTimeout(fireStage, t);
  }
  function fireStage() {
    if (opts.placement) { const n = document.getElementById('nudge'); if (n) n.style.display = 'block'; return; }
    if (stage === 0) {
      stage = 1;
      const b = document.getElementById('padBtn');
      if (b) { b.classList.add('pulse'); setTimeout(() => b.classList.remove('pulse'), 4000); }
      const cap = document.getElementById('wscap');
      if (cap) cap.style.display = 'block';
    } else if (stage === 1) {
      stage = 2;
      showHint();
      armNudge();
    } else if (stage === 2) {
      stage = 3;
      showWorkedExample();
    }
  }
  function showHint() {
    const zone = document.getElementById('hintzone');
    if (!zone) return;
    hintShown++;
    zone.innerHTML = hintShown <= hintLevels.length
      ? `<div style="margin-top:12px;background:#eef2ff;border-radius:14px;padding:10px 14px;font-size:1rem">💡 ${esc(hintLevels[hintShown - 1])}</div>`
      : `<div style="margin-top:12px;background:#eef2ff;border-radius:14px;padding:10px 14px;font-size:1rem">💪 That's all the hints — you've got this!</div>`;
    requestAnimationFrame(() => zone.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
  function showWorkedExample() {
    const cur = plan[i]; const it = cur.item || cur;
    const zone = document.getElementById('hintzone');
    let sib = null;
    try { sib = makeItem(GRAPH.byId.get(it.conceptId), it.rung); } catch {}
    if (!sib || !(sib.hints && sib.hints.length)) {
      zone.innerHTML = `<div style="margin-top:12px;background:#eef2ff;border-radius:14px;padding:10px 14px;font-size:1rem">💪 Take your best guess — wrong answers help too! (Or tap skip 🤔)</div>`;
      return;
    }
    const steps = [...sib.hints, sib.explain];
    zone.innerHTML = `<div style="margin-top:12px;background:#e0f2fe;border-radius:14px;padding:10px 14px;font-size:1rem">
      📝 One like yours, worked out:<br>
      <b>${esc(sib.stem)}</b><br>
      ${steps.map((s) => esc(s)).join('<br>')}<br>
      <i>Now try yours!</i></div>`;
    requestAnimationFrame(() => zone.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function step() {
    clearTimeout(pokeTimer);
    if (i >= plan.length || Date.now() - t0 > LIMIT) return over();
    const p = plan[i];
    const it = p.item || p; // daily sessions wrap items; placement passes bare items
    const mode = p.mode || 'new';
    stage = 0; hintShown = 0;
    hintLevels = [...new Set([it.hint, ...(it.hints || [])].filter(Boolean))];
    const n = i + 1, total = plan.length;
    render(`
      <div class="view">
        <div class="row spread"><div class="muted">Question ${n} of ${total}</div><div class="muted">⏱ ${Math.max(0, Math.ceil((LIMIT - (Date.now() - t0)) / 60000))} min</div></div>
        <div class="progress"><div style="width:${(i / total) * 100}%"></div></div>
        <div class="card">
          <div class="qnum">${opts.placement
            ? '🧭 Explorer'
            : mode === 'review' ? '🔁 Quick review'
            : mode === 'stretch' ? '🚀 Challenge'
            : `🆕 New stuff${maybe(GARNISH, 0.2) ? `<br><span style="color:#6d28d9">${esc(maybe(GARNISH, 1))}</span>` : ''}`}</div>
          <div class="qtext" id="qt">${esc(it.stem)}</div>
          <div id="wscap" style="display:none;margin-top:10px;background:#fef3c7;border-radius:12px;padding:8px 12px;font-size:.95rem;color:#4338ca">
            ✏️ Try writing the first bit down — like the first part of the sum — so you don't have to hold it in your head
          </div>
          <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="ghost" id="spk" style="font-size:.95rem;padding:8px 14px">🔊 Read it</button>
            <button class="ghost" id="padBtn" style="font-size:.95rem;padding:8px 14px">✏️ Working out</button>
            <button class="ghost" id="hintBtn" style="font-size:.95rem;padding:8px 14px">💡 Help</button>
            ${opts.placement ? '<button class="ghost" id="skip" style="font-size:.95rem;padding:8px 14px">🤔 Not sure yet</button>' : ''}
          </div>
          <div id="padzone" style="display:none;margin-top:12px">
            <canvas id="pad" style="width:100%;height:170px;border:2px dashed #c7d2fe;border-radius:12px;background:#f8fafc;touch-action:none"></canvas>
            <button class="ghost" id="padClr" style="font-size:.85rem;padding:5px 10px;margin-top:6px">Clear ✏️</button>
          </div>
          <div id="hintzone"></div>
          <div id="nudge" style="display:none;margin-top:12px;background:#fef3c7;border-radius:14px;padding:10px 14px;font-size:1rem">
            ${opts.placement
              ? 'Take your time 🙂 or tap <b>Not sure yet</b> to move on — either is fine!'
              : 'Stuck? Try ✏️ or 💡 — or take your best guess, wrong answers help too! 🙂'}
          </div>
          <div id="ansarea"></div>
        </div>
      </div>`);
    el('spk').onclick = () => { armNudge(); speak(speakable(it.stem)); };
    if (el('skip')) el('skip').onclick = () => { armNudge(); grade(false, null, true); };
    wireScratchpad(it);
    wireHints();
    if (it.kind === 'mcq') drawMCQ(it); else drawPad(it);
    armNudge();
  }

  // finger-drawing scratchpad: externalise working memory, write like on paper.
  // First 2 opens (per app launch): a ghost hand demonstrates the method on a
  // SIBLING question — write first part down, then the next, then add.
  function wireScratchpad(it) {
    let drawing = false;
    const zone = document.getElementById('padzone');
    const btn = document.getElementById('padBtn');
    const cv = document.getElementById('pad');
    const clr = document.getElementById('padClr');
    btn.onclick = () => { armNudge(); zone.style.display = zone.style.display === 'none' ? 'block' : 'none'; sizeCanvas(); if (zone.style.display === 'block' && wsDemos < 2) ghostDemo(it, cv); };
    clr.onclick = () => { armNudge(); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); };
    function sizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = 170;
      cv.width = w * dpr; cv.height = h * dpr;
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
      ctx.fillStyle = '#475569';
      ctx.clearRect(0, 0, w, h);
    }
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    cv.onpointerdown = (e) => { drawing = true; armNudge(); const c = cv.getContext('2d'); const [x, y] = pos(e); c.beginPath(); c.moveTo(x, y); };
    cv.onpointermove = (e) => { if (!drawing) return; armNudge(); const c = cv.getContext('2d'); const [x, y] = pos(e); c.lineTo(x, y); c.stroke(); };
    cv.onpointerup = cv.onpointercancel = () => { drawing = false; };
  }

  function ghostDemo(it, cv) {
    wsDemos++;
    let sib = null;
    try { sib = makeItem(GRAPH.byId.get(it.conceptId), it.rung); } catch {}
    if (!sib || !(sib.hints && sib.hints.length)) return;
    const ctx = cv.getContext('2d');
    ctx.font = '22px "Comic Sans MS", "Segoe Print", "Brush Script MT", cursive';
    ctx.fillStyle = '#64748b';
    const lines = [`like this: ${sib.stem}`, ...sib.hints, sib.explain, 'now you try yours! ✏️'].filter(Boolean);
    let li = 0, ci = 0, y = 28;
    (function tick() {
      if (li >= lines.length) return;
      const line = lines[li];
      ci++;
      ctx.clearRect(0, y - 22, cv.width, 28);
      ctx.fillText(line.slice(0, ci), 14, y);
      if (ci >= line.length) { li++; ci = 0; y += 30; }
      setTimeout(tick, 55);
    })();
  }

  // 💡 button feeds the shared staged hint ladder (manual taps never hurt)
  function wireHints() {
    const btn = document.getElementById('hintBtn');
    btn.onclick = () => { armNudge(); showHint(); };
  }

  function drawMCQ(it) {
    const cols = it.options.some((o) => o.length > 14) ? 'cols1' : '';
    el('ansarea').innerHTML = `<div class="opts ${cols}">${it.options.map((o) => `<button data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="fb"></div>`;
    el('ansarea').querySelectorAll('.opts button').forEach((b) => {
      b.onclick = () => {
        armNudge(); // any tap resets the stillness clock
        const chosen = b.dataset.o;
        grade(chosen === String(it.answer), chosen);
      }
    });
  }

  function drawPad(it) {
    let buf = '';
    el('ansarea').innerHTML = `
      <div class="ansbox" id="ab"><span style="color:#6366f1">${it.unit || ''}</span>&nbsp;</div>
      <div class="pad">
        ${[1,2,3,4,5,6,7,8,9,'.',0,'⌫'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}
        <button class="good" data-k="ok" style="grid-column: 2 / 4;">Check ✔️</button>
      </div><div id="fb"></div>`;
    const upd = () => el('ab').innerHTML = `<span style="color:#6366f1">${it.unit || ''}</span> ${buf || '\u00a0'}`;
    el('ansarea').querySelectorAll('.pad button').forEach((b) => {
      b.onclick = () => {
        armNudge(); // any tap resets the stillness clock
        const k = b.dataset.k;
        if (k === '⌫') buf = buf.slice(0, -1);
        else if (k === 'ok') { if (buf) grade(Number(buf) === it.answer, buf); return; }
        else if (buf.length < 10) buf += (k === '.' && buf.includes('.')) ? '' : k;
        upd();
      };
    });
    upd();
  }

  function grade(ok, shown, skipped = false) {
    clearTimeout(pokeTimer); // question is settled — no more nudges
    const p = plan[i];
    const it = p.item || plan[i];
    // lock buttons
    el('ansarea').querySelectorAll('button').forEach((b) => (b.disabled = true));
    if (el('spk')) el('spk').disabled = true;
    if (el('skip')) el('skip').disabled = true;

    if (opts.placement) {
      // adaptive probe chain: probe → one confirm follow-up → frontier set
      if (p.mode === 'probe') {
        const fu = placementFollowUp(state, p.strand, ok);
        plan.splice(i + 1, 0, { mode: 'place-confirm', item: fu.item, strand: fu.strand,
          targetIfCorrect: fu.targetIfCorrect, targetIfWrong: fu.targetIfWrong });
      } else if (p.mode === 'place-confirm') {
        applyPlacementResult(state, p.strand, ok ? p.targetIfCorrect : p.targetIfWrong);
      }
    } else {
      results.push(ok); updateAttempt(state, it, ok); if (ok) correctCount++;
    }

    const fb = el('fb');
    const praise = ok ? maybe(PRAISE, 0.5) : null;
    const missLine = (!ok && !skipped) ? maybe(MISS, 0.3) : null;
    fb.innerHTML = `${skipped
        ? `<div class="feed no">Skipping is what good explorers do! 🧭</div>`
        : `<div class="feed ${ok ? 'ok' : 'no'}">${ok ? '✅ Yes! ' : '❌ Not quite. '}${esc(it.explain)}
           ${praise ? `<br><b>${esc(praise)}</b>` : ''}${missLine ? `<br><i>${esc(missLine)}</i>` : ''}
           <button class="ghost" id="hear" style="font-size:.85rem;padding:5px 10px;margin-left:6px">🔊 hear it</button></div>`}
      <button class="big" id="nx" style="width:100%;margin-top:12px">${i + 1 >= plan.length ? 'Finish 🎉' : 'Next ➡️'}</button>`;
    // voice is ALWAYS opt-in: nothing is ever spoken automatically on a wrong
    // answer (child feedback: spoken corrections felt like public shaming)
    if (el('hear')) el('hear').onclick = () => speak(speakable(it.explain));
    if (ok) { try { navigator.vibrate?.(40); } catch {} }
    i = i + 1;
    el('nx').onclick = step;
    // the Next button must be visible without hunting for it (tablets, phones)
    requestAnimationFrame(() => el('nx').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  step();
}

function viewPlacementDone() {
  const sum = parentSummary(state);
  render(`
    <div class="view" style="justify-content:center;text-align:center;gap:12px">
      <div style="font-size:3.5rem">🎯</div>
      <h1>Found your level, ${esc(state.child.name)}!</h1>
      <p class="muted">We'll start here and go at your pace. You earned 🪙 ${state.coins} coins for the explore!</p>
      <div class="card">${sum.rows.map((r) => `<div class="row spread" style="padding:6px 0"><span>${r.emoji} ${esc(r.frontier)}</span></div>`).join('')}</div>
      <button class="big" id="home" style="width:100%">Let's play!</button>
    </div>`);
  el('home').onclick = viewHome;
}

function viewDone(fin, spent) {
  const mins = Math.max(1, Math.round(spent / 60000));
  const stars = fin.pct >= 0.9 ? '⭐️⭐️⭐️' : fin.pct >= 0.7 ? '⭐️⭐️' : '⭐️';
  render(`
    <div class="view" style="justify-content:center;text-align:center;gap:12px">
      <div style="font-size:3.5rem">🏆</div>
      <h1>Mission complete!</h1>
      <div class="stars">${stars}</div>
      <p>${Math.round(fin.pct * 100)}% correct in ${mins} min — <b>+🪙 ${fin.coins} coins</b></p>
      ${maybe(DONE, 1) ? `<p style="font-size:1.05rem"><b>${esc(maybe(DONE, 1))}</b></p>` : ''}
      <p class="muted">Streak: ${state.streakDays} day${state.streakDays === 1 ? '' : 's'} in a row</p>
      <div class="card">${parentSummary(state).rows.map((r) => `<div class="row spread" style="padding:6px 0"><span>${r.emoji} ${esc(r.frontier)}</span><span class="muted">rung ${r.rung}/5 ${r.mastered ? '✅' : ''}</span></div>`).join('')}</div>
      <button class="big" id="home" style="width:100%">Done</button>
    </div>`);
  el('home').onclick = viewHome;
}

// ---------- parent ----------
function viewParentGate() {
  const a = Math.floor(Math.random() * 21) + 10, b = Math.floor(Math.random() * 21) + 10;
  render(`
    <div class="view" style="justify-content:center;text-align:center;gap:12px">
      <h2>🔒 Grown-ups only</h2>
      <p class="muted">What is ${a} + ${b}?</p>
      <input id="pin" type="number" inputmode="numeric" style="font-size:1.6rem;padding:12px;width:200px;text-align:center;border-radius:12px;border:2px solid #c7d2fe">
      <div class="row" style="justify-content:center"><button id="pk" class="good">Enter</button><button id="bk" class="ghost">Back</button></div>
    </div>`);
  el('bk').onclick = viewHome;
  el('pk').onclick = () => { Number(el('pin').value) === a + b ? viewParent() : (el('pin').value = '', el('pin').placeholder = 'try again'); };
}

function viewParent() {
  const s = parentSummary(state);
  render(`
    <div class="view">
      <h2>Parent area — ${esc(state.child.name)}, Year ${state.child.year}</h2>
      <div class="kv">
        <div class="stat"><b>🪙 ${state.coins}</b><span>coins earned</span></div>
        <div class="stat"><b>🔥 ${state.streakDays}</b><span>day streak</span></div>
        <div class="stat"><b>${s.masteredCount}</b><span>concepts mastered</span></div>
        <div class="stat"><b>+${s.weekCoins}</b><span>coins this week</span></div>
        <div class="stat"><b>▲ ${s.rungUps}</b><span>level-ups this week</span></div>
      </div>
      <table class="pw">
        <tr><th>Strand</th><th>Working on</th><th>vs curriculum</th><th>Rung</th><th>Status</th></tr>
        ${s.rows.map((r) => `<tr><td>${r.emoji} ${esc(r.strand)}</td><td>${esc(r.frontier)} <span class="muted">(Y${r.frontierYear})</span></td>
          <td><span class="pill ${r.position.cls}">${esc(r.position.label)}</span></td><td>${r.rung}/5</td>
          <td>${r.mastered ? '<span class="pill ok">mastered → moving on</span>' : r.due ? `<span class="pill due">${r.due} due for review</span>` : '<span class="pill new">in progress</span>'}</td></tr>`).join('')}
      </table>
      <h3 style="margin:8px 0 4px">Recent sessions</h3>
      <table class="pw">${s.sessions.slice(-7).reverse().map((x) => `<tr><td>${new Date(x.t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>${x.correct}/${x.total}</td><td>${Math.round(100 * x.correct / x.total)}%</td></tr>`).join('') || '<tr><td class="muted">none yet</td></tr>'}</table>
      <p class="muted" style="font-size:.85rem">Prototype note: this summary, plus coins and streaks, is the stub of the milestone-ledger rewards layer. The maths engine (what's mastered, what's due, what's next) is deliberate and fully local — no AI runs during practice.</p>
      <p class="muted" style="font-size:.8rem;margin-top:-6px">Version: <b>v0.2.1</b> (if this doesn't say v0.2.1, fully close and reopen the app twice)</p>
      <div class="row"><button id="exp" class="ghost">Export data (JSON)</button><button id="bn" class="ghost">${state.settings.bonus ? 'Bonus rounds: ON (tap to turn off)' : 'Bonus rounds: OFF (tap to turn on)'}</button><button id="rst" class="ghost" style="color:#b91c1c">Reset</button></div>
      <button id="bk2" style="margin-top:14px">⬅️ Back</button>
    </div>`);
  el('bk2').onclick = viewHome;
  el('exp').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `stretch-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  el('bn').onclick = async () => { state.settings.bonus = !state.settings.bonus; await saveState(state); viewParent(); };
  el('rst').onclick = async () => {
    if (confirm('Delete all progress on this device? This cannot be undone.')) {
      await clearAll(); state = null; viewWelcome();
    }
  };
}

boot();
