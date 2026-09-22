/* 登入彈窗與證書頁視覺檢查截圖 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright'));

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'login-shots');
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const stubCode = `(() => {
  window.FirebaseService = {
    isConfigured: () => true,
    loginStudent: async (email, alias = '') => String(email).trim().toLowerCase() === 'student@st.tc.edu.tw'
      ? { status: 'registered', profile: { classId: '201', seatNo: '7', name: alias || '王小明', email: 'student@st.tc.edu.tw', rosterName: '王小明', registered: true } }
      : { status: 'guest', message: '此帳號不在學習帳號名冊中' },
    submitScore: async () => ({ status: 'success', submissionId: 'stub' })
  };
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });

  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(PAGE_URL);
    await page.waitForTimeout(400);
    await page.evaluate(stubCode);
    await page.click('.handout-footer-cta .super-big-btn');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `login-${vp.name}.png`) });

    await page.fill('#regEmail', 'student@st.tc.edu.tw');
    await page.click('#studentRegistrationModal .secondary-btn:has-text("確定")');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `profile-${vp.name}.png`) });

    await page.click('#studentProfileModal .primary-btn:has-text("確認並開始闖關")');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      gameState.challenge.completed = true;
      gameState.score = 145;
      gameState.stars = 6;
      gameState.badges.add('民族互動大探索家');
      unlockCertificateTab();
      goToUnit('tab-summary');
    });
    await page.waitForTimeout(400);
    await page.locator('#tab-summary').screenshot({ path: path.join(OUT, `summary-${vp.name}.png`) });
    await page.close();
  }

  const guest = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await guest.goto(PAGE_URL);
  await guest.waitForTimeout(400);
  await guest.evaluate(stubCode);
  await guest.click('.handout-footer-cta .super-big-btn');
  await guest.fill('#regEmail', 'nobody@example.com');
  await guest.click('#studentRegistrationModal .secondary-btn:has-text("確定")');
  await guest.waitForTimeout(250);
  await guest.screenshot({ path: path.join(OUT, 'guest-desktop.png') });
  await guest.close();

  await browser.close();
  console.log('screenshots saved to', OUT);
})().catch(e => { console.error(e); process.exit(1); });
