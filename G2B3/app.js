/**
 * 國中歷史二上 第1課〈商周至隋唐的國家與社會〉
 * 互動作業網頁 核心遊戲與學習邏輯
 * 特色：
 * 1. 課本重點講義獨立閱讀，支援講義列印
 * 2. 講義底部單一「開始挑戰」大按鈕，點擊後啟動全作業碼錶計時
 * 3. 5 道關卡連貫自動跳轉：揭曉方塊 ➔ 時空迷宮 ➔ 天命轉盤 ➔ 殿試問答 ➔ 歷史除錯
 * 4. 轉盤答對後扇區自動消失避免重複，次數用完自動跳關
 * 5. 全數通關後結算總得分與總耗時，引導查看證書
 */

// ==========================================
// Firebase 學習帳號與成績服務設定
// ==========================================
const SCHOOL_AUTH_CONFIG = {
  UNIT_NAME: '二上第1課_商周至隋唐的國家與社會',
  SCORE_UNIT_ID: 'G2B3'
};

// Google Form 由老師執行 G2B3/gas/CreateScoreForms.js 建立後填入網址。
const SCORE_FORM_CONFIG = {
  URL: 'https://docs.google.com/forms/d/e/1FAIpQLSe0zZJA3NnwwEWIXOtcmqK1FPD88ScvnIGRrfVVY-SWnebdmg/viewform?usp=header',
  ENTRIES: {className: '', seat: '', name: '', score: ''}
};
window.SCORE_FORM_CONFIG = SCORE_FORM_CONFIG;

// ==========================================
// 1. Web Audio API 音效引擎 (即開即響，無依賴)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, duration, type = 'sine', gainVal = 0.15) {
    if (!this.enabled) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  click() {
    this.playTone(800, 0.05, 'triangle', 0.1);
  }

  flip() {
    this.playTone(500, 0.08, 'sine', 0.12);
  }

  tick() {
    this.playTone(950, 0.03, 'square', 0.04);
  }

  correct() {
    if (!this.enabled) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 0.16, 'triangle', 0.18), idx * 80);
    });
  }

  wrong() {
    if (!this.enabled) return;
    this.init();
    this.playTone(220, 0.25, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(180, 0.35, 'sawtooth', 0.2), 150);
  }

  fanfare() {
    if (!this.enabled) return;
    this.init();
    const chords = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    chords.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.4, 'triangle', 0.22), i * 110);
    });
  }
}

const sounds = new SoundEngine();

// ==========================================
// 2. 全局遊戲狀態與挑戰計時
// ==========================================
const gameState = {
  score: 0,
  stars: 0,
  badges: new Set(),
  student: {
    class: '201',
    seat: '1',
    name: '歷史探險家',
    email: '',
    registered: false,
    authenticated: false,
    idToken: ''
  },
  // 全程挑戰計時系統
  challenge: {
    started: false,
    timer: null,
    seconds: 0,
    currentStage: 1,
    completed: false
  }
};

function formatTime(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTimeChinese(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins === 0) return `${secs} 秒`;
  return `${mins} 分 ${secs} 秒`;
}

function addPoints(pts, starsToAdd = 1, badge = null) {
  gameState.score += pts;
  gameState.stars += starsToAdd;
  if (badge) gameState.badges.add(badge);
  updateGlobalDisplay();
}

function updateGlobalDisplay() {
  document.getElementById('totalScore').innerText = gameState.score;
  document.getElementById('totalStars').innerText = gameState.stars;
  const challengeScore = document.getElementById('challengeScoreText');
  if (challengeScore) challengeScore.innerText = gameState.score;
  updateCertificate();
}

// 講義列印功能
function printHandout() {
  sounds.click();
  document.body.classList.add('printing-handout');
  document.body.classList.remove('printing-cert');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-handout');
  }, 1000);
}

// 證書列印功能
function printCertificate() {
  if (!gameState.challenge.completed) {
    alert('請先完成全部 5 道挑戰關卡，再列印榮譽學習成就證書！');
    return;
  }
  sounds.click();
  document.body.classList.add('printing-cert');
  document.body.classList.remove('printing-handout');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-cert');
  }, 1000);
}

function downloadCertificate() {
  if (!gameState.challenge.completed) {
    alert('請先完成全部 5 道挑戰關卡，再下載 PDF 證書！');
    return;
  }
  sounds.click();
  document.body.classList.add('printing-cert');
  document.body.classList.remove('printing-handout');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-cert'), 1000);
}

// 頁籤切換
function goToUnit(targetTabId) {
  if (targetTabId === 'tab-summary' && !gameState.challenge.completed) {
    alert('請先完成全部 5 道挑戰關卡，再查看榮譽學習成就證書！');
    return;
  }
  sounds.click();
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTabId}"]`);
  if (tabBtn) tabBtn.classList.add('active');
  const targetPane = document.getElementById(targetTabId);
  if (targetPane) targetPane.classList.add('active');

  if (window.MazeAdventure) MazeAdventure.refresh();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (targetTabId === 'tab-summary') {
    updateCertificate();
  }
}

function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      goToUnit(targetId);
    });
  });
}

function closeModal(modalId) {
  sounds.click();
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('show');
}

// ==========================================
// 3. 連貫挑戰流程控制 (關卡自動跳轉)
// ==========================================
const stageNames = [
  '',
  '關卡 1：揭曉方塊',
  '關卡 2：時空迷宮',
  '關卡 3：天命仕途轉盤',
  '關卡 4：殿試問答爭霸戰',
  '關卡 5：歷史除錯官'
];

function openScoreForm() {
  if (window.FirebaseService && FirebaseService.isConfigured()) {
    uploadScoreToGAS();
    return;
  }
  alert('Firebase 尚未完成設定，暫時無法儲存成績。');
}

let scoreUploadInFlight = false;
let scoreSubmissionId = '';
let pendingG2B3Profile = null;
async function uploadScoreToGAS() {
  if (scoreUploadInFlight) return;
  const syncBox = document.getElementById('cloudSyncStatusBox');
  const syncText = document.getElementById('cloudSyncText');
  const syncIcon = document.getElementById('cloudSyncIcon');
  const certSyncText = document.getElementById('certCloudSyncText');
  const certSyncIcon = document.getElementById('certCloudSyncIcon');
  const certSyncPill = document.getElementById('certCloudSyncPill');

  function updateStatus(status, icon, msg) {
    if (syncBox) {
      syncBox.className = `cloud-sync-status-box ${status}`;
      if (syncIcon) syncIcon.innerText = icon;
      if (syncText) syncText.innerText = msg;
    }
    if (certSyncPill) {
      certSyncPill.className = `cloud-sync-status-box ${status}`;
      if (certSyncIcon) certSyncIcon.innerText = icon;
      if (certSyncText) certSyncText.innerText = msg;
    }
  }

  if (!gameState.challenge.completed) return;

  if (window.FirebaseService && FirebaseService.isConfigured()) {
    updateStatus('uploading', '⏳', '正在儲存成績，請稍候...');
    const result = await FirebaseService.submitScore({
      unitId: 'G2B3',
      profile: {
        classId: gameState.student.class,
        seatNo: gameState.student.seat,
        name: gameState.student.name,
        email: gameState.student.email,
        registered: gameState.student.registered === true,
        rosterName: gameState.student.rosterName
      },
      score: gameState.score,
      stars: gameState.stars,
      durationSeconds: gameState.challenge.seconds,
      badges: Array.from(gameState.badges),
      completed: true,
      isGuest: gameState.student.registered !== true
    });
    if (result.status === 'success') {
      updateStatus('success', '☁️', '成績已送出，等待教師核對。');
    } else if (result.status === 'guest') {
      updateStatus('error', '👤', '目前是訪客模式，不會儲存正式成績。');
    } else {
      updateStatus('error', '⚠️', `成績儲存失敗：${result.message || '請稍後重試'}。`);
    }
    return result;
  }

  updateStatus('error', '⚠️', 'Firebase 尚未完成設定，無法儲存成績。');
}

function startFullChallenge() {
  sounds.click();
  // 彈出學籍資料登記視窗 (班級、座號、姓名，製作證書使用)
  const regClass = document.getElementById('regClass');
  const regSeat = document.getElementById('regSeat');
  const regName = document.getElementById('regName');

  const curClass = document.getElementById('studentClass').value.trim();
  const curSeat = document.getElementById('studentSeat').value.trim();
  const curName = document.getElementById('studentName').value.trim();

  document.getElementById('regEmail').value = gameState.student.email || '';
  regClass.value = '';
  regSeat.value = '';
  regName.value = '';
  pendingG2B3Profile = null;
  document.getElementById('studentRegistrationModal').classList.add('show');
  setTimeout(() => document.getElementById('regEmail').focus(), 150);
}

async function lookupG2B3Student() {
  const email = document.getElementById('regEmail').value.trim();
  if (!email) {
    alert('請輸入學習帳號 Email！');
    return;
  }
  const result = await FirebaseService.loginStudent(email);
  if (result.status === 'registered') {
    pendingG2B3Profile = result.profile;
    document.getElementById('regClass').value = result.profile.classId;
    document.getElementById('regSeat').value = result.profile.seatNo;
    document.getElementById('regName').value = result.profile.name;
    closeModal('studentRegistrationModal');
    document.getElementById('studentProfileModal').classList.add('show');
  } else if (result.status === 'guest') {
    pendingG2B3Profile = null;
    closeModal('studentRegistrationModal');
    document.getElementById('studentGuestModal').classList.add('show');
  } else {
    pendingG2B3Profile = null;
    alert(result.message || '目前無法查詢學習帳號，請稍後再試。');
  }
}

function backToG2B3Query(currentModalId) {
  closeModal(currentModalId);
  document.getElementById('studentRegistrationModal').classList.add('show');
  setTimeout(() => document.getElementById('regEmail').focus(), 150);
}

function startG2B3Guest() {
  const regName = document.getElementById('regName').value.trim() || '訪客';
  gameState.student.class = '訪客';
  gameState.student.seat = '00';
  gameState.student.name = regName;
  gameState.student.email = '';
  gameState.student.registered = false;
  gameState.student.authenticated = false;
  document.getElementById('studentClass').value = '訪客';
  document.getElementById('studentSeat').value = '00';
  document.getElementById('studentName').value = regName;
  updateCertificate();
  closeModal('studentGuestModal');
  if (gameState.challenge.completed) {
    goToUnit('tab-summary');
    return;
  }
  sounds.fanfare();
  goToUnit('tab-challenge');
  if (!gameState.challenge.started) {
    gameState.challenge.started = true;
    gameState.challenge.timer = setInterval(() => {
      gameState.challenge.seconds++;
      document.getElementById('challengeTimerText').innerText = formatTime(gameState.challenge.seconds);
    }, 1000);
  }
  goToStage(1);
}

async function handleRegistrationSubmit(e) {
  e.preventDefault();
  const regEmail = document.getElementById('regEmail').value.trim();
  const regName = document.getElementById('regName').value.trim();

  if (!regEmail || !pendingG2B3Profile) {
    alert('請先查詢學習帳號，確認班級與座號後再開始遊戲。');
    return;
  }

  const result = await FirebaseService.loginStudent(regEmail, regName);
  if (result.status !== 'registered') {
    alert(result.message);
    return;
  }
  const profile = result.profile;

  gameState.student.class = profile.classId;
  gameState.student.seat = profile.seatNo;
  gameState.student.name = profile.name;
  gameState.student.email = profile.email || '';
  gameState.student.rosterName = profile.rosterName || '';
  gameState.student.registered = result.status === 'registered';
  gameState.student.authenticated = gameState.student.registered;

  document.getElementById('studentClass').value = profile.classId;
  document.getElementById('studentSeat').value = profile.seatNo;
  document.getElementById('studentName').value = profile.name;

  updateCertificate();
  closeModal('studentProfileModal');

  if (gameState.challenge.completed) {
    await uploadScoreToGAS();
    goToUnit('tab-summary');
    return;
  }

  sounds.fanfare();
  goToUnit('tab-challenge');

  if (!gameState.challenge.started) {
    gameState.challenge.started = true;
    gameState.challenge.timer = setInterval(() => {
      gameState.challenge.seconds++;
      document.getElementById('challengeTimerText').innerText = formatTime(gameState.challenge.seconds);
    }, 1000);
  }

  goToStage(1);
}

function returnToHandout() {
  sounds.click();
  goToUnit('tab-handout');
}

function goToStage(stageNum) {
  gameState.challenge.currentStage = stageNum;
  document.getElementById('currentStageTitle').innerText = stageNames[stageNum] || '';

  // 更新步進器
  for (let i = 1; i <= 5; i++) {
    const indicator = document.getElementById(`stepIndicator${i}`);
    const line = document.getElementById(`stepLine${i}`);
    if (indicator) {
      indicator.classList.remove('active', 'completed');
      if (i < stageNum) indicator.classList.add('completed');
      else if (i === stageNum) indicator.classList.add('active');
    }
    if (line) {
      line.classList.remove('passed');
      if (i < stageNum) line.classList.add('passed');
    }
  }

  // 切換關卡畫面
  document.querySelectorAll('.challenge-stage').forEach(s => s.classList.remove('active'));
  const stageMap = {
    1: 'stageBox',
    2: 'stageMaze',
    3: 'stageWheel',
    4: 'stageQuiz',
    5: 'stageDetective'
  };

  const targetElem = document.getElementById(stageMap[stageNum]);
  if (targetElem) {
    targetElem.classList.add('active');
  }

  window.scrollTo({ top: 120, behavior: 'smooth' });

  // 關卡個別初始化喚醒
  if (stageNum === 2) {
    drawMaze();
  } else if (stageNum === 3) {
    drawWheel();
  }
}

// 全部關卡完成
function completeAllChallenges(showModal = true) {
  if (gameState.challenge.completed) return;
  clearInterval(gameState.challenge.timer);
  gameState.challenge.completed = true;
  sounds.fanfare();

  const finalTime = formatTimeChinese(gameState.challenge.seconds);
  document.getElementById('finalTotalScore').innerText = `${gameState.score} 分`;
  document.getElementById('finalTotalTime').innerText = finalTime;

  let evalText = '卓越非凡！完全貫通自西周封建、秦代郡縣至歷代選才演進的歷史全貌！';
  if (gameState.challenge.seconds <= 180) {
    evalText = '⚡ 登峰造極！答題神速且準確無誤，堪稱歷史大博學家！';
  }
  document.getElementById('finalEvaluation').innerText = evalText;

  addPoints(50, 3, '歷史全貫通大宗師');
  if (showModal) document.getElementById('challengeCompleteModal').classList.add('show');

  // Firebase 設定完成後，學生可從證書頁直接儲存成績；未設定時保留表單備援。
}

// ==========================================
// 4. 關卡 1：揭曉方塊 (Open the Box)
// ==========================================
const boxData = [
  {
    id: 1,
    title: '青銅編鐘',
    icon: '🔔',
    desc: '西周貴族在祭祀與宴饗場合使用的成套樂器，規格等級極為嚴格。',
    q: '西周藉由禮樂制度規範青銅器與編鐘的數量，其主要目的是什麼？',
    options: ['彰顯貴族身分與階級等第', '吸引平民百姓前來同樂', '記錄各國氣候與農耕收成', '作為日常買賣交易的貨幣'],
    answer: 0,
    hint: '禮樂的核心在於維持尊卑與秩序！'
  },
  {
    id: 2,
    title: '嫡長子宗法簡',
    icon: '📜',
    desc: '西周王室與諸侯用以維持家族尊卑與權力繼承的血緣法則。',
    q: '西周宗法制度中，王位或爵位最主要的繼承原則是何者？',
    options: ['由全體諸侯投票推舉', '軍功最高者繼承', '嫡長子繼承大宗', '年齡最小的幼子優先'],
    answer: 2,
    hint: '宗法以正妻所生的長子為大宗！'
  },
  {
    id: 3,
    title: '商鞅連坐竹簡',
    icon: '🎋',
    desc: '戰國時期秦國實施變法，推行「伍什編制」與連坐制度。',
    q: '商鞅在秦國推行「編列戶籍」並建立連坐法的根本統治目的為何？',
    options: ['推廣普及儒家仁政思想', '利於國家掌握人口以徵兵、徵稅與調勞役', '獎勵百姓自由經商致富', '保障舊貴族世襲特權'],
    answer: 1,
    hint: '古代戶籍是國家動員人力資源的利器！'
  },
  {
    id: 4,
    title: '軍功爵位印',
    icon: '🎖️',
    desc: '戰國時期打破舊貴族特權，以戰場斬首立功授爵的重要變革。',
    q: '商鞅變法中「獎勵軍功」措施，對秦國社會帶來什麼重大轉變？',
    options: ['平民亦可憑戰功獲封爵位，削弱舊世襲貴族', '禁止平民參與作戰', '只有周王親戚才能當軍官', '全國廢除所有爵位階級'],
    answer: 0,
    hint: '貴族無軍功亦不得繼承爵位！'
  },
  {
    id: 5,
    title: '傳國皇帝璽',
    icon: '👑',
    desc: '西元前221年秦始皇滅六國後所制定的最高統治者稱號信物。',
    q: '秦王嬴政兼併天下後，自認「德兼三皇、功過五帝」，開創了什麼稱號？',
    options: ['大單于', '周天子', '皇帝', '大總統'],
    answer: 2,
    hint: '自此開啟中國兩千多年的帝制時代！'
  },
  {
    id: 6,
    title: '秦半兩方孔錢',
    icon: '🪙',
    desc: '秦統一天下後廢除六國刀幣、布幣，全國通行的圓形方孔標準銅錢。',
    q: '秦始皇統一貨幣、度量衡與文字（小篆），這對帝國產生何種正面影響？',
    options: ['造成各地物價暴漲商人罷市', '便利各地經濟與文化交流，鞏固大一統', '使平民喪失土地', '導致各國文字更加繁雜分歧'],
    answer: 1,
    hint: '統一度量促進各地貨暢其流！'
  },
  {
    id: 7,
    title: '小篆與書同文',
    icon: '🖌️',
    desc: '秦始皇統一天下後廢除六國相異文字，推行全國標準統一的小篆。',
    q: '秦始皇推行「書同文」政策統一文字為小篆，這項措施帶來的主要歷史影響為何？',
    options: ['方便政令推行與各地經濟文化交流', '導致各國文字差異更加懸殊', '廢除所有民間教育學校', '僅供皇帝一人觀賞使用'],
    answer: 0,
    hint: '文字統一消除了各地文化與政令推行的隔閡！'
  },
  {
    id: 8,
    title: '郡守印信',
    icon: '印',
    desc: '秦始皇廢除分封制度後，派往全國各郡管理政務的官員印鑑。',
    q: '關於秦代全面推行的「郡縣制」，下列哪項敘述完全正確？',
    options: ['長官由中央直接任免，不可世襲', '郡守死後職位由長子世襲繼承', '地方郡守擁有獨立封國軍隊', '周天子仍是名義上的共主'],
    answer: 0,
    hint: '郡縣長官是中央派遣的流官，絕非世襲！'
  }
];

let boxesSolvedCount = 0;

function initBoxGame() {
  const grid = document.getElementById('boxGrid');
  grid.innerHTML = '';
  boxesSolvedCount = 0;
  document.getElementById('boxesOpened').innerText = '0';

  boxData.forEach(item => {
    const boxElem = document.createElement('div');
    boxElem.className = 'box-item';
    boxElem.id = `box-${item.id}`;
    boxElem.innerHTML = `
      <div class="box-inner">
        <div class="box-front">
          <div class="box-num">${item.id}</div>
          <div class="box-label">點擊揭開秘寶</div>
        </div>
        <div class="box-back">
          <div class="box-back-icon">${item.icon}</div>
          <div class="box-back-title">${item.title}</div>
          <div class="box-back-status">已解鎖 ✓</div>
        </div>
      </div>
    `;
    boxElem.addEventListener('click', () => openBox(item));
    grid.appendChild(boxElem);
  });
}

function openBox(item) {
  const boxElem = document.getElementById(`box-${item.id}`);
  if (boxElem.classList.contains('solved')) return;
  sounds.flip();

  const modal = document.getElementById('boxModal');
  document.getElementById('modalBoxBadge').innerText = `秘寶方塊 ${item.id}`;
  document.getElementById('modalBoxTitle').innerText = item.title;
  document.getElementById('modalBoxIcon').innerText = item.icon;
  document.getElementById('modalBoxDesc').innerText = item.desc;
  document.getElementById('modalBoxQuestion').innerText = item.q;

  const optionsStack = document.getElementById('modalBoxOptions');
  optionsStack.innerHTML = '';
  const feedback = document.getElementById('modalBoxFeedback');
  feedback.className = 'feedback-msg';
  feedback.innerText = '';

  item.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'modal-option-btn';
    btn.innerText = opt;
    btn.onclick = () => handleBoxAnswer(item, idx, btn, modal, boxElem);
    optionsStack.appendChild(btn);
  });

  modal.classList.add('show');
}

function handleBoxAnswer(item, chosenIdx, btnElem, modalElem, boxElem) {
  const feedback = document.getElementById('modalBoxFeedback');
  if (chosenIdx === item.answer) {
    sounds.correct();
    btnElem.classList.add('correct');
    feedback.className = 'feedback-msg success show';
    feedback.innerText = `🎉 答對了！恭喜獲得 15 積分！${item.hint}`;

    setTimeout(() => {
      modalElem.classList.remove('show');
      boxElem.classList.add('flipped', 'solved');
      boxesSolvedCount++;
      document.getElementById('boxesOpened').innerText = boxesSolvedCount;
      addPoints(15, 1);

      if (boxesSolvedCount === boxData.length) {
        sounds.fanfare();
        addPoints(20, 1, '秘寶破譯神手');
        // 自動跳轉到關卡 2 (時空迷宮)
        setTimeout(() => {
          goToStage(2);
        }, 1200);
      }
    }, 900);
  } else {
    sounds.wrong();
    btnElem.classList.add('wrong');
    feedback.className = 'feedback-msg error show';
    feedback.innerText = `❌ 再想一想喔！提示：${item.hint}`;
  }
}

// ==========================================
// 5. 關卡 2：時空迷宮尋寶 (Maze Runner)
// ==========================================
const mazeMap = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 2, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1], // 2 = 門 1
  [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1, 0, 1], // 3 = 門 2
  [1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 4, 1, 0, 1], // 4 = 門 3
  [1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 5, 1], // 5 = 終點寶藏
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

const mazeGates = {
  2: {
    title: '西周封建守門考官',
    badge: '第一道封印：鎬京城門',
    q: '西周周天子為了「保衛王室、鞏固新征服地」，分封的對象主要是哪兩類人？',
    options: ['外國商人和匈奴首領', '親戚與功臣', '農民與奴隸', '地方富商大賈'],
    answer: 1,
    unlocked: false
  },
  3: {
    title: '春秋戰國賢士守門官',
    badge: '第二道封印：賢士講學大帳',
    q: '春秋戰國時期，民間出現許多平民憑藉個人才能拜相入仕的「布衣卿相」現象，促成平民崛起的主要背景是什麼？',
    options: [
      '貴族沒落流落民間開啟私人講學，且列國競爭求富國強兵',
      '周天子推行科舉考試選拔天下農民',
      '秦始皇下令所有世襲貴族交出爵位給平民',
      '朝廷規定只有平民才能進入太學讀書'
    ],
    answer: 0,
    unlocked: false
  },
  4: {
    title: '大秦咸陽禁衛軍',
    badge: '第三道封印：咸陽宮門',
    q: '秦始皇統一天下後，在地方制度上做了哪項重大革新以實現中央集權？',
    options: ['恢復分封王族為諸侯', '全面推行郡縣制，官員由中央任免', '廢除所有地方行政組織', '將天下平分給六國貴族'],
    answer: 1,
    unlocked: false
  }
};

let playerPos = { x: 1, y: 1 };
let mazeGatesUnlockedCount = 0;

function initMazeGame() {
  playerPos = { x: 1, y: 1 };
  mazeGatesUnlockedCount = 0;
  Object.values(mazeGates).forEach(gate => gate.unlocked = false);
  document.getElementById('mazeGatesUnlocked').innerText = '0';
  MazeAdventure.init();
}
function drawMaze() { if (window.MazeAdventure) MazeAdventure.refresh(); }
function moveMazePlayer(dx, dy) { MazeAdventure.move(dx, dy); }

function triggerMazeGate(gateType) {
  if (!MazeAdventure.canInteract(gateType)) return;
  const gate = mazeGates[gateType];
  const modal = document.getElementById('mazeModal');
  document.getElementById('mazeGateBadge').innerText = gate.badge;
  document.getElementById('mazeGateTitle').innerText = gate.title;
  document.getElementById('mazeQuestion').innerText = gate.q;

  const optionsStack = document.getElementById('mazeOptions');
  optionsStack.innerHTML = '';
  const feedback = document.getElementById('mazeFeedback');
  feedback.className = 'feedback-msg';
  feedback.innerText = '';

  gate.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'modal-option-btn';
    btn.innerText = opt;
    btn.onclick = () => {
      if (gate.unlocked) return;
      if (idx === gate.answer) {
        sounds.correct();
        btn.classList.add('correct');
        feedback.className = 'feedback-msg success show';
        feedback.innerText = '🎉 守門官認可了你的歷史知識！封印解除！獲得 20 分！';
        gate.unlocked = true;
        optionsStack.querySelectorAll("button").forEach(option => option.disabled = true);
        mazeGatesUnlockedCount++;
        document.getElementById('mazeGatesUnlocked').innerText = mazeGatesUnlockedCount;
        addPoints(20, 1);
        MazeAdventure.solved(gateType);

        setTimeout(() => {
          modal.classList.remove('show');
          document.getElementById('mazeScene').focus({ preventScroll: true });
          drawMaze();
        }, 900);
      } else {
        sounds.wrong();
        btn.classList.add('wrong');
        feedback.className = 'feedback-msg error show';
        feedback.innerText = '❌ 答案不正確！仔細想想題目再試一次！';
      }
    };
    optionsStack.appendChild(btn);
  });

  modal.classList.add('show');
}

// ==========================================
// 6. 關卡 3：天命仕途轉盤 (答對扇區消失，用完自動跳關)
// ==========================================
let wheelSectors = [
  { id: 'w1', label: '漢代孝子', color: '#f59e0b', era: '漢代', q: '你身為漢代地方上孝順父母、名聲極佳的士人，地方長官最可能透過哪項制度向朝廷推舉你？', options: ['科舉制度', '察舉制度（孝廉）', '世襲分封', '九品官人之法'], a: 1, desc: '漢代以孝治天下，推舉孝子與廉吏！' },
  { id: 'w2', label: '太學博士', color: '#3b82f6', era: '漢代', q: '漢武帝設立最高學府「太學」，太學教授的考核內容主要是哪一家學派經典？', options: ['法家刑名', '道家黃老', '儒家五經', '墨家兼愛'], a: 2, desc: '董仲舒提倡獨尊儒術，太學傳授儒家五經！' },
  { id: 'w3', label: '魏晉中正官', color: '#8b5cf6', era: '魏晉南北朝', q: '你在曹魏時期擔任評選人才的中正官，按規定你應根據哪三項條件評定九品？', options: ['只有財富與土地', '家世背景、才能與品德', '只有身高與長相', '八股文考試成績'], a: 1, desc: '原本包含家世、才德，但後來卻只看家世！' },
  { id: 'w4', label: '上品世家大族', color: '#ec4899', era: '魏晉南北朝', q: '魏晉世家大族勢力鼎盛，不僅在中央壟斷高級官位，在經濟上還享有何種特權？', options: ['免除賦稅與勞役特權', '必須向國庫繳納十倍稅賦', '禁止購買任何土地', '必須自備糧草參加科舉'], a: 0, desc: '世族享有政治特權與經濟免稅免役特權！' },
  { id: 'w5', label: '東晉瑯琊王氏', color: '#10b981', era: '魏晉南北朝', q: '東晉建立之初流傳著「王與馬，共天下」的民諺，這句話反映了什麼政治現象？', options: ['皇帝權力獨大專制', '皇帝必須與地方世家大族攜手合作統治', '官員由平民考試票選產生', '朝廷全面推行郡縣集權'], a: 1, desc: '司馬皇室極度倚賴瑯琊王氏輔佐！' },
  { id: 'w6', label: '隋代寒門書生', color: '#6366f1', era: '隋唐', q: '你出身寒微但滿腹經綸，隋朝哪一項創新的選才制度讓你得以報名應考、翻身任官？', options: ['世卿世祿', '科舉制度', '九品官人法', '軍功授爵'], a: 1, desc: '隋朝創立科舉，向天下士人開放！' },
  { id: 'w7', label: '唐代金榜狀元', color: '#ef4444', era: '隋唐', q: '唐代科舉考試金榜題名後，士人仕途平步青雲。科舉制度在社會層面帶來了什麼正面影響？', options: ['促進社會階層流動，帶動民間讀書風氣', '導致貴族門第更加穩固不可動搖', '完全廢除儒家思想地位', '限制平民受教育機會'], a: 0, desc: '打破世族壟斷，平民讀書有了向上流動的希望！' },
  { id: 'w8', label: '舊時王謝堂前燕', color: '#eab308', era: '魏晉～隋唐', q: '劉禹錫詩云：「舊時王謝堂前燕，飛入尋常百姓家。」這首詩主要描寫了什麼歷史變遷？', options: ['世家大族門第破敗與走向沒落', '百姓大量飼養燕子發財', '秦始皇修築長城工程宏偉', '周武王分封諸侯盛況'], a: 0, desc: '唐代以後世族權勢不再，門第破散！' }
];

let spinsLeft = 5;
let wheelAngle = 0;
let isSpinning = false;
let currentFateSector = null;

function initWheelGame() {
  spinsLeft = 5;
  document.getElementById('spinsLeft').innerText = '5';
  document.getElementById('wheelFateTitle').innerText = '等待轉盤旋轉...';
  document.getElementById('wheelFateDesc').innerText = '按下中央的「啟動轉盤」，答對之身分扇區將會消失，次數用完後自動跳關！';
  document.getElementById('wheelAnswerBtn').classList.add('hide');
  drawWheel();
}

function drawWheel() {
  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const numSectors = wheelSectors.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (numSectors === 0) {
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 20px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('全部身分考驗皆已破解！', canvas.width / 2, canvas.height / 2);
    return;
  }

  const arc = (Math.PI * 2) / numSectors;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 10;

  for (let i = 0; i < numSectors; i++) {
    const angle = wheelAngle + i * arc;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + arc);
    ctx.fillStyle = wheelSectors[i].color;
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Noto Sans TC", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(wheelSectors[i].label, radius - 20, 5);
    ctx.restore();
  }
}

function spinWheel() {
  if (isSpinning) return;
  if (spinsLeft <= 0 || wheelSectors.length === 0) {
    goToStage(4);
    return;
  }

  isSpinning = true;
  spinsLeft--;
  document.getElementById('spinsLeft').innerText = spinsLeft;
  sounds.click();

  const totalRotations = Math.floor(Math.random() * 4 + 5) * Math.PI * 2;
  const randomExtra = Math.random() * Math.PI * 2;
  const targetAngle = wheelAngle + totalRotations + randomExtra;
  const duration = 3200;
  const startTime = performance.now();
  const startAngle = wheelAngle;
  let lastTickAngle = wheelAngle;

  function animateSpin(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    wheelAngle = startAngle + (targetAngle - startAngle) * ease;

    if (Math.abs(wheelAngle - lastTickAngle) > 0.4) {
      sounds.tick();
      lastTickAngle = wheelAngle;
    }

    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animateSpin);
    } else {
      isSpinning = false;
      determineWheelResult();
    }
  }

  requestAnimationFrame(animateSpin);
}

function determineWheelResult() {
  const numSectors = wheelSectors.length;
  if (numSectors === 0) {
    goToStage(4);
    return;
  }
  const arc = (Math.PI * 2) / numSectors;
  const normalizedAngle = (wheelAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const pointerAngle = (3 * Math.PI / 2 - normalizedAngle + Math.PI * 2) % (Math.PI * 2);
  const sectorIndex = Math.floor(pointerAngle / arc) % numSectors;

  currentFateSector = wheelSectors[sectorIndex];
  sounds.flip();

  document.getElementById('wheelFateTitle').innerText = `【${currentFateSector.label}】(${currentFateSector.era})`;
  document.getElementById('wheelFateDesc').innerText = currentFateSector.desc;
  document.getElementById('wheelAnswerBtn').classList.remove('hide');
}

function openWheelQuestion() {
  if (!currentFateSector) return;
  sounds.click();

  const modal = document.getElementById('wheelModal');
  document.getElementById('wheelModalBadge').innerText = `${currentFateSector.era}選才考驗`;
  document.getElementById('wheelModalTitle').innerText = currentFateSector.label;
  document.getElementById('wheelQuestion').innerText = currentFateSector.q;

  const optionsStack = document.getElementById('wheelOptions');
  optionsStack.innerHTML = '';
  const feedback = document.getElementById('wheelFeedback');
  feedback.className = 'feedback-msg';
  feedback.innerText = '';

  currentFateSector.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'modal-option-btn';
    btn.innerText = opt;
    btn.onclick = () => {
      if (idx === currentFateSector.a) {
        sounds.correct();
        btn.classList.add('correct');
        feedback.className = 'feedback-msg success show';
        feedback.innerText = `🎉 恭喜回答正確！獲得 20 分！該身分考驗已解鎖，扇區將從轉盤中移除！`;
        addPoints(20, 1);

        // 從轉盤中移除此題目，避免被重複轉到
        const targetId = currentFateSector.id;
        wheelSectors = wheelSectors.filter(s => s.id !== targetId);

        setTimeout(() => {
          modal.classList.remove('show');
          document.getElementById('wheelAnswerBtn').classList.add('hide');
          drawWheel();

          // 若轉盤次數用完，或所有題目皆答對，自動跳到下一關 (關卡 4：殿試問答)
          if (spinsLeft <= 0 || wheelSectors.length === 0) {
            sounds.fanfare();
            addPoints(20, 1, '天命轉盤大贏家');
            setTimeout(() => {
              goToStage(4);
            }, 1000);
          }
        }, 1100);
      } else {
        sounds.wrong();
        btn.classList.add('wrong');
        feedback.className = 'feedback-msg error show';
        feedback.innerText = '❌ 答案不正確！仔細看講義內容再試一次！';
      }
    };
    optionsStack.appendChild(btn);
  });

  modal.classList.add('show');
}

// ==========================================
// 7. 關卡 4：殿試問答 (全數答完後自動跳下一關)
// ==========================================
const quizQuestions = [
  {
    era: '漢代・未央宮',
    q: '漢武帝時期，地方長官定期向中央推舉「孝子」與「廉吏」，此選拔人才的制度稱為什麼？',
    options: ['科舉制度', '察舉制度', '九品官人之法', '世卿世祿制'],
    answer: 1,
    hint: '由下而上保薦人才，以「孝廉」最為著名！'
  },
  {
    era: '漢代・太學辟雍殿',
    q: '漢武帝設立太學、拔擢通曉儒家五經者任官，此措施在往後社會逐漸形成了何種特殊家族群體？',
    options: ['軍功地主家族', '經學傳家、累世當官的世家大族', '經營海外貿易的大富商', '蒙古草原游牧貴族'],
    answer: 1,
    hint: '士人將經書見解代代相傳給自家子弟！'
  },
  {
    era: '曹魏・洛陽殿堂',
    q: '東漢末年戰亂戶籍殘破，曹魏時期開始推行「九品官人之法」，派往各郡評定人才的官員稱為什麼？',
    options: ['御史大夫', '五經博士', '中正官', '刺史'],
    answer: 2,
    hint: '負責到各地按照九個等第評核士人！'
  },
  {
    era: '南北朝・高門士族府邸',
    q: '魏晉南北朝實施九品官人之法，後期實際評選時多只看重家世門第，造成了何種社會現象？',
    options: ['「萬般皆下品，唯有讀書高」', '「上品無寒門，下品無世族」', '「朝為田舍郎，暮登天子堂」', '「布衣卿相輩出」'],
    answer: 1,
    hint: '高官皆被大世族壟斷，貧寒人才無法晉升！'
  },
  {
    era: '隋唐・長安大雁塔',
    q: '隋朝為了維繫政權並「削弱世家大族的勢力」，廢除九品官人之法，改採哪一項選才制度？',
    options: ['察舉制度', '科舉制度', '軍功授爵制度', '貴族世襲制度'],
    answer: 1,
    hint: '由士人自主報名公開考試，憑成績任官！'
  },
  {
    era: '隋唐～清末・貢院考場',
    q: '科舉制度自隋朝創立後一直沿用到清末，其對中國社會結構帶來的最大正面改變為何？',
    options: ['促使士人全心投入經商發財', '提升平民任官機會，促進社會階層流動', '保障大地主擁有免稅特權', '讓官員職位再度世襲化'],
    answer: 1,
    hint: '讓寒門平民有了透過讀書翻身任官的希望！'
  }
];

let quizCurrentIdx = 0;
let quizComboCount = 0;

function initQuizGame() {
  quizCurrentIdx = 0;
  quizComboCount = 0;
  document.getElementById('quizCombo').innerText = '0';
  document.getElementById('lifeline5050').disabled = false;
  document.getElementById('lifelineHint').disabled = false;
  loadQuizQuestion(0);
}

function loadQuizQuestion(idx) {
  if (idx >= quizQuestions.length) {
    sounds.fanfare();
    addPoints(25, 2, '殿試登科文魁');
    // 自動跳轉到關卡 5 (歷史除錯官)
    setTimeout(() => {
      goToStage(5);
    }, 1200);
    return;
  }

  quizCurrentIdx = idx;
  const qData = quizQuestions[idx];
  document.getElementById('quizIndex').innerText = idx + 1;
  document.getElementById('quizEraTag').innerText = qData.era;
  document.getElementById('quizTitle').innerText = qData.q;
  document.getElementById('quizHintText').classList.add('hide');

  const fb = document.getElementById('quizFeedbackBox');
  fb.className = 'feedback-msg';
  fb.innerText = '';

  const grid = document.getElementById('quizOptionsGrid');
  grid.innerHTML = '';

  qData.options.forEach((opt, optIdx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.id = `quiz-opt-${optIdx}`;
    btn.innerHTML = `<span class="opt-label">${String.fromCharCode(65 + optIdx)}.</span> ${opt}`;
    btn.onclick = () => handleQuizAnswer(optIdx, qData);
    grid.appendChild(btn);
  });
}

function handleQuizAnswer(selectedIdx, qData) {
  const allBtns = document.querySelectorAll('.quiz-option-btn');
  allBtns.forEach(b => b.disabled = true);
  const fb = document.getElementById('quizFeedbackBox');

  if (selectedIdx === qData.answer) {
    sounds.correct();
    allBtns[selectedIdx].classList.add('correct');
    quizComboCount++;
    document.getElementById('quizCombo').innerText = quizComboCount;

    const basePts = 15;
    const bonus = quizComboCount > 1 ? (quizComboCount - 1) * 5 : 0;
    const totalGained = basePts + bonus;
    addPoints(totalGained, 1);

    fb.className = 'feedback-msg success show';
    fb.innerText = `🎉 答對了！+${totalGained} 分！${qData.hint}`;

    setTimeout(() => {
      loadQuizQuestion(quizCurrentIdx + 1);
    }, 1000);
  } else {
    sounds.wrong();
    allBtns[selectedIdx].classList.add('wrong');
    allBtns[qData.answer].classList.add('correct');
    quizComboCount = 0;
    document.getElementById('quizCombo').innerText = '0';

    fb.className = 'feedback-msg error show';
    fb.innerText = `❌ 答錯了！正確答案是：${String.fromCharCode(65 + qData.answer)}。提示：${qData.hint}`;

    setTimeout(() => {
      loadQuizQuestion(quizCurrentIdx + 1);
    }, 1400);
  }
}

function useLifeline5050() {
  sounds.click();
  const qData = quizQuestions[quizCurrentIdx];
  const wrongIndices = [0, 1, 2, 3].filter(i => i !== qData.answer);
  const shuffled = wrongIndices.sort(() => 0.5 - Math.random());
  document.getElementById(`quiz-opt-${shuffled[0]}`).style.visibility = 'hidden';
  document.getElementById(`quiz-opt-${shuffled[1]}`).style.visibility = 'hidden';
  document.getElementById('lifeline5050').disabled = true;
}

function useLifelineHint() {
  sounds.click();
  const qData = quizQuestions[quizCurrentIdx];
  const hintBox = document.getElementById('quizHintText');
  hintBox.innerText = `💡 夫子解經提示：${qData.hint}`;
  hintBox.classList.remove('hide');
  document.getElementById('lifelineHint').disabled = true;
}

// ==========================================
// 8. 關卡 5：歷史除錯官 (全數揪出後結算全作業)
// ==========================================
function initDetectiveGame() { DetectiveGame.init(); }

// ==========================================
// 9. 榮譽證書與成果結算
// ==========================================
function updateCertificate() {
  const nameInput = document.getElementById('studentName').value || '歷史探險家';
  const classInput = document.getElementById('studentClass').value || '201';
  const seatInput = document.getElementById('studentSeat').value || '1';

  document.getElementById('certName').innerText = nameInput;
  document.getElementById('certClass').innerText = classInput;
  document.getElementById('certSeat').innerText = seatInput;
  document.getElementById('certTotalScore').innerText = gameState.score;
  document.getElementById('certTotalStars').innerText = gameState.stars;

  const totalTimeStr = formatTimeChinese(gameState.challenge.seconds);
  document.getElementById('certTotalTime').innerText = totalTimeStr;

  const badgeRow = document.getElementById('certBadgesRow');
  badgeRow.innerHTML = '';
  if (gameState.badges.size === 0) {
    badgeRow.innerHTML = '<span class="badge-item">🌱 歷史初試身手</span>';
  } else {
    gameState.badges.forEach(b => {
      const span = document.createElement('span');
      span.className = 'badge-item';
      span.innerText = `🏅 ${b}`;
      badgeRow.appendChild(span);
    });
  }

  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  document.getElementById('certDate').innerText = dateStr;
}

function shareScore() {
  sounds.click();
  const name = document.getElementById('studentName').value || '歷史探險家';
  const className = document.getElementById('studentClass').value || '201';
  const seat = document.getElementById('studentSeat').value || '1';
  const totalTimeStr = formatTimeChinese(gameState.challenge.seconds);

  const report = `【國中歷史二上 第1課 作業成果回傳】
班級：${className}
座號：${seat}
姓名：${name}
作業總積分：${gameState.score} 分
獲得星星：${gameState.stars} 顆
全作業挑戰總耗時：${totalTimeStr}
解鎖勳章：${Array.from(gameState.badges).join('、') || '完成全課複習'}
已精通西周封建、秦代郡縣與歷代選才演進制度！`;

  navigator.clipboard.writeText(report).then(() => {
    alert('📋 成績與時間報告已複製到剪貼簿！可直接貼在 LINE、Google Classroom 傳給歷史老師！');
  }).catch(() => {
    alert(report);
  });
}

// ==========================================
// 10. 頁面載入初始化
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  setupTabNavigation();

  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    sounds.enabled = !sounds.enabled;
    document.getElementById('soundIcon').innerText = sounds.enabled ? '🔊' : '🔇';
  });

  ['studentName', 'studentClass', 'studentSeat'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCertificate);
  });

  initBoxGame();
  initMazeGame();
  initWheelGame();
  initQuizGame();
  initDetectiveGame();
  updateCertificate();
});
