/* ===== Общее состояние, совместимое с вашим приложением ===== */
const API = 'https://script.google.com/macros/s/AKfycbzk_bfXNQ3aRDQQ6v6qVRSfdf3iUha3qnpwxGzLnTwJVwMsmlfuUv5kgGJwV-yK7nzmmA/exec';

const state = { id:null, level:1, score:0, purchases:0 };
const lsKey = id => `gn_user_${id}`;

function renderStatus(){
  document.querySelectorAll('[data-bind="level"]').forEach(n => n.textContent = state.level);
  document.querySelectorAll('[data-bind="score"]').forEach(n => n.textContent = state.score);
  document.querySelectorAll('.progress-rail').forEach(rail=>{
    rail.querySelectorAll('.seg').forEach((s,i)=> s.classList.toggle('on', i < state.purchases));
  });
}
function saveLocal(){
  if (!state.id) return;
  localStorage.setItem(lsKey(state.id), JSON.stringify({
    level: state.level, score: state.score, purchases: state.purchases
  }));
}
function loadLocal(id){
  try{
    const raw = localStorage.getItem(lsKey(id));
    if (!raw){ state.id=id; return; }
    const d = JSON.parse(raw);
    state.id=id;
    state.level = Number(d.level)||1;
    state.score = Number(d.score)||0;
    state.purchases = Math.max(0, Math.min(5, Number(d.purchases)||0));
  }catch{ state.id=id; }
}
function getClientId(){
  const u = new URL(location.href);
  return (u.searchParams.get('id') || 'demo').trim();
}

/* ===== Нижнее меню навигация ===== */
document.querySelectorAll('#bottomNav .tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    const id = getClientId();
    const t = tab.dataset.tab;
    if (t === 'casino') return; // уже тут
    if (t === 'shop') location.href = `index.html?id=${encodeURIComponent(id)}#shop`;
    else location.href = `index.html?id=${encodeURIComponent(id)}`;
  });
});

/* ===== Инициализация пользователя ===== */
const userId = getClientId();
loadLocal(userId);
renderStatus();

/* ===== Колесо фортуны ===== */
const SLICE_VALUES = [0,1,3,4,5,6,10,12]; // порядок как на картинке
const N = SLICE_VALUES.length;
const SLICE_ANGLE = 360 / N;
const BASE_WEIGHTS = {0:0.3,1:0.6,3:1.0,4:1.2,5:1.4,6:1.2,10:0.6,12:0.4};

const spinBtn = document.getElementById('spinBtn');
const wheel   = document.getElementById('wheelBody');
const uiSpins = document.getElementById('spinsLeft');
const uiTotal = document.getElementById('totalPoints');
const uiLast  = document.getElementById('lastDrop');

/* трекинг сессии казино: 3 спина, сумма ≤20 и не 0 */
const CK = id => `casino_v1_${id}`;
let casino = { angle:0, spinsLeft:3, total:0, done:false };
try{ casino = {...casino, ...(JSON.parse(localStorage.getItem(CK(userId))||'{}'))}; }catch{}
syncUI();

let spinning = false;
spinBtn.addEventListener('click', onSpin);

function onSpin(){
  if (spinning || casino.spinsLeft<=0 || casino.done) return;

  const v = chooseValue();
  if (v == null){ finish(); return; }

  const idxs = indicesOf(SLICE_VALUES, v);
  const idx  = idxs[Math.floor(Math.random()*idxs.length)];

  const currentAngle = normAngle(getRotationDeg(wheel));
  const targetCenter = normAngle(-idx*SLICE_ANGLE + SLICE_ANGLE/2);
  const turns = randInt(10,14)*360;
  const delta = shortestPositiveDelta(currentAngle, targetCenter);
  const targetAngle = currentAngle + turns + delta - randFloat(4, SLICE_ANGLE/2 - 4);

  spinning = true;
  spinBtn.disabled = true;
  wheel.style.setProperty('--rot', targetAngle+'deg');

  wheel.addEventListener('transitionend', function h(){
    wheel.removeEventListener('transitionend', h);
    casino.angle = normAngle(targetAngle);
    applyDrop(v);
    spinning = false;
    spinBtn.disabled = casino.spinsLeft<=0 || casino.done;
    persist();
    syncUI();
  }, {once:true});
}

function applyDrop(v){
  casino.spinsLeft -= 1;
  casino.total += v;
  if (casino.total > 20) casino.total = 20;
  if (casino.spinsLeft === 0){
    if (casino.total === 0) casino.total = 1; // гарантия не ноль
    finish();
  }
  uiLast.textContent = String(v);

  // ДОБАВЛЯЕМ К БАЛЛАМ ПОЛЬЗОВАТЕЛЯ
  state.score = Number(state.score||0) + Number(v||0);
  renderStatus(); saveLocal();
}

function finish(){ casino.done = true; }

function chooseValue(){
  const left = casino.spinsLeft;
  const total = casino.total;
  const maxAdd = 20 - total;
  let allowed = SLICE_VALUES.filter(v => v <= maxAdd);

  if (left === 1){
    if (total === 0) allowed = allowed.filter(v => v > 0);
    if (!allowed.length) return 1;
  }
  const weights = allowed.map(v => BASE_WEIGHTS[v] ?? 0.1);
  return weightedRandom(allowed, weights);
}

/* ===== Утилиты ===== */
function indicesOf(arr, val){ const r=[]; arr.forEach((x,i)=>{ if(x===val) r.push(i); }); return r; }
function getRotationDeg(el){
  const st = getComputedStyle(el).transform;
  if (!st || st==='none') return 0;
  const m = st.match(/matrix\(([^)]+)\)/);
  if (!m) return 0;
  const [a,b] = m[1].split(',').map(parseFloat);
  return Math.atan2(b,a) * 180/Math.PI;
}
function normAngle(a){ a%=360; if(a<0) a+=360; return a; }
function shortestPositiveDelta(from,to){ let d = to - (from%360); d = (d+360)%360; if(d<0)d+=360; return d; }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randFloat(min,max){ return Math.random()*(max-min)+min; }
function weightedRandom(values,weights){
  const sum = weights.reduce((a,b)=>a+b,0)||1;
  let r = Math.random()*sum;
  for(let i=0;i<values.length;i++){ r-=weights[i]; if(r<=0) return values[i]; }
  return values[values.length-1];
}
function persist(){ localStorage.setItem(CK(userId), JSON.stringify(casino)); }
function syncUI(){
  uiSpins.textContent = casino.spinsLeft;
  uiTotal.textContent = casino.total;
  wheel.style.setProperty('--rot', (casino.angle||0)+'deg');
  spinBtn.disabled = casino.spinsLeft<=0 || casino.done;
}
