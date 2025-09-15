/* ===== API ===== */
const API = 'https://script.google.com/macros/s/AKfycby_rPc5W8Ob_73C7EAu6QM0W0WWMeQPpIzk8G8e_TkWca44h51kiHs8CgoOf891Y87Psg/exec';

/* ===== Пользователь ===== */
const state = { id:null, level:1, score:0, purchases:0, spins:0 };
const lsKey = id => `gn_user_${id}`;
const getClientId = () => (new URL(location.href)).searchParams.get('id')?.trim() || 'demo';

function loadLocal(id){
  try{
    const d = JSON.parse(localStorage.getItem(lsKey(id))||'{}');
    state.id=id;
    state.level = Number(d.level)||1;
    state.score = Number(d.score)||0;
    state.purchases = Math.max(0, Math.min(5, Number(d.purchases)||0));
  }catch{ state.id=id; }
}
function saveLocal(){
  if (!state.id) return;
  localStorage.setItem(lsKey(state.id), JSON.stringify({
    level: state.level, score: state.score, purchases: state.purchases
  }));
}
async function fetchUserFromAPI(id){
  const url = `${API}?id=${encodeURIComponent(id)}&t=${Date.now()}`;
  try{
    const r = await fetch(url,{cache:'no-store'}); const j = await r.json();
    if (j && j.ok){
      const d = j.data||{};
      state.id=id;
      state.level = Number(d.level ?? d.Level) || 1;
      state.score = Number(d.score ?? d.Score) || 0;
      state.spins = Number(d.spins ?? d.Spins) || 0;
      saveLocal();
      return true;
    }
  }catch(e){ console.warn('API read fail', e); }
  return false;
}

/* ===== Обновление таблицы ===== */
async function updateUserOnAPI({ addScore=0, useSpins=0 } = {}) {
  const id  = state.id;
  const inc = Number(addScore) || 0;
  const dec = Math.abs(Number(useSpins) || 0);

  const attempts = [
    {kind:'GET',  params:{action:'update', id, addScore:inc, addSpins:-dec}},
    {kind:'FORM', params:{action:'update', id, addScore:inc, addSpins:-dec}},
  ];

  try {
    const r = await fetch(`${API}?id=${encodeURIComponent(id)}&t=${Date.now()}`, {cache:'no-store'});
    const j = await r.json();
    if (j?.ok) {
      const d = j.data || {};
      const newScore = Number(d.score ?? d.Score ?? 0) + inc;
      const newSpins = Math.max(0, Number(d.spins ?? d.Spins ?? 0) - dec);
      attempts.push(
        {kind:'FORM', params:{action:'set', id, score:newScore, spins:newSpins}},
        {kind:'JSON', params:{action:'set', id, score:newScore, spins:newSpins}},
      );
    }
  } catch {}

  for (const att of attempts) {
    try {
      if (att.kind === 'GET') {
        const qs = new URLSearchParams({...att.params, t:Date.now()});
        const r = await fetch(`${API}?${qs}`, {cache:'no-store'});
        if (r.ok) return true;
      } else if (att.kind === 'FORM') {
        const body = new URLSearchParams(att.params).toString();
        const r = await fetch(API, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body});
        if (r.ok) return true;
      } else {
        const r = await fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(att.params)});
        if (r.ok) return true;
      }
    } catch {}
  }
  console.warn('API update failed');
  return false;
}

/* ===== UI ===== */
const spinBtn = document.getElementById('spinBtn');
const wheel   = document.getElementById('wheelBody');
const uiSpins = document.getElementById('spinsLeft');
const uiScore = document.getElementById('userScore');

/* ===== POPUP refs ===== */
const REF_LINK = 'https://t.me/Gastronomads_bot?start=ref_go';
const noSpinsOverlay = document.getElementById('noSpinsOverlay');
const refClose  = document.getElementById('refClose');
const refCopy   = document.getElementById('refCopy');
const refLinkEl = document.getElementById('refLink');
const refToast  = document.getElementById('refToast');
refLinkEl.value = REF_LINK;

let popupShownThisSession = false;
function showNoSpinsPopup(){
  if (popupShownThisSession) return;
  popupShownThisSession = true;
  noSpinsOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function hideNoSpinsPopup(){
  noSpinsOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}
refClose?.addEventListener('click', hideNoSpinsPopup);
noSpinsOverlay?.addEventListener('click', (e)=>{ if (e.target===noSpinsOverlay) hideNoSpinsPopup(); });
refCopy?.addEventListener('click', async ()=>{
  try{
    await navigator.clipboard.writeText(REF_LINK);
  }catch{
    refLinkEl.select(); document.execCommand('copy');
  }
  refToast?.classList.add('on');
  setTimeout(()=>refToast?.classList.remove('on'), 1200);
});

function renderUI(){
  uiSpins.textContent = state.spins;
  uiScore.textContent = state.score;
  const ok = canSpin();
  spinBtn.style.pointerEvents = ok ? 'auto' : 'none';
  spinBtn.style.opacity = ok ? '1' : '.45';
}

/* ===== Дневной лимит 3 спина / 24 часа ===== */
const DAY = 24*60*60*1000;
const dailyKey = id => `casino_daily_v1_${id}`;
let daily = { startedAt:0, used:0 };
let resetTimer;
function loadDaily(){
  try{ daily = {...daily, ...(JSON.parse(localStorage.getItem(dailyKey(state.id))||'{}'))}; }catch{}
  resetDailyIfNeeded();
}
function saveDaily(){ localStorage.setItem(dailyKey(state.id), JSON.stringify(daily)); }
function msToReset(){ return Math.max(0, daily.startedAt + DAY - Date.now()); }
function resetDailyIfNeeded(){
  if (!daily.startedAt || Date.now() - daily.startedAt >= DAY){
    daily.startedAt = Date.now();
    daily.used = 0;
    resetSession();
    saveDaily(); persistSession();
  }
  scheduleResetTimer();
}
function scheduleResetTimer(){
  clearTimeout(resetTimer);
  const wait = msToReset();
  if (wait>0) resetTimer = setTimeout(()=>{ resetDailyIfNeeded(); renderUI(); }, wait + 250);
}

/* ===== Сессия колеса ===== */
const SLICE_VALUES = [0,1,3,4,5,6,10,12];
const N = SLICE_VALUES.length;
const SLICE_ANGLE = 360 / N;
const BASE_WEIGHTS = {0:.3,1:.6,3:1.0,4:1.2,5:1.4,6:1.2,10:.6,12:.4};

const sessionKey = id => `casino_session_v1_${id}`;
let session = { angle:0, spins:0, total:0, done:false };
function persistSession(){ localStorage.setItem(sessionKey(state.id), JSON.stringify(session)); }
function loadSession(){
  try{ session = {...session, ...(JSON.parse(localStorage.getItem(sessionKey(state.id))||'{}'))}; }catch{}
  wheel.style.setProperty('--rot', (session.angle||0)+'deg');
}
function resetSession(){ session = { angle: session.angle||0, spins:0, total:0, done:false }; }

function canSpin(){
  return !spinning && state.spins > 0 && daily.used < 3 && session.total < 20;
}

/* ===== Выбор значения ===== */
function chooseValue(){
  const left = 3 - session.spins;
  const cap  = 20 - session.total;
  let allowed = SLICE_VALUES.filter(v => v <= cap);
  if (left === 1 && session.total === 0) allowed = allowed.filter(v => v > 0);
  if (!allowed.length) return 1;
  const w = allowed.map(v => BASE_WEIGHTS[v] ?? .1);
  const s = w.reduce((a,b)=>a+b,0)||1; let r = Math.random()*s;
  for (let i=0;i<allowed.length;i++){ r -= w[i]; if (r<=0) return allowed[i]; }
  return allowed[allowed.length-1];
}

/* ===== Геометрия ===== */
function getRotationDeg(el){
  const tr = getComputedStyle(el).transform;
  if (!tr || tr==='none') return 0;
  const m = tr.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const [a,b] = m[1].split(',').map(parseFloat);
  return Math.atan2(b,a)*180/Math.PI;
}
const norm = a => ((a%360)+360)%360;
const ri = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const rf = (a,b)=>Math.random()*(b-a)+a;
function dPos(from,to){ let d = (to - (from%360) + 360)%360; if (d<0) d+=360; return d; }

/* ===== Прокрутка ===== */
let spinning = false;
spinBtn.addEventListener('click', trySpin);
spinBtn.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') trySpin(); });

function trySpin(){
  if (!canSpin()) return;

  const value = chooseValue();
  const indices = SLICE_VALUES.map((v,i)=>[v,i]).filter(p=>p[0]===value).map(p=>p[1]);
  const idx = indices[Math.floor(Math.random()*indices.length)];

  const start = norm(getRotationDeg(wheel));
  const center = norm(-idx*SLICE_ANGLE + SLICE_ANGLE/2);
  const turns = ri(10,14)*360;
  const delta = dPos(start, center);
  const target = start + turns + delta - rf(4, SLICE_ANGLE/2 - 4);

  spinning = true;
  spinBtn.style.pointerEvents = 'none';
  wheel.style.setProperty('--rot', target+'deg');

  wheel.addEventListener('transitionend', async function onEnd(){
    wheel.removeEventListener('transitionend', onEnd);

    session.angle = norm(target);
    wheel.classList.add('no-anim');
    wheel.style.setProperty('--rot', session.angle+'deg');
    void wheel.offsetHeight;
    wheel.classList.remove('no-anim');

    session.spins += 1;
    session.total += value;
    if (session.spins >= 3 || session.total >= 20) session.done = true;

    daily.used += 1; saveDaily(); if (daily.used >= 3) scheduleResetTimer();

    state.score = Number(state.score||0) + Number(value||0);
    state.spins = Math.max(0, Number(state.spins||0) - 1);

    saveLocal(); persistSession(); renderUI();

    try{
      await updateUserOnAPI({ addScore:value, useSpins:1 });
      await fetchUserFromAPI(state.id); // подтянуть актуальные значения
      renderUI();
    }catch(e){ console.warn(e); }

    // ПОКАЗАТЬ ПОПАП, если попыток больше нет
    if (state.spins <= 0) showNoSpinsPopup();

    spinning = false;
    renderUI();
  }, {once:true});
}

/* ===== Навигация нижнего меню ===== */
document.querySelectorAll('#bottomNav .tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    const id = state.id || getClientId();
    const t = tab.dataset.tab;
    if (t === 'casino') return;
    if (t === 'shop') location.href = `index.html?id=${encodeURIComponent(id)}#shop`;
    else location.href = `index.html?id=${encodeURIComponent(id)}`;
  });
});

/* ===== Инициализация ===== */
(async () => {
  const id = getClientId();
  loadLocal(id);
  await fetchUserFromAPI(id);
  loadSession();
  loadDaily();
  renderUI();
})();
