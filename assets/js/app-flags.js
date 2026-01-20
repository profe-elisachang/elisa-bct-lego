// Global feature flags for the frontend (teacher-controlled toggles).
// Set these before nav/loader/review scripts run.
(function () {
  'use strict';

  // Hide Group/Cohort UI across desktop + mobile.
  // When false, the app will still use cohort internally (defaulting to taigen-a),
  // but users won't be able to switch cohorts from the UI.
  window.BCT_ENABLE_GROUP_UI = false;
})();


