// File: js/ui.js
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/* ---------------------------------------------------
   STRIKELOG — UI MODULE (Presentation Only)
   This file contains:
   • Sheet animations
   • Small rendering helpers
   • View management
   • DOM transitions
   • Non-logic UI effects
   (All heavy logic stays in app.js)
--------------------------------------------------- */

const SLUI = window.SLUI || {};   // Extend existing SLUI from app.js


/* ---------------------------------------------------
   SIMPLE VIEW SWITCHER (Optional enhancement)
--------------------------------------------------- */
SLUI.showView = function(viewId) {
  document.querySelectorAll(".sl-view").forEach(v => v.classList.remove("sl-view-active"));
  document.getElementById(viewId).classList.add("sl-view-active");
};


/* ---------------------------------------------------
   MODAL SHEET ANIMATION HELPERS
--------------------------------------------------- */
SLUI.openSheet = function(sheetId, backdropId) {
  document.getElementById(backdropId).classList.remove("sl-hidden");
  const sheet = document.getElementById(sheetId);
  sheet.classList.remove("sl-hidden");

  // small pop effect
  sheet.style.transform = "translateY(100%)";
  requestAnimationFrame(() => {
    sheet.style.transition = "transform 0.25s ease-out";
    sheet.style.transform = "translateY(0)";
  });
};

SLUI.closeSheet = function(sheetId, backdropId) {
  const sheet = document.getElementById(sheetId);

  sheet.style.transform = "translateY(100%)";
  sheet.style.transition = "transform 0.20s ease-in";

  setTimeout(() => {
    sheet.classList.add("sl-hidden");
    document.getElementById(backdropId).classList.add("sl-hidden");
  }, 200);
};


/* ---------------------------------------------------
   STRIKE SHEET OPEN/CLOSE SHORTHANDS
--------------------------------------------------- */
SLUI.openStrikeSheet = function() {
  SLUI.openSheet("strikeSheet", "strikeSheetBackdrop");
};

SLUI.closeStrikeSheet = function() {
  SLUI.closeSheet("strikeSheet", "strikeSheetBackdrop");
};


/* ---------------------------------------------------
   TOAST (already in app.js, but extend if needed)
--------------------------------------------------- */
SLUI.toast = SLUI.toast || function(msg) {
  const t = document.getElementById("toast");
  const lbl = document.getElementById("toastMessage");
  lbl.textContent = msg;

  t.classList.remove("sl-hidden");
  setTimeout(() => t.classList.add("sl-hidden"), 2000);
};


/* ---------------------------------------------------
   UPDATE STRIKE ENV BLOCK (delegates to app.js)
--------------------------------------------------- */
SLUI.updateStrikeEnvUI = SLUI.updateStrikeEnvUI || function() {
  // Overridden in app.js where data exists
};


/* ---------------------------------------------------
   RENDER STRIKE LIST
--------------------------------------------------- */
SLUI.renderStrikeList = SLUI.renderStrikeList || function() {
  /* actual implementation in app.js */
};


/* ---------------------------------------------------
   PHOTO PREVIEW HANDLING
--------------------------------------------------- */
document.addEventListener("change", e => {
  if (e.target.id === "strikePhoto") {
    const input = e.target;
    const previewBox = document.getElementById("strikePhotoPreview");
    const imgEl = document.getElementById("strikePhotoImg");

    if (!input.files || input.files.length === 0) {
      previewBox.classList.add("sl-hidden");
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = ev => {
      imgEl.src = ev.target.result;
      previewBox.classList.remove("sl-hidden");
    };

    reader.readAsDataURL(file);
  }
});


/* ---------------------------------------------------
   WEATHER UPDATE VISUAL FEEDBACK
--------------------------------------------------- */
SLUI.updateMissionWeatherUI = SLUI.updateMissionWeatherUI || function(env) {
  /* Implementation lives in app.js (env block) */
};


/* ---------------------------------------------------
   SPOTS UI RENDERING
--------------------------------------------------- */
SLUI.renderSpots = SLUI.renderSpots || function() {
  /* actual implementation sits in app.js */
};


/* ---------------------------------------------------
   SCROLL TO TOP ANIMATION
--------------------------------------------------- */
SLUI.scrollTop = function() {
  window.scrollTo({ top: 0, behavior: "smooth" });
};


/* ---------------------------------------------------
   TAB BAR VISUAL SYNC (optional aesthetic)
--------------------------------------------------- */
SLUI.activateTab = function(tabId) {
  document.querySelectorAll(".sl-tab").forEach(t => t.classList.remove("sl-tab-active"));
  document.getElementById(tabId).classList.add("sl-tab-active");
};


/* ---------------------------------------------------
   MAP INITIALIZATION WRAPPER
--------------------------------------------------- */
SLUI.initMap = SLUI.initMap || function() {
  // Placeholder only — actual logic in app.js
};


/* ---------------------------------------------------
   END OF UI MODULE
--------------------------------------------------- */
console.log("[StrikeLog] UI module loaded.");
