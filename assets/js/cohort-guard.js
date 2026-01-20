// Cohort Guard: enforce active cohorts (active/frozen) on the frontend.
// - Reads requested cohort from URL/localStorage
// - Checks Firestore: cohorts/{cohortId}.status
// - If not active, force fallback to taigen-a
// - Writes back to localStorage and URL (replaceState)
//
// Exposes:
// - window.BCT_ACTIVE_COHORT
// - window.BCT_ALLOWED_COHORTS (active-only)
// - window.__cohortGuardReady (Promise)
(function () {
  'use strict';

  const DEFAULT_COHORT = 'taigen-a';
  const STORAGE_KEY = 'bct-cohort';

  const firebaseConfig = {
    apiKey: "AIzaSyBIJ0YDcX438Tq0G05qpvIANiolTrNM8Ds",
    authDomain: "bct-lego.firebaseapp.com",
    projectId: "bct-lego",
    storageBucket: "bct-lego.firebasestorage.app",
    messagingSenderId: "205694748282",
    appId: "1:205694748282:web:9a8e9a196b2d1829bdddc3",
    measurementId: "G-1CBF9H64WN"
  };

  const getParam = (key) => new URLSearchParams(window.location.search).get(key);

  const getRequestedCohort = () => {
    return getParam('cohort') || localStorage.getItem(STORAGE_KEY) || DEFAULT_COHORT;
  };

  const setCohortInUrl = (cohortId) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('cohort', cohortId);
      // Preserve other params; avoid navigation/reload.
      window.history.replaceState({}, '', url.toString());
    } catch (_) {
      // Ignore (older browsers / file:// edge cases)
    }
  };

  const initFirebaseIfNeeded = () => {
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK not loaded (firebase is undefined)');
    }
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
    return firebase.firestore();
  };

  window.__cohortGuardReady = (async () => {
    let enforced = DEFAULT_COHORT;
    let allowed = [DEFAULT_COHORT];

    try {
      const requested = getRequestedCohort();
      const db = initFirebaseIfNeeded();

      // Fetch all cohorts so UI can hide frozen cohorts if needed.
      const cohortSnap = await db.collection('cohorts').get();
      const activeIds = [];
      cohortSnap.forEach((doc) => {
        const data = doc.data() || {};
        if (data.status === 'active') activeIds.push(doc.id);
      });
      allowed = activeIds.length ? activeIds : [DEFAULT_COHORT];

      // Determine enforced cohort (requested must be active)
      if (allowed.includes(requested)) {
        enforced = requested;
      } else {
        enforced = allowed.includes(DEFAULT_COHORT) ? DEFAULT_COHORT : allowed[0];
        console.warn(`[cohort-guard] Cohort "${requested}" is not active; fallback to "${enforced}".`);
      }
    } catch (err) {
      // Fail-safe: force default
      enforced = DEFAULT_COHORT;
      allowed = [DEFAULT_COHORT];
      console.warn('[cohort-guard] Failed to validate cohort; fallback to taigen-a.', err);
    }

    // Persist enforcement
    localStorage.setItem(STORAGE_KEY, enforced);
    if (getParam('cohort') !== enforced) setCohortInUrl(enforced);

    window.BCT_ALLOWED_COHORTS = allowed;
    window.BCT_ACTIVE_COHORT = enforced;
    return { enforcedCohort: enforced, allowedCohorts: allowed };
  })();
})();


