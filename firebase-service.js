/* global firebase */
(function initFirebaseService(global) {
  'use strict';

  const config = global.CAI_FIREBASE_CONFIG || {};
  const options = global.CAI_FIREBASE_OPTIONS || {};
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const configured = requiredKeys.every(key => typeof config[key] === 'string' && config[key].trim());
  const sessionKey = 'L2B1A_FIREBASE_SESSION_V1';

  let app = null;
  let auth = null;
  let db = null;
  let initError = null;

  if (configured && global.firebase) {
    try {
      app = global.firebase.apps.length ? global.firebase.app() : global.firebase.initializeApp(config);
      auth = global.firebase.auth(app);
      db = global.firebase.firestore(app);
    } catch (error) {
      initError = error;
      console.warn('[Firebase] 初始化失敗，暫時使用離線模式。', error);
    }
  }

  function getLocalSession() {
    try {
      const raw = sessionStorage.getItem(sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setLocalSession(session) {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(session));
    } catch (error) {
      // file:// 或瀏覽器隱私模式可能禁止 sessionStorage，仍允許遊戲體驗。
    }
  }

  async function ensureSession() {
    if (!auth || !options.anonymousSession) return getLocalSession();
    if (auth.currentUser && auth.currentUser.isAnonymous !== false) return auth.currentUser;
    if (auth.currentUser && auth.currentUser.isAnonymous === false) {
      await auth.signOut();
    }

    const result = await auth.signInAnonymously();
    setLocalSession({ uid: result.user.uid, anonymous: true });
    return result.user;
  }

  function getStudentProfile() {
    const session = getLocalSession();
    return session && session.profile ? session.profile : null;
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function defaultStudentName(rosterName) {
    const name = String(rosterName || '').trim();
    return name ? `${name.slice(0, 1)}同學` : '同學';
  }

  function setStudentProfile(profile) {
    const session = getLocalSession() || {};
    setLocalSession({
      ...session,
      profile: {
        classId: String(profile.classId || '').trim(),
        seatNo: String(profile.seatNo || '').trim(),
        name: String(profile.name || '').trim(),
        email: normalizeEmail(profile.email),
        registered: profile.registered === true,
        rosterName: String(profile.rosterName || '').trim(),
        identityStatus: 'self_declared'
      }
    });
  }

  async function loginStudent(email, alias = '') {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return { status: 'invalid_email', message: '請輸入學習帳號 Email' };

    try {
      assertConfigured();
      const user = await ensureSession();
      const snapshot = await db.collection('students').doc(normalizedEmail).get();
      if (!snapshot.exists) return { status: 'guest', message: '此帳號不在學習帳號名冊中' };

      const roster = snapshot.data();
      const profile = {
        classId: String(roster.class || '').trim(),
        seatNo: String(roster.seat || '').trim(),
        name: String(alias || defaultStudentName(roster.name)).trim(),
        email: normalizedEmail,
        rosterName: String(roster.name || '').trim(),
        registered: true,
        identityStatus: 'roster_matched'
      };
      setLocalSession({uid: user.uid, anonymous: true, profile});
      return { status: 'registered', profile };
    } catch (error) {
      console.warn('[Firebase] 學習帳號查詢失敗。', error);
      return { status: 'error', message: error.message || '無法查詢學習帳號' };
    }
  }

  function getUid() {
    return auth && auth.currentUser
      ? auth.currentUser.uid
      : (getLocalSession() || {}).uid || '';
  }

  function assertConfigured() {
    if (!configured) throw new Error('Firebase 尚未設定，請填入 firebase-config.js');
    if (initError || !db) throw new Error('Firebase 尚未成功初始化');
  }

  async function submitScore(data) {
    if (data.isGuest) {
      return { status: 'guest', message: '免登入體驗模式不記錄正式成績' };
    }

    try {
      assertConfigured();
      const user = await ensureSession();
      const profile = data.profile || getStudentProfile() || {};
      if (!user || !user.uid) throw new Error('無法建立 Firebase 工作階段');
      if (!profile.registered || !profile.email || !profile.classId || !profile.seatNo) {
        return { status: 'guest', message: '非名冊學生不記錄正式成績' };
      }

      const clientSubmissionId = data.clientSubmissionId || crypto.randomUUID();
      const submissionId = `${user.uid}_${data.unitId}_${clientSubmissionId}`;
      const score = Number(data.score ?? data.totalScore ?? 0);
      const baseScore = Number(data.baseScore ?? score);
      const bonusScore = Number(data.bonusScore ?? 0);
      const totalScore = baseScore + bonusScore;
      const payload = {
        uid: user.uid,
        class: profile.classId,
        seat: profile.seatNo,
        email: profile.email,
        unitName: data.unitId,
        totalScore,
        name: profile.name,
        score: totalScore,
        baseScore,
        bonusScore,
        hiddenLevelUnlocked: data.hiddenLevelUnlocked === true,
        hiddenLevelCompleted: data.hiddenLevelCompleted === true,
        hiddenLevelScore: Number(data.hiddenLevelScore ?? bonusScore),
        hiddenLevelDurationSeconds: Number(data.hiddenLevelDurationSeconds ?? 0),
        hiddenReward: data.hiddenReward || '',
        stars: Number(data.stars || 0),
        durationSeconds: Number(data.durationSeconds || 0),
        moves: Number(data.moves || 0),
        badges: Array.isArray(data.badges) ? data.badges : [],
        levelDetails: Array.isArray(data.levelDetails) ? data.levelDetails : [],
        completed: data.completed === true || data.isCompleted === true,
        identityStatus: 'self_declared',
        assignmentId: data.assignmentId || '',
        clientSubmissionId,
        status: 'pending_review',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('scores').doc(submissionId).set(payload, { merge: false });
      return { status: 'success', submissionId, identityStatus: 'self_declared' };
    } catch (error) {
      console.warn('[Firebase] 成績寫入失敗。', error);
      return { status: 'error', message: error.message || '無法連線至 Firebase' };
    }
  }

  async function getLeaderboard(unitId, classId, limit = 10) {
    try {
      assertConfigured();
      const snapshot = await db.collection('scores')
        .where('unitName', '==', unitId)
        .where('class', '==', classId || '')
        .where('completed', '==', true)
        .orderBy('score', 'desc')
        .limit(limit)
        .get();

      return {
        status: 'success',
        topList: snapshot.docs.map((doc, index) => {
          const item = doc.data();
          return {
            rank: index + 1,
            name: item.name ? `${item.name.slice(0, 1)}○${item.name.slice(-1)}` : '未具名',
            score: item.totalScore,
            moves: item.moves
          };
        })
      };
    } catch (error) {
      console.warn('[Firebase] 排行榜讀取失敗。', error);
      return { status: 'error', topList: [], message: error.message || '無法讀取排行榜' };
    }
  }

  async function loginTeacher(email, password) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !String(password || '')) {
      return { status: 'invalid_credentials', message: '請輸入教師 Email 與密碼' };
    }

    try {
      assertConfigured();
      const result = await auth.signInWithEmailAndPassword(normalizedEmail, password);
      const user = result.user;
      if (!user || user.isAnonymous) {
        await auth.signOut();
        return { status: 'unauthorized', message: '此帳號沒有教師管理權限' };
      }

      const teacherDoc = await db.collection('teachers').doc(user.uid).get();
      const teacher = teacherDoc.exists ? teacherDoc.data() : {};
      if (!teacherDoc.exists || teacher.role !== 'teacher' || teacher.active !== true) {
        await auth.signOut();
        return { status: 'unauthorized', message: '此帳號尚未取得教師管理權限' };
      }

      return {
        status: 'success',
        teacher: { uid: user.uid, email: user.email || normalizedEmail }
      };
    } catch (error) {
      console.warn('[Firebase] 教師登入失敗。', error);
      const messages = {
        'auth/invalid-credential': 'Email 或密碼不正確',
        'auth/user-not-found': '找不到此教師帳號',
        'auth/wrong-password': 'Email 或密碼不正確',
        'auth/too-many-requests': '嘗試次數過多，請稍後再試',
        'auth/operation-not-allowed': 'Firebase 尚未啟用 Email/Password 登入'
      };
      return {
        status: 'error',
        message: messages[error.code] || error.message || '教師登入失敗，請稍後再試'
      };
    }
  }

  async function requireTeacher() {
    assertConfigured();
    const user = auth && auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('請先以教師帳號登入');

    const snapshot = await db.collection('teachers').doc(user.uid).get();
    const teacher = snapshot.exists ? snapshot.data() : {};
    if (!snapshot.exists || teacher.role !== 'teacher' || teacher.active !== true) {
      await auth.signOut();
      throw new Error('此帳號沒有教師管理權限或權限已停用');
    }
    return user;
  }

  async function logoutTeacher() {
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
      await auth.signOut();
    }
  }

  async function getTeacherSession() {
    try {
      const user = await requireTeacher();
      return {
        status: 'success',
        teacher: { uid: user.uid, email: user.email || '' }
      };
    } catch (error) {
      return { status: 'unauthorized', message: error.message || '請先以教師帳號登入' };
    }
  }

  async function listStudents() {
    try {
      await requireTeacher();
      const snapshot = await db.collection('students').get();
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      students.sort((a, b) =>
        String(a.class || '').localeCompare(String(b.class || ''), 'zh-Hant', { numeric: true }) ||
        String(a.seat || '').localeCompare(String(b.seat || ''), 'zh-Hant', { numeric: true }) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant')
      );
      return { status: 'success', students };
    } catch (error) {
      console.warn('[Firebase] 名冊讀取失敗。', error);
      return { status: 'error', students: [], message: error.message || '無法讀取學生名冊' };
    }
  }

  function normalizeStudent(data) {
    const email = normalizeEmail(data.email);
    const student = {
      email,
      class: String(data.class || '').trim(),
      seat: String(data.seat || '').trim(),
      name: String(data.name || '').trim()
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
      throw new Error('請輸入有效的學習帳號 Email');
    }
    if (!student.email || !student.class || !student.seat || !student.name) {
      throw new Error('請完整填寫 Email、班級、座號與姓名');
    }
    return student;
  }

  async function addStudent(data) {
    try {
      await requireTeacher();
      const student = normalizeStudent(data);
      const ref = db.collection('students').doc(student.email);
      const existing = await ref.get();
      if (existing.exists) throw new Error('此 Email 已存在於名冊中');
      await ref.set({
        ...student,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { status: 'success', student };
    } catch (error) {
      console.warn('[Firebase] 新增學生失敗。', error);
      return { status: 'error', message: error.message || '無法新增學生' };
    }
  }

  async function updateStudent(oldEmail, data) {
    try {
      await requireTeacher();
      const previousEmail = normalizeEmail(oldEmail);
      const student = normalizeStudent(data);
      const oldRef = db.collection('students').doc(previousEmail);
      const newRef = db.collection('students').doc(student.email);
      const oldSnapshot = await oldRef.get();
      if (!oldSnapshot.exists) throw new Error('找不到要編輯的學生資料，請重新整理名冊');

      const existing = student.email === previousEmail ? oldSnapshot : await newRef.get();
      if (student.email !== previousEmail && existing.exists) {
        throw new Error('新的 Email 已存在於名冊中');
      }

      const previousData = oldSnapshot.data();
      const previousEmails = Array.from(new Set([
        ...(Array.isArray(previousData.previousEmails) ? previousData.previousEmails : []),
        ...(student.email !== previousEmail ? [previousEmail] : [])
      ].map(normalizeEmail).filter(email => email && email !== student.email)));

      const batch = db.batch();
      const payload = {
        ...student,
        previousEmails,
        createdAt: previousData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      batch.set(newRef, payload, { merge: true });
      if (student.email !== previousEmail) batch.delete(oldRef);
      await batch.commit();
      return { status: 'success', student };
    } catch (error) {
      console.warn('[Firebase] 學生資料更新失敗。', error);
      return { status: 'error', message: error.message || '無法更新學生資料' };
    }
  }

  async function deleteStudent(email) {
    try {
      await requireTeacher();
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) throw new Error('學生 Email 不正確');
      await db.collection('students').doc(normalizedEmail).delete();
      return { status: 'success' };
    } catch (error) {
      console.warn('[Firebase] 學生資料刪除失敗。', error);
      return { status: 'error', message: error.message || '無法刪除學生資料' };
    }
  }

  async function listScores() {
    try {
      await requireTeacher();
      const snapshot = await db.collection('scores').get();
      return {
        status: 'success',
        scores: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };
    } catch (error) {
      console.warn('[Firebase] 成績讀取失敗。', error);
      return { status: 'error', scores: [], message: error.message || '無法讀取學生總成績' };
    }
  }

  global.FirebaseService = {
    isConfigured: () => configured && !initError && !!db,
    getStudentProfile,
    setStudentProfile,
    loginStudent,
    defaultStudentName,
    ensureSession,
    submitScore,
    getLeaderboard,
    getUid,
    loginTeacher,
    logoutTeacher,
    getTeacherSession,
    listStudents,
    addStudent,
    updateStudent,
    deleteStudent,
    listScores
  };
})(window);
