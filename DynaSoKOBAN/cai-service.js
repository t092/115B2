/**
 * 中國朝代 SOKOBAN - CAI 電腦輔助教學系統服務模組
 * 負責：學生資料工作階段、免登入體驗管理、Firebase 成績上傳與班級排行榜
 */

const CAI_CONFIG = {
  UNIT_NAME: 'DynaSoKOBAN',
  SESSION_KEY: 'L2B1A_DYNA_STUDENT_V2' // 使用 sessionStorage，關閉瀏覽器即清空防呆
};

const CAI = {
  openScoreForm(scoreData) {
    return this.submitScore({
      totalScore: scoreData.score,
      moves: scoreData.moves || 0,
      durationSeconds: scoreData.durationSeconds || 0,
      maxLevel: scoreData.maxLevel || 5,
      isCompleted: true,
      levelDetails: scoreData.levelDetails || []
    });
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
    return Boolean(s && !s.isGuest && s.classId && s.seatNo && s.name);
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
      idToken: '',
      name: studentData.name || '',
      classId: studentData.classId || '',
      seatNo: studentData.seatNo || '',
      registered: studentData.registered === true,
      rosterName: studentData.rosterName || '',
      isTeacher: studentData.isTeacher || false,
      loginTime: new Date().toISOString()
    }));
    if (window.FirebaseService) {
      FirebaseService.setStudentProfile({
        classId: studentData.classId,
        seatNo: studentData.seatNo,
        name: studentData.name,
        email: studentData.email,
        registered: studentData.registered === true,
        rosterName: studentData.rosterName
      });
    }
  },

  /**
   * 登出並清除 session
   */
  logout() {
    sessionStorage.removeItem(CAI_CONFIG.SESSION_KEY);
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
   * 提交成績至 Firebase。
   * 備註：純訪客體驗模式不發送任何請求。
   */
  async submitScore(scoreData) {
    if (this.isGuest()) {
      return {
        status: 'guest',
        message: '體驗模式不記錄成績'
      };
    }

    const student = this.getStudent();
    if (!student) {
      return {
        status: 'not_ready',
        message: '尚未填寫學生資料'
      };
    }

    if (window.FirebaseService && FirebaseService.isConfigured()) {
      return FirebaseService.submitScore({
        unitId: CAI_CONFIG.UNIT_NAME,
        profile: {
          classId: student.classId,
          seatNo: student.seatNo,
          name: student.name,
          email: student.email,
          registered: student.registered === true
        },
        score: scoreData.totalScore,
        moves: scoreData.moves,
        durationSeconds: scoreData.durationSeconds,
        levelDetails: scoreData.levelDetails,
        completed: scoreData.isCompleted,
        isGuest: false
      });
    }
    return {status: 'not_configured', message: 'Firebase 尚未完成設定'};
  },

  /**
   * 取得指定班級前 10 名排行榜
   */
  async getLeaderboard(classId) {
    if (window.FirebaseService && FirebaseService.isConfigured()) {
      return FirebaseService.getLeaderboard(CAI_CONFIG.UNIT_NAME, classId);
    }
    return {status: 'not_configured', topList: [], message: 'Firebase 尚未完成設定'};
  }
};

window.CAI = CAI;
