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
    const exportClass = $('exportClassSelect');
    const selectedExportClass = exportClass.value;
    exportClass.innerHTML = '<option value="">請選擇班級</option>' + sorted.map(classId =>
      `<option value="${escapeHtml(classId)}">${escapeHtml(classId)} 班</option>`
    ).join('');
    if (sorted.includes(selectedExportClass)) exportClass.value = selectedExportClass;
    $('studentCount').textContent = state.students.length.toLocaleString('zh-TW');
    $('classCount').textContent = sorted.length.toLocaleString('zh-TW');
    updateExportButton();
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
    renderExportOptions(units);
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

  function renderExportOptions(units) {
    const container = $('exportCourseOptions');
    const previousInputs = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    const previousIds = new Set(previousInputs.map(input => input.value));
    const previouslyChecked = new Set(previousInputs.filter(input => input.checked).map(input => input.value));
    container.innerHTML = units.map(unit => {
      const checked = previousIds.has(unit.id) ? previouslyChecked.has(unit.id) : true;
      return `<label class="course-option"><input type="checkbox" value="${escapeHtml(unit.id)}"${checked ? ' checked' : ''}><span>${escapeHtml(unit.label)}</span></label>`;
    }).join('');
    container.querySelectorAll('input').forEach(input => input.addEventListener('change', updateExportButton));
    updateExportButton();
  }

  function selectedExportUnitIds() {
    const container = $('exportCourseOptions');
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
  }

  function updateExportButton() {
    const classSelected = $('exportClassSelect') && $('exportClassSelect').value;
    const selectedCourses = selectedExportUnitIds().length;
    const button = $('exportCsvButton');
    if (!button) return;
    button.disabled = !classSelected || selectedCourses === 0;
    if ($('exportHint')) {
      $('exportHint').classList.remove('is-error');
      if (!classSelected) {
        $('exportHint').textContent = '請先選擇班級，再勾選要輸出的課程。CSV 使用 UTF-8 編碼，適合以試算表開啟。';
      } else if (selectedCourses === 0) {
        $('exportHint').textContent = '請至少勾選一門要輸出的課程。';
      } else {
        $('exportHint').textContent = `已選 ${selectedCourses} 門課程；匯出該班全體名冊及歷史成績，搜尋條件不會影響輸出。`;
      }
    }
  }

  function csvCell(value, isText = false) {
    let text = String(value ?? '');
    if (isText && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename, content) {
    const blob = new Blob(['\uFEFF', content], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function exportScoresCsv() {
    const button = $('exportCsvButton');
    const classId = $('exportClassSelect').value;
    const selectedUnits = selectedExportUnitIds();
    if (!classId || selectedUnits.length === 0) {
      $('exportHint').textContent = '請選擇一個班級及至少一門課程。';
      $('exportHint').classList.add('is-error');
      return;
    }

    const originalText = button.innerHTML;
    button.disabled = true;
    button.textContent = '準備中…';
    try {
      if (!Array.isArray(state.scores)) {
        await loadScores(true);
      }
      if (!Array.isArray(state.scores)) throw new Error('成績尚未載入，請稍後再試或確認教師權限');

      const units = [
        ...UNIT_CATALOG,
        ...Array.from(new Set(state.scores.map(score => String(score.unitName || '').trim()).filter(Boolean)))
          .filter(unit => !UNIT_LABELS.has(unit))
          .sort(compareText)
          .map(id => ({ id, label: `${id}總成績` }))
      ].filter(unit => selectedUnits.includes(unit.id));
      const rows = buildScoreRows().filter(row => row.class === classId)
        .sort((a, b) => compareText(a.class, b.class) || compareText(a.seat, b.seat) || compareText(a.name, b.name));
      const csvRows = [
        ['班級', '座號', '姓名', ...units.map(unit => unit.label)].map(value => csvCell(value, true)).join(','),
        ...rows.map(row => [
          csvCell(row.class, true),
          csvCell(row.seat, true),
          csvCell(row.name, true),
          ...units.map(unit => {
            const score = row.totals.get(unit.id);
            return score === undefined ? csvCell('—', true) : csvCell(Number(score));
          })
        ].join(','))
      ];
      const safeClass = classId.replace(/[^\w\u4e00-\u9fff-]/g, '') || '班級';
      const today = new Date();
      const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      downloadCsv(`${safeClass}班_成績總表_${date}.csv`, csvRows.join('\r\n'));
      $('exportHint').textContent = `已輸出 ${rows.length.toLocaleString('zh-TW')} 位學生、${units.length} 門課程。`;
      $('exportHint').classList.remove('is-error');
      notify('CSV 成績檔已下載');
    } catch (error) {
      $('exportHint').textContent = error.message || '匯出失敗，請稍後再試';
      $('exportHint').classList.add('is-error');
      notify(error.message || '匯出失敗', true);
    } finally {
      button.innerHTML = originalText;
      updateExportButton();
    }
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
  $('exportClassSelect').addEventListener('change', updateExportButton);
  $('exportCsvButton').addEventListener('click', exportScoresCsv);
  $('selectAllCourses').addEventListener('click', () => {
    $('exportCourseOptions').querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; });
    updateExportButton();
  });
  $('clearCourses').addEventListener('click', () => {
    $('exportCourseOptions').querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; });
    updateExportButton();
  });
  $('studentForm').addEventListener('submit', saveStudent);
  $('closeDialogButton').addEventListener('click', closeStudentDialog);
  $('cancelStudentButton').addEventListener('click', closeStudentDialog);
  $('studentDialog').addEventListener('click', event => {
    if (event.target === $('studentDialog')) closeStudentDialog();
  });

  renderExportOptions(UNIT_CATALOG);
  restoreTeacherSession();
})();
