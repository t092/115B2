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
    if (auth.currentUser) return auth.currentUser;

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
      const payload = {
        uid: user.uid,
        class: profile.classId,
        seat: profile.seatNo,
        email: profile.email,
        unitName: data.unitId,
        totalScore: Number(data.score || 0),
        name: profile.name,
        score: Number(data.score || 0),
        stars: Number(data.stars || 0),
        durationSeconds: Number(data.durationSeconds || 0),
        moves: Number(data.moves || 0),
        badges: Array.isArray(data.badges) ? data.badges : [],
        levelDetails: Array.isArray(data.levelDetails) ? data.levelDetails : [],
        completed: data.completed === true,
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

  global.FirebaseService = {
    isConfigured: () => configured && !initError && !!db,
    getStudentProfile,
    setStudentProfile,
    loginStudent,
    defaultStudentName,
    ensureSession,
    submitScore,
    getLeaderboard,
    getUid
  };
})(window);
