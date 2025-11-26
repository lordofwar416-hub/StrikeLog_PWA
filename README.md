// File: README.md
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

# 🎣 StrikeLog — Smart Fishing Strike Recorder (PWA)

StrikeLog is a lightweight **Progressive Web App (PWA)** designed for **fast, real-time fishing strike logging** with deep telemetry:

- Instant strike button (FAB)
- Auto GPS snapshot
- Auto weather + marine conditions
- Auto lunar phase + illumination
- Manual species + lure inputs
- Mission-based logging (start → strike list → export)
- Spot management (lat/lon + depth + weather)
- Offline-ready with service worker
- ZIP, JSON, CSV export formats

StrikeLog is optimized for **Android phones** and will run 100% offline once installed.

---

## 📦 Project Structure

```
StrikeLog_PWA/
│
├── index.html
├── manifest.json
├── service-worker.js
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   ├── ui.js
│   ├── env.js
│   ├── geo.js
│   └── lunar.js
│
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🚀 Installation (Android)

### 1. Upload to any static hosting:
- GitHub Pages  
- Netlify  
- Vercel  
- Local server  
- Even a USB stick + file:// path (development)

### 2. Visit the site in Chrome (Android)

You will see:
```
Install StrikeLog
```

Or open Chrome settings → **Add to Home Screen**.

### 3. StrikeLog becomes a full app:
- Own icon  
- Own splash screen  
- Runs fullscreen  
- Works offline  
- GPS access enabled  
- Stores logs locally  

---

## 🧠 Core Concepts

### ✔ Mission
A fishing session with:
- Name  
- Technique  
- Gear (rod/reel/line)  
- Spot  
- Conditions  
- Start / End time  
- Weather + tide + clarity  
- Notes  

### ✔ Strike Snapshot (v2.5)
Each strike stores:

```
timestamp
gps = { lat, lon, accuracy }
env = { wind, waves, pressure, clouds, airTemp, waterTemp, trend }
lunar = { illumination, phase_angle, age, phase_name, icon }
species
size_cm
weight_g
lure
released
retrieve_technique
retrieve_speed
strike_depth
strike_type
notes
photo (base64)
advisor_context (for the Fishing Advisor integration)
```

StrikeLog records:
- **GPS + weather + lunar at the exact strike moment**  
- Fully compatible with the Fishing Advisor ecosystem  

---

## 🌙 Lunar Engine

`lunar.js` computes:
- Illumination %  
- Phase angle  
- Age  
- 8-phase name (waxing/waning)  
- Unicode icon (🌑→🌘)

Displayed inside Mission tab via the Moon Phase card.

---

## 🌊 Weather Engine

StrikeLog uses:
**Open-Meteo Marine API**

Parameters:
- wind_speed  
- wind_direction  
- air_temp  
- sea_surface_temperature  
- pressure_msl  
- wave_height  
- cloudcover  

Fallback classification:
- Beaufort  
- Sea state  
- Pressure trend  
- Weather score  

---

## 📍 GEO Engine

`geo.js` provides:
- High-accuracy GPS fixes  
- Accuracy grade (excellent/good/poor/bad)  
- Freshness check  
- Smoothing filter  
- UI-formatted output  

---

## 🧭 Spot Manager

Each spot stores:
```
name
lat
lon
depth
bottom_type
weather (cached)
last_update
```

Bulk features:
- Auto-fill from current GPS  
- Weather update for all spots  
- Export / Import JSON  
- Full integration with missions  

---

## 📁 Export Formats

### ✔ JSON  
Full mission dump (`mission + strikes`)

### ✔ CSV  
Tabular output for Excel/Sheets

### ✔ ZIP Bundle  
```
mission.json
strikes.json
photos/*.jpg
```

---

## 🔧 Development

To run locally:

```
python -m http.server
```

Then open:
```
http://localhost:8000
```

For Android install, you **must** run via HTTP/S, not file://.

---

## 🔒 Privacy & Storage

All data is stored **locally**:
- `localStorage` for missions  
- Cached weather  
- Spots  
- Photos inside ZIP export only  

No cloud sync.

---

## 🏁 Version

**StrikeLog PWA v1.0 — Initial complete release**  
Matches Catch Snapshot v2.5 and Fishing Advisor Phase 1 specs.

---

## 👤 Author & Credits

Built for **Fishing Advisor Project** (LordOfWar Labs — Greece).  
Design optimized for real-world shore fishing, eging, spinning, and jigging.

```
© 2025 StrikeLog / LordOfWar Labs — Internal Use Only
```
