// File: js/env.js
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/*
  StrikeLog Environmental Engine
  ------------------------------
  Provides:
    • Wind direction → cardinal (8p + 16p)
    • Beaufort scale
    • Sea state category
    • Water clarity category
    • Pressure trend scoring
    • Weather quality scoring
    • Sunrise / sunset
    • Tide / current estimator (fallback)
*/

window.SL_ENV = {

  /* ---------------------------------------------------
     WIND → CARDINAL (16-point)
     Input: degrees
  --------------------------------------------------- */
  cardinal16(deg) {
    if (deg == null) return "–";

    const dirs = [
      "N", "NNE", "NE", "ENE",
      "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW",
      "W", "WNW", "NW", "NNW"
    ];

    return dirs[Math.round(deg / 22.5) % 16];
  },

  /* ---------------------------------------------------
     WIND → CARDINAL (8-point)
  --------------------------------------------------- */
  cardinal8(deg) {
    if (deg == null) return "–";

    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round(deg / 45) % 8];
  },

  /* ---------------------------------------------------
     KMH → BEAUFORT
     Input: km/h
     Output: 0–12
  --------------------------------------------------- */
  beaufort(kmh) {
    if (kmh == null) return null;

    const val = kmh;
    if (val <= 1) return 0;
    if (val <= 5) return 1;
    if (val <= 11) return 2;
    if (val <= 19) return 3;
    if (val <= 28) return 4;
    if (val <= 38) return 5;
    if (val <= 49) return 6;
    if (val <= 61) return 7;
    if (val <= 74) return 8;
    if (val <= 88) return 9;
    if (val <= 102) return 10;
    if (val <= 117) return 11;
    return 12;
  },

  /* ---------------------------------------------------
     SEA STATE CLASSIFICATION
     based on wave height (m)
  --------------------------------------------------- */
  seaState(wave_m) {
    if (wave_m == null) return "unknown";

    if (wave_m < 0.2) return "glassy";
    if (wave_m < 0.5) return "calm";
    if (wave_m < 1.0) return "light chop";
    if (wave_m < 1.8) return "choppy";
    if (wave_m < 2.5) return "rough";
    if (wave_m < 4.0) return "very rough";
    return "violent seas";
  },

  /* ---------------------------------------------------
     WATER CLARITY
     based on qualitative input:
     (clear / semi-clear / semi-turbid / turbid)
  --------------------------------------------------- */
  clarityScore(str) {
    if (!str) return 0;

    switch (str.toLowerCase()) {
      case "clear": return 3;
      case "semi-clear": return 2;
      case "semi-turbid": return 1;
      case "turbid": return 0;
      default: return 0;
    }
  },

  /* ---------------------------------------------------
     PRESSURE TREND EVALUATOR
  --------------------------------------------------- */
  pressureTrend(prev, curr) {
    if (prev == null || curr == null) return "unknown";

    const diff = curr - prev;
    if (diff > 1.5) return "rising fast";
    if (diff > 0.3) return "rising";
    if (diff > -0.3) return "steady";
    if (diff > -1.5) return "falling";
    return "falling fast";
  },

  /* ---------------------------------------------------
     WEATHER QUALITY SCORE (0–10)
     For Fishing Advisor weighting
  --------------------------------------------------- */
  weatherScore(env) {
    if (!env) return 0;

    let score = 5; // baseline

    // Moderate wind good for predators
    if (env.wind_speed) {
      if (env.wind_speed >= 10 && env.wind_speed <= 25) score += 2;
      if (env.wind_speed < 5) score -= 1;      // too calm
      if (env.wind_speed > 35) score -= 2;     // too rough
    }

    // Clarity: clear is usually better at night, worse in daytime
    if (env.clarity) {
      score += this.clarityScore(env.clarity) - 1;
    }

    // Pressure: stable/rising is good, falling is bad
    if (env.pressure_trend) {
      if (env.pressure_trend.includes("rising")) score += 1;
      if (env.pressure_trend.includes("falling")) score -= 1;
    }

    // Wave height: slight chop = good
    if (env.wave_height != null) {
      if (env.wave_height >= 0.2 && env.wave_height <= 1.0) score += 1;
      if (env.wave_height > 2.5) score -= 2;
    }

    // Clamp
    return Math.max(0, Math.min(10, score));
  },

  /* ---------------------------------------------------
     SUNRISE / SUNSET (NO API)
     Accurate to ~1–2 minutes (sufficient)
  --------------------------------------------------- */
  sunTimes(lat, lon, date = new Date()) {
    // Basic NOAA approximation

    const rad = Math.PI / 180;
    const J1970 = 2440587.5;
    const J2000 = 2451545;
    const dayMs = 86400000;

    const toJulian = d => d / dayMs + J1970;

    const jd = toJulian(date);
    const n = Math.round(jd - J2000 - 0.0009 - lon / 360);

    const Jstar = J2000 + (n + lon / 360);
    const M = (357.5291 + 0.98560028 * (Jstar - J2000)) * rad;
    const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;

    const lambda = (M + C + 102.9372 * rad + Math.PI) % (2 * Math.PI);

    const Jtransit = Jstar + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lambda);
    const delta = Math.asin(Math.sin(lambda) * Math.sin(23.44 * rad));

    const h = -0.83 * rad; // refraction

    const omega = Math.acos(
      (Math.sin(h) - Math.sin(lat * rad) * Math.sin(delta)) /
      (Math.cos(lat * rad) * Math.cos(delta))
    );

    const Jset = Jtransit + omega / (2 * Math.PI);
    const Jrise = Jtransit - omega / (2 * Math.PI);

    return {
      sunrise: new Date((Jrise - J1970) * dayMs),
      sunset: new Date((Jset - J1970) * dayMs)
    };
  },

  /* ---------------------------------------------------
     TIDE/CURRENT ESTIMATOR (fallback only)
     NOT for navigation — only for Advisor weighting
     Uses lunar age + sunrise/sunset offset
  --------------------------------------------------- */
  tideTrend(lunarAge) {
    // 2 peaks + 2 lows daily → simplified
    const mod = lunarAge % 6.21;

    if (mod < 1.5) return "rising";
    if (mod < 3.1) return "high";
    if (mod < 4.6) return "falling";

    return "low";
  }
};

console.log("[StrikeLog] Environmental engine loaded.");
