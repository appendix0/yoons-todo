/* Yoon's TO-DO — shared store (state, KST time, timebox builder).
   Loaded on both pages as global `S`. */
window.S = (() => {
  'use strict';

  const KEY = 'yoons-todo:v2';
  const TZ_OFFSET_MIN = 9 * 60; // KST = UTC+9, no DST
  const RESET_HOUR = 6;         // day resets at 06:00 KST

  // Timebox window. NOTE: "0630–1200" read as 06:30 → midnight (00:00).
  // For 06:30 → NOON instead, set DAY_END_MIN = 12 * 60.
  const DAY_START_MIN = 6 * 60 + 30;
  const DAY_END_MIN   = 24 * 60;
  const STEP_MIN      = 15;
  const SLOT_COUNT    = (DAY_END_MIN - DAY_START_MIN) / STEP_MIN;

  // 114 real, attributed quotes. Strings are double-quoted so apostrophes are fine.
  const QUOTES = [
    // ── Tech founders & CEOs (over half the list) ──
    ["When something is important enough, you do it even if the odds are not in your favor.", "Elon Musk"],
    ["Persistence is very important. You should not give up unless you are forced to give up.", "Elon Musk"],
    ["Failure is an option here. If things are not failing, you are not innovating enough.", "Elon Musk"],
    ["If you get up in the morning and think the future is going to be better, it is a bright day.", "Elon Musk"],
    ["I think it's possible for ordinary people to choose to be extraordinary.", "Elon Musk"],
    ["Stay hungry, stay foolish.", "Steve Jobs"],
    ["Innovation distinguishes between a leader and a follower.", "Steve Jobs"],
    ["The only way to do great work is to love what you do.", "Steve Jobs"],
    ["Your time is limited, so don't waste it living someone else's life.", "Steve Jobs"],
    ["Design is not just what it looks like and feels like. Design is how it works.", "Steve Jobs"],
    ["Have the courage to follow your heart and intuition.", "Steve Jobs"],
    ["Focusing is about saying no.", "Steve Jobs"],
    ["Quality is more important than quantity. One home run is much better than two doubles.", "Steve Jobs"],
    ["Your most unhappy customers are your greatest source of learning.", "Bill Gates"],
    ["It's fine to celebrate success but it is more important to heed the lessons of failure.", "Bill Gates"],
    ["Patience is a key element of success.", "Bill Gates"],
    ["Success is a lousy teacher. It seduces smart people into thinking they can't lose.", "Bill Gates"],
    ["We always overestimate the change in the next two years and underestimate the change in the next ten.", "Bill Gates"],
    ["Your brand is what other people say about you when you're not in the room.", "Jeff Bezos"],
    ["If you double the number of experiments you do per year, you double your inventiveness.", "Jeff Bezos"],
    ["I knew that if I failed I wouldn't regret that, but I might regret not trying.", "Jeff Bezos"],
    ["We are stubborn on vision. We are flexible on details.", "Jeff Bezos"],
    ["What's dangerous is not to evolve.", "Jeff Bezos"],
    ["Move fast and break things.", "Mark Zuckerberg"],
    ["The biggest risk is not taking any risk.", "Mark Zuckerberg"],
    ["People don't care about what you say, they care about what you build.", "Mark Zuckerberg"],
    ["Done is better than perfect.", "Sheryl Sandberg"],
    ["If you're offered a seat on a rocket ship, don't ask what seat. Just get on.", "Sheryl Sandberg"],
    ["Don't be a know-it-all; be a learn-it-all.", "Satya Nadella"],
    ["Our industry does not respect tradition — it only respects innovation.", "Satya Nadella"],
    ["If you are not embarrassed by the first version of your product, you've launched too late.", "Reid Hoffman"],
    ["An entrepreneur is someone who jumps off a cliff and builds a plane on the way down.", "Reid Hoffman"],
    ["No matter how brilliant your strategy, if you're playing a solo game you'll lose to a team.", "Reid Hoffman"],
    ["Software is eating the world.", "Marc Andreessen"],
    ["Competition is for losers.", "Peter Thiel"],
    ["Do not tolerate brilliant jerks. The cost to teamwork is too high.", "Reed Hastings"],
    ["Always deliver more than expected.", "Larry Page"],
    ["Always work hard on something uncomfortably exciting.", "Larry Page"],
    ["Revenue solves all known problems.", "Eric Schmidt"],
    ["I want to be looked back on as being very innovative, very trusted and ethical.", "Sergey Brin"],
    ["Never trust a computer you can't throw out a window.", "Steve Wozniak"],
    ["Ideas are a commodity. Execution of them is not.", "Michael Dell"],
    ["Try never to be the smartest person in the room.", "Michael Dell"],
    ["Never give up. Today is hard, tomorrow worse, but the day after tomorrow is sunshine.", "Jack Ma"],
    ["If you don't give up, you still have a chance.", "Jack Ma"],
    ["I always tell people not to be afraid of failure, but to learn from it.", "Masayoshi Son"],
    ["The business of business is improving the state of the world.", "Marc Benioff"],
    ["Growth and comfort do not coexist.", "Ginni Rometty"],
    ["Work like there is someone working 24 hours a day to take it all away from you.", "Mark Cuban"],
    ["Sweat equity is the most valuable equity there is.", "Mark Cuban"],
    ["Don't worry about failure; you only have to be right once.", "Drew Houston"],
    ["If we tried to think of a good idea, we wouldn't have been able to think of a good idea.", "Brian Chesky"],
    ["Make something people want.", "Paul Graham"],
    ["Only the paranoid survive.", "Andy Grove"],
    ["When you innovate, you've got to be prepared for everyone telling you you're nuts.", "Larry Ellison"],
    ["I always did something I was a little not ready to do. That's how you grow.", "Marissa Mayer"],
    ["When people are emotionally invested, they want to contribute.", "Meg Whitman"],
    ["You want to be the pebble in the pond that creates the ripple for change.", "Tim Cook"],
    ["Wear your failure as a badge of honor.", "Sundar Pichai"],
    ["Make every detail perfect and limit the number of details to perfect.", "Jack Dorsey"],
    // ── Investors, business leaders & classic entrepreneurs ──
    ["Price is what you pay. Value is what you get.", "Warren Buffett"],
    ["It takes 20 years to build a reputation and five minutes to ruin it.", "Warren Buffett"],
    ["Risk comes from not knowing what you're doing.", "Warren Buffett"],
    ["The big money is not in the buying and selling, but in the waiting.", "Charlie Munger"],
    ["Spend each day trying to be a little wiser than you were when you woke up.", "Charlie Munger"],
    ["Whether you think you can, or you think you can't — you're right.", "Henry Ford"],
    ["Failure is simply the opportunity to begin again, this time more intelligently.", "Henry Ford"],
    ["I have not failed. I've just found 10,000 ways that won't work.", "Thomas Edison"],
    ["Genius is one percent inspiration and ninety-nine percent perspiration.", "Thomas Edison"],
    ["The way to get started is to quit talking and begin doing.", "Walt Disney"],
    ["You don't learn to walk by following rules. You learn by doing, and by falling over.", "Richard Branson"],
    ["High expectations are the key to everything.", "Sam Walton"],
    ["In times of adversity, we discover who we are and what we're made of.", "Howard Schultz"],
    ["People who are unable to motivate themselves must be content with mediocrity.", "Andrew Carnegie"],
    ["Don't be afraid to give up the good to go for the great.", "John D. Rockefeller"],
    ["Success is 99 percent failure.", "Soichiro Honda"],
    ["The best way to predict the future is to create it.", "Peter Drucker"],
    ["What gets measured gets managed.", "Peter Drucker"],
    ["The biggest adventure you can take is to live the life of your dreams.", "Oprah Winfrey"],
    ["I never dreamed about success. I worked for it.", "Estée Lauder"],
    ["Change before you have to.", "Jack Welch"],
    ["Whatever the mind can conceive and believe, it can achieve.", "Napoleon Hill"],
    ["Either you run the day or the day runs you.", "Jim Rohn"],
    ["You don't have to be great to start, but you have to start to be great.", "Zig Ziglar"],
    // ── Scientists, thinkers, leaders & athletes ──
    ["Imagination is more important than knowledge.", "Albert Einstein"],
    ["A person who never made a mistake never tried anything new.", "Albert Einstein"],
    ["Life is like riding a bicycle. To keep your balance, you must keep moving.", "Albert Einstein"],
    ["If I have seen further it is by standing on the shoulders of giants.", "Isaac Newton"],
    ["Nothing in life is to be feared, it is only to be understood.", "Marie Curie"],
    ["Intelligence is the ability to adapt to change.", "Stephen Hawking"],
    ["I would rather have questions that can't be answered than answers that can't be questioned.", "Richard Feynman"],
    ["Simplicity is the ultimate sophistication.", "Leonardo da Vinci"],
    ["Knowing yourself is the beginning of all wisdom.", "Aristotle"],
    ["An unexamined life is not worth living.", "Socrates"],
    ["It does not matter how slowly you go as long as you do not stop.", "Confucius"],
    ["The man who moves a mountain begins by carrying away small stones.", "Confucius"],
    ["The journey of a thousand miles begins with one step.", "Lao Tzu"],
    ["You have power over your mind — not outside events. Realize this, and you will find strength.", "Marcus Aurelius"],
    ["Luck is what happens when preparation meets opportunity.", "Seneca"],
    ["In the midst of chaos, there is also opportunity.", "Sun Tzu"],
    ["Live as if you were to die tomorrow. Learn as if you were to live forever.", "Mahatma Gandhi"],
    ["It always seems impossible until it's done.", "Nelson Mandela"],
    ["If you can't fly then run, if you can't run then walk, but whatever you do keep moving forward.", "Martin Luther King Jr."],
    ["Believe you can and you're halfway there.", "Theodore Roosevelt"],
    ["The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"],
    ["The only thing we have to fear is fear itself.", "Franklin D. Roosevelt"],
    ["Nothing will work unless you do.", "Maya Angelou"],
    ["The secret of getting ahead is getting started.", "Mark Twain"],
    ["Alone we can do so little; together we can do so much.", "Helen Keller"],
    ["I've failed over and over and over again in my life and that is why I succeed.", "Michael Jordan"],
    ["You miss 100 percent of the shots you don't take.", "Wayne Gretzky"],
    ["Don't count the days, make the days count.", "Muhammad Ali"],
    ["Success is not final, failure is not fatal: it is the courage to continue that counts.", "Winston Churchill"],
    ["The most difficult thing is the decision to act, the rest is merely tenacity.", "Amelia Earhart"],
    // ── 한국 인물의 명언 (Korean quotes by Korean figures) ──
    ["이봐, 해봤어?", "정주영"],
    ["시련은 있어도 실패는 없다.", "정주영"],
    ["길이 없으면 길을 찾고, 찾아도 없으면 길을 닦아 나가야 한다.", "정주영"],
    ["마누라와 자식 빼고 다 바꿔라.", "이건희"],
    ["한 명의 천재가 십만 명을 먹여 살린다.", "이건희"],
    ["의심나면 쓰지 말고, 썼으면 의심하지 마라.", "이병철"],
    ["기업은 곧 사람이다. 인재가 제일이다.", "이병철"],
    ["짧은 인생을 영원 조국에.", "박태준"],
    ["기업에서 얻은 이익은 그 기업을 키워준 사회에 환원해야 한다.", "유일한"],
    ["나를 움직이게 한 원동력은 분노였다.", "방시혁"],
    ["죽고자 하면 살 것이요, 살고자 하면 죽을 것이다.", "이순신"],
    ["신에게는 아직 열두 척의 배가 남아 있사옵니다.", "이순신"],
    ["한 사람이 길목을 지키면 천 명도 두렵게 할 수 있다.", "이순신"],
    ["하루라도 책을 읽지 않으면 입안에 가시가 돋는다.", "안중근"],
    ["나라의 안위를 걱정하고 애태운다.", "안중근"],
    ["대장부가 집을 나서면 살아서 돌아오지 않는다.", "윤봉길"],
    ["나라에 바칠 목숨이 하나밖에 없는 것이 나의 유일한 슬픔입니다.", "유관순"],
    ["낙심은 청년의 죽음이요, 청년이 죽으면 민족이 죽는다.", "안창호"],
    ["나라를 사랑하거든 먼저 그대가 건전한 인격이 되라.", "안창호"],
    ["나는 우리나라가 세계에서 가장 아름다운 나라가 되기를 원한다.", "김구"],
    ["문화의 힘은 우리 자신을 행복하게 하고, 나아가 남에게도 행복을 준다.", "김구"],
    ["역사를 잊은 민족에게 미래는 없다.", "신채호"],
    ["행동하지 않는 양심은 악의 편이다.", "김대중"],
    ["자유는 만물의 생명이요, 평화는 인생의 행복이다.", "한용운"],
    ["죽는 날까지 하늘을 우러러 한 점 부끄럼이 없기를.", "윤동주"],
    ["무소유란 아무것도 갖지 않는 것이 아니라, 불필요한 것을 갖지 않는 것이다.", "법정"],
    ["작은 것을 갖고도 고마워하고 만족할 줄 안다면 그것이 행복이다.", "법정"],
    ["고맙습니다. 서로 사랑하세요.", "김수환"],
    ["산은 산이요, 물은 물이로다.", "성철"],
    ["무슨 생각을 해, 그냥 하는 거지.", "김연아"],
  ];

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(16).slice(2));
  const pad = (n) => String(n).padStart(2, '0');
  const round15 = (m) => Math.max(STEP_MIN, Math.round(m / STEP_MIN) * STEP_MIN);
  const snapToGrid = (m) => DAY_START_MIN + Math.round((m - DAY_START_MIN) / STEP_MIN) * STEP_MIN;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

  // ── KST helpers ──
  const kstShift = (d = new Date()) => new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  function kstParts(d = new Date()) {
    const k = kstShift(d);
    return {
      y: k.getUTCFullYear(), mon: k.getUTCMonth(), day: k.getUTCDate(),
      weekday: k.getUTCDay(), h: k.getUTCHours(), mi: k.getUTCMinutes(), s: k.getUTCSeconds(),
      minutes: k.getUTCHours() * 60 + k.getUTCMinutes(),
    };
  }
  function planDayKey(d = new Date()) {
    const a = new Date(d.getTime() + TZ_OFFSET_MIN * 60000 - RESET_HOUR * 3600000);
    return `${a.getUTCFullYear()}-${pad(a.getUTCMonth() + 1)}-${pad(a.getUTCDate())}`;
  }
  function msUntilReset(d = new Date()) {
    const k = kstShift(d);
    const next = new Date(k.getTime());
    next.setUTCHours(RESET_HOUR, 0, 0, 0);
    if (k.getUTCHours() >= RESET_HOUR) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - k.getTime();
  }
  function timeToMin(s) {
    if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
    const [h, m] = s.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  const minToHHMM = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };

  // ── State + daily reset ──
  let state;
  const blank = (dayKey) => ({ planDay: dayKey, brainDump: '', scheduled: [], prioritized: [] });
  function loadRaw() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (_) { return null; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function ensureDay() {
    const dk = planDayKey();
    const s = loadRaw();
    let reset = false;
    if (!s || s.planDay !== dk) { state = blank(dk); save(); reset = true; }
    else state = s;
    return reset;
  }
  const findJob = (id) =>
    state.scheduled.find((j) => j.id === id) || state.prioritized.find((j) => j.id === id);

  // ── Timebox builder ──
  // Order of `prioritized` array IS the priority (index 0 = P1).
  function buildTimebox() {
    const occ = new Array(SLOT_COUNT).fill(false);
    const blocks = [];
    const mark = (s, e) => { for (let m = s; m < e; m += STEP_MIN) { const i = (m - DAY_START_MIN) / STEP_MIN; if (i >= 0 && i < SLOT_COUNT) occ[i] = true; } };

    state.scheduled.forEach((j) => {
      const s = timeToMin(j.start), e = timeToMin(j.end);
      if (s == null || e == null || e <= s) return;
      blocks.push({ jobId: j.id, kind: 'fixed', startMin: s, endMin: e, dur: e - s });
      mark(s, e);
    });

    const auto = [];
    state.prioritized.forEach((j, idx) => {
      const rank = idx + 1;
      const dur = round15(j.mins || 30);
      if (j.atMin != null) {
        const s = clamp(snapToGrid(j.atMin), DAY_START_MIN, DAY_END_MIN - dur);
        blocks.push({ jobId: j.id, kind: 'prio', rank, startMin: s, endMin: s + dur, dur });
        mark(s, s + dur);
      } else auto.push({ j, rank, dur });
    });

    let ptr = 0;
    auto.forEach(({ j, rank, dur }) => {
      const need = dur / STEP_MIN;
      while (ptr < SLOT_COUNT && occ[ptr]) ptr++;
      if (ptr >= SLOT_COUNT) { blocks.push({ jobId: j.id, kind: 'prio', rank, unscheduled: true, dur }); return; }
      const startIdx = ptr; let count = 0;
      while (ptr < SLOT_COUNT && !occ[ptr] && count < need) { occ[ptr] = true; ptr++; count++; }
      const s = DAY_START_MIN + startIdx * STEP_MIN;
      blocks.push({ jobId: j.id, kind: 'prio', rank, startMin: s, endMin: s + count * STEP_MIN, dur });
    });

    return blocks;
  }

  // Calendar column layout for overlapping blocks (returns positioned items).
  function layoutBlocks(blocks) {
    const items = blocks
      .filter((b) => b.startMin != null)
      .map((b) => ({ ...b, s: clamp(b.startMin, DAY_START_MIN, DAY_END_MIN), e: clamp(b.endMin, DAY_START_MIN, DAY_END_MIN) }))
      .filter((b) => b.e > b.s)
      .sort((a, b) => a.s - b.s || a.e - b.e);

    let cluster = [], clusterEnd = -1;
    const flush = () => {
      const cols = [];
      cluster.forEach((it) => {
        let placed = false;
        for (let c = 0; c < cols.length; c++) { if (it.s >= cols[c]) { it.col = c; cols[c] = it.e; placed = true; break; } }
        if (!placed) { it.col = cols.length; cols.push(it.e); }
      });
      cluster.forEach((it) => { it.cols = cols.length; });
      cluster = []; clusterEnd = -1;
    };
    items.forEach((it) => {
      if (cluster.length && it.s >= clusterEnd) flush();
      cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
    });
    if (cluster.length) flush();
    return items;
  }

  return {
    KEY, DAY_START_MIN, DAY_END_MIN, STEP_MIN, SLOT_COUNT, QUOTES,
    uid, pad, round15, snapToGrid, clamp,
    kstParts, planDayKey, msUntilReset, timeToMin, minToHHMM,
    save, ensureDay, findJob, buildTimebox, layoutBlocks,
    get state() { return state; },
  };
})();
