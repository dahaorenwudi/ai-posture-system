// AI体态与状态恢复系统 - 核心逻辑

const APP = {
  user: {
    id: 1,
    name: '用户',
    phone: '',
    avatar: '',
    hasActiveChallenge: false,
    isLoggedIn: false
  },

  challenges: {
    7: {
      id: 7,
      name: '7天入门挑战',
      days: 7,
      leaveAllowed: 1,
      plans: [
        { id: 'light', name: '轻松体验', desc: '低压力入门', amount: 49, serviceFee: 15, deposit: 34, baseDeduct: 8 },
        { id: 'standard', name: '推荐标准', desc: '性价比更高', amount: 99, serviceFee: 29, deposit: 70, baseDeduct: 10 },
        { id: 'pro', name: '强化约束', desc: '高返现金激励', amount: 149, serviceFee: 39, deposit: 110, baseDeduct: 15 }
      ]
    },
    14: {
      id: 14,
      name: '14天标准挑战',
      days: 14,
      leaveAllowed: 2,
      plans: [
        { id: 'light', name: '轻松体验', desc: '低压力入门', amount: 129, serviceFee: 39, deposit: 90, baseDeduct: 10 },
        { id: 'standard', name: '推荐标准', desc: '性价比更高', amount: 199, serviceFee: 59, deposit: 140, baseDeduct: 15 },
        { id: 'pro', name: '强化约束', desc: '高返现金激励', amount: 299, serviceFee: 79, deposit: 220, baseDeduct: 20 }
      ]
    },
    28: {
      id: 28,
      name: '28天稳定挑战',
      days: 28,
      leaveAllowed: 4,
      plans: [
        { id: 'light', name: '轻松体验', desc: '低压力入门', amount: 199, serviceFee: 59, deposit: 140, baseDeduct: 10 },
        { id: 'standard', name: '推荐标准', desc: '性价比更高', amount: 299, serviceFee: 89, deposit: 210, baseDeduct: 15 },
        { id: 'pro', name: '强化约束', desc: '高返现金激励', amount: 499, serviceFee: 129, deposit: 370, baseDeduct: 20 }
      ]
    }
  },

  unlocked: { 7: true, 14: false, 28: false },
  activeChallenge: null,

  init() {
    this.loadData();
    this.setupEventListeners();
    this.checkDailyStatus();
  },

  checkLogin() {
    const loginData = localStorage.getItem('ai_posture_user');
    if (loginData) {
      try {
        const loginUser = JSON.parse(loginData);
        if (loginUser && loginUser.isLoggedIn) {
          this.user.isLoggedIn = true;
          this.user.phone = loginUser.phone || '';
          this.user.name = this.user.phone
            ? this.user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
            : '用户';
          return true;
        }
      } catch (err) {
        console.warn('登录缓存损坏，已清理:', err);
        localStorage.removeItem('ai_posture_user');
      }
    }
    this.user.isLoggedIn = false;
    return false;
  },

  requireLogin() {
    if (!this.checkLogin()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  logout() {
    localStorage.removeItem('ai_posture_user');
    this.user.isLoggedIn = false;
    this.user.phone = '';
    window.location.href = 'login.html';
  },

  loadData() {
    const saved = localStorage.getItem('ai_posture_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.unlocked = data.unlocked || this.unlocked;
        this.activeChallenge = this.normalizeActiveChallenge(data.activeChallenge);
        this.user = this.normalizeUserData({ ...this.user, ...data.user });
        if (this.activeChallenge !== data.activeChallenge || this.user.name !== data.user?.name) {
          this.saveData();
        }
      } catch (err) {
        console.warn('应用缓存损坏，已清理:', err);
        localStorage.removeItem('ai_posture_data');
      }
    }
  },

  normalizeText(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    if (!text || /[\uFFFD]|[\u93a0-\u93ff][\u4e00-\u9fff]|[\u9380-\u94ff]{2,}/.test(text)) {
      return fallback;
    }
    return text;
  },

  normalizeUserData(user) {
    const normalized = { ...user };
    normalized.name = this.normalizeText(normalized.name, '用户');
    return normalized;
  },

  normalizeActiveChallenge(challenge) {
    if (!challenge || typeof challenge !== 'object') return null;
    const days = Number(challenge.days);
    const config = this.challenges[days];
    if (!config) return null;
    const plan = this.getPlan(days, challenge.planId) || config.plans[0];
    const dailyRecords = Array.isArray(challenge.dailyRecords) ? challenge.dailyRecords : [];
    return {
      ...challenge,
      days,
      planId: plan.id,
      name: config.name,
      planName: plan.name,
      status: challenge.status || 'active',
      currentDay: Number(challenge.currentDay) || 1,
      checkedDays: Number(challenge.checkedDays) || 0,
      leaveDays: Number(challenge.leaveDays) || 0,
      missedDays: Number(challenge.missedDays) || 0,
      deductedAmount: Number(challenge.deductedAmount) || 0,
      dailyRecords
    };
  },

  saveData() {
    localStorage.setItem('ai_posture_data', JSON.stringify({
      unlocked: this.unlocked,
      activeChallenge: this.activeChallenge,
      user: this.user
    }));
  },

  calculateDeduction(baseDeduct, missedCount, rate = 0.5) {
    return Math.round(baseDeduct * (1 + rate * (missedCount - 1)));
  },

  calculateRefund(challenge) {
    const plan = this.getPlan(challenge.days, challenge.planId);
    if (!plan) return 0;
    let totalDeducted = 0;
    for (let i = 1; i <= challenge.missedDays; i++) {
      totalDeducted += this.calculateDeduction(plan.baseDeduct, i);
    }
    return Math.max(0, plan.deposit - totalDeducted);
  },

  getPlan(days, planId) {
    const config = this.challenges[days];
    if (!config) return null;
    return config.plans.find(function(plan) { return plan.id === planId; }) || null;
  },

  getTodayStatus(challenge) {
    const today = new Date().toISOString().split('T')[0];
    return challenge.dailyRecords.find(function(record) { return record.date === today; });
  },

  setupEventListeners() {
    document.querySelectorAll('.plan-option')?.forEach(function(opt) {
      opt.addEventListener('click', function() {
        document.querySelectorAll('.plan-option').forEach(function(item) {
          item.classList.remove('selected');
        });
        opt.classList.add('selected');
      });
    });
  },

  checkDailyStatus() {
    if (!this.activeChallenge) return;
    const challenge = this.activeChallenge;
    const today = new Date().toISOString().split('T')[0];
    const record = challenge.dailyRecords.find(function(item) { return item.date === today; });
    if (!record && challenge.status === 'active') {
      challenge.dailyRecords.push({
        date: today,
        status: 'pending',
        dayNumber: challenge.currentDay
      });
      this.saveData();
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('home-content') || document.getElementById('step-form')) return;
  APP.init();
});
