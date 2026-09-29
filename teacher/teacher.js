(() => {
  'use strict';

  const UNIT_CATALOG = [
    { id: 'G2B3', label: '課程1總成績' },
    { id: 'G2B3L21', label: '課程2總成績' },
    { id: 'DynaSoKOBAN', label: '朝代SOKOBAN總成績' },
    { id: 'silklemmings', label: '絲路小商人總成績' }
  ];
  const UNIT_LABELS = new Map(UNIT_CATALOG.map(unit => [unit.id, unit.label]));
  const state = {
    teacher: null,
    students: [],
    scores: null,
    editingEmail: '',
    toastTimer: 0
  };
  const $ = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function compareText(left, right) {
    return String(left || '').localeCompare(String(right || ''), 'zh-Hant', { numeric: true });
  }

  function notify(message, isError = false) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.toggle('is-error', isError);
    toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  function showDashboard(teacher) {
    state.teacher = teacher;
    $('loginPanel').hidden = true;
    $('dashboard').hidden = false;
    $('teacherAccountEmail').textContent = teacher.email || '教師帳號';
    loadStudents();
  }

  function showLogin() {
    state.teacher = null;
    $('dashboard').hidden = true;
    $('loginPanel').hidden = false;
    $('teacherPassword').value = '';
    $('teacherEmail').focus();
  }

  function setLoadingButton(button, isLoading, loadingText) {
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = loadingText;
      button.disabled = true;
    } else {
      button.innerHTML = button.dataset.originalText || button.innerHTML;
      button.disabled = false;
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const button = $('loginSubmit');
    const message = $('loginMessage');
    message.textContent = '';
    setLoadingButton(button, true, '驗證帳號中…');
    const result = await window.FirebaseService.loginTeacher(
      $('teacherEmail').value,
      $('teacherPassword').value
    );
    setLoadingButton(button, false);
    if (result.status !== 'success') {
      message.textContent = result.message || '登入失敗，請確認教師帳號設定。';
      return;
    }
    $('teacherPassword').value = '';
    showDashboard(result.teacher);
    notify('教師登入成功');
  }

  async function restoreTeacherSession() {
    if (!window.FirebaseService || !FirebaseService.isConfigured()) return;
    const result = await FirebaseService.getTeacherSession();
    if (result.status === 'success') showDashboard(result.teacher);
  }

  async function handleLogout() {
    $('logoutButton').disabled = true;
    try {
      await window.FirebaseService.logoutTeacher();
      state.students = [];
      state.scores = null;
      showLogin();
      notify('已安全登出');
    } catch (error) {
      notify(error.message || '登出失敗，請重試', true);
    } finally {
      $('logoutButton').disabled = false;
    }
  }

  function renderClassOptions() {
    const classes = new Set();
    state.students.forEach(student => {
      if (student.class) classes.add(String(student.class));
    });
    (state.scores || []).forEach(score => {
      if (score.class) classes.add(String(score.class));
    });
    const sorted = Array.from(classes).sort(compareText);
    for (const select of [$('rosterClassFilter'), $('scoresClassFilter')]) {
      const selected = select.value;
      select.innerHTML = '<option value="">全部班級</option>' + sorted.map(classId =>
        `<option value="${escapeHtml(classId)}">${escapeHtml(classId)} 班</option>`
      ).join('');
      if (sorted.includes(selected)) select.value = selected;
    }
    $('studentCount').textContent = state.students.length.toLocaleString('zh-TW');
    $('classCount').textContent = sorted.length.toLocaleString('zh-TW');
  }

  async function loadStudents() {
    $('rosterBody').innerHTML = '<tr><td colspan="5" class="empty-cell">正在讀取 Firebase 名冊…</td></tr>';
    const result = await window.FirebaseService.listStudents();
    if (result.status !== 'success') {
      $('rosterBody').innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(result.message)}</td></tr>`;
      notify(result.message || '名冊讀取失敗', true);
      return;
    }
    state.students = result.students;
    renderClassOptions();
    renderRoster();
    if (state.scores) renderScores();
  }

  function filteredStudents() {
    const classId = $('rosterClassFilter').value;
    const query = $('rosterSearch').value.trim().toLocaleLowerCase();
    return state.students.filter(student => {
      if (classId && String(student.class) !== classId) return false;
      if (!query) return true;
      return [student.name, student.seat, student.email, student.class]
        .some(value => String(value || '').toLocaleLowerCase().includes(query));
    });
  }

  function renderRoster() {
    const students = filteredStudents();
    $('rosterResultCount').textContent = `顯示 ${students.length.toLocaleString('zh-TW')} / ${state.students.length.toLocaleString('zh-TW')} 位學生`;
    if (!students.length) {
      $('rosterBody').innerHTML = '<tr><td colspan="5" class="empty-cell">沒有符合條件的學生資料</td></tr>';
      return;
    }
    $('rosterBody').innerHTML = students.map(student => `
      <tr>
        <td>${escapeHtml(student.class)}</td>
        <td>${escapeHtml(student.seat)}</td>
        <td>${escapeHtml(student.name)}</td>
        <td>${escapeHtml(student.email || student.id)}</td>
        <td><div class="row-actions">
          <button class="row-action" type="button" data-action="edit" data-email="${escapeHtml(student.id)}">編輯</button>
          <button class="row-action row-action--delete" type="button" data-action="delete" data-email="${escapeHtml(student.id)}">刪除</button>
        </div></td>
      </tr>`).join('');
  }

  function openStudentDialog(student = null) {
    state.editingEmail = student ? normalizeEmail(student.id || student.email) : '';
    $('studentDialogTitle').textContent = student ? '編輯學生' : '新增學生';
    $('saveStudentButton').textContent = student ? '儲存變更' : '新增至名冊';
    $('studentFormMessage').textContent = '';
    $('studentEmail').value = student ? (student.email || student.id) : '';
    $('studentClass').value = student ? student.class || '' : '';
    $('studentSeat').value = student ? student.seat || '' : '';
    $('studentName').value = student ? student.name || '' : '';
    $('studentEmail').readOnly = false;
    $('studentDialog').showModal();
    $('studentEmail').focus();
  }

  function closeStudentDialog() {
    $('studentDialog').close();
    $('studentForm').reset();
    state.editingEmail = '';
  }

  async function saveStudent(event) {
    event.preventDefault();
    const formMessage = $('studentFormMessage');
    formMessage.textContent = '';
    const data = {
      email: normalizeEmail($('studentEmail').value),
      class: $('studentClass').value.trim(),
      seat: $('studentSeat').value.trim(),
      name: $('studentName').value.trim()
    };
    const duplicateSeat = state.students.some(student =>
      normalizeEmail(student.id || student.email) !== state.editingEmail &&
      String(student.class || '').trim() === data.class &&
      String(student.seat || '').trim() === data.seat
    );
    if (duplicateSeat) {
      formMessage.textContent = '同班已有相同座號，請確認名冊資料。';
      return;
    }

    const button = $('saveStudentButton');
    setLoadingButton(button, true, '儲存中…');
    const result = state.editingEmail
      ? await window.FirebaseService.updateStudent(state.editingEmail, data)
      : await window.FirebaseService.addStudent(data);
    setLoadingButton(button, false);
    if (result.status !== 'success') {
      formMessage.textContent = result.message || '儲存失敗，請重試。';
      return;
    }
    const wasEditing = Boolean(state.editingEmail);
    closeStudentDialog();
    await loadStudents();
    notify(wasEditing ? '學生資料已更新' : '學生已加入名冊');
  }

  async function handleRosterAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const student = state.students.find(item => normalizeEmail(item.id || item.email) === normalizeEmail(button.dataset.email));
    if (!student) return;
    if (button.dataset.action === 'edit') {
      openStudentDialog(student);
      return;
    }
    if (!window.confirm(`確定要從名冊刪除「${student.name}」（${student.class} 班 ${student.seat} 號）嗎？\n歷史成績會保留。`)) return;
    button.disabled = true;
    const result = await window.FirebaseService.deleteStudent(student.id || student.email);
    if (result.status !== 'success') {
      notify(result.message || '刪除失敗', true);
      button.disabled = false;
      return;
    }
    await loadStudents();
    notify('學生已從名冊移除；歷史成績保留');
  }

  function buildScoreRows() {
    const rows = new Map();
    const emailLookup = new Map();
    for (const student of state.students) {
      const email = normalizeEmail(student.id || student.email);
      const row = {
        key: `student:${email}`,
        email,
        class: String(student.class || ''),
        seat: String(student.seat || ''),
        name: String(student.name || ''),
        orphan: false,
        totals: new Map()
      };
      rows.set(row.key, row);
      emailLookup.set(email, row);
      (Array.isArray(student.previousEmails) ? student.previousEmails : []).forEach(previousEmail => {
        emailLookup.set(normalizeEmail(previousEmail), row);
      });
    }

    for (const score of state.scores || []) {
      const scoreEmail = normalizeEmail(score.email);
      let row = emailLookup.get(scoreEmail);
      if (!row) {
        const fallback = scoreEmail || `${score.class || ''}:${score.seat || ''}:${score.name || ''}`;
        const key = `history:${fallback}`;
        row = rows.get(key);
        if (!row) {
          row = {
            key,
            email: scoreEmail,
            class: String(score.class || ''),
            seat: String(score.seat || ''),
            name: String(score.name || '名冊外學生'),
            orphan: true,
            totals: new Map()
          };
          rows.set(key, row);
          if (scoreEmail) emailLookup.set(scoreEmail, row);
        }
      }
      const unit = String(score.unitName || '').trim();
      const total = Number(score.totalScore ?? score.score);
      if (!unit || !Number.isFinite(total)) continue;
      const current = row.totals.get(unit);
      if (current === undefined || total > current) row.totals.set(unit, total);
    }

    return Array.from(rows.values());
  }

  function renderScores() {
    if (!Array.isArray(state.scores)) return;
    const discoveredUnits = new Set((state.scores || []).map(score => String(score.unitName || '').trim()).filter(Boolean));
    const units = [
      ...UNIT_CATALOG,
      ...Array.from(discoveredUnits)
        .filter(unit => !UNIT_LABELS.has(unit))
        .sort(compareText)
        .map(id => ({ id, label: `${id}總成績` }))
    ];
    $('scoresHead').innerHTML = `<tr><th>班級</th><th>座號</th><th>姓名</th>${units.map(unit => `<th title="${escapeHtml(unit.id)}">${escapeHtml(unit.label)}</th>`).join('')}</tr>`;

    const classId = $('scoresClassFilter').value;
    const query = $('scoresSearch').value.trim().toLocaleLowerCase();
    const rows = buildScoreRows().filter(row => {
      if (classId && row.class !== classId) return false;
      if (!query) return true;
      return [row.class, row.seat, row.name, row.email]
        .some(value => String(value || '').toLocaleLowerCase().includes(query));
    }).sort((a, b) => compareText(a.class, b.class) || compareText(a.seat, b.seat) || compareText(a.name, b.name));

    $('scoresResultCount').textContent = `${rows.length.toLocaleString('zh-TW')} 位學生`;
    $('scoreCount').textContent = (state.scores || []).length.toLocaleString('zh-TW');
    if (!rows.length) {
      $('scoresBody').innerHTML = `<tr><td colspan="${units.length + 3}" class="empty-cell">沒有符合條件的成績資料</td></tr>`;
      return;
    }
    $('scoresBody').innerHTML = rows.map(row => `<tr class="${row.orphan ? 'is-orphan' : ''}">
      <td>${escapeHtml(row.class || '—')}</td>
      <td>${escapeHtml(row.seat || '—')}</td>
      <td>${escapeHtml(row.name || '—')}</td>
      ${units.map(unit => {
        const score = row.totals.get(unit.id);
        return score === undefined
          ? '<td class="no-score">—</td>'
          : `<td class="score-value">${escapeHtml(Number(score).toLocaleString('zh-TW'))}</td>`;
      }).join('')}
    </tr>`).join('');
  }

  async function loadScores(force = false) {
    if (Array.isArray(state.scores) && !force) {
      renderScores();
      return;
    }
    $('scoresBody').innerHTML = '<tr><td class="empty-cell">正在讀取成績紀錄…</td></tr>';
    $('refreshScoresButton').disabled = true;
    const result = await window.FirebaseService.listScores();
    $('refreshScoresButton').disabled = false;
    if (result.status !== 'success') {
      state.scores = null;
      $('scoresBody').innerHTML = '<tr><td class="empty-cell">成績讀取失敗，請重新整理或確認教師權限。</td></tr>';
      notify(result.message || '成績讀取失敗', true);
      return;
    }
    state.scores = result.scores;
    renderClassOptions();
    renderScores();
  }

  function setActiveTab(tab) {
    const showRoster = tab === 'roster';
    $('rosterTab').classList.toggle('is-active', showRoster);
    $('scoresTab').classList.toggle('is-active', !showRoster);
    $('rosterTab').setAttribute('aria-selected', String(showRoster));
    $('scoresTab').setAttribute('aria-selected', String(!showRoster));
    $('rosterPanel').hidden = !showRoster;
    $('scoresPanel').hidden = showRoster;
    if (!showRoster) loadScores();
  }

  $('loginForm').addEventListener('submit', handleLogin);
  $('logoutButton').addEventListener('click', handleLogout);
  $('rosterTab').addEventListener('click', () => setActiveTab('roster'));
  $('scoresTab').addEventListener('click', () => setActiveTab('scores'));
  $('addStudentButton').addEventListener('click', () => openStudentDialog());
  $('rosterBody').addEventListener('click', handleRosterAction);
  $('rosterClassFilter').addEventListener('change', renderRoster);
  $('rosterSearch').addEventListener('input', renderRoster);
  $('scoresClassFilter').addEventListener('change', renderScores);
  $('scoresSearch').addEventListener('input', renderScores);
  $('refreshScoresButton').addEventListener('click', () => loadScores(true));
  $('studentForm').addEventListener('submit', saveStudent);
  $('closeDialogButton').addEventListener('click', closeStudentDialog);
  $('cancelStudentButton').addEventListener('click', closeStudentDialog);
  $('studentDialog').addEventListener('click', event => {
    if (event.target === $('studentDialog')) closeStudentDialog();
  });

  restoreTeacherSession();
})();
