/**
 * 中國朝代 SOKOBAN - CAI 電腦輔助教學系統服務模組
 * 負責：st.tc.edu.tw 學生登入認證、免登入體驗管理、GAS 成績上傳與班級排行榜
 */

const CAI_CONFIG = {
  CLIENT_ID: '403500919614-4c109l85fn6hul7nng2nskbs9kn4reis.apps.googleusercontent.com',
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbzjetB7qPpquboR0rnMyvWNOQxAi3AbzSPNiVsiEiEnrxvckNH3X1_z4AzSctdJVFbIQQ/exec',
  SCORE_FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSfpEN7ExwsG1kTcaNZDTf2KIFec2tpx7FqqxSSKydm0zzI2tQ/viewform?usp=header',
  SCORE_FORM_ENTRIES: {
    className: '', seat: '', name: '', score: '', time: '', badges: ''
  },
  HOSTED_DOMAIN: 'st.tc.edu.tw',
  UNIT_NAME: 'DynaSoKOBAN',
  SESSION_KEY: 'L2B1A_DYNA_STUDENT_V2' // 使用 sessionStorage，關閉瀏覽器即清空防呆
};

const CAI = {
  openScoreForm(scoreData) {
    if (!CAI_CONFIG.SCORE_FORM_URL) {
      alert('成績登錄表尚未設定，請稍後再試或通知老師。');
      return;
    }
    const values = {
      className: scoreData.className || '',
      seat: scoreData.seat || '',
      name: scoreData.name || '',
      score: String(scoreData.score ?? ''),
      time: scoreData.time || '',
      badges: scoreData.badges || ''
    };
    const params = new URLSearchParams();
    Object.keys(values).forEach(key => {
      const entry = CAI_CONFIG.SCORE_FORM_ENTRIES[key];
      if (entry && values[key]) params.set(`entry.${entry}`, values[key]);
    });
    const separator = CAI_CONFIG.SCORE_FORM_URL.includes('?') ? '&' : '?';
    const url = params.toString()
      ? CAI_CONFIG.SCORE_FORM_URL + separator + params.toString()
      : CAI_CONFIG.SCORE_FORM_URL;
    window.open(url, '_blank', 'noopener');
  },

  /**
   * 取得當前 session 中的學生資訊
   * @returns {Object|null}
   */
  getStudent() {
    try {
      const raw = sessionStorage.getItem(CAI_CONFIG.SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  /**
   * 是否為免登入體驗模式
   */
  isGuest() {
    const s = this.getStudent();
    return s && s.isGuest === true;
  },

  /**
   * 是否為已登入之正式學生（或教師）
   */
  isLoggedIn() {
    const s = this.getStudent();
    return s && s.email && !s.isGuest;
  },

  /**
   * 設定為免登入體驗模式
   */
  setGuestMode() {
    const guestUser = {
      isGuest: true,
      name: '訪客體驗者',
      classId: '體驗',
      seatNo: '00',
      email: ''
    };
    sessionStorage.setItem(CAI_CONFIG.SESSION_KEY, JSON.stringify(guestUser));
    return guestUser;
  },

  /**
   * 儲存已登入學生資訊至 sessionStorage
   */
  setStudent(studentData) {
    sessionStorage.setItem(CAI_CONFIG.SESSION_KEY, JSON.stringify({
      isGuest: false,
      email: studentData.email || '',
      idToken: studentData.idToken || '',
      name: studentData.name || '',
      classId: studentData.classId || '',
      seatNo: studentData.seatNo || '',
      isTeacher: studentData.isTeacher || false,
      loginTime: new Date().toISOString()
    }));
  },

  /**
   * 登出並清除 session
   */
  logout() {
    sessionStorage.removeItem(CAI_CONFIG.SESSION_KEY);
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  },

  /**
   * 解析 Google JWT Credential Token
   */
  decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('JWT 解析失敗:', e);
      return null;
    }
  },

  /**
   * 提交成績至 Google 試算表 (GAS)
   * 備註：體驗模式不發送任何請求
   */
  async submitScore(scoreData) {
    if (this.isGuest()) {
      return {
        status: 'guest',
        message: '體驗模式不記錄成績'
      };
    }

    const student = this.getStudent();
    if (!student || !student.email) {
      return {
        status: 'not_logged_in',
        message: '未登入學生資訊'
      };
    }

    const claims = this.decodeJwt(student.idToken || '');
    if (!claims || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) {
      return {status: 'error', message: '登入已過期，請回首頁重新登入學校帳號'};
    }
    const payload = {
      unitName: CAI_CONFIG.UNIT_NAME,
      idToken: student.idToken,
      action: 'submitScore',
      name: student.name,
      classId: student.classId,
      seatNo: student.seatNo,
      totalScore: scoreData.totalScore || 0,
      moves: scoreData.moves || 0,
      durationSeconds: scoreData.durationSeconds || 0,
      maxLevel: scoreData.maxLevel || 1,
      isCompleted: scoreData.isCompleted || false,
      levelDetails: scoreData.levelDetails || []
    };

    try {
      // 使用 text/plain 避免觸發 CORS 預檢限制
      const res = await fetch(CAI_CONFIG.GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok || !result || result.status !== 'success') {
        console.warn('GAS 回傳成績寫入失敗:', result);
        return {
          status: 'error',
          message: (result && result.message) || `HTTP ${res.status}`
        };
      }
      return result;
    } catch (err) {
      console.warn('成績上傳失敗或離線:', err.message || err);
      return {
        status: 'network_error',
        message: '無法連線至成績伺服器'
      };
    }
  },

  /**
   * 取得指定班級前 10 名排行榜
   */
  async getLeaderboard(classId) {
    try {
      const url = `${CAI_CONFIG.GAS_API_URL}?unitName=DynaSoKOBAN&action=getLeaderboard&classId=${encodeURIComponent(classId || '')}`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      console.warn('無法取得排行榜:', err);
      return {
        status: 'error',
        topList: []
      };
    }
  }
};

window.CAI = CAI;
