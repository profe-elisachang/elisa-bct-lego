// 統一導航欄 - Unified Navigation
// 三頁共用：index.html, lesson-template-b.html, bct-review.html

(function () {
  'use strict';

  // ================================================
  // 配置
  // ================================================
  const ENABLE_GROUP_UI = window.BCT_ENABLE_GROUP_UI !== false;
  const STORAGE_KEYS = {
    CLASS: 'bct-active-class',
    COHORT: 'bct-cohort'
  };

  const COHORTS = [
    { id: 'taigen-a', name: 'Taigen A', label: 'A' },
    { id: 'taigen-b', name: 'Taigen B', label: 'B' }
  ];

  const LEVELS = [
    { id: 'btc1', label: 'BCT 1', emoji: '🟢' },
    { id: 'btc2', label: 'BCT 2', emoji: '🟠' },
    { id: 'btc3', label: 'BCT 3', emoji: '🟣' }
  ];

  // ================================================
  // 工具函數
  // ================================================
  const getParam = (key) => new URLSearchParams(window.location.search).get(key);

  const getPageType = () => {
    const path = window.location.pathname;
    if (path.endsWith('bct-review.html')) return 'review';
    if (path.endsWith('lesson-template-b.html') || path.endsWith('lesson-template-a.html') || path.endsWith('lesson.html')) return 'lesson';
    return 'home';
  };

  const getCurrentLevel = () => {
    const param = getParam('level') || getParam('class');
    const stored = localStorage.getItem(STORAGE_KEYS.CLASS);
    return param || stored || 'btc1';
  };

  const getCurrentCohort = () => {
    if (getPageType() === 'review') return 'taigen-a';
    const param = getParam('cohort');
    const stored = localStorage.getItem(STORAGE_KEYS.COHORT);
    return param || stored || 'taigen-a';
  };

  const setCurrentLevel = (level) => {
    localStorage.setItem(STORAGE_KEYS.CLASS, level);
  };

  const setCurrentCohort = (cohortId) => {
    localStorage.setItem(STORAGE_KEYS.COHORT, cohortId);
  };

  const getCohortInfo = (cohortId) => {
    return COHORTS.find(c => c.id === cohortId) || COHORTS[0];
  };

  // ================================================
  // 導航欄渲染
  // ================================================
  const renderNav = () => {
    const pageType = getPageType();
    const currentLevel = getCurrentLevel();
    const currentCohort = getCurrentCohort();
    const cohortInfo = getCohortInfo(currentCohort);

    // 創建導航容器
    const nav = document.createElement('nav');
    nav.className = 'unified-nav';
    nav.innerHTML = `
      <div class="unified-nav-inner">
        <!-- Logo -->
        <a href="index.html" class="nav-logo">Chinese Lego</a>

        <!-- BCT 等級標籤 -->
        <div class="nav-level-tabs">
          ${LEVELS.map(level => `
            <button type="button"
                    class="nav-level-btn ${level.id === currentLevel ? 'active' : ''}"
                    data-level="${level.id}">
              ${level.emoji} ${level.label}
            </button>
          `).join('')}
        </div>

        <!-- 右側操作區 -->
        <div class="nav-actions">
          <!-- Review 按鈕 -->
          <a href="bct-review.html?level=${currentLevel}&cohort=${currentCohort}"
             class="nav-review-btn ${pageType === 'review' ? 'active' : ''}">
            🧠 Review
          </a>

          ${ENABLE_GROUP_UI ? `
          <!-- 班級選擇器 -->
          <div class="nav-cohort-dropdown">
            <button type="button" class="nav-cohort-btn">
              👤 ${cohortInfo.name}
              <span class="arrow">▼</span>
            </button>
            <div class="nav-cohort-menu">
              ${COHORTS.map(cohort => `
                <div class="nav-cohort-item ${cohort.id === currentCohort ? 'active' : ''}"
                     data-cohort="${cohort.id}">
                  <span class="check">${cohort.id === currentCohort ? '✓' : ''}</span>
                  <span>${cohort.name}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ``}
        </div>
      </div>
    `;

    // 插入頁面最前面
    document.body.insertBefore(nav, document.body.firstChild);

    // 綁定事件
    bindNavEvents(nav, pageType, currentLevel, currentCohort);
  };

  // ================================================
  // 事件綁定
  // ================================================
  const bindNavEvents = (nav, pageType, currentLevel, currentCohort) => {
    // BCT 等級切換 - 統一行為：跳轉到對應等級的 lesson 頁
    nav.querySelectorAll('.nav-level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.level;

        setCurrentLevel(level);

        // 統一跳轉到 lesson 頁（首頁從 L1 開始，其他頁面保持當前課程）
        if (pageType === 'lesson') {
          const currentLesson = getParam('lesson') || 'L1';
          window.location.href = `lesson-template-b.html?level=${level}&lesson=${currentLesson}&cohort=${getCurrentCohort()}`;
        } else {
          // 首頁和複習頁：跳轉到該等級的 L1
          window.location.href = `lesson-template-b.html?level=${level}&lesson=L1&cohort=${getCurrentCohort()}`;
        }
      });
    });

    // 班級選擇器下拉（可選功能）
    if (!ENABLE_GROUP_UI) return;

    const cohortDropdown = nav.querySelector('.nav-cohort-dropdown');
    const cohortBtn = nav.querySelector('.nav-cohort-btn');
    const cohortMenu = nav.querySelector('.nav-cohort-menu');

    if (!cohortDropdown || !cohortBtn || !cohortMenu) return;

    cohortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cohortDropdown.classList.toggle('open');
      cohortBtn.classList.toggle('open');
    });

    // 點擊外部關閉下拉
    document.addEventListener('click', () => {
      cohortDropdown.classList.remove('open');
      cohortBtn.classList.remove('open');
    });

    // 班級選擇
    cohortMenu.querySelectorAll('.nav-cohort-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const cohortId = item.dataset.cohort;
        if (cohortId === currentCohort) {
          cohortDropdown.classList.remove('open');
          cohortBtn.classList.remove('open');
          return;
        }

        // 更新 localStorage
        setCurrentCohort(cohortId);

        // 根據頁面類型重載
        const level = getCurrentLevel();
        if (pageType === 'home') {
          // 首頁：刷新頁面（會自動更新按鈕鏈接）
          window.location.reload();
        } else if (pageType === 'lesson') {
          // 課程頁：更新 URL 參數並重載
          const currentLesson = getParam('lesson') || 'L1';
          window.location.href = `lesson-template-b.html?level=${level}&lesson=${currentLesson}&cohort=${cohortId}`;
        } else if (pageType === 'review') {
          // 複習頁：更新 URL 參數並重載
          window.location.href = `bct-review.html?level=${level}&cohort=${cohortId}`;
        }
      });
    });
  };

  // ================================================
  // 側邊欄功能（僅 lesson-template-b.html）
  // ================================================
  const initSidebar = () => {
    const pageType = getPageType();
    if (pageType !== 'lesson') return;

    const CONFIG = window.BCT_COURSE_CONFIG;
    if (!CONFIG || !Array.isArray(CONFIG.classes)) return;

    const currentLevel = getCurrentLevel();
    const currentCohort = getCurrentCohort();
    const currentLesson = getParam('lesson') || 'L1';

    // 找到當前等級的課程
    const currentClass = CONFIG.classes.find(c => c.id === currentLevel) || CONFIG.classes[0];

    // 渲染側邊欄單元列表
    const sidebarList = document.getElementById('sidebar-unit-list');
    if (sidebarList && currentClass?.lessons?.length) {
      sidebarList.innerHTML = '';
      currentClass.lessons.forEach((lesson) => {
        const item = document.createElement('a');
        item.className = 'b-unit-item';
        const num = lesson.id.replace('L', '').padStart(2, '0');
        item.href = `lesson-template-b.html?level=${currentClass.id}&lesson=${lesson.id}&cohort=${currentCohort}`;
        item.innerHTML = `<span class="b-unit-num">L${num}</span><span>${lesson.title || ''}</span>`;
        if (lesson.id.toUpperCase() === currentLesson.toUpperCase()) {
          item.classList.add('active');
        }
        sidebarList.appendChild(item);
      });

      // 從 Firestore 更新標題
      updateSidebarTitlesFromFirestore(sidebarList, currentClass.id);
    }

    // 隱藏側邊欄的課程下拉選單（已由導航欄處理）
    const sidebarDropdown = document.getElementById('sidebar-course-dropdown');
    if (sidebarDropdown) {
      sidebarDropdown.style.display = 'none';
    }
  };

  // 從 Firestore 獲取課程標題
  const updateSidebarTitlesFromFirestore = async (sidebarList, classId) => {
    if (typeof firestoreService === 'undefined') return;

    const normalizeLessonId = (id) => {
      if (!id) return null;
      if (/^L\d+$/i.test(id)) return `lesson${id.slice(1)}`;
      return id;
    };

    try {
      if (!firestoreService.isConnected()) {
        await firestoreService.init();
      }

      const items = Array.from(sidebarList.querySelectorAll('.b-unit-item'));
      await Promise.all(items.map(async (item) => {
        const href = item.getAttribute('href') || '';
        const match = href.match(/lesson=([^&]+)/i);
        if (!match) return;
        const lessonId = normalizeLessonId(match[1]);
        if (!lessonId) return;
        const data = await firestoreService.getLesson(lessonId, classId);
        if (!data || !data.title) return;
        const labelSpan = item.querySelector('span:nth-of-type(2)') || item.querySelector('span:last-child');
        if (!labelSpan) return;
        labelSpan.textContent = data.title;
      }));
    } catch (err) {
      console.warn('Failed to update sidebar titles:', err);
    }
  };

  // ================================================
  // 初始化
  // ================================================
  const init = async () => {
    // Review page uses fixed single-cohort mode; skip Firestore cohort validation on startup.
    if (getPageType() !== 'review') {
      if (window.__cohortGuardReady && typeof window.__cohortGuardReady.then === 'function') {
        try { await window.__cohortGuardReady; } catch (_) {}
      }
    }
    renderNav();
    initSidebar();
  };

  // 確保 DOM 已加載
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
  } else {
    init();
  }
})();
