// старт -> показать ЛК с попапом
const startBtn    = document.getElementById('startBtn');
const startScreen = document.getElementById('startScreen');
const cabinet     = document.getElementById('cabinet');
const overlay     = document.getElementById('introOverlay');
const mapScreen   = document.getElementById('mapScreen');

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  cabinet.classList.remove('hidden');
  overlay.classList.remove('hidden');
  mapScreen.setAttribute('aria-hidden','false');
});

// закрыть попап
document.getElementById('btnOk').addEventListener('click', () => {
  overlay.classList.add('hidden');
});

// клики по уровням (заглушки)
document.querySelectorAll('.lvl').forEach(btn => {
  btn.addEventListener('click', () => {
    const lvl = btn.dataset.level;
    // TODO: действие для выбранного уровня
    console.log('LEVEL', lvl);
  });
});

// кнопка «Открыть новый уровень» (заглушка)
document.getElementById('openLevel').addEventListener('click', () => {
  // TODO
  console.log('OPEN_LEVEL');
});

// нижнее меню (заглушки)
document.querySelectorAll('#bottomNav .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.tab;
    // TODO: роутинг/переход по разделам
    console.log('TAB', id);
  });
});
