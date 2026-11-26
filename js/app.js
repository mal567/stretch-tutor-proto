// App — view routing, kid UI, mission flow, parent dashboard.
import { STRANDS, GRAPH } from './graph.js';
import { makeItem } from './gen.js';
import {
  defaultState, quickPlace, applyPlacement, buildDailySession,
  updateAttempt, finishSession, parentSummary,
} from './engine.js';
import { loadState, saveState, clearAll } from './db.js';

const $app = document.getElementById('app');
let state = null;

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
  if (!state) viewWelcome();
  else if (!state.placement.done) viewPlacementIntro();
  else viewHome();
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
  el('pl').onclick = () => runMission(quickPlace(state), { placement: true });
}

// ---------- home ----------
function viewHome() {
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = state.sessions.length && new Date(state.sessions[state.sessions.length - 1].t).toISOString().slice(0, 10) === today;
  const sum = parentSummary(state);
  render(`
    <div class="view" style="justify-content:center;text-align:center;gap:12px">
      <div class="chips">
        <div class="chip">🔥 ${state.streakDays} day streak</div>
        <div class="chip coins">🪙 ${state.coins} coins</div>
      </div>
      <h1>Hey ${esc(state.child.name)} 👋</h1>
      ${doneToday
        ? `<div class="card"><div class="stars">⭐️⭐️⭐️</div><p>You're done for today — brilliant! Come back tomorrow to keep your streak.</p></div>`
        : `<button class="big" id="strt" style="width:100%">▶️ Today's 10 minutes</button>`}
      <button class="ghost" id="par" style="max-width:260px;margin:0 auto;font-size:1rem">Parent area</button>
    </div>`);
  if (el('strt')) el('strt').onclick = () => runMission(buildDailySession(state), { placement: false });
  el('par').onclick = viewParentGate;
}

// ---------- mission runner ----------
function runMission(plan, opts = {}) {
  if (!plan.length) { viewHome(); return; }
  const t0 = Date.now();
  const LIMIT = 10 * 60 * 1000;
  let i = 0, results = [], correctCount = 0;
  const placementResults = [];
  let pokeTimer = null;

  function over() {
    const spent = Date.now() - t0;
    if (opts.placement) {
      applyPlacement(state, placementResults);
      saveState(state);
      viewPlacementDone();
    } else {
      const fin = finishSession(state, results);
      saveState(state);
      viewDone(fin, spent);
    }
  }

  // Stillness nudge: after N seconds with no taps, gently offer a way out.
  // Never auto-advances, never counts down, fires once per question.
  const NUDGE_MS = opts.placement ? 30_000 : 45_000;
  function armNudge() {
    clearTimeout(pokeTimer);
    pokeTimer = setTimeout(() => {
      const n = document.getElementById('nudge');
      if (n) n.style.display = 'block';
    }, NUDGE_MS);
  }

  function step() {
    clearTimeout(pokeTimer);
    if (i >= plan.length || Date.now() - t0 > LIMIT) return over();
    const p = plan[i];
    const it = p.item || p; // daily sessions wrap items; placement passes bare items
    const mode = p.mode || 'new';
    const n = i + 1, total = plan.length;
    render(`
      <div class="view">
        <div class="row spread"><div class="muted">Question ${n} of ${total}</div><div class="muted">⏱ ${Math.max(0, Math.ceil((LIMIT - (Date.now() - t0)) / 60000))} min</div></div>
        <div class="progress"><div style="width:${(i / total) * 100}%"></div></div>
        <div class="card">
          <div class="qnum">${mode === 'review' ? '🔁 Quick review' : mode === 'stretch' ? '🚀 Challenge' : '🆕 New stuff'}</div>
          <div class="qtext" id="qt">${esc(it.stem)}</div>
          <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="ghost" id="spk" style="font-size:.95rem;padding:8px 14px">🔊 Read it to me</button>
            ${opts.placement ? '<button class="ghost" id="skip" style="font-size:.95rem;padding:8px 14px">🤔 Not sure yet</button>' : ''}
          </div>
          <div id="nudge" style="display:none;margin-top:12px;background:#fef3c7;border-radius:14px;padding:10px 14px;font-size:1rem">
            ${opts.placement
              ? 'Take your time 🙂 or tap <b>Not sure yet</b> to move on — either is fine!'
              : 'Stuck? Try the 🔊 button, or take your best guess — wrong answers help too! 🙂'}
          </div>
          <div id="ansarea"></div>
        </div>
      </div>`);
    el('spk').onclick = () => { armNudge(); speak(speakable(it.stem)); };
    if (el('skip')) el('skip').onclick = () => { armNudge(); grade(false, null, true); };
    if (it.kind === 'mcq') drawMCQ(it); else drawPad(it);
    armNudge();
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
    const it = plan[i].item || plan[i];
    // lock buttons
    el('ansarea').querySelectorAll('button').forEach((b) => (b.disabled = true));
    if (el('spk')) el('spk').disabled = true;
    if (el('skip')) el('skip').disabled = true;
    if (opts.placement) placementResults.push({ conceptId: it.conceptId, correct: ok });
    else { results.push(ok); updateAttempt(state, it, ok); if (ok) correctCount++; }
    const fb = el('fb');
    fb.innerHTML = `${skipped
        ? `<div class="feed no">🤔 No worries — that's really useful!</div>`
        : `<div class="feed ${ok ? 'ok' : 'no'}">${ok ? '✅ Yes! ' : '❌ Not quite. '}${esc(it.explain)}</div>`}
      <button class="big" id="nx" style="width:100%;margin-top:12px">${++i >= plan.length ? 'Finish 🎉' : 'Next ➡️'}</button>`;
    if (!ok && !skipped) speak(speakable(it.explain));
    if (ok) { try { navigator.vibrate?.(40); } catch {} }
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
      <p class="muted" style="font-size:.8rem;margin-top:-6px">Version: <b>v0.1.7</b> (if this doesn't say v0.1.7, fully close and reopen the app twice)</p>
      <div class="row"><button id="exp" class="ghost">Export data (JSON)</button><button id="rst" class="ghost" style="color:#b91c1c">Reset everything</button></div>
      <button id="bk2" style="margin-top:14px">⬅️ Back</button>
    </div>`);
  el('bk2').onclick = viewHome;
  el('exp').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `stretch-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  el('rst').onclick = async () => {
    if (confirm('Delete all progress on this device? This cannot be undone.')) {
      await clearAll(); state = null; viewWelcome();
    }
  };
}

boot();
