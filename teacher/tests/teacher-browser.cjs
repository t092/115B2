const {chromium} = require('../../G2B3/tests/playwright.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());

    await page.goto(pathToFileURL(path.resolve(__dirname, '../../index.html')).href, {waitUntil: 'domcontentloaded'});
    const entry = page.getByRole('link', {name: /教師管理/});
    assert.equal(await entry.getAttribute('href'), 'teacher/index.html');
    assert.equal(await entry.evaluate(element => getComputedStyle(element).position), 'fixed');

    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, {waitUntil: 'domcontentloaded'});
    await page.evaluate(() => {
      const students = [{id: 'student@example.test', email: 'student@example.test', class: '701', seat: '1', name: '林同學', previousEmails: []}];
      const scores = [
        {email: 'student@example.test', class: '701', seat: '1', name: '林同學', unitName: 'G2B3', totalScore: 62},
        {email: 'student@example.test', class: '701', seat: '1', name: '林同學', unitName: 'G2B3', totalScore: 91},
        {email: 'student@example.test', class: '701', seat: '1', name: '林同學', unitName: 'FutureCourse', totalScore: 78},
        {email: 'removed@example.test', class: '701', seat: '2', name: '已離冊學生', unitName: 'G2B3', totalScore: 75}
      ];
      window.FirebaseService = {
        isConfigured: () => false,
        getTeacherSession: async () => ({status: 'unauthorized'}),
        loginTeacher: async email => ({status: 'success', teacher: {uid: 'teacher-1', email}}),
        logoutTeacher: async () => {},
        listStudents: async () => ({status: 'success', students: structuredClone(students)}),
        addStudent: async data => {
          if (students.some(student => student.email === data.email)) return {status: 'error', message: 'Email 已存在'};
          students.push({...data, id: data.email, previousEmails: []});
          return {status: 'success'};
        },
        updateStudent: async (oldEmail, data) => {
          const index = students.findIndex(student => student.id === oldEmail);
          if (index < 0) return {status: 'error', message: '找不到學生'};
          const previousEmails = [...students[index].previousEmails];
          if (oldEmail !== data.email) previousEmails.push(oldEmail);
          students[index] = {...data, id: data.email, previousEmails};
          return {status: 'success'};
        },
        deleteStudent: async email => {
          const index = students.findIndex(student => student.id === email);
          if (index >= 0) students.splice(index, 1);
          return {status: 'success'};
        },
        listScores: async () => ({status: 'success', scores: structuredClone(scores)})
      };
    });

    await page.locator('#teacherEmail').fill('teacher@example.test');
    await page.locator('#teacherPassword').fill('not-a-real-password');
    await page.getByRole('button', {name: /登入管理室/}).click();
    await page.getByRole('heading', {name: '學生名冊'}).waitFor();
    assert.equal(await page.locator('#studentCount').innerText(), '1');

    await page.getByRole('button', {name: /新增學生/}).click();
    await page.locator('#studentEmail').fill('new@example.test');
    await page.locator('#studentClass').fill('701');
    await page.locator('#studentSeat').fill('3');
    await page.locator('#studentName').fill('新增同學');
    await page.getByRole('button', {name: '新增至名冊'}).click();
    await page.getByText('新增同學').waitFor();
    assert.equal(await page.locator('#studentCount').innerText(), '2');

    const originalRow = page.locator('#rosterBody tr').filter({hasText: '林同學'});
    await originalRow.getByRole('button', {name: '編輯'}).click();
    await page.locator('#studentEmail').fill('lin-new@example.test');
    await page.locator('#studentName').fill('林新同學');
    await page.getByRole('button', {name: '儲存變更'}).click();
    await page.getByText('林新同學').waitFor();

    const addedRow = page.locator('#rosterBody tr').filter({hasText: '新增同學'});
    page.once('dialog', dialog => dialog.accept());
    await addedRow.getByRole('button', {name: '刪除'}).click();
    await page.getByText('學生已從名冊移除；歷史成績保留').waitFor();
    assert.equal(await page.locator('#studentCount').innerText(), '1');

    await page.getByRole('button', {name: '成績總表'}).click();
    await page.locator('#scoresHead').getByText('FutureCourse總成績').waitFor();
    const firstScoreRow = page.locator('#scoresBody tr').filter({hasText: '林新同學'});
    assert.match(await firstScoreRow.innerText(), /91/);
    assert.match(await page.locator('#scoresBody').innerText(), /已離冊學生/);

    await page.locator('#exportClassSelect').selectOption('701');
    await page.locator('#clearCourses').click();
    await page.locator('#exportCourseOptions input[value="G2B3"]').check();
    await page.locator('#exportCourseOptions input[value="FutureCourse"]').check();
    await page.evaluate(() => {
      window.__csvDownload = {};
      URL.createObjectURL = blob => {
        window.__csvDownload.blob = blob;
        return 'blob:teacher-export-test';
      };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function captureDownload() {
        window.__csvDownload.filename = this.download;
      };
    });
    await page.getByRole('button', {name: /下載 CSV/}).click();
    const download = await page.evaluate(async () => ({
      filename: window.__csvDownload.filename,
      bytes: Array.from(new Uint8Array(await window.__csvDownload.blob.arrayBuffer())),
      text: await window.__csvDownload.blob.text()
    }));
    assert.match(download.filename, /^701班_成績總表_\d{8}\.csv$/);
    assert.deepEqual(download.bytes.slice(0, 3), [239, 187, 191]);
    assert.match(download.text, /^"班級","座號","姓名","課程1總成績","FutureCourse總成績"/);
    assert.doesNotMatch(download.text, /課程2總成績/);
    assert.match(download.text, /"701","1","林新同學","91","78"/);
    assert.match(download.text, /"701","2","已離冊學生","75","—"/);

    await page.setViewportSize({width: 390, height: 844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'teacher dashboard should not overflow the mobile viewport');
    assert.deepEqual(errors, []);
    console.log('PASS teacher UI: roster management, highest score, dynamic units and class/course CSV export');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
