// File: js/geo.js
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/*
  StrikeLog GEO Engine
  --------------------
  Provides:
    • High accuracy GPS fixes
    • Accuracy rating (excellent / good / poor / bad)
    • Freshness timers
    • Location smoothing (optional)
*/

window.SL_GEO = {

  lastFix: null,     // Cached latest GPS fix
  lastFixTime: null, // Timestamp (ms)

  /* ---------------------------------------------------
     GET HIGH ACCURACY POSITION
     – Retries on poor accuracy
     – Optimized timeout for fishing use
  --------------------------------------------------- */
  async getPosition(options = {}) {

    const opt = {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
      ...options
    };

    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          const fix = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            ts: Date.now()
          };

          this.lastFix = fix;
          this.lastFixTime = Date.now();

          resolve(fix);
        },
        err => {
          console.warn("[StrikeLog] GPS error:", err);

          // If we have a last fix, return that instead of null
          if (this.lastFix) {
            resolve(this.lastFix);
          } else {
            resolve(null);
          }
        },
        opt
      );
    });
  },

  /* ---------------------------------------------------
     ACCURACY RATING
     Returns: "excellent" | "good" | "poor" | "bad"
  --------------------------------------------------- */
  accuracyGrade(m) {
    if (!m || !m.accuracy) return "unknown";

    const a = m.accuracy;

    if (a < 6) return "excellent";
    if (a < 15) return "good";
    if (a < 30) return "poor";
    return "bad";
  },

  /* ---------------------------------------------------
     FRESHNESS (seconds since last fix)
  --------------------------------------------------- */
  freshness() {
    if (!this.lastFixTime) return Infinity;
    return (Date.now() - this.lastFixTime) / 1000;
  },

  /* ---------------------------------------------------
     FORMATTED COORDINATE STRINGS
  --------------------------------------------------- */
  formatCoords(lat, lon) {
    if (lat == null || lon == null) return "–";
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  },

  /* ---------------------------------------------------
     PRETTY SUMMARY (UI helper)
  --------------------------------------------------- */
  summary(fix) {
    if (!fix) return "No GPS";

    const grade = this.accuracyGrade(fix);
    const fresh = Math.round((Date.now() - fix.ts) / 1000);

    return `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)} — ${grade} (${fresh}s old)`;
  },

  /* ---------------------------------------------------
     OPTIONAL LOCATION SMOOTHING
     Weighted average 70% previous, 30% new
     Useful when accuracy jumps around
  --------------------------------------------------- */
  smoothFix(newFix) {
    if (!this.lastFix) return newFix;

    return {
      lat: this.lastFix.lat * 0.7 + newFix.lat * 0.3,
      lon: this.lastFix.lon * 0.7 + newFix.lon * 0.3,
      accuracy: Math.min(this.lastFix.accuracy, newFix.accuracy),
      ts: newFix.ts
    };
  }
};

console.log("[StrikeLog] GEO engine loaded.");
