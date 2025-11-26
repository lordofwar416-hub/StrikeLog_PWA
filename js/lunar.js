// File: js/lunar.js
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/*
  StrikeLog Lunar Engine
  ----------------------
  Provides:
    • illumination (%) 
    • phase angle (°)
    • age (days)
    • phase index (0–7)
    • phase name (string)
    • phase icon (Unicode)
*/

window.SL_LunarCalc = {

  /* ---------------------------------------------------
     PUBLIC API
     compute(date)
  --------------------------------------------------- */
  compute(date = new Date()) {
    const jd = this._julian(date);
    const t = (jd - 2451545.0) / 36525.0;

    // Moon mean longitude
    const L = this._normalize(218.3164477 + 481267.88123421 * t);

    // Moon mean elongation
    const D = this._normalize(297.8501921 + 445267.1114034 * t);

    // Sun mean anomaly
    const M = this._normalize(357.5291092 + 35999.0502909 * t);

    // Moon mean anomaly
    const Mprime = this._normalize(134.9633964 + 477198.8675055 * t);

    // Phase angle
    const phaseAngle =
      180 - D - 6.289 * Math.sin(this._rad(Mprime)) +
      2.1 * Math.sin(this._rad(M)) -
      1.274 * Math.sin(this._rad(2 * D - Mprime)) -
      0.658 * Math.sin(this._rad(2 * D)) -
      0.214 * Math.sin(this._rad(2 * Mprime)) -
      0.11 * Math.sin(this._rad(D));

    // Illumination (fraction → %)
    const illum = (1 + Math.cos(this._rad(phaseAngle))) / 2;
    const illuminationPct = +(illum * 100).toFixed(1);

    // Age (0–29.53 days)
    const age = this._moonAge(jd);

    const phaseIndex = this._phaseIndex(age);
    const phaseName = this._phaseName(phaseIndex);
    const phaseIcon = this._phaseIcon(phaseIndex);

    return {
      illumination: illuminationPct,
      phase_angle: +phaseAngle.toFixed(1),
      age: +age.toFixed(2),
      phase_index: phaseIndex,
      phase_name: phaseName,
      icon: phaseIcon
    };
  },

  /* ---------------------------------------------------
     UI Helper
  --------------------------------------------------- */
  getPhaseIcon() {
    const now = this.compute(new Date());
    return now.icon;
  },

  getPhaseName() {
    return this.compute(new Date()).phase_name;
  },

  /* ---------------------------------------------------
     JULIAN DATE
  --------------------------------------------------- */
  _julian(date) {
    return date / 86400000 + 2440587.5;
  },

  /* ---------------------------------------------------
     MOON AGE (approx)
  --------------------------------------------------- */
  _moonAge(jd) {
    const T = (jd - 2451550.1) / 29.530588853;
    return (T - Math.floor(T)) * 29.530588853;
  },

  /* ---------------------------------------------------
     PHASE INDEX (0–7)
     0 = New Moon
     4 = Full Moon
  --------------------------------------------------- */
  _phaseIndex(age) {
    const synodic = 29.530588853;
    const eighth = synodic / 8;

    if (age < eighth) return 0;              // New Moon
    if (age < 2 * eighth) return 1;          // Waxing Crescent
    if (age < 3 * eighth) return 2;          // First Quarter
    if (age < 4 * eighth) return 3;          // Waxing Gibbous
    if (age < 5 * eighth) return 4;          // Full Moon
    if (age < 6 * eighth) return 5;          // Waning Gibbous
    if (age < 7 * eighth) return 6;          // Last Quarter
    return 7;                                // Waning Crescent
  },

  /* ---------------------------------------------------
     PHASE NAME
  --------------------------------------------------- */
  _phaseName(idx) {
    return [
      "New Moon",
      "Waxing Crescent",
      "First Quarter",
      "Waxing Gibbous",
      "Full Moon",
      "Waning Gibbous",
      "Last Quarter",
      "Waning Crescent"
    ][idx];
  },

  /* ---------------------------------------------------
     PHASE ICON (Unicode)
     Works perfectly on Android
  --------------------------------------------------- */
  _phaseIcon(idx) {
    return [
      "🌑", // New
      "🌒", // Waxing Crescent
      "🌓", // First Quarter
      "🌔", // Waxing Gibbous
      "🌕", // Full
      "🌖", // Waning Gibbous
      "🌗", // Last Quarter
      "🌘"  // Waning Crescent
    ][idx];
  },

  /* ---------------------------------------------------
     HELPERS
  --------------------------------------------------- */
  _rad(d) { return d * Math.PI / 180; },

  _normalize(v) {
    v = v % 360;
    return v < 0 ? v + 360 : v;
  }
};

console.log("[StrikeLog] Lunar engine loaded.");
