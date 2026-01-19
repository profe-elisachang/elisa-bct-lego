(function () {
  const STORAGE_KEYS = {
    CLASS: 'bct-active-class',
    COHORT: 'bct-cohort'
  };

  const getParam = (key) => new URLSearchParams(window.location.search).get(key);
  const getCurrentLevel = () => getParam('level') || localStorage.getItem(STORAGE_KEYS.CLASS) || 'btc1';
  const getCurrentCohort = () => getParam('cohort') || localStorage.getItem(STORAGE_KEYS.COHORT) || 'taigen-a';
  const setCurrentLevel = (value) => localStorage.setItem(STORAGE_KEYS.CLASS, value);
  const setCurrentCohort = (value) => localStorage.setItem(STORAGE_KEYS.COHORT, value);
  const getLessonParam = () => getParam('lesson') || 'L1';

  const mobileNav = document.querySelector('.mobile-nav');
  const dropdowns = mobileNav ? mobileNav.querySelectorAll('.m-dropdown') : [];
  const dropButtons = mobileNav ? mobileNav.querySelectorAll('.m-dropbtn') : [];
  const courseButtons = mobileNav ? mobileNav.querySelectorAll('.m-course-option') : [];
  const groupButtons = mobileNav ? mobileNav.querySelectorAll('.m-group-option') : [];
  const reviewLink = mobileNav ? mobileNav.querySelector('#mobile-review-link') : null;
  const homeLink = mobileNav ? mobileNav.querySelector('#mobile-home-link') : null;
  const backToTopBtn = document.querySelector('.back-to-top');

  const updateLinks = () => {
    const level = getCurrentLevel();
    const cohort = getCurrentCohort();
    const lesson = getLessonParam();
    if (reviewLink) {
      reviewLink.href = `bct-review.html?level=${encodeURIComponent(level)}&cohort=${encodeURIComponent(cohort)}`;
    }
    if (homeLink) {
      homeLink.href = `index.html?cohort=${encodeURIComponent(cohort)}`;
    }
    courseButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.level === level);
    });
    groupButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.cohort === cohort);
    });
  };

  const navigateToCourse = (levelId) => {
    if (!levelId) return;
    const cohort = getCurrentCohort();
    const lesson = getLessonParam();
    setCurrentLevel(levelId);
    window.location.href = `lesson-template-b.html?level=${encodeURIComponent(levelId)}&lesson=${encodeURIComponent(lesson)}&cohort=${encodeURIComponent(cohort)}`;
  };

  const switchGroup = (cohortId) => {
    if (!cohortId) return;
    const level = getCurrentLevel();
    const lesson = getLessonParam();
    setCurrentCohort(cohortId);
    window.location.href = `lesson-template-b.html?level=${encodeURIComponent(level)}&lesson=${encodeURIComponent(lesson)}&cohort=${encodeURIComponent(cohortId)}`;
  };

  const closeDropdowns = () => {
    dropdowns.forEach((dropdown) => {
      dropdown.classList.remove('open');
      const btn = dropdown.querySelector('.m-dropbtn');
      btn?.setAttribute('aria-expanded', 'false');
    });
  };

  const toggleDropdown = (dropdown) => {
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('open');
    closeDropdowns();
    if (!isOpen) {
      dropdown.classList.add('open');
      const btn = dropdown.querySelector('.m-dropbtn');
      btn?.setAttribute('aria-expanded', 'true');
    }
  };

  const handleDocumentClick = (event) => {
    if (![...dropdowns].some((dropdown) => dropdown.contains(event.target))) {
      closeDropdowns();
    }
  };

  const handleScroll = () => {
    if (!backToTopBtn) return;
    if (window.scrollY > 220) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  };

  const init = () => {
    updateLinks();
    handleScroll();
    dropButtons.forEach((button) => {
      const dropdown = button.closest('.m-dropdown');
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDropdown(dropdown);
      });
    });
    courseButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        closeDropdowns();
        navigateToCourse(button.dataset.level);
      });
    });
    groupButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        closeDropdowns();
        switchGroup(button.dataset.cohort);
      });
    });
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') {
        closeDropdowns();
      }
    });
    window.addEventListener('scroll', handleScroll);
    backToTopBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

