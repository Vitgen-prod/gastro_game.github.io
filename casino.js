/* ===== API ===== */
const API = 'https://script.google.com/macros/s/AKfycbzk_bfXNQ3aRDQQ6v6qVRSfdf3iUha3qnpwxGzLnTwJVwMsmlfuUv5kgGJwV-yK7nzmmA/exec';

/* ===== Пользовательское состояние, совместимо с основной страницей ===== */
const state = { id:null, level:1, score:0, purchases:0, spins:0 };
const lsKey = id => `gn_user_${id}`;
const getClientId = () => (new URL(location.href)).searchParams.get('id')?.trim() || 'demo';

function loadLocal(id){
  try{
    const raw = localStorage.getItem(lsKey(id));
    if (!raw) { state.id=id; return; }
    const d = JSON.parse(raw);
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
    const r = await fetch(url, {cache:'no-store'});
    const j = await r.json();
    if (j && j.ok){
      const d = j.data || {};
      state.id    = id;
      state.level = Number(d.level ?? d.Level) || 1;
      state.score = Number(d.score ?? d.Score) || 0;
      state.spins = Number(d.spins ?? d.Spins) || 0;   // ВАЖНО: колонка Spins
      saveLocal();
      return true;
    }
  }catch(e){ console.warn('API read fail', e); }
  return false;
}

/* ===== Обновление на сервере: Score+=addScore, Spins-=useSpins ===== */
async function updateUserOnAPI({addScore=0, useSpins=0}={}){
  try{
    await fetch(API, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        action: 'update',
        id: state.id,
        addScore: Number(addScore)||0,
        addSpins: -Math.abs(Number(useSpins)||0)   // уменьшаем Spins
      })
    });
  }catch(e){ console.warn('API write fail', e); }
}

/* ===== UI ===== */
const spinBtn = document.getElementById('spinBtn');
const wheel   = document.getElementById('wheelBody');
const wheelWrap = document.getElementById('wheelWrap');
const uiSpins = document.getElementById('spinsLeft');
const uiScore = document.getElementById('userScore');

function renderUI(){
  uiSpins.textContent = state.spins;
  uiScore.textContent = state.score;
  spinBtn.style.pointerEvents = state.spins>0 && !session.done ? 'auto' : 'none';
  spinBtn.style.opacity = state.spins>0 && !session.done ? '1' : '.45';
}

/* ===== Колесо: логика выпадений ===== */
const SLICE_VALUES = [0,1,3,4,5,6,10,12]; // по часовой, начиная с верхнего сектора
const N = SLICE_VALUES.length;
const SLICE_ANGLE = 360 / N;
const BASE_WEIGHTS = {0:.3,1:.6,3:1.0,4:1.2,5:1.4,6:1.2,10:.6,12:.4};

/* Сессионные ограничения: максимум 3 спина и сумма ≤ 20 (и не 0) */
const sessionKey = id => `casino_v1_${id}`;
let session = { angle:0, spins:0, total:0, done:false }; // spins — сколько уже сделано
try{ session = {...session, ...(JSON.parse(localStorage.getItem(sessionKey(getClientId()))||'{}'))}; }catch{}
syncAngle();

function persistSession(){ localStorage.setItem(sessionKey(state.id), JSON.stringify(session)); }
function syncAngle(){ wheel.style.setProperty('--rot', (session.angle||0)+'deg'); }

/* анти-реверс: быстро ставим нормализованный угол без transition */
function snapTo(angleDeg){
  wheel.classList.add('no-anim');
  wheel.style.setProperty('--rot', (angleDeg%360)+'deg');
  void wheel.offsetHeight; // reflow
  wheel.classList.remove('no-anim');
}

/* выбор значения с учётом лимита 20 за сессию */
function chooseValue(){
  const leftThisSession = 3 - session.spins;
  const cap = 20 - session.total;
  let allowed = SLICE_VALUES.filter(v => v <= cap);
  if (leftThisSession === 1 && session.total === 0) {
    allowed = allowed.filter(v => v > 0); // итог не ноль
  }
  if (!allowed.length) return 1;
  const weights = allowed.map(v => BASE_WEIGHTS[v] ?? .1);
  return weightedRandom(allowed, weights);
}
function weightedRandom(values, weights){
  const s = weights.reduce((a,b)=>a+b,0)||1; let r = Math.random()*s;
  for (let i=0;i<values.length;i++){ r -= weights[i]; if (r<=0) return values[i]; }
  return values[values.length-1];
}

/* утилиты поворота */
function getRotationDeg(el){
  const tr = getComputedStyle(el).transform;
  if (!tr || tr==='none') return 0;
  const m = tr.match(/matrix\\(([^)]+)\\)/);
  if (!m) return 0;
  const [a,b] = m[1].split(',').map(parseFloat);
  return Math.atan2(b,a)*180/Math.PI;
}
const norm = a => ((a%360)+360)%360;
const randInt = (mi,ma)=>Math.floor(Math.random()*(ma-mi+1))+mi;
const randF = (mi,ma)=>Math.random()*(ma-mi)+mi;
function shortestPositive(from,to){ let d = (to - (from%360) + 360)%360; if (d<0) d+=360; return d; }

/* клик по кнопке */
let spinning = false;
spinBtn.addEventListener('click', trySpin);
spinBtn.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') trySpin(); });

function trySpin(){
  if (spinning) return;
  if (state.spins<=0) return;
  if (session.done) return;               // соблюдаем лимит 3 и ≤20

  const value = chooseValue();
  const idxList = SLICE_VALUES.map((v,i)=>[v,i]).filter(p=>p[0]===value).map(p=>p[1]);
  const idx = idxList[Math.floor(Math.random()*idxList.length)];

  const start = norm(getRotationDeg(wheel));
  const targetCenter = norm(-idx*SLICE_ANGLE + SLICE_ANGLE/2);
  const turns = randInt(10,14)*360;
  const delta = shortestPositive(start, targetCenter);
  const target = start + turns + delta - randF(4, SLICE_ANGLE/2 - 4);

  spinning = true;
  spinBtn.style.pointerEvents = 'none';
  wheel.style.setProperty('--rot', target+'deg');

  wheel.addEventListener('transitionend', async function h(){
    wheel.removeEventListener('transitionend', h);

    // 1) фиксируем угол без реверса
    session.angle = norm(target);
    snapTo(session.angle);

    // 2) применяем результат
    session.spins += 1;
    session.total += value;
    if (session.spins >= 3 || session.total >= 20) session.done = true;

    // 3) обновляем пользователя: score↑, spins↓
    state.score = Number(state.score||0) + Number(value||0);
    state.spins = Math.max(0, Number(state.spins||0) - 1);

    saveLocal(); renderUI(); persistSession();

    // 4) пишем на сервер
    updateUserOnAPI({addScore:value, useSpins:1}).catch(()=>{});

    spinning = false;
    renderUI();
  }, {once:true});
}

/* ===== Навигация нижнего меню на другие экраны ===== */
document.querySelectorAll('#bottomNav .tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    const id = state.id || getClientId();
    const t = tab.dataset.tab;
    if (t === 'casino') return; // уже здесь
    if (t === 'shop') location.href = `index.html?id=${encodeURIComponent(id)}#shop`;
    else location.href = `index.html?id=${encodeURIComponent(id)}`;
  });
});

/* ===== Старт ===== */
(async () => {
  const id = getClientId();
  loadLocal(id);
  await fetchUserFromAPI(id);  // подтягиваем score и Spins из таблицы
  renderUI();
  syncAngle();
})();
