const PEOPLE = ['David', 'Ray', 'EJ', 'Ryan', 'Janna', 'Claire'];

let POOL = null;
let TIMELINE = null; // chronological chat-rename history: [{d: iso-date, n: name}, ...]
let MODE = 'daily';
let sessionStats = { correct: 0, total: 0 };

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

// Finds what the group chat was named at the moment a given message was sent —
// i.e. the most recent rename at or before that timestamp. TIMELINE is sorted
// chronologically, so this is a standard binary search for "rightmost entry <= target".
function getChatNameAt(isoStr) {
  if (!TIMELINE || TIMELINE.length === 0) return null;
  if (isoStr < TIMELINE[0].d) return TIMELINE[0].n; // before the first known rename

  let lo = 0, hi = TIMELINE.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (TIMELINE[mid].d <= isoStr) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return TIMELINE[ans].n;
}

function pickMessageAndOptions(rng) {
  const msg = POOL[Math.floor(rng() * POOL.length)];
  const distractorPool = PEOPLE.filter(p => p !== msg.s);
  const distractors = shuffleWithRng(distractorPool, rng).slice(0, 3);
  const options = shuffleWithRng([msg.s, ...distractors], rng);
  return { msg, options };
}

// ---------- shared rendering ----------
function renderPuzzleShell(msg, options) {
  document.getElementById('timestamp').textContent = formatTimestamp(msg.d);
  const chatName = getChatNameAt(msg.d);
  document.getElementById('chatTitle').textContent = chatName ? `"${chatName}"` : '';
  document.getElementById('bubble').textContent = msg.t;
  document.getElementById('result').textContent = '';
  document.getElementById('result').className = 'result';
  document.getElementById('nextBtn').classList.add('hidden');
  document.getElementById('skipBtn').classList.add('hidden');

  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';
  options.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = name;
    btn.dataset.name = name;
    optionsEl.appendChild(btn);
  });
  return optionsEl;
}

function lockIn(correctName, chosenName) {
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
  return wasCorrect;
}

// ---------- daily mode ----------
function startDaily() {
  const dateKey = todayKey();
  const rng = seededRandom(dateKey);
  const { msg, options } = pickMessageAndOptions(rng);

  const optionsEl = renderPuzzleShell(msg, options);
  renderStreak();

  const saved = JSON.parse(localStorage.getItem('buttonDaily_' + dateKey) || 'null');

  if (saved) {
    lockIn(msg.s, saved.chosen);
  } else {
    optionsEl.querySelectorAll('.option').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = btn.dataset.name;
        const correct = chosen === msg.s;
        localStorage.setItem('buttonDaily_' + dateKey, JSON.stringify({ chosen, correct }));
        updateStreak(correct, dateKey);
        lockIn(msg.s, chosen);
      });
    });
  }
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
    streak = (lastPlayed === yKey || lastPlayed === dateKey) ? streak + 1 : 1;
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

// ---------- free play mode ----------
function triggerSweepAnimation() {
  const puzzleEl = document.getElementById('puzzle');
  puzzleEl.classList.remove('sweep-in');
  void puzzleEl.offsetWidth; // force reflow so the animation can replay on consecutive rounds
  puzzleEl.classList.add('sweep-in');
}

function startFreePlay() {
  triggerSweepAnimation();

  const rng = Math.random; // genuine randomness each round, not date-seeded
  const { msg, options } = pickMessageAndOptions(rng);

  const optionsEl = renderPuzzleShell(msg, options);
  renderSessionTally();
  document.getElementById('skipBtn').classList.remove('hidden');

  optionsEl.querySelectorAll('.option').forEach(btn => {
    btn.addEventListener('click', () => {
      const chosen = btn.dataset.name;
      const wasCorrect = lockIn(msg.s, chosen);
      sessionStats.total += 1;
      if (wasCorrect) sessionStats.correct += 1;
      renderSessionTally();
      document.getElementById('skipBtn').classList.add('hidden');
      document.getElementById('nextBtn').classList.remove('hidden');
    });
  });
}

function renderSessionTally() {
  const el = document.getElementById('sessionTally');
  if (MODE !== 'free' || sessionStats.total === 0) {
    el.textContent = '';
  } else {
    el.textContent = `${sessionStats.correct}/${sessionStats.total} correct this session`;
  }
}

// ---------- mode switching ----------
function setMode(mode) {
  MODE = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const streakEl = document.getElementById('streak');
  const tallyEl = document.getElementById('sessionTally');

  if (mode === 'daily') {
    tallyEl.textContent = '';
    streakEl.style.display = '';
    startDaily();
  } else {
    streakEl.style.display = 'none';
    startFreePlay();
  }
}

// ---------- main ----------
async function init() {
  // Wire up interactivity immediately, independent of whether data loading
  // succeeds — otherwise a slow/failed fetch leaves these buttons permanently dead.
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!POOL) {
        document.getElementById('result').textContent = 'Still loading — try again in a second.';
        return;
      }
      setMode(btn.dataset.mode);
    });
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (!POOL) return;
    startFreePlay();
  });
  document.getElementById('skipBtn').addEventListener('click', () => {
    if (!POOL) return;
    startFreePlay();
  });

  try {
    const res = await fetch('data/messages.json');
    if (!res.ok) {
      throw new Error(`Couldn't load messages.json (HTTP ${res.status}). Check that it's inside a "data" folder next to index.html.`);
    }
    const pool = await res.json();
    if (!Array.isArray(pool) || pool.length === 0) {
      throw new Error('messages.json loaded but was empty or malformed.');
    }
    POOL = pool;

    // Chat-name timeline is a nice-to-have, not critical — don't let a failure here
    // break the actual game.
    try {
      const timelineRes = await fetch('data/chat_name_timeline.json');
      if (timelineRes.ok) {
        TIMELINE = await timelineRes.json();
      }
    } catch (timelineErr) {
      TIMELINE = null;
    }

    startDaily();
  } catch (err) {
    document.getElementById('timestamp').textContent = 'Something went wrong loading today\u2019s message.';
    document.getElementById('bubble').textContent = String(err.message || err);
    document.getElementById('options').innerHTML = '';
  }
}

init();
