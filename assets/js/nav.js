// 動態渲染全站導航與課程條
(function () {
  const CONFIG = window.BCT_COURSE_CONFIG;
  if (!CONFIG || !Array.isArray(CONFIG.classes)) return;

  // 等待 DOM 加載完成
  const init = () => {
    const STORAGE_KEY = 'bct-active-class';

    const getParam = (key) => new URLSearchParams(window.location.search).get(key);
    const normalizeLesson = (raw) => {
      if (!raw) return null;
      if (raw.match(/^lesson\d+$/i)) {
        return 'L' + raw.replace(/lesson/i, '');
      }
      return raw.toUpperCase();
    };

    const resolveClassId = () => {
      const qs = getParam('class');
      const remembered = localStorage.getItem(STORAGE_KEY);
      const candidate = qs || remembered || CONFIG.defaultClassId;
      const exists = CONFIG.classes.find((c) => c.id === candidate);
      return exists ? candidate : CONFIG.defaultClassId;
    };

    const setClassId = (id) => localStorage.setItem(STORAGE_KEY, id);

    const currentClassId = resolveClassId();
    const currentLessonId = normalizeLesson(getParam('lesson') || getParam('lessonId'));
    const currentClass = CONFIG.classes.find((c) => c.id === currentClassId) || CONFIG.classes[0];

    const path = window.location.pathname;
    const lessonPage = path.endsWith('lesson-template-a.html')
      ? 'lesson-template-a.html'
      : path.endsWith('lesson-template-b.html')
        ? 'lesson-template-b.html'
        : 'lesson.html';
    // #region agent log
    const scriptSrcs = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => s.getAttribute('src'))
      .filter(Boolean);
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sessionId:'debug-session',
        runId:'baseline',
        hypothesisId:'H15',
        location:'assets/js/nav.js:init',
        message:'Script sources',
        data:{baseURI:document.baseURI, scriptSrcs},
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sessionId:'debug-session',
        runId:'baseline',
        hypothesisId:'H1',
        location:'assets/js/nav.js:init',
        message:'Resolved class/lesson/page',
        data:{
          path,
          qsClass:getParam('class'),
          qsLesson:getParam('lesson'),
          currentClassId,
          currentLessonId,
          lessonPage
        },
        timestamp:Date.now()
      })
    }).catch(()=>{});
    // #endregion

    const root = document.createElement('div');
    root.id = 'global-nav-shell';
    root.className = 'nav-shell';

    // 第一層：主導覽
    const topNav = document.createElement('nav');
    topNav.className = 'top-nav';

    const brand = document.createElement('div');
    brand.className = 'nav-brand';
    brand.textContent = 'BCT Lego';
    topNav.appendChild(brand);

    const linksWrap = document.createElement('div');
    linksWrap.className = 'nav-links';

    // Home 連結
    const homeLink = document.createElement('a');
    homeLink.href = 'index.html';
    homeLink.textContent = 'Home';
    if (path.endsWith('index.html') || path.endsWith('/')) {
      homeLink.classList.add('active');
    }
    linksWrap.appendChild(homeLink);

    // 分隔符
    const sep1 = document.createElement('span');
    sep1.className = 'nav-separator';
    sep1.textContent = '|';
    linksWrap.appendChild(sep1);

    // Courses 下拉選單
    const dropdown = document.createElement('div');
    dropdown.className = 'nav-dropdown';

    const dropdownBtn = document.createElement('button');
    dropdownBtn.type = 'button';
    dropdownBtn.className = 'nav-dropdown-btn';
    dropdownBtn.innerHTML = `${currentClass.label} <span class="arrow">▼</span>`;
    dropdown.appendChild(dropdownBtn);

    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'nav-dropdown-menu';

    const courseLevels = {
      btc1: '初级',
      btc2: '中级',
      btc3: '高级',
    };

    CONFIG.classes.forEach((cls) => {
      const item = document.createElement('a');
      item.className = 'nav-dropdown-item';
      item.href = `${lessonPage}?class=${cls.id}`;
      const isActive = cls.id === currentClassId;
      if (isActive) item.classList.add('active');
      item.innerHTML = `
        <span class="check">${isActive ? '✓' : ''}</span>
        <span>${cls.label}</span>
        <span class="course-level">${courseLevels[cls.id] || ''}</span>
      `;
      item.addEventListener('click', (e) => {
        e.preventDefault();
        setClassId(cls.id);
        window.location.href = `${lessonPage}?class=${cls.id}`;
      });
      dropdownMenu.appendChild(item);
    });

    dropdown.appendChild(dropdownMenu);
    linksWrap.appendChild(dropdown);

    // 下拉選單開關邏輯
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
    });

    // 分隔符
    const sep2 = document.createElement('span');
    sep2.className = 'nav-separator';
    sep2.textContent = '|';
    linksWrap.appendChild(sep2);

    // Review 連結
    const reviewLink = document.createElement('a');
    const cohort = localStorage.getItem('bct-cohort') || 'taigen-a';
    reviewLink.href = `bct-review.html?level=${currentClassId}&cohort=${cohort}`;
    reviewLink.textContent = 'Review';
    if (path.endsWith('bct-review.html')) {
      reviewLink.classList.add('active');
    }
    linksWrap.appendChild(reviewLink);

    topNav.appendChild(linksWrap);
    root.appendChild(topNav);

    // 插入頁面最前面
    const body = document.body;
    if (body.firstChild) {
      body.insertBefore(root, body.firstChild);
    } else {
      body.appendChild(root);
    }

    // 課程條（在 lesson.html 頁面顯示，不在首頁顯示）
    const showCourseBar =
      path.endsWith('lesson.html') ||
      path.endsWith('lesson-template-a.html');
      // 移除首页显示：&& !path.endsWith('index.html') && !path.endsWith('/')
    if (showCourseBar && currentClass?.lessons?.length) {
      const targetInner = document.getElementById('unit-bar-inner');

      if (targetInner) {
        // Template A logic: Use existing container
        targetInner.innerHTML = '';
        currentClass.lessons.forEach((lesson) => {
          const chip = document.createElement('a');
          chip.className = 'unit-btn';
          chip.href = `${lessonPage}?class=${currentClass.id}&lesson=${lesson.id}`;
          chip.textContent = lesson.id.replace('L', '');
          if (currentLessonId && lesson.id.toUpperCase() === currentLessonId.toUpperCase()) {
            chip.classList.add('active');
          }
          targetInner.appendChild(chip);
        });

        // Add Review button for Template A
        const reviewBtn = document.createElement('a');
        reviewBtn.className = 'unit-btn review';
        const cohort = localStorage.getItem('bct-cohort') || 'taigen-a';
        reviewBtn.href = `bct-review.html?level=${currentClass.id}&cohort=${cohort}`;
        reviewBtn.innerHTML = '⚡ Review';
        targetInner.appendChild(reviewBtn);
      } else {
        // Original logic: Create black bar
        const barWrap = document.createElement('div');
        barWrap.className = 'course-bar-wrap';

        const bar = document.createElement('div');
        bar.className = 'course-bar';

        currentClass.lessons.forEach((lesson) => {
          const chip = document.createElement('a');
          chip.className = 'course-chip';
          chip.href = `${lessonPage}?class=${currentClass.id}&lesson=${lesson.id}`;
          chip.textContent = lesson.id.replace('L', '');
          if (currentLessonId && lesson.id.toUpperCase() === currentLessonId.toUpperCase()) {
            chip.classList.add('active');
          }
          bar.appendChild(chip);
        });

        barWrap.appendChild(bar);

        // 插入到 container 內部
        const container = document.querySelector('.container');
        const heroHeader = document.querySelector('.hero-header');
        const lessonHeader = document.querySelector('.lesson-header');
        const mainContent = document.querySelector('main');

        if (container) {
          if (heroHeader) {
            heroHeader.after(barWrap);
          } else if (lessonHeader) {
            lessonHeader.before(barWrap);
          } else if (mainContent) {
            mainContent.before(barWrap);
          } else {
            container.prepend(barWrap);
          }
        } else {
          body.appendChild(barWrap);
        }
      }
    }

    const sidebarDropdown = document.getElementById('sidebar-course-dropdown');
    const sidebarBtn = document.getElementById('sidebar-course-btn');
    const sidebarMenu = document.getElementById('sidebar-course-menu');

    if (sidebarDropdown && sidebarBtn && sidebarMenu) {
      sidebarBtn.innerHTML = `${currentClass.label} <span class="arrow">▼</span>`;
      sidebarMenu.innerHTML = '';

      CONFIG.classes.forEach((cls) => {
        const item = document.createElement('a');
        item.className = 'nav-dropdown-item';
        item.href = `${lessonPage}?class=${cls.id}`;
        const isActive = cls.id === currentClassId;
        if (isActive) item.classList.add('active');
        item.innerHTML = `
          <span class="check">${isActive ? '✓' : ''}</span>
          <span>${cls.label}</span>
          <span class="course-level">${courseLevels[cls.id] || ''}</span>
        `;
        item.addEventListener('click', (e) => {
          e.preventDefault();
          setClassId(cls.id);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              sessionId:'debug-session',
              runId:'baseline',
              hypothesisId:'H1',
              location:'assets/js/nav.js:sidebarCourseClick',
              message:'Sidebar course selected',
              data:{targetClass:cls.id, redirect:`${lessonPage}?class=${cls.id}`},
              timestamp:Date.now()
            })
          }).catch(()=>{});
          // #endregion
          window.location.href = `${lessonPage}?class=${cls.id}`;
        });
        sidebarMenu.appendChild(item);
      });

      sidebarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebarDropdown.classList.toggle('open');
      });
    }

    const sidebarList = document.getElementById('sidebar-unit-list');
    if (sidebarList && currentClass?.lessons?.length) {
      sidebarList.innerHTML = '';
      currentClass.lessons.forEach((lesson) => {
        const item = document.createElement('a');
        item.className = 'b-unit-item';
        const num = lesson.id.replace('L', '').padStart(2, '0');
        item.href = `${lessonPage}?class=${currentClass.id}&lesson=${lesson.id}`;
        item.innerHTML = `<span class="b-unit-num">L${num}</span><span>${lesson.title || ''}</span>`;
        if (currentLessonId && lesson.id.toUpperCase() === currentLessonId.toUpperCase()) {
          item.classList.add('active');
        }
        sidebarList.appendChild(item);
      });
      const normalizeLessonId = (id) => {
        if (!id) return null;
        if (/^L\d+$/i.test(id)) return `lesson${id.slice(1)}`;
        return id;
      };
      const updateSidebarTitlesFromFirestore = async () => {
        if (typeof firestoreService === 'undefined') return;
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
          const data = await firestoreService.getLesson(lessonId, currentClass.id);
          if (!data || !data.title) return;
          const labelSpan = item.querySelector('span:nth-of-type(2)') || item.querySelector('span:last-child');
          if (!labelSpan) return;
          labelSpan.textContent = data.title;
        }));
      };
      const waitForFirestore = (tries = 0) => {
        if (typeof firestoreService !== 'undefined') {
          updateSidebarTitlesFromFirestore();
          return;
        }
        if (tries < 120) requestAnimationFrame(() => waitForFirestore(tries + 1));
      };
      waitForFirestore();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sessionId:'debug-session',
          runId:'baseline',
          hypothesisId:'H2',
          location:'assets/js/nav.js:sidebarUnitRender',
          message:'Sidebar units rendered',
          data:{
            classId:currentClass.id,
            lessonsCount:currentClass.lessons.length,
            firstLesson:currentClass.lessons[0]?.id,
            lessonPage
          },
          timestamp:Date.now()
        })
      }).catch(()=>{});
      // #endregion

      const reviewLink = document.getElementById('sidebar-review-link');
      if (reviewLink) {
        const cohort = localStorage.getItem('bct-cohort') || 'taigen-a';
        reviewLink.href = `bct-review.html?level=${currentClass.id}&cohort=${cohort}`;
      }
    }
  };

  // 確保 DOM 已加載
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
