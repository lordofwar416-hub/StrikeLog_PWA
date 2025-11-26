// File: js/app.js
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/* ---------------------------------------------------
   STRIKELOG — CORE ENGINE
   Handles:
   • Routing between tabs
   • Mission lifecycle (start / end)
   • Environment + lunar updates at strike time
   • Global app state
   • FAB behavior
--------------------------------------------------- */

const SL = {
  mission: null,            // Active mission object
  missionStartTime: null,
  missionTimerInterval: null,
  strikes: [],              // Current mission strikes
  spots: [],                // Smart Spots DB
  lastWeatherFetch: null,   // Timestamp of last weather update
  lastWeatherData: null,    // Cached full weather snapshot
  currentView: "missionView",

  // On strike → snapshot momentary data:
  strikeEnvCache: null,
  strikeLunarCache: null,
  strikeGPSCache: null,
};

// Wait for DOM ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("[StrikeLog] App initialized");

  // Restore saved spots
  SL.spots = SLStorage.loadSpots();
  SLUI.renderSpots();

  // Restore possible unfinished mission
  SLStorage.loadMissionState();

  SLApp.initRouter();
  SLApp.initButtons();
  SLApp.initStrikeButton();
});

/* ---------------------------------------------------
   ROUTER
--------------------------------------------------- */
const SLApp = {

  initRouter() {
    const tabs = document.querySelectorAll(".sl-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const view = tab.dataset.view;
        SLApp.switchView(view);

        tabs.forEach(t => t.classList.remove("sl-tab-active"));
        tab.classList.add("sl-tab-active");
      });
    });
  },

  switchView(viewId) {
    document.querySelectorAll(".sl-view").forEach(v => v.classList.remove("sl-view-active"));
    document.getElementById(viewId).classList.add("sl-view-active");

    SL.currentView = viewId;

    // If entering map view → initialize map
    if (viewId === "mapView") {
      SLUI.initMap();
    }
  },

  /* ---------------------------------------------------
     BUTTONS & INTERACTIONS
  --------------------------------------------------- */
  initButtons() {

    // Mission control
    document.getElementById("btnStartMission")
      .addEventListener("click", SLApp.startMission);

    document.getElementById("btnEndMission")
      .addEventListener("click", SLApp.endMission);

    // Fetch weather from API
    document.getElementById("btnFetchConditions")
      .addEventListener("click", SLEnv.fetchWeatherForMissionSpot);

    // Quick export
    document.getElementById("btnQuickExport")
      .addEventListener("click", SLStorage.quickExport);

    // Strike Sheet actions
    document.getElementById("btnCloseStrikeSheet")
      .addEventListener("click", SLUI.closeStrikeSheet);

    document.getElementById("btnCancelStrike")
      .addEventListener("click", SLUI.closeStrikeSheet);

    document.getElementById("btnSaveStrike")
      .addEventListener("click", SLApp.saveStrike);

    document.getElementById("btnRefreshStrikeEnv")
      .addEventListener("click", async () => {
        await SLApp.refreshStrikeEnvironment(true);
      });

    // Spot management buttons
    document.getElementById("btnAddSpot")
      .addEventListener("click", SLApp.addSpot);

    document.getElementById("btnUseCurrentLocationForSpot")
      .addEventListener("click", async () => {
        const pos = await SLGeo.getGPS();
        if (pos) {
          document.getElementById("spotLat").value = pos.lat;
          document.getElementById("spotLon").value = pos.lon;
        }
      });

    document.getElementById("btnExportSpots")
      .addEventListener("click", SLStorage.exportSpots);

    document.getElementById("btnImportSpots")
      .addEventListener("click", SLStorage.importSpots);

    document.getElementById("btnUpdateAllSpotsWeather")
      .addEventListener("click", SLApp.updateWeatherForAllSpots);
  },

  /* ---------------------------------------------------
     STRIKE BUTTON (FAB)
  --------------------------------------------------- */
  initStrikeButton() {
    document.getElementById("strikeFab")
      .addEventListener("click", async () => {

        if (!SL.mission) {
          SLUI.toast("Start a mission first");
          return;
        }

        // Snapshot actual conditions at this exact moment
        await SLApp.refreshStrikeEnvironment(false);

        // Open strike sheet
        SLUI.openStrikeSheet();
      });
  },

  /* ---------------------------------------------------
     MISSION START
  --------------------------------------------------- */
  async startMission() {

    // Validate minimum fields
    const name = document.getElementById("missionName").value.trim();
    const technique = document.getElementById("missionTechnique").value.trim();

    if (!name || !technique) {
      SLUI.toast("Please set mission name and technique");
      return;
    }

    // GPS fix at mission start
    const gps = await SLGeo.getGPS();

    SL.missionStartTime = Date.now();

    SL.mission = {
      id: crypto.randomUUID(),
      name,
      technique,
      start_time: SL.missionStartTime,
      start_location: gps || null,
      gear: {
        rod: document.getElementById("missionRod").value,
        reel: document.getElementById("missionReel").value,
        line: document.getElementById("missionLine").value
      },
      spot: document.getElementById("missionSpot").value || null,
      conditions: SLApp.getMissionConditions(),
      notes: document.getElementById("missionNotes").value.trim() || "",
    };

    SL.strikes = [];

    SLUI.updateMissionUI("active");
    SLStorage.saveMissionState();

    SLApp.startMissionTimer();

    SLUI.toast("Mission started");
  },

  getMissionConditions() {
    return {
      sea_state: document.getElementById("missionSeaState").value || null,
      clarity: document.getElementById("missionClarity").value || null,
      depth: Number(document.getElementById("missionDepth").value || 0),
      bottom_type: document.getElementById("missionBottomType").value || null,
      baitfish: document.getElementById("missionBaitfish").value || null,
      light: document.getElementById("missionLight").value || null,
      tide: document.getElementById("missionTide").value || null,
    };
  },

  /* ---------------------------------------------------
     MISSION END
  --------------------------------------------------- */
  async endMission() {
    if (!SL.mission) return;

    // GPS fix at mission end
    const gps = await SLGeo.getGPS();
    SL.mission.end_location = gps || null;

    SL.mission.end_time = Date.now();

    clearInterval(SL.missionTimerInterval);

    SLUI.updateMissionUI("idle");

    SLStorage.exportBundle();  // auto-export full mission bundle

    // Clear state
    SL.mission = null;
    SL.strikes = [];
    SLStorage.saveMissionState();

    SLUI.toast("Mission ended & exported");
  },

  /* ---------------------------------------------------
     MISSION TIMER
  --------------------------------------------------- */
  startMissionTimer() {
    SL.missionTimerInterval = setInterval(() => {
      if (!SL.missionStartTime) return;
      const elapsed = Date.now() - SL.missionStartTime;

      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);

      const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      document.getElementById("missionDurationLabel").textContent = label;
    }, 1000);
  },

  /* ---------------------------------------------------
     STRIKE ENVIRONMENT SNAPSHOT
     Fetches:
     • GPS
     • Weather
     • Lunar
  --------------------------------------------------- */
  async refreshStrikeEnvironment(showToast) {
    SLUI.toast("Updating environment…");

    const [gps, env] = await Promise.all([
      SLGeo.getGPS(),
      SLEnv.fetchRealtimeWeather()
    ]);

    SL.strikeGPSCache = gps;
    SL.strikeEnvCache = env;
    SL.strikeLunarCache = SLLunar.computeNow();

    // Update preview in strike sheet UI (if open)
    SLUI.updateStrikeEnvUI();

    if (showToast) {
      SLUI.toast("Environment updated");
    }
  },

  /* ---------------------------------------------------
     SAVE STRIKE
  --------------------------------------------------- */
  saveStrike() {
    if (!SL.mission) return;

    const strike = SLApp.buildStrikeObject();
    SL.strikes.push(strike);

    SLStorage.saveMissionState();
    SLUI.renderStrikeList();
    SLUI.closeStrikeSheet();

    SLUI.toast("Strike saved");
  },

  buildStrikeObject() {
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),

      species: document.getElementById("strikeSpecies").value.trim() || null,
      size_cm: Number(document.getElementById("strikeSize").value || 0),
      weight_g: Number(document.getElementById("strikeWeight").value || 0),
      lure: document.getElementById("strikeLure").value.trim() || null,
      released: document.getElementById("strikeReleased").value || null,

      dynamics: {
        retrieve_technique: document.getElementById("strikeRetrieveTechnique").value || null,
        retrieve_speed: document.getElementById("strikeRetrieveSpeed").value || null,
        strike_depth: document.getElementById("strikeDepthCategory").value || null,
        strike_type: document.getElementById("strikeType").value || null,
      },

      notes: document.getElementById("strikeNotes").value.trim() || null,

      photo: SLUI.getStrikePhotoBase64(),

      gps: SL.strikeGPSCache || null,
      env: SL.strikeEnvCache || null,
      lunar: SL.strikeLunarCache || null,

      advisor_context: SLApp.buildAdvisorContext()
    };
  },

  buildAdvisorContext() {
    const m = SL.mission;

    return {
      mission_id: m.id,
      technique: m.technique,
      gear: m.gear,
      spot: m.spot,
      conditions: m.conditions,
    };
  },

  /* ---------------------------------------------------
     SPOTS
  --------------------------------------------------- */
  addSpot() {
    const name = document.getElementById("spotName").value.trim();
    const lat = parseFloat(document.getElementById("spotLat").value);
    const lon = parseFloat(document.getElementById("spotLon").value);

    if (!name || isNaN(lat) || isNaN(lon)) {
      SLUI.toast("Name & coordinates are required");
      return;
    }

    const spot = {
      id: crypto.randomUUID(),
      name,
      lat,
      lon,
      depth: Number(document.getElementById("spotDepth").value || 0),
      bottom_type: document.getElementById("spotBottom").value || null,
      weather: null,
      last_update: null
    };

    SL.spots.push(spot);
    SLStorage.saveSpots();
    SLUI.renderSpots();

    SLUI.toast("Spot added");
  },

  async updateWeatherForAllSpots() {
    for (let spot of SL.spots) {
      const res = await SLEnv.fetchWeatherAt(spot.lat, spot.lon);
      if (res) {
        spot.weather = res;
        spot.last_update = Date.now();
      }
    }
    SLStorage.saveSpots();
    SLUI.renderSpots();
    SLUI.toast("Weather updated for all spots");
  }
};
// File: js/app.js (Part 2/4)
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/* ---------------------------------------------------
   UI MODULE
   (StrikeLog Lightweight UI Controller)
--------------------------------------------------- */

const SLUI = {

  /* -----------------------------------------
     TOAST
  ----------------------------------------- */
  toast(msg) {
    const t = document.getElementById("toast");
    const lbl = document.getElementById("toastMessage");

    lbl.textContent = msg;
    t.classList.remove("sl-hidden");

    // Auto hide
    setTimeout(() => {
      t.classList.add("sl-hidden");
    }, 2000);
  },

  /* -----------------------------------------
     MISSION UI STATE UPDATE
  ----------------------------------------- */
  updateMissionUI(state) {
    const status = document.getElementById("missionStatusLabel");
    const btnStart = document.getElementById("btnStartMission");
    const btnEnd = document.getElementById("btnEndMission");

    if (state === "active") {
      status.textContent = "Active";
      status.classList.remove("sl-mission-status-idle");
      status.classList.add("sl-mission-status-active");
      btnStart.disabled = true;
      btnEnd.disabled = false;
    } else {
      status.textContent = "Idle";
      status.classList.remove("sl-mission-status-active");
      status.classList.add("sl-mission-status-idle");
      btnStart.disabled = false;
      btnEnd.disabled = true;

      document.getElementById("missionDurationLabel").textContent = "00:00";
    }
  },

  /* -----------------------------------------
     STRIKE SHEET OPEN
  ----------------------------------------- */
  openStrikeSheet() {
    const backdrop = document.getElementById("strikeSheetBackdrop");
    const sheet = document.getElementById("strikeSheet");

    backdrop.classList.remove("sl-hidden");
    sheet.classList.remove("sl-hidden");

    SLUI.populateStrikeSheetInitial();
  },

  /* -----------------------------------------
     STRIKE SHEET CLOSE
  ----------------------------------------- */
  closeStrikeSheet() {
    const backdrop = document.getElementById("strikeSheetBackdrop");
    const sheet = document.getElementById("strikeSheet");

    backdrop.classList.add("sl-hidden");
    sheet.classList.add("sl-hidden");

    SLUI.clearStrikeSheet();
  },

  /* -----------------------------------------
     SET INITIAL STRIKE SHEET INFO
     (Time, GPS, Lunar)
  ----------------------------------------- */
  populateStrikeSheetInitial() {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById("strikeTimeLabel").textContent = timeLabel;

    if (SL.strikeGPSCache) {
      document.getElementById("strikeLocationLabel").textContent =
        `${SL.strikeGPSCache.lat.toFixed(5)}, ${SL.strikeGPSCache.lon.toFixed(5)}`;
    } else {
      document.getElementById("strikeLocationLabel").textContent = "No GPS";
    }

    if (SL.strikeLunarCache) {
      const { illumination, phase_angle } = SL.strikeLunarCache;
      document.getElementById("strikeLunarLabel").textContent =
        `${illumination}% / ${phase_angle}°`;
    } else {
      document.getElementById("strikeLunarLabel").textContent = "–";
    }

    SLUI.updateStrikeEnvUI();
  },

  /* -----------------------------------------
     UPDATE STRIKE ENVIRONMENT BLOCK
  ----------------------------------------- */
  updateStrikeEnvUI() {
    const env = SL.strikeEnvCache || {};

    const windLabel = document.getElementById("strikeEnvWind");
    const windDirLabel = document.getElementById("strikeEnvWindDir");
    const air = document.getElementById("strikeEnvAirTemp");
    const water = document.getElementById("strikeEnvWaterTemp");
    const pressure = document.getElementById("strikeEnvPressure");
    const pTrend = document.getElementById("strikeEnvPressureTrend");
    const waves = document.getElementById("strikeEnvWaves");
    const clouds = document.getElementById("strikeEnvClouds");

    windLabel.textContent = env?.wind_speed ? `${env.wind_speed} km/h` : "–";
    windDirLabel.textContent = env?.wind_direction ?? "–";

    air.textContent = env?.air_temp ? `${env.air_temp}°C` : "–";
    water.textContent = env?.water_temp ? `${env.water_temp}°C` : "–";
    pressure.textContent = env?.pressure ? `${env.pressure} hPa` : "–";
    pTrend.textContent = env?.pressure_trend
      ? `trend: ${env.pressure_trend}`
      : "trend: –";
    waves.textContent = env?.wave_height ? `${env.wave_height} m` : "–";
    clouds.textContent = env?.cloud_cover ? `${env.cloud_cover}%` : "–";
  },

  /* -----------------------------------------
     STRIKE PHOTO HANDLING
  ----------------------------------------- */
  getStrikePhotoBase64() {
    const input = document.getElementById("strikePhoto");
    if (!input.files || input.files.length === 0) return null;

    const file = input.files[0];
    SLUI._lastPhotoFile = file; // saved for export bundle

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },

  clearStrikeSheet() {
    document.getElementById("strikeSpecies").value = "";
    document.getElementById("strikeSize").value = "";
    document.getElementById("strikeWeight").value = "";
    document.getElementById("strikeLure").value = "";
    document.getElementById("strikeReleased").value = "";
    document.getElementById("strikeRetrieveTechnique").value = "";
    document.getElementById("strikeRetrieveSpeed").value = "";
    document.getElementById("strikeDepthCategory").value = "";
    document.getElementById("strikeType").value = "";
    document.getElementById("strikeNotes").value = "";

    const photoPrev = document.getElementById("strikePhotoPreview");
    photoPrev.classList.add("sl-hidden");
  },

  /* -----------------------------------------
     STRIKE LIST RENDERING
  ----------------------------------------- */
  renderStrikeList() {
    const list = document.getElementById("strikeList");
    const emptyState = document.getElementById("logEmptyState");

    if (SL.strikes.length === 0) {
      emptyState.style.display = "block";
      list.innerHTML = "";
      return;
    }

    emptyState.style.display = "none";

    list.innerHTML = SL.strikes.map(s => `
      <li class="sl-strike-item">
        <div class="sl-strike-header">
          <div class="sl-strike-species">${s.species || "Unknown"}</div>
          <div class="sl-strike-time">${new Date(s.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
        <div class="sl-strike-meta">
          ${s.size_cm} cm, ${s.weight_g} g, Lure: ${s.lure || "-"}
        </div>
      </li>
    `).join("");
  },

  /* -----------------------------------------
     SPOTS UI
  ----------------------------------------- */
  renderSpots() {
    const container = document.getElementById("spotList");

    if (!SL.spots.length) {
      container.innerHTML = `<li class="sl-text-muted">No spots saved.</li>`;
      return;
    }

    container.innerHTML = SL.spots.map(spot => `
      <li class="sl-spot-item">
        <div class="sl-spot-header">
          <div class="sl-spot-name">${spot.name}</div>
          <div class="sl-spot-actions">
            <button class="sl-btn-text" onclick="SLUI.selectSpot('${spot.id}')">Use</button>
            <button class="sl-btn-text sl-text-danger" onclick="SLUI.deleteSpot('${spot.id}')">Delete</button>
          </div>
        </div>

        <div class="sl-spot-meta">
          Lat/Lon: ${spot.lat.toFixed(5)}, ${spot.lon.toFixed(5)}<br>
          Depth: ${spot.depth || "-"}m<br>
          Bottom: ${spot.bottom_type || "-"}<br>
          Weather: ${spot.weather ? "✓" : "–"}<br>
          Updated: ${spot.last_update ? new Date(spot.last_update).toLocaleString() : "–"}
        </div>
      </li>
    `).join("");
  },

  selectSpot(id) {
    const spot = SL.spots.find(s => s.id === id);
    if (!spot) return;

    document.getElementById("missionSpot").value = id;

    SLUI.toast(`Using spot: ${spot.name}`);
  },

  deleteSpot(id) {
    SL.spots = SL.spots.filter(s => s.id !== id);
    SLStorage.saveSpots();
    SLUI.renderSpots();
    SLUI.toast("Spot deleted");
  },

  /* -----------------------------------------
     MAP RENDERING (Placeholder)
     Will be replaced by Leaflet later.
  ----------------------------------------- */
  initMap() {
    const coordsLabel = document.getElementById("mapCurrentCoords");

    SLGeo.getGPS().then(pos => {
      if (pos) {
        coordsLabel.textContent = `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`;
      } else {
        coordsLabel.textContent = "Unable to determine position";
      }
    });
  }
};
// File: js/app.js (Part 3/4)
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/* ---------------------------------------------------
   STORAGE ENGINE
   Handles:
   • Saving mission state
   • Loading mission + strikes
   • Export (JSON, CSV, Bundle ZIP)
   • Spots import/export
--------------------------------------------------- */

const SLStorage = {

  /* -----------------------------------------
     SPOTS
  ----------------------------------------- */
  saveSpots() {
    localStorage.setItem("sl_spots", JSON.stringify(SL.spots));
  },

  loadSpots() {
    try {
      const data = JSON.parse(localStorage.getItem("sl_spots"));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  exportSpots() {
    const data = JSON.stringify(SL.spots, null, 2);
    SLStorage._downloadFile("StrikeLog_Spots.json", data, "application/json");
  },

  importSpots() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = e => {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = ev => {
        try {
          const json = JSON.parse(ev.target.result);
          if (Array.isArray(json)) {
            SL.spots = json;
            SLStorage.saveSpots();
            SLUI.renderSpots();
            SLUI.toast("Spots imported");
          } else {
            SLUI.toast("Invalid file format");
          }
        } catch {
          SLUI.toast("Error reading file");
        }
      };

      reader.readAsText(file);
    };

    input.click();
  },

  /* -----------------------------------------
     MISSION STATE SAVE / LOAD
  ----------------------------------------- */
  saveMissionState() {
    if (!SL.mission) {
      localStorage.removeItem("sl_mission_state");
      return;
    }

    const data = {
      mission: SL.mission,
      strikes: SL.strikes
    };

    localStorage.setItem("sl_mission_state", JSON.stringify(data));
  },

  loadMissionState() {
    try {
      const raw = localStorage.getItem("sl_mission_state");
      if (!raw) return;

      const data = JSON.parse(raw);
      SL.mission = data.mission || null;
      SL.strikes = data.strikes || [];

      if (SL.mission) {
        SL.missionStartTime = SL.mission.start_time;
        SLApp.startMissionTimer();
        SLUI.updateMissionUI("active");
        SLUI.renderStrikeList();
      }
    } catch (err) {
      console.warn("Failed to load mission state:", err);
    }
  },

  /* -----------------------------------------
     QUICK EXPORT (current mission only)
  ----------------------------------------- */
  quickExport() {
    if (!SL.mission) {
      SLUI.toast("No active mission");
      return;
    }

    const exportObj = {
      mission: SL.mission,
      strikes: SL.strikes
    };

    const data = JSON.stringify(exportObj, null, 2);
    SLStorage._downloadFile(`StrikeLog_Mission_${SL.mission.id}.json`, data, "application/json");
    SLUI.toast("Mission exported");
  },

  /* -----------------------------------------
     CSV EXPORT
  ----------------------------------------- */
  exportCSV() {
    if (!SL.mission || SL.strikes.length === 0) {
      SLUI.toast("No strikes to export");
      return;
    }

    const rows = [
      "timestamp,species,size_cm,weight_g,lure,released,lat,lon,wind,temp_air,temp_water,pressure,waves,clarity,depth"
    ];

    SL.strikes.forEach(s => {
      const env = s.env || {};
      const gps = s.gps || {};

      rows.push([
        s.timestamp,
        s.species || "",
        s.size_cm || "",
        s.weight_g || "",
        s.lure || "",
        s.released || "",
        gps.lat || "",
        gps.lon || "",
        env.wind_speed || "",
        env.air_temp || "",
        env.water_temp || "",
        env.pressure || "",
        env.wave_height || "",
        SL.mission.conditions.clarity || "",
        SL.mission.conditions.depth || ""
      ].join(","));
    });

    const blob = rows.join("\n");
    SLStorage._downloadFile("StrikeLog_Mission.csv", blob, "text/csv");

    SLUI.toast("CSV exported");
  },

  /* -----------------------------------------
     FULL MISSION EXPORT BUNDLE (ZIP)
     Contains:
     • mission.json
     • strikes.json
     • photos
  ----------------------------------------- */
  async exportBundle() {
    if (!SL.mission) return;

    const zip = new JSZip();

    // Mission metadata
    zip.file("mission.json", JSON.stringify(SL.mission, null, 2));

    // Strikes
    zip.file("strikes.json", JSON.stringify(SL.strikes, null, 2));

    // Photos folder
    const imgFolder = zip.folder("photos");

    for (let strike of SL.strikes) {
      if (strike.photo) {
        const base64 = strike.photo.split(",")[1];
        imgFolder.file(`${strike.id}.jpg`, base64, { base64: true });
      }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    SLStorage._downloadBlob(`StrikeLog_MissionBundle_${SL.mission.id}.zip`, blob);
  },

  /* -----------------------------------------
     DOWNLOAD HELPERS
  ----------------------------------------- */
  _downloadFile(filename, data, type) {
    const blob = new Blob([data], { type });
    SLStorage._downloadBlob(filename, blob);
  },

  _downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};
// File: js/app.js (Part 4/4)
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

/* ---------------------------------------------------
   GPS MODULE
   — On-demand high-accuracy GPS
   — Used at:
       • Mission Start
       • Mission End
       • Strike button press
--------------------------------------------------- */

const SLGeo = {

  async getGPS() {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        SLUI.toast("GPS not supported");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            ts: Date.now()
          });
        },
        err => {
          console.warn("GPS error:", err);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0
        }
      );
    });
  }
};


/* ---------------------------------------------------
   LUNAR MODULE (Thin Wrapper)
   Computes:
   • illumination %
   • phase angle
   • moon altitude
   • moonrise offset
   NOTE: actual computation in lunar.js
--------------------------------------------------- */

const SLLunar = {
  computeNow() {
    return window.SL_LunarCalc.compute(new Date());
  }
};


/* ---------------------------------------------------
   ENVIRONMENT FETCHING
   — Real-time weather data at strike
   — Mission-spot weather retrieval
--------------------------------------------------- */

const SLEnv = {

  /* -----------------------------------------
     REALTIME WEATHER @ STRIKE MOMENT
  ----------------------------------------- */
  async fetchRealtimeWeather() {
    const gps = await SLGeo.getGPS();
    if (!gps) return null;

    return await this.fetchWeatherAt(gps.lat, gps.lon);
  },

  /* -----------------------------------------
     WEATHER FOR SPECIFIC COORDINATES
     Using Open-Meteo Marine API
  ----------------------------------------- */
  async fetchWeatherAt(lat, lon) {

    try {
      const url = `https://api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wind_speed,wind_direction,air_temperature,sea_surface_temperature,pressure_msl,cloudcover&timezone=auto`;

      const res = await fetch(url);
      const data = await res.json();

      // Current hour index
      const hIndex = 0;

      const env = {
        wind_speed: data.hourly.wind_speed[hIndex],
        wind_direction: SLEnv._degToCardinal(data.hourly.wind_direction[hIndex]),
        air_temp: data.hourly.air_temperature[hIndex],
        water_temp: data.hourly.sea_surface_temperature[hIndex],
        pressure: data.hourly.pressure_msl[hIndex],
        wave_height: data.hourly.wave_height[hIndex],
        cloud_cover: data.hourly.cloudcover[hIndex],
      };

      // Calculate pressure trend using last cached reading
      if (SL.lastWeatherData?.pressure) {
        const diff = env.pressure - SL.lastWeatherData.pressure;
        env.pressure_trend = diff > 0 ? "rising" : diff < 0 ? "falling" : "steady";
      } else {
        env.pressure_trend = "unknown";
      }

      SL.lastWeatherData = env;
      SL.lastWeatherFetch = Date.now();

      return env;

    } catch (err) {
      console.warn("Weather fetch error:", err);
      return null;
    }
  },

  /* -----------------------------------------
     FETCH WEATHER FOR MISSION SPOT (setup UI)
  ----------------------------------------- */
  async fetchWeatherForMissionSpot() {
    const spotId = document.getElementById("missionSpot").value;
    if (!spotId) {
      SLUI.toast("Select a spot first");
      return;
    }

    const spot = SL.spots.find(s => s.id === spotId);
    if (!spot) {
      SLUI.toast("Spot not found");
      return;
    }

    const env = await SLEnv.fetchWeatherAt(spot.lat, spot.lon);
    if (!env) {
      SLUI.toast("Weather fetch failed");
      return;
    }

    spot.weather = env;
    spot.last_update = Date.now();

    SLStorage.saveSpots();
    SLUI.renderSpots();
    SLUI.updateMissionWeatherUI(env);

    SLUI.toast("Weather loaded");
  },

  _degToCardinal(deg) {
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round(deg / 45) % 8];
  }
};


/* ---------------------------------------------------
   UPDATE MISSION WEATHER UI
--------------------------------------------------- */

SLUI.updateMissionWeatherUI = function(env) {
  if (!env) return;

  document.getElementById("weatherWindValue").textContent = env.wind_speed + " km/h";
  document.getElementById("weatherWindDir").textContent = env.wind_direction;
  document.getElementById("weatherAirTemp").textContent = env.air_temp + "°C";
  document.getElementById("weatherWaterTemp").textContent = env.water_temp + "°C";
  document.getElementById("weatherPressure").textContent = env.pressure + " hPa";
  document.getElementById("weatherPressureTrend").textContent = "trend: " + env.pressure_trend;
  document.getElementById("weatherWaves").textContent = env.wave_height + " m";
  document.getElementById("weatherClouds").textContent = env.cloud_cover + "%";

  document.getElementById("weatherUpdatedLabel").textContent =
    "Updated " + new Date().toLocaleTimeString();
};

// File: js/app.js (Moon Phase UI Hook)
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

function SL_UpdateMoonPhaseCard() {
  const moon = SL_LunarCalc.compute(new Date());

  document.getElementById("moonPhaseIcon").textContent = moon.icon;
  document.getElementById("moonPhaseName").textContent = moon.phase_name;
  document.getElementById("moonIllumination").textContent = `${moon.illumination}% illuminated`;
}

// Refresh button
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnRefreshMoon");
  if (btn) btn.addEventListener("click", SL_UpdateMoonPhaseCard);

  // Initial render
  SL_UpdateMoonPhaseCard();
});

// Also refresh automatically whenever user opens the Mission tab
document.querySelectorAll(".sl-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    if (tab.dataset.view === "missionView") {
      SL_UpdateMoonPhaseCard();
    }
  });
});

/* ---------------------------------------------------
   END OF APP CORE
--------------------------------------------------- */
console.log("[StrikeLog] Core engine loaded.");
