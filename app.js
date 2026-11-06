/* МедиаКоми — игровая логика */
'use strict';

const ROUNDS = 10;
const SLIDER_MIN = 100000;
const SLIDER_MAX = 2000000;
const SLIDER_STEP = 5000;

// Баллы за точность: чем ближе оценка к реальной цене, тем больше баллов
function pointsFor(guess, real) {
  const err = Math.abs(guess - real) / real;
  if (err <= 0.10) return 100;
  if (err <= 0.20) return 75;
  if (err <= 0.35) return 50;
  if (err <= 0.50) return 25;
  return 0;
}

function verdictFor(points) {
  if (points >= 100) return { text: '🎯 Точно в цель! Отличное чутьё.', cls: 'ok' };
  if (points >= 75)  return { text: '👍 Очень близко!', cls: 'ok' };
  if (points >= 50)  return { text: '🙂 Неплохо, но мимо.', cls: 'mid' };
  if (points >= 25)  return { text: '🤔 Далековато от цены.', cls: 'mid' };
  return { text: '😅 Совсем не в цену.', cls: 'bad' };
}

const fmt = (n) => n.toLocaleString('ru-RU');
const fmtShort = (n) => fmt(Math.round(n));

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const screens = {
  start: $('screen-start'),
  game: $('screen-game'),
  final: $('screen-final'),
};

function show(name) {
  Object.values(screens).forEach((s) => { s.hidden = true; });
  screens[name].hidden = false;
  window.scrollTo(0, 0);
}

// ---------- Состояние игры ----------
let deck = [];        // 10 случайных лотов текущей игры
let round = 0;        // индекс текущего раунда (0..9)
let totalScore = 0;
let results = [];     // { guess, real, points, listing }

// ---------- Архетипы ----------
function archetype(results) {
  let under = 0, over = 0, accurate = 0;
  for (const r of results) {
    if (r.guess < r.real * 0.95) under++;
    else if (r.guess > r.real * 1.05) over++;
    else accurate++;
  }
  const list = $('final-list');
  const stats = { under, over, accurate };

  if (over > under && over >= accurate) {
    return {
      emoji: '💎', title: 'Мажор', stats,
      desc: 'Ты почти всегда оценивал квартиры выше реальной цены. ' +
            'Оказывается, в Республике Коми можно жить куда скромнее — и дешевле!',
    };
  }
  if (under > over && under >= accurate) {
    return {
      emoji: '🪙', title: 'Жадный студент', stats,
      desc: 'Твои ставки почти всегда ниже реальной цены. ' +
            'Квартиры в Коми доступны больше, чем ты думаешь — самое время присмотреться к объявлениям!',
    };
  }
  return {
    emoji: '🏆', title: 'Адекватный квартирант', stats,
    desc: 'Ты хорошо чувствуешь рынок недвижимости Республики Коми. ' +
          'Твои оценки близки к реальным ценам!',
  };
}

// ---------- Галерея ----------
function buildGallery(listing) {
  const gal = $('gallery');
  const dots = $('gallery-dots');
  gal.innerHTML = '';
  dots.innerHTML = '';

  listing.photos.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'gallery__slide';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.alt = `Фото квартиры ${i + 1}`;
    img.onerror = () => {
      slide.classList.add('gallery__slide--fail');
      slide.textContent = 'Фото недоступно';
    };
    img.src = src;
    slide.appendChild(img);

    if (i === 0) {
      const counter = document.createElement('span');
      counter.className = 'gallery__counter';
      counter.textContent = `1 / ${listing.photos.length}`;
      slide.appendChild(counter);
    }
    gal.appendChild(slide);

    const dot = document.createElement('i');
    if (i === 0) dot.className = 'on';
    dots.appendChild(dot);
  });

  gal.scrollLeft = 0;

  gal.onscroll = () => {
    const idx = Math.round(gal.scrollLeft / gal.clientWidth);
    dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === idx));
  };
}

// ---------- Бегунок ----------
function setSliderFill(v) {
  const pct = ((v - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  $('price-slider').style.setProperty('--fill', pct + '%');
  $('guess-value').textContent = fmt(v) + ' ₽';
}

// ---------- Раунд ----------
function startRound() {
  const listing = deck[round];

  $('round-num').textContent = round + 1;
  $('progress-bar').style.width = (round / ROUNDS * 100) + '%';
  $('round-street').textContent = listing.street || '';
  $('hud-score').textContent = totalScore;

  buildGallery(listing);

  const slider = $('price-slider');
  // случайное стартовое положение бегунка — чтобы не было привычки
  const start = SLIDER_MIN + Math.floor(Math.random() * (SLIDER_MAX - SLIDER_MIN) / SLIDER_STEP) * SLIDER_STEP;
  slider.value = start;
  setSliderFill(start);
  slider.disabled = false;
  $('btn-guess').disabled = false;

  $('guess-panel').hidden = false;
  $('reveal-panel').hidden = true;

  // предзагрузка первого фото следующего лота
  const next = deck[round + 1];
  if (next) {
    const pre = new Image();
    pre.src = next.photos[0];
  }
}

function submitGuess() {
  const listing = deck[round];
  const guess = Number($('price-slider').value);
  const points = pointsFor(guess, listing.price);

  totalScore += points;
  results.push({ guess, real: listing.price, points, listing });

  $('hud-score').textContent = totalScore;
  $('progress-bar').style.width = ((round + 1) / ROUNDS * 100) + '%';

  const diff = guess - listing.price;
  const diffEl = $('reveal-diff');
  diffEl.textContent = (diff >= 0 ? '+' : '−') + fmtShort(Math.abs(diff)) + ' ₽';
  diffEl.className = 'reveal__num ' + (diff >= 0 ? 'up' : 'down');

  $('reveal-price').textContent = fmt(listing.price) + ' ₽';
  $('reveal-guess').textContent = fmt(guess) + ' ₽';
  $('reveal-points').textContent = '+' + points;

  const verdict = verdictFor(points);
  const vEl = $('reveal-verdict');
  vEl.textContent = verdict.text;
  vEl.className = 'reveal__verdict ' + verdict.cls;

  const link = $('reveal-link');
  link.href = listing.url;

  const btnNext = $('btn-next');
  btnNext.textContent = round === ROUNDS - 1 ? 'К результатам' : 'Следующая квартира';

  $('guess-panel').hidden = true;
  $('reveal-panel').hidden = false;
  $('btn-guess').disabled = true;
  $('price-slider').disabled = true;

  $('reveal-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- Итоги ----------
function showFinal() {
  const a = archetype(results);

  $('final-score').textContent = totalScore;
  $('final-emoji').textContent = a.emoji;
  $('final-title').textContent = a.title;
  $('final-desc').textContent = a.desc;

  $('final-stats').innerHTML =
    `<div><b>${a.stats.under}</b>ниже цены</div>` +
    `<div><b>${a.stats.accurate}</b>в точку</div>` +
    `<div><b>${a.stats.over}</b>выше цены</div>`;

  $('final-list').innerHTML = results.map((r, i) => {
    const addr = (r.listing.desc || '') + (r.listing.street ? ', ' + r.listing.street : '');
    return `<div class="final-rounds__row">` +
      `<span class="addr">${i + 1}. ${escapeHtml(addr)}</span>` +
      `<span class="pts">${r.points} б.</span></div>`;
  }).join('');

  show('final');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Запуск игры ----------
function startGame() {
  deck = [...LISTINGS].sort(() => Math.random() - 0.5).slice(0, ROUNDS);
  round = 0;
  totalScore = 0;
  results = [];
  show('game');
  startRound();
}

// ---------- События ----------
$('btn-start').addEventListener('click', startGame);
$('btn-again').addEventListener('click', startGame);

$('btn-guess').addEventListener('click', submitGuess);
$('btn-next').addEventListener('click', () => {
  round += 1;
  if (round >= ROUNDS) {
    showFinal();
  } else {
    startRound();
  }
});

$('price-slider').addEventListener('input', (e) => setSliderFill(Number(e.target.value)));

// клавиши для десктопа
document.addEventListener('keydown', (e) => {
  if (!screens.game.hidden && !$('reveal-panel').hidden && e.key === 'Enter') {
    $('btn-next').click();
  } else if (!screens.game.hidden && $('reveal-panel').hidden && e.key === 'Enter') {
    submitGuess();
  }
});
