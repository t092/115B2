/**
 * 國中歷史二上 第2課〈商周至隋唐的民族與文化〉
 * 互動學習網頁 核心遊戲與學習邏輯
 * 六道關卡：揭曉方塊 → 時空迷宮 → 天命轉盤 → 事件配對 → 闖關問答 → 歷史找不同
 */

// ==========================================
// 1. Web Audio API 音效引擎
// ==========================================
class SoundEngine {
  constructor() { this.ctx = null; this.enabled = true; }
  init() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  playTone(freq, duration, type = 'sine', gainVal = 0.15) {
    if (!this.enabled) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + duration);
    } catch (e) { /* 忽略音效錯誤 */ }
  }
  click() { this.playTone(800, 0.05, 'triangle', 0.1); }
  flip() { this.playTone(500, 0.08, 'sine', 0.12); }
  tick() { this.playTone(950, 0.03, 'square', 0.04); }
  correct() { if (!this.enabled) return; this.init(); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.playTone(f, 0.16, 'triangle', 0.18), i * 80)); }
  wrong() { if (!this.enabled) return; this.init(); this.playTone(220, 0.25, 'sawtooth', 0.2); setTimeout(() => this.playTone(180, 0.35, 'sawtooth', 0.2), 150); }
  fanfare() { if (!this.enabled) return; this.init(); [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => setTimeout(() => this.playTone(f, 0.4, 'triangle', 0.22), i * 110)); }
}
const sounds = new SoundEngine();

// ==========================================
// 2. 全局狀態
// ==========================================
const gameState = {
  score: 0,
  stars: 0,
  badges: new Set(),
  student: { class: '201', seat: '1', name: '歷史探險家' },
  challenge: { started: false, timer: null, seconds: 0, currentStage: 1, completed: false }
};

const stageNames = ['', '關卡 1：揭曉方塊', '關卡 2：時空迷宮', '關卡 3：天命轉盤', '關卡 4：轉生者的歷史之旅', '關卡 5：獨孤求敗的漢化之路', '關卡 6：歷史偵探'];

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60); const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function formatTimeChinese(totalSec) {
  const m = Math.floor(totalSec / 60); const s = totalSec % 60;
  if (m === 0) return `${s} 秒`;
  return `${m} 分 ${s} 秒`;
}
function addPoints(pts, starsToAdd = 1, badge = null) {
  gameState.score += pts;
  gameState.stars += starsToAdd;
  if (badge) gameState.badges.add(badge);
  updateGlobalDisplay();
}
function updateGlobalDisplay() {
  const s = document.getElementById('totalScore'); if (s) s.textContent = gameState.score;
  const st = document.getElementById('totalStars'); if (st) st.textContent = gameState.stars;
  const cs = document.getElementById('challengeScoreText'); if (cs) cs.textContent = gameState.score;
  updateCertificate();
}

// ==========================================
// 3. 共用彈窗
// ==========================================
function closeModal(id) { sounds.click(); const m = document.getElementById(id); if (m) m.classList.remove('show'); }

function showQuestionModal(cfg) {
  const modal = document.getElementById('gameModal');
  if (!modal) return;
  document.getElementById('gmBadge').textContent = cfg.badge || '歷史考驗';
  document.getElementById('gmTitle').textContent = cfg.title || '題目';
  document.getElementById('gmIcon').textContent = cfg.icon || '📜';
  document.getElementById('gmDesc').textContent = cfg.desc || '';
  document.getElementById('gmQuestion').textContent = cfg.question;
  const stack = document.getElementById('gmOptions');
  stack.innerHTML = '';
  const fb = document.getElementById('gmFeedback');
  fb.className = 'feedback-msg'; fb.textContent = '';

  cfg.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'modal-option-btn'; btn.textContent = opt;
    btn.onclick = () => {
      if (idx === cfg.answer) {
        sounds.correct();
        btn.classList.add('correct');
        stack.querySelectorAll('button').forEach(b => { b.disabled = true; });
        fb.className = 'feedback-msg success';
        fb.textContent = `🎉 答對了！${cfg.hint || ''}`;
        setTimeout(() => { modal.classList.remove('show'); cfg.onCorrect(); }, 950);
      } else {
        sounds.wrong();
        btn.classList.add('wrong');
        fb.className = 'feedback-msg error';
        fb.textContent = `❌ 再想想！提示：${cfg.hint || '回到課文找線索。'}`;
      }
    };
    stack.appendChild(btn);
  });
  modal.classList.add('show');
}

// ==========================================
// 4. 頁面切換與流程
// ==========================================
function goToUnit(targetTabId) {
  if (targetTabId === 'tab-summary' && !gameState.challenge.completed) {
    alert('請先完成全部 6 道挑戰關卡，再查看榮譽學習證書！');
    return;
  }
  sounds.click();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTabId}"]`);
  if (tabBtn) tabBtn.classList.add('active');
  const pane = document.getElementById(targetTabId);
  if (pane) pane.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (targetTabId === 'tab-summary') updateCertificate();
}
function setupTabNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      goToUnit(btn.getAttribute('data-tab'));
    });
  });
}
function unlockCertificateTab() {
  const btn = document.getElementById('tabBtnSummary');
  if (!btn) return;
  btn.disabled = false;
  btn.removeAttribute('aria-disabled');
  btn.classList.remove('tab-locked');
  const icon = btn.querySelector('.tab-icon');
  if (icon) icon.textContent = '🏆';
}
function printHandout() { sounds.click(); document.body.classList.add('printing-handout'); document.body.classList.remove('printing-cert'); window.print(); setTimeout(() => document.body.classList.remove('printing-handout'), 1000); }
function printCertificate() {
  if (!gameState.challenge.completed) { alert('請先完成全部 6 道挑戰關卡，再列印學習證書！'); return; }
  sounds.click(); document.body.classList.add('printing-cert'); document.body.classList.remove('printing-handout');
  window.print(); setTimeout(() => document.body.classList.remove('printing-cert'), 1000);
}
function shareScore() {
  sounds.click();
  const name = document.getElementById('studentName').value || '歷史探險家';
  const cls = document.getElementById('studentClass').value || '201';
  const seat = document.getElementById('studentSeat').value || '1';
  const report = `【國中歷史二上 第2課 學習成果】
班級：${cls}
座號：${seat}
姓名：${name}
作業總積分：${gameState.score} 分
獲得星星：${gameState.stars} 顆
挑戰總耗時：${formatTimeChinese(gameState.challenge.seconds)}
解鎖勳章：${Array.from(gameState.badges).join('、') || '完成本課複習'}`;
  navigator.clipboard.writeText(report)
    .then(() => alert('📋 成績報告已複製，可貼給歷史老師！'))
    .catch(() => alert(report));
}

function goToStage(n) {
  gameState.challenge.currentStage = n;
  const title = document.getElementById('currentStageTitle');
  if (title) title.textContent = stageNames[n] || '';
  for (let i = 1; i <= 6; i++) {
    const ind = document.getElementById(`stepIndicator${i}`);
    const line = document.getElementById(`stepLine${i}`);
    if (ind) { ind.classList.remove('active', 'completed'); if (i < n) ind.classList.add('completed'); else if (i === n) ind.classList.add('active'); }
    if (line) { line.classList.remove('passed'); if (i < n) line.classList.add('passed'); }
  }
  document.querySelectorAll('.challenge-stage').forEach(s => s.classList.remove('active'));
  const map = { 1: 'stageBox', 2: 'stageMaze', 3: 'stageWheel', 4: 'stageMatch', 5: 'stageQuiz', 6: 'stageDetective' };
  const el = document.getElementById(map[n]);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 120, behavior: 'smooth' });
  if (n === 2) renderMaze();
  if (n === 3) drawWheel();
}

function completeAllChallenges(showModal = true) {
  if (!gameState.challenge.completed) {
    clearInterval(gameState.challenge.timer);
    gameState.challenge.completed = true;
    sounds.fanfare();
    addPoints(50, 3, '民族互動大探索家');
    document.getElementById('finalTotalScore').textContent = `${gameState.score} 分`;
    document.getElementById('finalTotalTime').textContent = formatTimeChinese(gameState.challenge.seconds);
    let evalText = '完成六道挑戰！你已掌握商周至隋唐民族互動的完整脈絡。';
    if (gameState.challenge.seconds <= 300) evalText = '⚡ 又快又準！從長城到絲路、從人口南遷到北魏漢化，全部融會貫通！';
    document.getElementById('finalEvaluation').textContent = evalText;
    unlockCertificateTab();
  }
  if (showModal) document.getElementById('challengeCompleteModal').classList.add('show');
}

function startFullChallenge() {
  sounds.click();
  document.getElementById('regClass').value = document.getElementById('studentClass').value || '201';
  document.getElementById('regSeat').value = document.getElementById('studentSeat').value || '1';
  document.getElementById('regName').value = document.getElementById('studentName').value || '歷史探險家';
  document.getElementById('studentRegistrationModal').classList.add('show');
}
function handleRegistrationSubmit() {
  const cls = document.getElementById('regClass').value.trim() || '201';
  const seat = document.getElementById('regSeat').value.trim() || '1';
  const name = document.getElementById('regName').value.trim() || '歷史探險家';
  gameState.student = { class: cls, seat, name };
  document.getElementById('studentClass').value = cls;
  document.getElementById('studentSeat').value = seat;
  document.getElementById('studentName').value = name;
  updateCertificate();
  closeModal('studentRegistrationModal');
  resetAllGames();
  sounds.fanfare();
  goToUnit('tab-challenge');
  if (!gameState.challenge.started) {
    gameState.challenge.started = true;
    gameState.challenge.timer = setInterval(() => {
      gameState.challenge.seconds++;
      const t = document.getElementById('challengeTimerText');
      if (t) t.textContent = formatTime(gameState.challenge.seconds);
    }, 1000);
  }
  goToStage(1);
}
function returnToHandout() { sounds.click(); goToUnit('tab-handout'); }

// ==========================================
// 5. 關卡 1：揭曉方塊
// ==========================================
const boxData = [
  { id: 1, title: '草原民族', icon: '🐎', desc: '長城以北的生活型態。',
    q: '長城以北的草原民族，主要的經濟生活方式為何？',
    options: ['以農耕為主並定居', '以畜牧為主並逐水草而居', '以海上貿易為主', '以採礦冶鐵為主'], answer: 1,
    hint: '牧草與水源會隨季節移動。' },
  { id: 2, title: '萬里長城', icon: '🧱', desc: '北方的重要防線。',
    q: '秦統一後，對北方各國原有的城牆採取什麼做法？',
    options: ['全部拆除', '改建成運河', '把各國舊城牆連接成長城', '交給匈奴管理'], answer: 2,
    hint: '秦是「連接」既有的城牆，不是最早蓋牆的人。' },
  { id: 3, title: '漢初和親', icon: '💍', desc: '漢初對匈奴的外交策略。',
    q: '漢初國力較弱時，對匈奴主要採取什麼策略？',
    options: ['和親，以婚姻建立外交關係', '派大軍長期北伐', '斷絕一切往來', '主動遷都到草原'], answer: 0,
    hint: '先求邊境安定。' },
  { id: 4, title: '張騫出使', icon: '🐪', desc: '漢武帝時期的外交行動。',
    q: '漢武帝派張騫出使西域，原本最主要的目的是什麼？',
    options: ['販賣絲綢賺錢', '修築萬里長城', '尋找盟友共同對抗匈奴', '把首都遷到西域'], answer: 2,
    hint: '這是一個軍事外交的結盟任務。' },
  { id: 5, title: '絲路交流', icon: '🛣️', desc: '東西往來的交通路線。',
    q: '下列哪一組最能說明絲路是「雙向交流」？',
    options: ['絲綢向西傳，葡萄與琵琶傳入中國', '只有中國絲綢向外傳', '只有西域物產傳入中國', '只運送軍事武器'], answer: 0,
    hint: '一邊傳出，一邊傳入。' },
  { id: 6, title: '永嘉之禍', icon: '🌊', desc: '西晉末年的重大戰亂。',
    q: '西元 311 年，匈奴攻進西晉首都洛陽，這件事稱為什麼？',
    options: ['安史之亂', '永嘉之禍', '靖康之難', '大澤鄉起義'], answer: 1,
    hint: '線索：311 年、洛陽、西晉。' },
  { id: 7, title: '孝文帝漢化', icon: '🏯', desc: '北魏的統治政策。',
    q: '下列哪一項是北魏孝文帝推行的漢化措施？',
    options: ['恢復分封諸侯', '廢除漢語改用鮮卑語', '禁止胡漢通婚', '遷都洛陽並改漢姓'], answer: 3,
    hint: '遷都、說漢語、穿漢服、改漢姓、鼓勵通婚。' },
  { id: 8, title: '天可汗', icon: '👑', desc: '唐太宗的尊號。',
    q: '唐太宗滅東突厥後，被西北各族尊稱為什麼？',
    options: ['大單于', '始皇帝', '天可汗', '周天子'], answer: 2,
    hint: '意思是普天下的君王。' }
];
let boxesSolved = 0;

function initBoxGame() {
  const grid = document.getElementById('boxGrid');
  if (!grid) return;
  grid.innerHTML = '';
  boxesSolved = 0;
  document.getElementById('boxesOpened').textContent = '0';
  boxData.forEach(item => {
    const box = document.createElement('div');
    box.className = 'box-item';
    box.id = `box-${item.id}`;
    box.innerHTML = `
      <div class="box-inner">
        <div class="box-front"><div class="box-num">${item.id}</div><div class="box-label">點擊揭開</div></div>
        <div class="box-back"><div class="box-back-icon">${item.icon}</div><div class="box-back-title">${item.title}</div><div class="box-back-status">已解鎖 ✓</div></div>
      </div>`;
    box.addEventListener('click', () => openBox(item, box));
    grid.appendChild(box);
  });
}
function openBox(item, boxElem) {
  if (boxElem.classList.contains('flipped')) return;
  sounds.flip();
  showQuestionModal({
    badge: `秘寶方塊 ${item.id}`, title: item.title, icon: item.icon, desc: item.desc,
    question: item.q, options: item.options, answer: item.answer, hint: item.hint,
    onCorrect: () => {
      boxElem.classList.add('flipped');
      boxesSolved++;
      document.getElementById('boxesOpened').textContent = boxesSolved;
      addPoints(15, 1);
      if (boxesSolved === boxData.length) {
        sounds.fanfare(); addPoints(20, 1, '秘寶破譯高手');
        setTimeout(() => goToStage(2), 900);
      }
    }
  });
}

// ==========================================
// 6. 關卡 2：時空迷宮
// ==========================================
const mazeMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1]
];
const mazeGates = {
  1: { key: 1, x: 3, y: 3, badge: '第一道封印', title: '邊關守將', q: '關於長城，下列哪一項敘述正確？',
    options: ['秦朝以前完全沒有城牆', '秦把東周以來各國的舊城牆連接起來', '長城是為了禁止百姓經商', '長城由漢武帝最早開始修築'], answer: 1,
    hint: '東周各國早已各自修築城牆。' },
  2: { key: 2, x: 5, y: 5, badge: '第二道封印', title: '西域使者', q: '張騫出使西域的「目的」與「結果」，下列配對何者正確？',
    options: ['目的：販賣絲綢；結果：建立北魏', '目的：遷都洛陽；結果：人口南遷', '目的：結盟抗匈奴；結果：未成功，卻促進東西交流', '目的：傳播漢語；結果：征服中亞'], answer: 2,
    hint: '目的是軍事結盟，交流是後來的結果。' },
  3: { key: 3, x: 7, y: 7, badge: '第三道封印', title: '南遷士人', q: '大批漢人南遷長江流域後，為什麼有助於南方開發？',
    options: ['所有南方地區立刻同樣繁榮', '帶來人力與農耕技術', '北方居民從此全部離開家鄉', '南方從此不再發生戰亂'], answer: 1,
    hint: '關鍵是人力與技術，而且是逐漸發展。' }
};
// ==========================================
// 7. 關卡 3：天命轉盤
// ==========================================
let wheelSectors = [];
const wheelSource = [
  { id: 'w1', label: '農業居民', era: '商周', color: '#0e7490', q: '長城以南的農業民族，生活特色是什麼？', options: ['以農耕為主，較常定居', '逐水草而居', '以畜牧為主', '以海上捕魚為生'], a: 0, desc: '農業民族大致在長城以南。' },
  { id: 'w2', label: '邊關守將', era: '東周～秦', color: '#155e75', q: '東周各國修牆、秦再加以連接，最主要的目的為何？', options: ['方便商人買賣', '防禦北方民族南下', '阻擋南方軍隊', '作為觀光景點'], a: 1, desc: '長城是北方的防線。' },
  { id: 'w3', label: '漢初使者', era: '漢初', color: '#0891b2', q: '漢初對匈奴採取和親，主要原因是什麼？', options: ['匈奴已經滅亡', '皇帝想遷都草原', '當時國力較弱', '想要統一西域'], a: 2, desc: '先求邊境安定。' },
  { id: 'w4', label: '漢武使臣', era: '漢武帝', color: '#06b6d4', q: '漢武帝派張騫出使西域，想達成的目標是什麼？', options: ['販賣絲綢', '聯絡西域各國共同對抗匈奴', '傳播佛教', '遷都洛陽'], a: 1, desc: '尋求軍事結盟。' },
  { id: 'w5', label: '絲路商人', era: '漢', color: '#10b981', q: '透過絲路，中國向外傳播的重要商品是什麼？', options: ['葡萄', '胡瓜', '琵琶', '絲綢'], a: 3, desc: '絲綢向西最遠可達大秦。' },
  { id: 'w6', label: '南遷士人', era: '西晉', color: '#f59e0b', q: '西元 311 年，匈奴攻進西晉首都洛陽，史稱為什麼？', options: ['永嘉之禍', '安史之亂', '靖康之難', '大澤鄉起義'], a: 0, desc: '戰亂促使人口南遷。' },
  { id: 'w7', label: '鮮卑君主', era: '北魏', color: '#ef4444', q: '北魏孝文帝推動漢化，其中「遷都」的方向為何？', options: ['從洛陽遷到平城', '從平城遷到洛陽', '從長安遷到北京', '從咸陽遷到南京'], a: 1, desc: '平城（今山西大同）遷到洛陽。' },
  { id: 'w8', label: '大唐使節', era: '唐', color: '#8b5cf6', q: '唐太宗被西北各族尊稱為天可汗，代表什麼意義？', options: ['他被立為西晉皇帝', '他推行了科舉制度', '他在各族中具有盟主地位', '他修築了萬里長城'], a: 2, desc: '唐帝國成為東亞秩序的盟主。' }
];
let spinsLeft = 5, wheelAngle = 0, isSpinning = false, currentFateSector = null;

function initWheelGame() {
  wheelSectors = wheelSource.map(s => ({ ...s }));
  spinsLeft = 5; wheelAngle = 0; isSpinning = false; currentFateSector = null;
  const sl = document.getElementById('spinsLeft'); if (sl) sl.textContent = '5';
  const t = document.getElementById('wheelFateTitle'); if (t) t.textContent = '等待轉盤旋轉…';
  const d = document.getElementById('wheelFateDesc'); if (d) d.textContent = '按下中央「啟動轉盤」，看看你抽到哪個歷史身分。';
  document.getElementById('wheelAnswerBtn').classList.add('hide');
  drawWheel();
}
function drawWheel() {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const n = wheelSectors.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, cy = canvas.height / 2, radius = cx - 8;
  if (n === 0) {
    ctx.fillStyle = '#0c4a6e'; ctx.font = 'bold 30px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('全部身分皆已破解！', cx, cy); return;
  }
  const arc = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const angle = wheelAngle + i * arc;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, angle, angle + arc);
    ctx.fillStyle = wheelSectors[i].color; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle + arc / 2);
    const mid = ((angle + arc / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const leftSide = mid > Math.PI / 2 && mid < Math.PI * 1.5;
    let tx = radius - 24;
    if (leftSide) { ctx.rotate(Math.PI); tx = -(radius - 24); }
    ctx.textAlign = leftSide ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 31px "Noto Sans TC", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 4;
    ctx.fillText(wheelSectors[i].label, tx, 0);
    ctx.restore();
  }
}
function spinWheel() {
  if (isSpinning || gameState.challenge.currentStage !== 3) return;
  if (spinsLeft <= 0 || wheelSectors.length === 0) { goToStage(4); return; }
  isSpinning = true; spinsLeft--;
  document.getElementById('spinsLeft').textContent = spinsLeft;
  document.getElementById('spinBtn').disabled = true;
  sounds.click();
  const totalRot = Math.floor(Math.random() * 4 + 5) * Math.PI * 2;
  const target = wheelAngle + totalRot + Math.random() * Math.PI * 2;
  const duration = 3000, start = performance.now(), startAngle = wheelAngle;
  let lastTick = wheelAngle;
  function animate(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    wheelAngle = startAngle + (target - startAngle) * ease;
    if (Math.abs(wheelAngle - lastTick) > 0.4) { sounds.tick(); lastTick = wheelAngle; }
    drawWheel();
    if (p < 1) requestAnimationFrame(animate);
    else { isSpinning = false; document.getElementById('spinBtn').disabled = false; determineWheelResult(); }
  }
  requestAnimationFrame(animate);
}
function determineWheelResult() {
  const n = wheelSectors.length;
  if (n === 0) { goToStage(4); return; }
  const arc = (Math.PI * 2) / n;
  const norm = (wheelAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const pointer = (3 * Math.PI / 2 - norm + Math.PI * 2) % (Math.PI * 2);
  const idx = Math.floor(pointer / arc) % n;
  currentFateSector = wheelSectors[idx];
  sounds.flip();
  document.getElementById('wheelFateTitle').textContent = `【${currentFateSector.label}】(${currentFateSector.era})`;
  document.getElementById('wheelFateDesc').textContent = currentFateSector.desc;
  document.getElementById('wheelAnswerBtn').classList.remove('hide');
}
function openWheelQuestion() {
  if (!currentFateSector) return;
  const sector = currentFateSector;
  showQuestionModal({
    badge: `${sector.era} 身分考驗`, title: sector.label, icon: '🎡', desc: sector.desc,
    question: sector.q, options: sector.options, answer: sector.a, hint: '回到課文找這一段的關鍵線索。',
    onCorrect: () => {
      addPoints(20, 1);
      wheelSectors = wheelSectors.filter(s => s.id !== sector.id);
      document.getElementById('wheelAnswerBtn').classList.add('hide');
      currentFateSector = null;
      drawWheel();
      if (spinsLeft <= 0 || wheelSectors.length === 0) {
        sounds.fanfare(); addPoints(20, 1, '天命轉盤大贏家');
        setTimeout(() => goToStage(4), 900);
      } else {
        document.getElementById('wheelFateTitle').textContent = '再轉一次！';
        document.getElementById('wheelFateDesc').textContent = `已破解身分，剩餘 ${spinsLeft} 次轉盤機會。`;
      }
    }
  });
}

// ==========================================
// 8. 關卡 4：轉生者的歷史之旅（事件與意義配對）
// ==========================================
const storyChapters = [
  {
    era: '東周', identity: '趙國平民', icon: '🧱',
    text: '你睜開眼，發現自己成了東周時期趙國的一名平民。某日清晨，官府的差役敲門，把你和村裡的壯丁一起帶到北方邊境，命你們修築邊牆。烈日下，你搬著石塊，忍不住問身旁一同工作的夥伴：「朝廷為什麼要花這麼大力氣修這道牆？」',
    question: '夥伴最可能的回答是什麼？',
    options: ['為了方便商人運送貨物', '為了抵禦北方民族南下', '為了阻擋南方軍隊進攻', '為了當作觀賞的景點'],
    answer: 1, hint: '長城以北，是草原民族活動的區域。',
    outcome: '東周各國修築城牆，是為了抵禦北方民族南下。'
  },
  {
    era: '秦', identity: '修築長城的民夫', icon: '⛏️',
    text: '場景一轉，你成了秦代的一名民夫，正隨大隊在北方曠野上搬運石塊。一位秦國官吏指著遠方高喊：「把先前各國留下的牆，全都接起來！」身旁的老工匠壓低聲音，向你解釋秦國這麼做的用意。',
    question: '老工匠說的是什麼？',
    options: ['把舊牆全部拆除，改建成運河', '讓各國繼續自己管理城牆', '把各國舊城牆連接成長城，形成北方的防線', '把城牆送給匈奴當作禮物'],
    answer: 2, hint: '秦是「連接」秦代以前的城牆，不是最早蓋牆。',
    outcome: '秦把各國舊城牆連接成長城，形成北方的防線。'
  },
  {
    era: '漢武帝', identity: '朝廷裡的小吏', icon: '🐪',
    text: '你轉生到漢武帝時代，成為朝廷裡的一名小吏。某日，皇帝召見使者張騫，命他出使西域。散朝後，你偷偷問同僚：「陛下派張騫走那麼遠，到底想做什麼？」',
    question: '同僚最可能的回答是什麼？',
    options: ['聯絡西域各國，想一起對抗匈奴', '只是為了販賣絲綢賺錢', '想把首都遷到西域', '想派人去傳播佛教'],
    answer: 0, hint: '這是一個軍事外交的結盟任務。',
    outcome: '張騫出使西域原是為了結盟對抗匈奴；雖未成功，卻促進了東西交流。'
  },
  {
    era: '西晉', identity: '洛陽城中的書生', icon: '🌊',
    text: '你轉生為西晉洛陽城中的一名書生。西元 311 年，城外突然殺聲震天，匈奴軍隊攻入洛陽，皇帝被俘。你跟著驚慌的人群一路南逃，渡過長江。多年後回想，這場戰亂在歷史上帶來什麼影響？',
    question: '這場戰亂的影響是什麼？',
    options: ['洛陽從此更加繁榮，人口大量移入', '西晉因此變得更強大', '北方從此不再發生戰亂', '史稱永嘉之禍，大批漢人南遷長江流域'],
    answer: 3, hint: '311 年、洛陽、西晉，是這場戰亂的線索。',
    outcome: '311 年永嘉之禍，匈奴攻入洛陽，大批漢人南遷，加速南方開發。'
  },
  {
    era: '北魏', identity: '鮮卑少年', icon: '🏯',
    text: '你再次轉生，成了北魏的一名鮮卑少年。朝廷下令遷都洛陽，還要求大家改說漢語、穿漢服、改漢姓。家中的長輩有些不滿，前來宣達的官員卻說，這麼做是為了大局。',
    question: '官員所說的「大局」是什麼？',
    options: ['恢復西周的封建制度', '推行漢化，促進胡漢融合、穩固統治', '建立科舉考試制度', '徹底消滅所有漢人文化'],
    answer: 1, hint: '胡族君主面對胡漢衝突，想穩固統治。',
    outcome: '北魏孝文帝遷都洛陽並推行漢化，促進胡漢融合。'
  },
  {
    era: '唐', identity: '長安城裡的旅人', icon: '👑',
    text: '最後一次轉生，你來到唐朝的長安城。街道上滿是各國使節、商人與僧侶，人們談起皇帝時，尊稱他為「天可汗」。你好奇地問客棧老闆，這個稱號代表什麼意思？',
    question: '「天可汗」代表什麼意思？',
    options: ['唐太宗被立為西晉皇帝', '唐太宗推行了科舉制度', '唐太宗成為各族共主，唐帝國是東亞秩序的盟主', '唐太宗修築了萬里長城'],
    answer: 2, hint: '這個尊號代表他在各族之間的盟主地位。',
    outcome: '唐太宗被尊為天可汗，成為東亞秩序的盟主。'
  }
];
let storyIdx = 0, storyDone = 0;

function initMatchGame() {
  storyIdx = 0; storyDone = 0;
  const c = document.getElementById('matchCount'); if (c) c.textContent = '0';
  renderStory();
}
function renderStory() {
  const ch = storyChapters[storyIdx];
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('storyEra', `${ch.era} · 第 ${storyIdx + 1} 章`);
  set('storyIdentity', `轉生身分：${ch.identity}`);
  set('storyText', ch.text);
  set('storyQuestion', ch.question);
  const fb = document.getElementById('matchFeedback');
  if (fb) fb.textContent = '';
  const box = document.getElementById('storyOptions');
  if (!box) return;
  box.innerHTML = '';
  ch.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'story-option'; btn.textContent = opt;
    btn.onclick = () => handleStoryAnswer(i, btn);
    box.appendChild(btn);
  });
}
function handleStoryAnswer(i, btn) {
  const ch = storyChapters[storyIdx];
  const box = document.getElementById('storyOptions');
  const fb = document.getElementById('matchFeedback');
  if (i === ch.answer) {
    sounds.correct();
    btn.classList.add('correct');
    box.querySelectorAll('button').forEach(b => { b.disabled = true; });
    storyDone++;
    document.getElementById('matchCount').textContent = storyDone;
    addPoints(15, 1);
    fb.textContent = `✅ ${ch.outcome}`;
    setTimeout(() => {
      if (storyIdx < storyChapters.length - 1) { storyIdx++; renderStory(); }
      else {
        sounds.fanfare(); addPoints(20, 1, '時空轉生者');
        fb.textContent = '🎉 六段人生全部完成！前往闖關問答。';
        setTimeout(() => goToStage(5), 1200);
      }
    }, 1400);
  } else {
    sounds.wrong();
    btn.classList.add('wrong', 'shake');
    setTimeout(() => btn.classList.remove('shake'), 400);
    fb.textContent = `❌ 再想想！提示：${ch.hint}`;
  }
}

// ==========================================
// 9. 關卡 5：獨孤求敗的漢化之路（北魏孝文帝漢化政策）
// ==========================================
const quizQuestions = [
  {
    era: '北魏・平城皇宮', story: '朝議上，孝文帝提出推行漢化政策，卻遭到保守派大臣強烈反對。下朝後，皇帝召集親信密談，其中也包括你——青年官員獨孤求敗。皇帝問道：「要如何才能降低阻力？」',
    q: '你（獨孤求敗）提出的建議是什麼？',
    options: ['建議處死所有反對的鮮卑貴族', '建議放棄漢化，維持舊制', '建議遷都洛陽，離開鮮卑舊勢力較強的平城', '建議把首都遷到更北的草原'],
    answer: 2, hint: '離開舊勢力盤據的地方，改革阻力才會變小。' },
  {
    era: '北魏・南征途中', story: '你的建議被採納了。西元 493 年，孝文帝親自率領大軍南下。隨行的大臣以為皇帝要攻打南朝，卻不明白他真正的用意。',
    q: '孝文帝是用什麼方法促成遷都的？',
    options: ['宣稱發兵攻打南朝，率軍南下，抵達洛陽後宣布遷都', '事先公告要遷都，讓大家慢慢準備', '派使者到南朝請求同意', '舉辦投票，由貴族共同決定'],
    answer: 0, hint: '以「南伐」為名，行遷都之實。' },
  {
    era: '北魏・洛陽', story: '大軍抵達洛陽後，皇帝宣布遷都於此。接著，一道道命令接連下達，朝廷上下都要改變，你身為鮮卑官員，生活也開始出現變化。',
    q: '遷都之後，你（獨孤求敗）最可能遇到什麼改變？',
    options: ['必須改信佛教，不准祭祖', '要辭去官職，回草原放牧', '必須改用鮮卑語、穿鮮卑服', '要改說漢語、穿漢服'],
    answer: 3, hint: '漢化包含語言與服飾的改變。' },
  {
    era: '北魏・洛陽朝堂', story: '為了讓胡漢更加融合，皇帝又陸續推出更多措施。朝廷裡的鮮卑貴族紛紛改名，你也被賜了一個新的漢姓。',
    q: '關於這些措施，下列哪一項敘述正確？',
    options: ['禁止鮮卑人與漢人來往', '鮮卑姓氏改為漢姓，並鼓勵胡漢通婚', '規定只有漢人能擔任官職', '廢除朝廷所有禮儀制度'],
    answer: 1, hint: '例如拓跋改為元，並鼓勵胡漢通婚。' },
  {
    era: '北魏・貴族府邸', story: '漢化的命令愈來愈多，朝中卻也出現不滿的聲音。部分鮮卑貴族私下抱怨，甚至有人開始抵制改革。',
    q: '這些鮮卑貴族為什麼反對漢化？',
    options: ['擔心皇帝把首都遷回草原', '擔心失去漢人的支持', '擔心喪失傳統生活與勇武精神', '擔心科舉考試太難'],
    answer: 2, hint: '改革會改變他們熟悉的生活方式與價值。' },
  {
    era: '北魏・洛陽（數年後）', story: '多年以後，你（獨孤求敗）回顧這一切。孝文帝的漢化政策，不只改變了朝廷，也改變了整個北方的未來。',
    q: '孝文帝推動漢化的主要目的與影響，下列何者最恰當？',
    options: ['穩固統治、促進胡漢融合，奠定日後隋唐盛世的基礎', '消滅漢人文化，恢復遊牧生活', '建立科舉制度，選拔平民人才', '與南朝結盟，共同對抗匈奴'],
    answer: 0, hint: '目的是穩固統治，影響是促進融合。' }
];
let quizIdx = 0, quizCombo = 0;

function initQuizGame() {
  quizIdx = 0; quizCombo = 0;
  const c = document.getElementById('quizCombo'); if (c) c.textContent = '0';
  const l50 = document.getElementById('lifeline5050'); if (l50) l50.disabled = false;
  const lh = document.getElementById('lifelineHint'); if (lh) lh.disabled = false;
  loadQuizQuestion(0);
}
function loadQuizQuestion(idx) {
  if (idx >= quizQuestions.length) {
    sounds.fanfare(); addPoints(25, 2, '漢化政策通');
    setTimeout(() => goToStage(6), 1000);
    return;
  }
  quizIdx = idx;
  const q = quizQuestions[idx];
  document.getElementById('quizIndex').textContent = idx + 1;
  document.getElementById('quizEraTag').textContent = q.era;
  const storyEl = document.getElementById('quizStoryText');
  if (storyEl) storyEl.textContent = q.story || '';
  document.getElementById('quizTitle').textContent = q.q;
  document.getElementById('quizHintText').classList.add('hide');
  const fb = document.getElementById('quizFeedbackBox'); fb.className = 'feedback-msg'; fb.textContent = '';
  const grid = document.getElementById('quizOptionsGrid');
  grid.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'quiz-option-btn'; btn.id = `quiz-opt-${i}`;
    btn.innerHTML = `<span class="opt-label">${String.fromCharCode(65 + i)}.</span> ${opt}`;
    btn.onclick = () => handleQuizAnswer(i, q);
    grid.appendChild(btn);
  });
}
function handleQuizAnswer(selected, q) {
  const all = document.querySelectorAll('.quiz-option-btn');
  all.forEach(b => { b.disabled = true; });
  const fb = document.getElementById('quizFeedbackBox');
  if (selected === q.answer) {
    sounds.correct();
    all[selected].classList.add('correct');
    quizCombo++;
    document.getElementById('quizCombo').textContent = quizCombo;
    const gained = 15 + (quizCombo > 1 ? (quizCombo - 1) * 5 : 0);
    addPoints(gained, 1);
    fb.className = 'feedback-msg success';
    fb.textContent = `🎉 答對了！+${gained} 分。${q.hint}`;
    setTimeout(() => loadQuizQuestion(quizIdx + 1), 1000);
  } else {
    sounds.wrong();
    all[selected].classList.add('wrong');
    all[q.answer].classList.add('correct');
    quizCombo = 0;
    document.getElementById('quizCombo').textContent = '0';
    fb.className = 'feedback-msg error';
    fb.textContent = `❌ 答錯了！正確答案是 ${String.fromCharCode(65 + q.answer)}。${q.hint}`;
    setTimeout(() => loadQuizQuestion(quizIdx + 1), 1500);
  }
}
function useLifeline5050() {
  sounds.click();
  const q = quizQuestions[quizIdx];
  const wrong = [0, 1, 2, 3].filter(i => i !== q.answer).sort(() => 0.5 - Math.random());
  document.getElementById(`quiz-opt-${wrong[0]}`).style.visibility = 'hidden';
  document.getElementById(`quiz-opt-${wrong[1]}`).style.visibility = 'hidden';
  document.getElementById('lifeline5050').disabled = true;
}
function useLifelineHint() {
  sounds.click();
  const q = quizQuestions[quizIdx];
  const box = document.getElementById('quizHintText');
  box.textContent = `💡 名師提示：${q.hint}`;
  box.classList.remove('hide');
  document.getElementById('lifelineHint').disabled = true;
}

// ==========================================
// 10. 關卡 6：歷史偵探（永嘉之禍：真相與謊言）
// ==========================================
const detectiveSources = [
  { era: '原因', truth: '漢代以來，北方草原民族陸續內遷，因風俗不同又受歧視，胡漢衝突不斷。', lie: '北方草原民族內遷後與漢人相處融洽，胡漢之間從未發生衝突。', explanation: '北方民族內遷後，因習俗差異與歧視，胡漢關係緊張、衝突不斷。' },
  { era: '經過', truth: '西元 311 年，匈奴軍隊攻入西晉首都洛陽，皇帝被俘，史稱永嘉之禍。', lie: '西元 311 年，匈奴軍隊攻入西晉首都長安，皇帝被俘，史稱永嘉之禍。', explanation: '永嘉之禍發生在西晉首都洛陽，不是長安。' },
  { era: '結果', truth: '永嘉之禍後不久西晉滅亡，北方成為胡人建立政權的局面。', lie: '永嘉之禍後，西晉反而更加強盛，繼續穩固統治整個北方。', explanation: '西晉在永嘉之禍後不久滅亡，北方改由胡人建立政權。' },
  { era: '影響', truth: '戰亂促使大批漢人南遷長江流域，加速南方的開發。', lie: '戰亂促使大批漢人南遷，使南方人口大減、開發停滯。', explanation: '南遷帶來人口與技術，是加速南方開發，不是讓南方衰落。' },
  { era: '衣冠南渡', truth: '晉室與大批士族（衣冠）南遷長江流域，後來在南方建立東晉。', lie: '永嘉之禍後，晉室選擇留在北方繼續抵抗，並沒有南遷。', explanation: '晉室與士族南遷並建立東晉，史稱「衣冠南渡」。' },
  { era: '影響', truth: '南遷人口帶來人力與農耕技術，對日後經濟重心南移有重要影響。', lie: '永嘉之禍後，中國經濟重心立刻完全移到南方，北方從此一蹶不振。', explanation: '經濟重心南移是逐漸的過程，不是立刻完成，北方也未從此一蹶不振。' }
];
let detectiveItems = [], detectivePlacements = {}, detectiveSelected = null, detectiveSettled = false, detectiveDrag = null;

function initDetectiveGame() {
  detectivePlacements = {}; detectiveSelected = null; detectiveSettled = false; detectiveDrag = null;
  const flags = detectiveSources.map(() => Math.random() < 0.5);
  if (flags.every(Boolean)) flags[Math.floor(Math.random() * flags.length)] = false;
  if (flags.every(f => !f)) flags[Math.floor(Math.random() * flags.length)] = true;
  detectiveItems = detectiveSources.map((s, i) => ({ ...s, id: String(i), isTrue: flags[i], text: flags[i] ? s.truth : s.lie }));
  const count = document.getElementById('errorsFoundCount'); if (count) count.textContent = '0';
  const results = document.getElementById('detectiveResults'); if (results) { results.hidden = true; results.replaceChildren(); }
  const status = document.getElementById('detectiveStatus'); if (status) status.textContent = '請分類所有線索卡片。';
  document.querySelectorAll('.verdict-zone').forEach(z => { z.querySelector('.verdict-cards').replaceChildren(); z.removeAttribute('aria-disabled'); z.tabIndex = 0; });
  const content = document.getElementById('scrollContent');
  if (!content) return;
  content.replaceChildren();
  const intro = document.createElement('p'); intro.className = 'evidence-intro';
  intro.textContent = '啟稟大人：關於「永嘉之禍」的六則傳聞中，有真相也有謊言，請依史實辨明真偽。';
  content.appendChild(intro);
  [...detectiveItems].sort(() => Math.random() - 0.5).forEach(item => {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'evidence-card'; card.dataset.evidence = item.id;
    const label = document.createElement('span'); label.className = 'evidence-label'; label.textContent = `線索 ${Number(item.id) + 1} · ${item.era}`;
    const text = document.createElement('span'); text.className = 'evidence-text'; text.textContent = item.text;
    card.append(label, text);
    card.onclick = () => detectiveChoose(item.id);
    card.addEventListener('pointerdown', e => {
      if (detectiveSettled || e.button !== 0) return;
      detectiveChoose(item.id);
      detectiveDrag = { id: item.id, pointer: e.pointerId, x: e.clientX, y: e.clientY, card, ghost: null };
      card.setPointerCapture(e.pointerId);
    });
    content.appendChild(card);
  });
}
function detectiveChoose(id) {
  if (detectiveSettled) return;
  detectiveSelected = id;
  document.querySelectorAll('.evidence-card').forEach(c => c.classList.toggle('is-selected', c.dataset.evidence === id));
  const status = document.getElementById('detectiveStatus');
  if (status) status.textContent = `已選取線索 ${Number(id) + 1}，請拖曳或選擇真相／謊言區。`;
}
function detectivePlace(id, value) {
  if (detectiveSettled || !detectiveItems.some(i => i.id === id) || !['true', 'false'].includes(value)) return;
  detectivePlacements[id] = value === 'true';
  detectiveSelected = null;
  const zone = document.querySelector(`[data-verdict="${value}"]`);
  const card = document.querySelector(`[data-evidence="${id}"]`);
  if (zone && card) zone.querySelector('.verdict-cards').appendChild(card);
  document.querySelectorAll('.evidence-card').forEach(c => c.classList.remove('is-selected'));
  const n = Object.keys(detectivePlacements).length;
  const count = document.getElementById('errorsFoundCount'); if (count) count.textContent = n;
  const status = document.getElementById('detectiveStatus');
  if (status) status.textContent = `已分類 ${n}／${detectiveItems.length} 則；全部放好前可移動更改。`;
  if (n === detectiveItems.length) detectiveFinish();
}
function detectiveClearDrag() {
  if (!detectiveDrag) return;
  try { detectiveDrag.ghost?.remove(); } catch (e) { /* 忽略 */ }
  try { detectiveDrag.card.classList.remove('is-dragging'); } catch (e) { /* 忽略 */ }
  try {
    if (detectiveDrag.card.hasPointerCapture && detectiveDrag.card.hasPointerCapture(detectiveDrag.pointer)) {
      detectiveDrag.card.releasePointerCapture(detectiveDrag.pointer);
    }
  } catch (e) { /* 忽略 */ }
  document.querySelectorAll('.verdict-zone').forEach(z => z.classList.remove('is-over'));
  detectiveDrag = null;
}
function detectiveFinish() {
  if (detectiveSettled) return;
  detectiveSettled = true;
  const correct = detectiveItems.filter(i => detectivePlacements[i.id] === i.isTrue).length;
  document.querySelectorAll('.evidence-card').forEach(card => {
    const item = detectiveItems.find(i => i.id === card.dataset.evidence);
    const ok = detectivePlacements[item.id] === item.isTrue;
    card.disabled = true;
    card.classList.add(ok ? 'verdict-correct' : 'verdict-wrong');
    const mark = document.createElement('span');
    mark.className = 'evidence-verdict';
    mark.textContent = `${ok ? '判斷正確' : '判斷錯誤'} · 實際為${item.isTrue ? '真相' : '謊言'}`;
    card.appendChild(mark);
  });
  document.querySelectorAll('.verdict-zone').forEach(z => { z.setAttribute('aria-disabled', 'true'); z.tabIndex = -1; });
  if (correct === detectiveItems.length) sounds.fanfare(); else sounds.wrong();
  if (correct) addPoints(correct * 15, correct);
  if (correct === detectiveItems.length) addPoints(20, 1, '永嘉之禍神探');
  const status = document.getElementById('detectiveStatus');
  if (status) status.textContent = `答案已揭曉：${correct}／${detectiveItems.length} 則判斷正確。`;

  const results = document.getElementById('detectiveResults');
  if (results) {
    results.hidden = false; results.replaceChildren();
    const heading = document.createElement('h4');
    heading.textContent = `真相揭曉 · ${correct}／${detectiveItems.length} 則正確`;
    results.appendChild(heading);
    const score = document.createElement('p');
    score.textContent = `本關獲得 ${correct * 15 + (correct === detectiveItems.length ? 20 : 0)} 分（每則答對 15 分，全對另加 20 分）。`;
    results.appendChild(score);
    detectiveItems.forEach(item => {
      const article = document.createElement('article');
      const title = document.createElement('h5');
      title.textContent = `線索 ${Number(item.id) + 1}｜${item.era}：${item.isTrue ? '真相' : '謊言'}`;
      const verdict = document.createElement('p');
      verdict.textContent = `你的分類：${detectivePlacements[item.id] ? '真相' : '謊言'}。${item.explanation}`;
      article.append(title, verdict);
      results.appendChild(article);
    });
  }
  completeAllChallenges(false);
  if (correct < detectiveItems.length) {
    document.getElementById('finalEvaluation').textContent = `已完成六道歷史挑戰！最後一關判斷正確 ${correct}／${detectiveItems.length} 則，請對照解析複習永嘉之禍的因果。`;
  }
  const btn = document.createElement('button');
  btn.className = 'primary-btn'; btn.textContent = '查看總成績與學習證書';
  btn.onclick = () => completeAllChallenges(true);
  if (results) results.appendChild(btn);
}

document.addEventListener('pointermove', e => {
  if (!detectiveDrag || e.pointerId !== detectiveDrag.pointer) return;
  if (!detectiveDrag.ghost && Math.hypot(e.clientX - detectiveDrag.x, e.clientY - detectiveDrag.y) < 7) return;
  if (!detectiveDrag.ghost) {
    detectiveDrag.ghost = detectiveDrag.card.cloneNode(true);
    detectiveDrag.ghost.removeAttribute('data-evidence');
    detectiveDrag.ghost.setAttribute('aria-hidden', 'true');
    detectiveDrag.ghost.classList.add('evidence-ghost');
    detectiveDrag.ghost.style.width = Math.min(detectiveDrag.card.offsetWidth, 320) + 'px';
    document.body.appendChild(detectiveDrag.ghost);
    detectiveDrag.card.classList.add('is-dragging');
  }
  detectiveDrag.ghost.style.left = e.clientX + 12 + 'px';
  detectiveDrag.ghost.style.top = e.clientY + 12 + 'px';
  const hovered = document.elementFromPoint(e.clientX, e.clientY)?.closest('.verdict-zone');
  document.querySelectorAll('.verdict-zone').forEach(z => z.classList.toggle('is-over', z === hovered));
  if (e.clientY > innerHeight - 60) window.scrollBy(0, 14);
  else if (e.clientY < 60) window.scrollBy(0, -14);
});
document.addEventListener('pointerup', e => {
  if (!detectiveDrag) return;
  const id = detectiveDrag.id, wasDragged = !!detectiveDrag.ghost;
  const dest = (e.pointerId === detectiveDrag.pointer && wasDragged)
    ? document.elementFromPoint(e.clientX, e.clientY)?.closest('.verdict-zone')
    : null;
  detectiveClearDrag();
  if (dest) detectivePlace(id, dest.dataset.verdict);
});
document.addEventListener('pointercancel', detectiveClearDrag);

// ==========================================
// 11. 證書
// ==========================================
function updateCertificate() {
  const nameEl = document.getElementById('certName'); if (!nameEl) return;
  nameEl.textContent = document.getElementById('studentName').value || '歷史探險家';
  document.getElementById('certClass').textContent = document.getElementById('studentClass').value || '201';
  document.getElementById('certSeat').textContent = document.getElementById('studentSeat').value || '1';
  document.getElementById('certTotalScore').textContent = gameState.score;
  document.getElementById('certTotalStars').textContent = gameState.stars;
  document.getElementById('certTotalTime').textContent = formatTimeChinese(gameState.challenge.seconds);
  const badgeRow = document.getElementById('certBadgesRow');
  badgeRow.innerHTML = '';
  if (gameState.badges.size === 0) badgeRow.innerHTML = '<span class="badge-item">🌱 歷史初試身手</span>';
  else gameState.badges.forEach(b => { const s = document.createElement('span'); s.className = 'badge-item'; s.textContent = `🏅 ${b}`; badgeRow.appendChild(s); });
  const today = new Date();
  document.getElementById('certDate').textContent = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
}

// ==========================================
// 12. 重置與初始化
// ==========================================
function resetAllGames() {
  gameState.score = 0; gameState.stars = 0; gameState.badges.clear();
  initBoxGame(); initMazeGame(); initWheelGame(); initMatchGame(); initQuizGame(); initDetectiveGame();
  updateGlobalDisplay();
}

window.addEventListener('DOMContentLoaded', () => {
  setupTabNavigation();
  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    sounds.enabled = !sounds.enabled;
    document.getElementById('soundIcon').textContent = sounds.enabled ? '🔊' : '🔇';
  });
  ['studentName', 'studentClass', 'studentSeat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCertificate);
  });
  document.querySelectorAll('[data-move]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[btn.dataset.move];
      moveMazePlayer(d[0], d[1]);
    });
  });
  document.querySelectorAll('.verdict-zone').forEach(z => {
    z.addEventListener('click', e => {
      if (!e.target.closest('.evidence-card') && detectiveSelected !== null) detectivePlace(detectiveSelected, z.dataset.verdict);
    });
    z.addEventListener('keydown', e => {
      if (e.target === z && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (detectiveSelected !== null) detectivePlace(detectiveSelected, z.dataset.verdict);
      }
    });
  });
  document.addEventListener('keydown', e => {
    if (gameState.challenge.currentStage !== 2) return;
    const map = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
    const d = map[e.key];
    if (d) { e.preventDefault(); moveMazePlayer(d[0], d[1]); }
  });
  resetAllGames();
  updateCertificate();
});
