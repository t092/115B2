/* G2B3L21 登入與成績儲存流程驗證（以 stub 取代 FirebaseService，離線可跑） */
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright'));

const ROOT = path.resolve(__dirname, '..');
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const stubCode = (mode) => `(() => {
  window.__calls = [];
  const mode = ${JSON.stringify(mode)};
  window.FirebaseService = {
    isConfigured: () => true,
    loginStudent: async (email, alias = '') => {
      if (mode === 'guest') return { status: 'guest', message: '此帳號不在學習帳號名冊中' };
      const key = String(email).trim().toLowerCase();
      if (key !== 'student@st.tc.edu.tw') return { status: 'guest', message: '此帳號不在學習帳號名冊中' };
      return {
        status: 'registered',
        profile: {
          classId: '201', seatNo: '7', name: alias || '王小明',
          email: 'student@st.tc.edu.tw', rosterName: '王小明',
          registered: true, identityStatus: 'roster_matched'
        }
      };
    },
    submitScore: async data => {
      window.__calls.push(data);
      if (data.isGuest) return { status: 'guest', message: '免登入體驗模式不記錄正式成績' };
      return { status: 'success', submissionId: 'stub_submission' };
    }
  };
})()`;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const results = {};
  const errors = [];

  // ===== A. 名冊學生流程 =====
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => errors.push(`student: ${e}`));
  await page.goto(PAGE_URL);
  await page.waitForTimeout(400);
  await page.evaluate(stubCode('registered'));

  await page.click('.handout-footer-cta .super-big-btn');
  await page.waitForTimeout(200);
  results.A1_loginModalShown = await page.isVisible('#studentRegistrationModal.show');

  await page.fill('#regEmail', 'student@st.tc.edu.tw');
  await page.click('#studentRegistrationModal .secondary-btn:has-text("確定")');
  await page.waitForTimeout(250);
  results.A2_profileModalShown = await page.isVisible('#studentProfileModal.show');
  results.A3_roster = {
    class: await page.inputValue('#regClass'),
    seat: await page.inputValue('#regSeat'),
    name: await page.inputValue('#regName')
  };
  results.A4_classReadonly = (await page.getAttribute('#regClass', 'readonly')) !== null;

  await page.fill('#regName', '小明');
  await page.click('#studentProfileModal .primary-btn:has-text("確認並開始闖關")');
  await page.waitForTimeout(500);
  results.A5_challengeActive = await page.isVisible('#tab-challenge.active');
  results.A6_header = {
    class: await page.inputValue('#studentClass'),
    seat: await page.inputValue('#studentSeat'),
    name: await page.inputValue('#studentName')
  };
  results.A7_state = await page.evaluate(() => ({
    registered: gameState.student.registered,
    email: gameState.student.email,
    rosterName: gameState.student.rosterName,
    timerStarted: gameState.challenge.started
  }));

  // 模擬完成後儲存成績
  await page.evaluate(() => {
    gameState.challenge.completed = true;
    gameState.score = 123;
    gameState.stars = 5;
    gameState.badges.add('測試徽章');
    unlockCertificateTab();
    goToUnit('tab-summary');
  });
  await page.waitForTimeout(250);
  await page.click('.summary-actions button:has-text("儲存成績至 Firebase")');
  await page.waitForTimeout(350);
  results.A8_uploadCalls = await page.evaluate(() => window.__calls.length);
  results.A9_payload = await page.evaluate(() => {
    const c = window.__calls[0];
    return c && {
      unitId: c.unitId, score: c.score, stars: c.stars, completed: c.completed, isGuest: c.isGuest,
      profile: c.profile, durationType: typeof c.durationSeconds, badges: c.badges
    };
  });
  results.A10_certSync = {
    className: await page.getAttribute('#certCloudSyncPill', 'class'),
    text: await page.textContent('#certCloudSyncText')
  };
  await page.close();

  // ===== B. 訪客流程 =====
  const guest = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  guest.on('pageerror', e => errors.push(`guest: ${e}`));
  await guest.goto(PAGE_URL);
  await guest.waitForTimeout(400);
  await guest.evaluate(stubCode('guest'));

  await guest.click('.handout-footer-cta .super-big-btn');
  await guest.fill('#regEmail', 'nobody@example.com');
  await guest.click('#studentRegistrationModal .secondary-btn:has-text("確定")');
  await guest.waitForTimeout(250);
  results.B1_guestModalShown = await guest.isVisible('#studentGuestModal.show');

  await guest.click('#studentGuestModal .primary-btn:has-text("以訪客模式體驗")');
  await guest.waitForTimeout(500);
  results.B2_header = await guest.evaluate(() => [
    document.getElementById('studentClass').value,
    document.getElementById('studentSeat').value,
    document.getElementById('studentName').value
  ]);
  results.B3_state = await guest.evaluate(() => ({
    registered: gameState.student.registered,
    email: gameState.student.email,
    challengeActive: document.getElementById('tab-challenge').classList.contains('active')
  }));

  await guest.evaluate(() => {
    gameState.challenge.completed = true;
    gameState.score = 88;
    unlockCertificateTab();
    goToUnit('tab-summary');
  });
  await guest.waitForTimeout(250);
  await guest.click('.summary-actions button:has-text("儲存成績至 Firebase")');
  await guest.waitForTimeout(350);
  results.B4_submitCalls = await guest.evaluate(() => window.__calls.length);
  results.B5_sync = {
    className: await guest.getAttribute('#certCloudSyncPill', 'class'),
    text: await guest.textContent('#certCloudSyncText')
  };
  await guest.close();

  results.pageErrors = errors;
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
