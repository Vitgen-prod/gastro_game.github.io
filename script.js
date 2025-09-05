/* ===== Старт / показ ЛК и попапа ===== */
const startBtn    = document.getElementById('startBtn');
const startScreen = document.getElementById('startScreen');
const cabinet     = document.getElementById('cabinet');
const overlay     = document.getElementById('introOverlay');
const mapScreen   = document.getElementById('mapScreen');

startBtn.addEventListener('click', async () => {
  startScreen.classList.add('hidden');
  cabinet.classList.remove('hidden');
  overlay.classList.remove('hidden');
  mapScreen.setAttribute('aria-hidden','false');

  const id = getClientId();
  if (!loadLocal(id)) await loadFromAPI(id);
  renderStatus();
});

/* Закрыть попап */
document.getElementById('btnOk').addEventListener('click', () => {
  overlay.classList.add('hidden');
});

/* Клики по уровням (заглушки) */
document.querySelectorAll('.lvl').forEach(btn => {
  btn.addEventListener('click', () => {
    console.log('LEVEL', btn.dataset.level);
  });
});

/* Кнопка «ОТКРЫТЬ НОВЫЙ УРОВЕНЬ» — демо +20% прогресса */
document.getElementById('openLevel').addEventListener('click', () => {
  addPurchase();
  console.log('Progress:', state.purchases * 20 + '%');
});

/* Нижнее меню (заглушки) */
document.querySelectorAll('#bottomNav .tab').forEach(tab => {
  tab.addEventListener('click', () => console.log('TAB', tab.dataset.tab));
});

/* ===== Блок статуса: уровень/очки/прогресс (5 шагов) ===== */
const API = 'https://script.google.com/macros/s/AKfycbzk_bfXNQ3aRDQQ6v6qVRSfdf3iUha3qnpwxGzLnTwJVwMsmlfuUv5kgGJwV-yK7nzmmA/exec';

const state = { id:null, level:1, score:9999, purchases:0 }; // purchases: 0..5

function renderStatus(){
  const lvl = document.getElementById('levelValue');
  const scr = document.getElementById('scoreValue');
  if (lvl) lvl.textContent = state.level;
  if (scr) scr.textContent = state.score;

  const segs = document.querySelectorAll('#progressRail .seg');
  segs.forEach((s,i)=> s.classList.toggle('on', i < state.purchases));
}

const key = id => `gn_user_${id}`;

function saveLocal(){
  if (!state.id) return;
  localStorage.setItem(key(state.id), JSON.stringify({
    level: state.level,
    score: state.score,
    purchases: state.purchases
  }));
}

function loadLocal(id){
  const raw = localStorage.getItem(key(id));
  if (!raw) return false;
  try{
    const d = JSON.parse(raw);
    state.id = id;
    state.level = Number(d.level)||1;
    state.score = Number(d.score)||0;
    state.purchases = Math.max(0, Math.min(5, Number(d.purchases)||0));
    renderStatus();
    return true;
  }catch{
    return false;
  }
}

async function loadFromAPI(id){
  try{
    const r = await fetch(`${API}?id=${encodeURIComponent(id)}`);
    const j = await r.json();
    if (j.ok){
      state.id = id;
      state.level = Number(j.data.level)||1;
      state.score = Number(j.data.score)||0;
      state.purchases = Math.max(0, Math.min(5, Number(j.data.progress)||0)); // 0..5
      renderStatus(); saveLocal();
    } else {
      state.id = id; renderStatus(); saveLocal();
      console.warn('API error:', j.error);
    }
  }catch(err){
    state.id = id; renderStatus();
    console.warn('API fetch failed:', err);
  }
}

function getClientId(){
  const u = new URL(location.href);
  return (u.searchParams.get('id') || 'demo').trim(); // если нет id — demo
}

/* Публичные методы (для будущего магазина) */
window.setPurchases = n => {
  state.purchases = Math.max(0, Math.min(5, Number(n)||0));
  renderStatus(); saveLocal();
};
window.addPurchase = () => {
  if (state.purchases < 5){
    state.purchases += 1;
    renderStatus(); saveLocal();
  }
};
window.setScore = v => { state.score = Number(v)||0; renderStatus(); saveLocal(); };
window.setLevel = v => { state.level = Number(v)||1; renderStatus(); saveLocal(); };

/* Слушатель “покупки” из магазина */
window.addEventListener('shop:purchase', e => {
  if (typeof e?.detail?.cost === 'number') setScore(state.score - e.detail.cost);
  addPurchase();
});

/* Первый рендер дефолтов */
renderStatus();
