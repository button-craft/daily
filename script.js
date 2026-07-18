const PEOPLE = ['David', 'Ray', 'EJ', 'Ryan', 'Janna', 'Claire'];

// ---------- deterministic seeded RNG (mulberry32), seeded from a date string ----------
function hashStringToSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^= h >>> 16) >>> 0;
    return h;
  };
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededRandom(dateStr) {
  const seedFn = hashStringToSeed(dateStr);
  return mulberry32(seedFn());
}
function shuffleWithRng(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- today's date key (local time, so it rolls over at local midnight) ----------
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimestamp(isoStr) {
  const d = new Date(isoStr);
  const dateOpts = { month: 'long', day: 'numeric', year: 'numeric' };
  const timeOpts = { hour: 'numeric', minute: '2-digit' };
  return `${d.toLocaleDateString(undefined, dateOpts)} · ${d.toLocaleTimeString(undefined, timeOpts)}`;
}

// ---------- main ----------
async function init() {
  try {
    const dateKey = todayKey();
    const rng = seededRandom(dateKey);

    const res = await fetch('data/messages.json');
    if (!res.ok) {
      throw new Error(`Couldn't load messages.json (HTTP ${res.status}). Check that it's inside a "data" folder next to index.html.`);
    }
    const pool = await res.json();
    if (!Array.isArray(pool) || pool.length === 0) {
      throw new Error('messages.json loaded but was empty or malformed.');
    }

    await runGame(dateKey, rng, pool);
  } catch (err) {
    document.getElementById('timestamp').textContent = 'Something went wrong loading today\u2019s message.';
    document.getElementById('bubble').textContent = String(err.message || err);
    document.getElementById('options').innerHTML = '';
  }
}

async function runGame(dateKey, rng, pool) {
  const msgIndex = Math.floor(rng() * pool.length);
  const msg = pool[msgIndex];

  const distractorPool = PEOPLE.filter(p => p !== msg.s);
  const shuffledDistractors = shuffleWithRng(distractorPool, rng).slice(0, 3);
  const options = shuffleWithRng([msg.s, ...shuffledDistractors], rng);

  document.getElementById('timestamp').textContent = formatTimestamp(msg.d);
  document.getElementById('bubble').textContent = msg.t;

  renderStreak();

  const saved = JSON.parse(localStorage.getItem('buttonDaily_' + dateKey) || 'null');

  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';

  options.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = name;
    btn.dataset.name = name;
    optionsEl.appendChild(btn);
  });

  if (saved) {
    lockIn(options, msg.s, saved.chosen, dateKey, false);
  } else {
    optionsEl.querySelectorAll('.option').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = btn.dataset.name;
        const correct = chosen === msg.s;
        localStorage.setItem(
          'buttonDaily_' + dateKey,
          JSON.stringify({ chosen, correct })
        );
        updateStreak(correct, dateKey);
        lockIn(options, msg.s, chosen, dateKey, true);
      });
    });
  }
}

function lockIn(options, correctName, chosenName, dateKey, animate) {
  const optionsEl = document.getElementById('options');
  optionsEl.querySelectorAll('.option').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.name === correctName) btn.classList.add('correct');
    if (btn.dataset.name === chosenName && chosenName !== correctName) btn.classList.add('wrong');
  });

  const resultEl = document.getElementById('result');
  const wasCorrect = chosenName === correctName;
  resultEl.textContent = wasCorrect
    ? `Correct — it was ${correctName}.`
    : `Not quite — it was ${correctName}, you picked ${chosenName}.`;
  resultEl.className = 'result ' + (wasCorrect ? 'correct-text' : 'wrong-text');

  renderStreak();
}

function updateStreak(correct, dateKey) {
  const lastPlayed = localStorage.getItem('buttonDaily_lastPlayed');
  let streak = parseInt(localStorage.getItem('buttonDaily_streak') || '0', 10);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getDate()).padStart(2, '0');
  const yKey = `${y}-${m}-${d}`;

  if (correct) {
    if (lastPlayed === yKey || lastPlayed === dateKey) {
      streak += 1;
    } else {
      streak = 1;
    }
  } else {
    streak = 0;
  }

  localStorage.setItem('buttonDaily_streak', String(streak));
  localStorage.setItem('buttonDaily_lastPlayed', dateKey);
}

function renderStreak() {
  const streak = parseInt(localStorage.getItem('buttonDaily_streak') || '0', 10);
  const el = document.getElementById('streak');
  el.textContent = streak > 0 ? `🔥 ${streak}-day streak` : '';
}

init();
