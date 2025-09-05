/* ===== Глобальные ссылки на узлы ===== */
const startBtn    = document.getElementById('startBtn');
const startScreen = document.getElementById('startScreen');
const cabinet     = document.getElementById('cabinet');
const overlay     = document.getElementById('introOverlay');
const mapScreen   = document.getElementById('mapScreen');
const shopScreen  = document.getElementById('shopScreen'); // НОВОЕ

/* ===== Конфиг API ===== */
const API = 'https://script.google.com/macros/s/AKfycbzk_bfXNQ3aRDQQ6v6qVRSfdf3iUha3qnpwxGzLnTwJVwMsmlfuUv5kgGJwV-yK7nzmmA/exec';

/* ===== Состояние ===== */
const state = {
  id: null,
  level: 1,
  score: 0,
  purchases: 0, // 0..5
};

/* ===== Утилиты ===== */
const lsKey = id => `gn_user_${id}`;

function renderStatus(){
  // уровень и баллы везде, где есть data-bind
  document.querySelectorAll('[data-bind="level"]').forEach(n => n.textContent = state.level);
  document.querySelectorAll('[data-bind="score"]').forEach(n => n.textContent = state.score);

  // сегменты прогресса во всех блоках
  document.querySelectorAll('.progress-rail').forEach(rail => {
    rail.querySelectorAll('.seg').forEach((s,i)=> s.classList.toggle('on', i < state.purchases));
  });
}

function saveLocal(){
  if (!state.id) return;
  localStorage.setItem(lsKey(state.id), JSON.stringify({
    level: state.level,
    score: state.score,
    purchases: state.purchases
  }));
}

function loadLocal(id){
  try{
    const raw = localStorage.getItem(lsKey(id));
    if (!raw) return false;
    const d = JSON.parse(raw);
    state.id = id;
    state.level = Number(d.level)||1;
    state.score = Number(d.score)||0;
    state.purchases = Math.max(0, Math.min(5, Number(d.purchases)||0));
    return true;
  }catch{ return false; }
}

async function loadFromAPI(id){
  // всегда пытаемся обновиться с сервера при входе
  const url = `${API}?id=${encodeURIComponent(id)}&t=${Date.now()}`;
  try{
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();

    if (j && j.ok) {
      const d = j.data || {};
      state.id        = id;
      state.level     = Number(d.level ?? d.Level) || 1;
      state.score     = Number(d.score ?? d.Score) || 0;
      state.purchases = Math.max(0, Math.min(5, Number(d.progress ?? d.Progress ?? 0)));
      saveLocal();
      return true;
    } else {
      console.warn('API error:', j && j.error);
      return false;
    }
  }catch(err){
    console.warn('API fetch failed:', err);
    return false;
  }
}

function getClientId(){
  const u = new URL(location.href);
  return (u.searchParams.get('id') || 'demo').trim();
}

/* ===== Публичные методы для будущего магазина ===== */
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

/* ===== Переключение экранов (карта / магазин) ===== */
function showScreen(which){
  if (which === 'shop'){
    mapScreen.classList.add('hidden');
    shopScreen.classList.remove('hidden');
    renderShop();
  } else {
    shopScreen.classList.add('hidden');
    mapScreen.classList.remove('hidden');
  }
}

/* ===== Магазин: прогресс по карточкам и клики ===== */
// временно: у 1-го уровня прогресс = state.purchases, у остальных 0
function getLevelProgressSteps(lvl){
  return (lvl === 1) ? (state.purchases || 0) : 0;
}

function renderShop(){
  if (!shopScreen) return;
  shopScreen.querySelectorAll('.shop-card').forEach(card => {
    const lvl = Number(card.dataset.level);

    // блокировка по уровню
    if (state.level >= lvl) card.classList.remove('locked');
    else card.classList.add('locked');

    const steps = Math.max(0, Math.min(5, getLevelProgressSteps(lvl)));
    const pct  = steps * 20;

    const fill = card.querySelector('.shop-fill');
    const txt  = card.querySelector('.shop-percent span');
    if (fill) fill.style.width = pct + '%';
    if (txt)  txt.textContent = pct;

    card.onclick = () => {
      if (card.classList.contains('locked')) return;
      alert(`Открыта карточка уровня ${lvl} (заглушка).`);
    };
  });
}

/* ===== Старт / показ ЛК и попапа ===== */
startBtn.addEventListener('click', async () => {
  startScreen.classList.add('hidden');
  cabinet.classList.remove('hidden');
  overlay.classList.remove('hidden');
  mapScreen.setAttribute('aria-hidden','false');

  const id = getClientId();

  // 1) пробуем получить свежие данные из API
  const ok = await loadFromAPI(id);

  // 2) если API недоступно — показываем из кэша (если есть)
  if (!ok) {
    const hasLocal = loadLocal(id);
    if (!hasLocal) state.id = id; // дефолт
  }

  renderStatus();
});

/* Закрыть попап */
document.getElementById('btnOk').addEventListener('click', () => {
  overlay.classList.add('hidden');
});

/* Клики по уровням (заглушки) */
document.querySelectorAll('.lvl').forEach(btn => {
  btn.addEventListener('click', () => console.log('LEVEL', btn.dataset.level));
});

/* Кнопка «ОТКРЫТЬ НОВЫЙ УРОВЕНЬ» — демо +20% прогресса */
document.getElementById('openLevel')?.addEventListener('click', () => {
  addPurchase();
  console.log('Progress:', state.purchases * 20 + '%');
});

/* Нижнее меню — переключение экранов */
document.querySelectorAll('#bottomNav .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.tab;
    if (id === 'shop') showScreen('shop');
    else showScreen('map'); // остальные возвращают на карту
    console.log('TAB', id);
  });
});

/* Первый рендер дефолтов (пока на стартовом экране) */
renderStatus();
