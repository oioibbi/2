(() => {
  "use strict";

  const MODE = { CAMPAIGN: "campaign", ENDLESS: "endless" };
  const STORAGE_KEY = "muyu-breaker.v1";
  const LOGICAL_WIDTH = 960;
  const LOGICAL_HEIGHT = 540;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const nowMs = () => performance.now();
  const fmtInt = (n) => `${Math.max(0, Math.floor(n))}`;

  const WOODFISH_TIERS = [
    { key: "bronze", name: "闈掗摐鏈ㄩ奔", rMul: 1.0, speedMul: 1.0, cost: 0 },
    { key: "blackiron", name: "榛戦搧鏈ㄩ奔", rMul: 1.12, speedMul: 0.95, cost: 2400 },
    { key: "gold", name: "榛勯噾鏈ㄩ奔", rMul: 1.25, speedMul: 0.9, cost: 8200 },
    { key: "diamond", name: "閽荤煶鏈ㄩ奔", rMul: 1.42, speedMul: 0.86, cost: 22000 },
    { key: "rainbow", name: "涓冨僵鏈ㄩ奔", rMul: 1.62, speedMul: 0.82, cost: 52000 },
  ];

  const PADDLE_TIERS = [
    { key: "mortal", name: "鍑″櫒", baseW: 140, deflectMul: 1.0, cost: 0 },
    { key: "spirit", name: "鐏靛櫒", baseW: 152, deflectMul: 1.08, cost: 1800 },
    { key: "dharma", name: "娉曞櫒", baseW: 168, deflectMul: 1.16, cost: 7200 },
    { key: "treasure", name: "瀹濆櫒", baseW: 186, deflectMul: 1.24, cost: 20000 },
    { key: "sacred", name: "鍦ｅ櫒", baseW: 206, deflectMul: 1.33, cost: 48000 },
  ];

  const TITLES = [
    { name: "绛戝熀", need: 0 },
    { name: "开光", need: 500 },
    { name: "铻嶅悎", need: 1500 },
    { name: "蹇冨姩", need: 3500 },
    { name: "閲戜腹", need: 7000 },
    { name: "鍏冨┐", need: 12000 },
    { name: "鍑虹獚", need: 20000 },
    { name: "鍒嗙", need: 32000 },
    { name: "鍚堜綋", need: 50000 },
    { name: "娲炶櫄", need: 76000 },
    { name: "澶т箻", need: 110000 },
    { name: "娓″姭", need: 160000 },
    { name: "鏁ｄ粰", need: 230000, gate: "post_tribulation" },
    { name: "鐪熶粰", need: 320000, gate: "post_tribulation" },
    { name: "澶箼鏁ｄ粰", need: 420000, gate: "post_tribulation" },
    { name: "澶箼鐪熶粰", need: 540000, gate: "post_tribulation" },
    { name: "澶箼鐜勪粰", need: 680000, gate: "post_tribulation" },
    { name: "澶箼閲戜粰", need: 850000, gate: "post_tribulation" },
    { name: "澶х綏閲戜粰", need: 1050000, gate: "post_tribulation" },
    { name: "娣峰厓澶х綏閲戜粰", need: 1300000, gate: "post_tribulation" },
  ];

  function titleGateSatisfied(save) {
    const cleared = Boolean(save.progress?.campaignCleared);
    const allWoodfish = (save.inventory?.woodfishTier ?? 0) >= 4;
    return cleared && allWoodfish;
  }

  function getCurrentRealm(save) {
    const earned = Math.floor(save.profile?.lifetimeMeritEarned ?? 0);
    let current = TITLES[0];
    for (const t of TITLES) {
      if (earned >= t.need) current = t;
      else break;
    }
    if (current.gate === "post_tribulation" && !titleGateSatisfied(save)) {
      const trib = TITLES.find((t) => t.name === "娓″姭") ?? TITLES[0];
      return {
        name: trib.name,
        locked: true,
        reason: "解锁“散仙”及以上需要：通关全部普通关卡，并解锁全部木鱼。",
      };
    }
    return { name: current.name, locked: false, reason: "" };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function defaultSave() {
    const iso = new Date().toISOString();
    return {
      profile: { totalMerit: 0, lifetimeMeritEarned: 0, createdAt: iso, updatedAt: iso },
      progress: { maxCampaignLevelCleared: 0, campaignCleared: false },
      inventory: {
        woodfishTier: 0, // 0-4: 闈掗摐/榛戦搧/榛勯噾/閽荤煶/涓冨僵
        paddleTier: 0, // 0-4
      },
      preferences: {
        mobileLandscape: false,
      },
      leaderboard: { campaign: [], endless: [] },
      history: [],
    };
  }

  function migrateSave(save) {
    if (!save || typeof save !== "object") return defaultSave();
    save.profile ??= {};
    save.profile.totalMerit = Number.isFinite(save.profile.totalMerit) ? save.profile.totalMerit : 0;
    save.profile.lifetimeMeritEarned = Number.isFinite(save.profile.lifetimeMeritEarned) ? save.profile.lifetimeMeritEarned : save.profile.totalMerit;
    save.profile.createdAt ??= new Date().toISOString();
    save.profile.updatedAt ??= new Date().toISOString();
    save.progress ??= {};
    save.progress.maxCampaignLevelCleared = Number.isFinite(save.progress.maxCampaignLevelCleared) ? save.progress.maxCampaignLevelCleared : 0;
    save.progress.campaignCleared = Boolean(save.progress.campaignCleared);
    save.inventory ??= {};
    save.inventory.woodfishTier = Number.isFinite(save.inventory.woodfishTier) ? clamp(save.inventory.woodfishTier, 0, 4) : 0;
    save.inventory.paddleTier = Number.isFinite(save.inventory.paddleTier) ? clamp(save.inventory.paddleTier, 0, 4) : 0;
    save.preferences ??= {};
    save.preferences.mobileLandscape = Boolean(save.preferences.mobileLandscape);
    save.leaderboard ??= { campaign: [], endless: [] };
    save.leaderboard.campaign ??= [];
    save.leaderboard.endless ??= [];
    save.history ??= [];
    return save;
  }

  function saveToStorage(save) {
    save.profile.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }

  function addLeaderboardEntry(save, mode, entry) {
    const list = save.leaderboard[mode] ?? [];
    list.push(entry);
    list.sort((a, b) => (b.merit ?? 0) - (a.merit ?? 0));
    save.leaderboard[mode] = list.slice(0, 10);
  }

  function addHistoryEntry(save, entry) {
    const list = save.history ?? [];
    list.unshift(entry);
    save.history = list.slice(0, 50);
  }

  function makeAudio() {
    let ctx = null;
    let enabled = false;
    let bgmReady = false;
    let bgmEnabled = true;
    let bgmMaster = null;
    let bgmDroneGain = null;
    let bgmDrones = [];
    let bgmLfo = null;
    let bgmPulseTimer = 0;

    function createBgmGraph() {
      if (!ctx || bgmReady) return;
      bgmMaster = ctx.createGain();
      bgmMaster.gain.setValueAtTime(0.0001, ctx.currentTime);

      bgmDroneGain = ctx.createGain();
      bgmDroneGain.gain.setValueAtTime(0.18, ctx.currentTime);
      bgmDroneGain.connect(bgmMaster);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(920, ctx.currentTime);
      filter.Q.setValueAtTime(0.8, ctx.currentTime);
      bgmMaster.connect(filter).connect(ctx.destination);

      const freqs = [146.83, 220.0, 293.66];
      bgmDrones = freqs.map((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index === 1 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(index === 1 ? 0.05 : 0.035, ctx.currentTime);
        osc.connect(gain).connect(bgmDroneGain);
        osc.start();
        return { osc, gain };
      });

      bgmLfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      bgmLfo.type = "sine";
      bgmLfo.frequency.setValueAtTime(0.055, ctx.currentTime);
      lfoGain.gain.setValueAtTime(0.035, ctx.currentTime);
      bgmLfo.connect(lfoGain).connect(bgmDroneGain.gain);
      bgmLfo.start();

      bgmReady = true;
    }

    function schedulePulse() {
      if (!enabled || !bgmEnabled || !ctx) return;
      const current = ctx.currentTime;
      if (current < bgmPulseTimer - 0.05) return;
      bgmPulseTimer = current + 3.8 + Math.random() * 2.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(720 + Math.random() * 240, current);
      filter.Q.setValueAtTime(3.5, current);
      osc.type = Math.random() > 0.5 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(392 + Math.random() * 110, current);
      osc.frequency.exponentialRampToValueAtTime(196 + Math.random() * 80, current + 1.8);
      gain.gain.setValueAtTime(0.0001, current);
      gain.gain.exponentialRampToValueAtTime(0.04, current + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, current + 1.9);
      osc.connect(filter).connect(gain).connect(bgmMaster);
      osc.start(current);
      osc.stop(current + 2.1);
    }

    return {
      get enabled() {
        return enabled;
      },
      get bgmEnabled() {
        return bgmEnabled;
      },
      get ctx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
      },
      async enable() {
        try {
          enabled = true;
          if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
          if (ctx.state === "suspended") await ctx.resume();
          createBgmGraph();
        } catch {
          enabled = false;
        }
      },
      startBgm() {
        if (!enabled) return;
        createBgmGraph();
        if (!bgmMaster) return;
        const t = ctx.currentTime;
        bgmMaster.gain.cancelScheduledValues(t);
        bgmMaster.gain.setValueAtTime(Math.max(0.0001, bgmMaster.gain.value), t);
        bgmMaster.gain.exponentialRampToValueAtTime(bgmEnabled ? 0.22 : 0.0001, t + 1.8);
        schedulePulse();
      },
      updateBgm() {
        if (!enabled || !bgmEnabled) return;
        schedulePulse();
      },
      toggleBgm() {
        bgmEnabled = !bgmEnabled;
        if (!enabled) return bgmEnabled;
        createBgmGraph();
        const t = ctx.currentTime;
        bgmMaster.gain.cancelScheduledValues(t);
        bgmMaster.gain.setValueAtTime(Math.max(0.0001, bgmMaster.gain.value), t);
        bgmMaster.gain.exponentialRampToValueAtTime(bgmEnabled ? 0.22 : 0.0001, t + 0.8);
        if (bgmEnabled) schedulePulse();
        return bgmEnabled;
      },
    };
  }

  function woodfishTok(audio, strength = 0.6) {
    if (!audio.enabled) return;
    const ctx = audio.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.06);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12 * strength, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
    const nearestX = clamp(cx, rx, rx + rw);
    const nearestY = clamp(cy, ry, ry + rh);
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy <= r * r;
  }

  function reflectBallOnRect(ball, rx, ry, rw, rh) {
    const prevX = ball.x - ball.vx;
    const prevY = ball.y - ball.vy;
    const wasInsideX = prevX >= rx && prevX <= rx + rw;
    const wasInsideY = prevY >= ry && prevY <= ry + rh;
    const hitFromSide = !wasInsideX && wasInsideY;
    const hitFromTopBottom = wasInsideX && !wasInsideY;

    if (hitFromSide) ball.vx *= -1;
    else if (hitFromTopBottom) ball.vy *= -1;
    else {
      const left = Math.abs(ball.x - rx);
      const right = Math.abs(ball.x - (rx + rw));
      const top = Math.abs(ball.y - ry);
      const bottom = Math.abs(ball.y - (ry + rh));
      const m = Math.min(left, right, top, bottom);
      if (m === left || m === right) ball.vx *= -1;
      else ball.vy *= -1;
    }
  }

  function sinValueForBrick({ base, hp, speed }) {
    const v = Math.round(base * Math.pow(hp, 1.2) * (1 + speed / 220));
    return Math.max(1, v);
  }

  function seededRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  function deepCloneBricks(bricks) {
    return bricks.map((b) => ({ ...b }));
  }

  function generateCampaignLevel(levelIndex, bounds) {
    const level = levelIndex + 1;
    const rng = seededRng(0xC0FFEE ^ (level * 98713));

    const cols = 12;
    const rows = clamp(4 + Math.floor(level / 2), 4, 9);
    const pad = 10;
    const topOffset = 72;
    const left = 30;
    const right = bounds.w - 30;
    const availableW = right - left;
    const brickW = Math.floor((availableW - pad * (cols - 1)) / cols);
    const brickH = 22;

    const base = 10 + level * 2;
    const moveChance = clamp((level - 6) * 0.08, 0, 0.32);
    const maxHp = clamp(1 + Math.floor(level / 3), 1, 4);
    const hpHeavyChance = clamp((level - 3) * 0.06, 0, 0.28);

    const bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hole = rng() < (level <= 2 ? 0.05 : 0.1);
        if (hole) continue;

        const x = left + c * (brickW + pad);
        const y = topOffset + r * (brickH + pad);

        let hp = 1;
        if (rng() < hpHeavyChance) hp = clamp(2 + Math.floor(rng() * maxHp), 2, maxHp);

        let moveType = "none";
        let moveSpeed = 0;
        let moveRange = 0;
        if (rng() < moveChance) {
          moveType = rng() < 0.5 ? "h" : "v";
          moveSpeed = 40 + rng() * (30 + level * 6);
          moveRange = 18 + rng() * 28;
        }

        const sin = sinValueForBrick({ base, hp, speed: moveSpeed });
        const styleSeed = rng();
        const glyphs = ["罪", "业", "孽", "障", "罚", "厄", "劫"];
        const glyph = glyphs[Math.floor(rng() * glyphs.length)];
        const variant = hp >= 3 ? "cracked" : moveType !== "none" ? "stripes" : rng() < 0.18 ? "rune" : "plain";
        bricks.push({
          x,
          y,
          w: brickW,
          h: brickH,
          hp,
          hpMax: hp,
          sin,
          moveType,
          moveSpeed,
          moveRange,
          phase: rng() * Math.PI * 2,
          ox: x,
          oy: y,
          variant,
          styleSeed,
          glyph,
        });
      }
    }

    return { bricks, meta: { level } };
  }

  function generateEndlessWave(waveIndex, bounds) {
    const wave = waveIndex + 1;
    const rng = seededRng(0xBEEFED ^ (wave * 1337));

    const cols = 12;
    const rows = clamp(5 + Math.floor(wave / 2), 5, 10);
    const pad = 10;
    const topOffset = 72;
    const left = 30;
    const right = bounds.w - 30;
    const availableW = right - left;
    const brickW = Math.floor((availableW - pad * (cols - 1)) / cols);
    const brickH = 22;

    const base = 12 + Math.floor(wave * 2.4);
    const moveChance = clamp(0.14 + wave * 0.018, 0.14, 0.55);
    const maxHp = clamp(2 + Math.floor(wave / 4), 2, 7);

    const bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < clamp(0.08 + wave * 0.002, 0.08, 0.18)) continue;
        const x = left + c * (brickW + pad);
        const y = topOffset + r * (brickH + pad);

        let hp = 1 + Math.floor(rng() * Math.min(3 + Math.floor(wave / 5), maxHp));
        hp = clamp(hp, 1, maxHp);

        let moveType = "none";
        let moveSpeed = 0;
        let moveRange = 0;
        if (rng() < moveChance) {
          moveType = rng() < 0.5 ? "h" : "v";
          moveSpeed = 60 + rng() * (60 + wave * 9);
          moveRange = 22 + rng() * 42;
        }

        const sin = sinValueForBrick({ base, hp, speed: moveSpeed });
        const styleSeed = rng();
        const glyphs = ["罪", "业", "孽", "障", "罚", "厄", "劫"];
        const glyph = glyphs[Math.floor(rng() * glyphs.length)];
        const variant = hp >= 4 ? "cracked" : moveType !== "none" ? "stripes" : rng() < 0.22 ? "rune" : "plain";
        bricks.push({
          x,
          y,
          w: brickW,
          h: brickH,
          hp,
          hpMax: hp,
          sin,
          moveType,
          moveSpeed,
          moveRange,
          phase: rng() * Math.PI * 2,
          ox: x,
          oy: y,
          variant,
          styleSeed,
          glyph,
        });
      }
    }

    return { bricks, meta: { wave } };
  }

  function makeGame(canvas) {
    const ctx = canvas.getContext("2d");
    const audio = makeAudio();
    const bounds = { w: LOGICAL_WIDTH, h: LOGICAL_HEIGHT };
    let renderScaleX = 1;
    let renderScaleY = 1;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width || LOGICAL_WIDTH);
      const height = Math.max(1, rect.height || LOGICAL_HEIGHT);
      const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      renderScaleX = targetWidth / bounds.w;
      renderScaleY = targetHeight / bounds.h;
      ctx.setTransform(renderScaleX, 0, 0, renderScaleY, 0, 0);
      ctx.imageSmoothingEnabled = true;
    }

    const state = {
      mode: MODE.CAMPAIGN,
      isPaused: false,
      isRunning: false,
      startedAtMs: 0,

      levelIndex: 0,
      waveIndex: 0,
      lives: 3,

      pendingMerit: 0,
      bankedMerit: 0,

      bricks: [],
      bricksSnapshot: [],

      stageBaseSpeed: 7.2,
      controlX: bounds.w / 2,
      targetControlX: bounds.w / 2,
      paddles: [{ id: 0, xOffset: 0, x: bounds.w / 2, y: bounds.h - 44, w: 140, h: 16 }],
      balls: [{ id: 0, x: bounds.w / 2, y: bounds.h - 62, r: 12, vx: 0, vy: 0, launched: false, baseSpeed: 7.2 }],
      aim: { active: true, tx: bounds.w / 2, ty: bounds.h / 2 },

      powerups: [],
      effects: { slowUntilMs: 0, wideUntilMs: 0 },

      rage: { active: false, untilMs: 0, combo: 0, nextAutoAtMs: 0 },
      particles: [],
      floaters: [],
      lastTickMs: nowMs(),
    };

    const ui = wireUI({ startMode, getSave: () => save, resetSave, buyWoodfish, buyPaddle });
    let save = migrateSave(loadSave() ?? defaultSave());
    saveToStorage(save);
    ui.syncAudio(true);
    ui.audioButton?.addEventListener("click", async () => {
      if (!audio.enabled) await audio.enable();
      const enabled = audio.toggleBgm();
      if (enabled) audio.startBgm();
      ui.syncAudio(enabled);
    });

    function isCompactMobileViewport() {
      return Math.min(window.innerWidth, window.innerHeight) < 820 && Math.max(window.innerWidth, window.innerHeight) < 1400;
    }

    function isPortraitViewport() {
      return window.innerHeight > window.innerWidth;
    }

    function syncMobileViewportState(statusText = "") {
      const compact = isCompactMobileViewport();
      const portrait = compact && isPortraitViewport();
      const landscapeEnabled = Boolean(save.preferences?.mobileLandscape);
      const useLandscapeLayout = landscapeEnabled && (!compact || !portrait);
      document.body.classList.toggle("mobile-landscape", useLandscapeLayout);
      document.body.classList.toggle("mobile-portrait", portrait && !useLandscapeLayout);

      if (!compact) {
        ui.setMobileTip("");
      } else if (statusText) {
        ui.setMobileTip(statusText);
      } else if (portrait) {
        ui.setMobileTip("竖屏下会自动精简界面；点“横屏”可尝试自动横屏，游玩区域会更大。");
      } else if (landscapeEnabled) {
        ui.setMobileTip("");
      } else {
        ui.setMobileTip("当前已是横屏，若想保留大视野布局，可以点“横屏”锁定。");
      }
    }

    async function requestLandscapePresentation() {
      let lockSucceeded = false;
      try {
        const host = canvas.closest(".game-shell") ?? canvas;
        if (document.fullscreenEnabled && !document.fullscreenElement && host.requestFullscreen) {
          await host.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
        }
      } catch {}

      try {
        await screen.orientation?.lock?.("landscape");
        lockSucceeded = true;
      } catch {}

      if (lockSucceeded || !isCompactMobileViewport()) return true;
      return !isPortraitViewport();
    }

    async function syncMobileLandscape(forceLock = false) {
      const enabled = Boolean(save.preferences?.mobileLandscape);
      ui.syncLandscape(enabled);
      let tip = "";
      if (enabled && forceLock && isCompactMobileViewport()) {
        const locked = await requestLandscapePresentation();
        if (!locked) {
          tip = "浏览器限制了自动横屏，我已切到横屏布局；请把手机横过来，画面会立刻适配。";
        }
      }
      if (!enabled) {
        try {
          screen.orientation?.unlock?.();
        } catch {}
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      syncMobileViewportState(tip);
      resizeCanvas();
    }

    ui.landscapeButton?.addEventListener("click", async () => {
      save.preferences.mobileLandscape = !save.preferences.mobileLandscape;
      saveToStorage(save);
      await syncMobileLandscape(true);
    });
    syncMobileLandscape();

    function resetSave() {
      localStorage.removeItem(STORAGE_KEY);
      save = defaultSave();
      saveToStorage(save);
    }

    function currentWoodfishTier() {
      return WOODFISH_TIERS[clamp(save.inventory?.woodfishTier ?? 0, 0, 4)];
    }

    function currentPaddleTier() {
      return PADDLE_TIERS[clamp(save.inventory?.paddleTier ?? 0, 0, 4)];
    }

    function primaryPaddle() {
      return state.paddles[0];
    }

    function primaryBall() {
      return state.balls[0];
    }

    function emitParticles(x, y, options = {}) {
      const {
        count = 8,
        color = "rgba(246,211,122,0.9)",
        colorAlt = null,
        speedMin = 0.8,
        speedMax = 2.6,
        sizeMin = 1.5,
        sizeMax = 4.4,
        lifeMin = 280,
        lifeMax = 820,
        spread = Math.PI * 2,
        angle = 0,
        gravity = 0.006,
        drag = 0.992,
        glow = 0.5,
      } = options;
      for (let i = 0; i < count; i++) {
        const localAngle = angle + (Math.random() - 0.5) * spread;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        state.particles.push({
          x,
          y,
          vx: Math.cos(localAngle) * speed,
          vy: Math.sin(localAngle) * speed,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          ttl: lifeMin + Math.random() * (lifeMax - lifeMin),
          maxTtl: lifeMax,
          gravity,
          drag,
          color: colorAlt && Math.random() > 0.55 ? colorAlt : color,
          glow,
        });
      }
    }

    function applyEquipmentToLiveObjects() {
      const woodfish = currentWoodfishTier();
      const newR = Math.round(12 * woodfish.rMul);
      for (const b of state.balls) b.r = newR;
      const p0 = primaryPaddle();
      if (p0) p0.w = currentPaddleTier().baseW;
    }

    function buyWoodfish() {
      const cur = clamp(save.inventory.woodfishTier ?? 0, 0, 4);
      const next = cur + 1;
      if (next > 4) return { ok: false, msg: "木鱼已至七彩，无需再购。" };
      const item = WOODFISH_TIERS[next];
      const cost = item.cost;
      if ((save.profile.totalMerit ?? 0) < cost) return { ok: false, msg: `功德不足，需要 ${cost}。` };
      const oldMul = WOODFISH_TIERS[cur].speedMul;
      const newMul = item.speedMul;
      save.profile.totalMerit = Math.floor((save.profile.totalMerit ?? 0) - cost);
      save.inventory.woodfishTier = next;
      saveToStorage(save);
      const ratio = oldMul > 0 ? newMul / oldMul : 1;
      for (const b of state.balls) {
        if (!b.launched) continue;
        b.vx *= ratio;
        b.vy *= ratio;
      }
      applyEquipmentToLiveObjects();
      updateHUD();
      return { ok: true, msg: `已解锁：${item.name}` };
    }

    function buyPaddle() {
      const cur = clamp(save.inventory.paddleTier ?? 0, 0, 4);
      const next = cur + 1;
      if (next > 4) return { ok: false, msg: "法器已至圣器，无需再购。" };
      const item = PADDLE_TIERS[next];
      const cost = item.cost;
      if ((save.profile.totalMerit ?? 0) < cost) return { ok: false, msg: `功德不足，需要 ${cost}。` };
      save.profile.totalMerit = Math.floor((save.profile.totalMerit ?? 0) - cost);
      save.inventory.paddleTier = next;
      saveToStorage(save);
      applyEquipmentToLiveObjects();
      updateHUD();
      return { ok: true, msg: `宸插崌绾э細${item.name}` };
    }

    function resetBallOnPaddle() {
      const p = primaryPaddle();
      const woodfish = currentWoodfishTier();
      const r = Math.round(12 * woodfish.rMul);
      state.balls = [
        {
          id: 0,
          x: p.x,
          y: p.y - 18,
          r,
          vx: 0,
          vy: 0,
          launched: false,
          baseSpeed: state.stageBaseSpeed,
        },
      ];
    }

    function resetPaddle() {
      const tier = currentPaddleTier();
      const x = bounds.w / 2;
      const y = bounds.h - 44;
      state.controlX = x;
      state.targetControlX = x;
      state.paddles = [{ id: 0, xOffset: 0, x, y, w: tier.baseW, h: 16 }];
    }

    function showOverlay(title, bodyHtml, labels, onPrimary, onSecondary) {
      ui.showOverlay(title, bodyHtml, labels, onPrimary, onSecondary);
      state.isPaused = true;
    }

    function hideOverlay(resume = false) {
      ui.hideOverlay();
      if (resume) state.isPaused = false;
    }

    function updateHUD() {
      const realmInfo = getCurrentRealm(save);
      ui.setHUD({
        mode: state.mode === MODE.CAMPAIGN ? "闂叧" : "鏃犲敖",
        stage: state.mode === MODE.CAMPAIGN ? `${state.levelIndex + 1}` : `${state.waveIndex + 1}`,
        title: realmInfo.name,
        lives: `${state.lives}`,
        pending: fmtInt(state.pendingMerit),
        banked: fmtInt(state.bankedMerit),
        total: fmtInt(save.profile.totalMerit ?? 0),
        lifetime: fmtInt(save.profile.lifetimeMeritEarned ?? 0),
      });
    }

    function loadLevel(levelIndex) {
      const { bricks } = generateCampaignLevel(levelIndex, bounds);
      state.bricks = bricks;
      state.bricksSnapshot = deepCloneBricks(bricks);
      state.pendingMerit = 0;
      state.levelIndex = levelIndex;
      state.stageBaseSpeed = clamp(7.2 + levelIndex * 0.22, 7.2, 10.5);
      resetPaddle();
      resetBallOnPaddle();
      state.aim.active = true;
      updateHUD();
    }

    function loadWave(waveIndex) {
      const { bricks } = generateEndlessWave(waveIndex, bounds);
      state.bricks = bricks;
      state.bricksSnapshot = deepCloneBricks(bricks);
      state.pendingMerit = 0;
      state.waveIndex = waveIndex;
      state.stageBaseSpeed = clamp(7.8 + waveIndex * 0.18, 7.8, 12.0);
      resetPaddle();
      resetBallOnPaddle();
      state.aim.active = true;
      updateHUD();
    }

    function startMode(mode) {
      state.mode = mode;
      state.isPaused = false;
      state.isRunning = true;
      state.startedAtMs = nowMs();
      state.lives = 3;
      state.pendingMerit = 0;
      state.bankedMerit = 0;
      state.levelIndex = 0;
      state.waveIndex = 0;
      state.effects.slowUntilMs = 0;
      state.effects.wideUntilMs = 0;
      state.powerups = [];
      state.particles = [];
      state.floaters = [];
      state.rage.active = false;
      state.rage.untilMs = 0;
      state.rage.combo = 0;
      state.rage.nextAutoAtMs = nowMs() + 52000;
      state.controlX = bounds.w / 2;
      state.targetControlX = bounds.w / 2;

      resetPaddle();
      resetBallOnPaddle();
      if (mode === MODE.CAMPAIGN) loadLevel(0);
      else loadWave(0);

      showOverlay(
        mode === MODE.CAMPAIGN ? "闯关：第 1 小关" : "无尽：第 1 波",
        ["打碎罪砖会获得本关功德，但只有清空本关砖块才会入账。", "失败会丢失本关未入账功德，并重试本关。", "点击/轻触发射木鱼；拖动控制法器。"].join("<br/>"),
        { primary: "开始", secondary: "返回" },
        () => {
          hideOverlay(true);
        },
        () => hideOverlay()
      );

      updateHUD();
    }

    function endRun() {
      state.isPaused = true;
      const durationMs = nowMs() - state.startedAtMs;
      const reached = state.mode === MODE.CAMPAIGN ? `第 ${state.levelIndex + 1} 小关` : `第 ${state.waveIndex + 1} 波`;
      const entry = { at: new Date().toISOString(), mode: state.mode, reached, merit: Math.floor(state.bankedMerit), durationSec: Math.floor(durationMs / 1000) };
      addHistoryEntry(save, entry);
      addLeaderboardEntry(save, state.mode, entry);
      saveToStorage(save);

      showOverlay(
        "鏈淇缁撴潫",
        [`模式：${state.mode === MODE.CAMPAIGN ? "闯关" : "无尽"}`, `到达：${reached}`, `本次已入账功德：<span class="mono">${fmtInt(state.bankedMerit)}</span>`, `累计功德：<span class="mono">${fmtInt(save.profile.totalMerit)}</span>`].join("<br/>"),
        { primary: "再来一局", secondary: "查看功德榜" },
        () => {
          hideOverlay();
          startMode(state.mode);
        },
        () => {
          hideOverlay();
          ui.openRecords();
        }
      );
    }

    function loseLife() {
      state.lives -= 1;
      state.pendingMerit = 0;
      state.floaters.push({ x: bounds.w / 2, y: bounds.h / 2, text: "未圆满，功德未入账", ttl: 1200, color: "rgba(255,95,109,0.95)" });
      emitParticles(bounds.w / 2, bounds.h * 0.78, {
        count: 18,
        color: "rgba(255,95,109,0.8)",
        colorAlt: "rgba(245,236,210,0.5)",
        speedMin: 1.1,
        speedMax: 3.4,
        lifeMin: 420,
        lifeMax: 920,
        angle: -Math.PI / 2,
        spread: Math.PI * 0.85,
        gravity: 0.01,
      });
      state.bricks = deepCloneBricks(state.bricksSnapshot);
      state.rage.active = false;
      state.rage.untilMs = 0;
      state.rage.combo = 0;
      state.rage.nextAutoAtMs = nowMs() + 52000;
      resetPaddle();
      resetBallOnPaddle();
      state.aim.active = true;
      woodfishTok(audio, 0.35);
      updateHUD();
      if (state.lives <= 0) endRun();
    }

    function bankPendingAndAdvance() {
      const gained = Math.floor(state.pendingMerit);
      state.pendingMerit = 0;
      state.bankedMerit += gained;
      save.profile.totalMerit = Math.floor((save.profile.totalMerit ?? 0) + gained);
      save.profile.lifetimeMeritEarned = Math.floor((save.profile.lifetimeMeritEarned ?? 0) + gained);
      saveToStorage(save);
      state.floaters.push({ x: bounds.w / 2, y: bounds.h / 2, text: `鍔熷痉鍏ヨ处 +${gained}`, ttl: 1200, color: "rgba(246,211,122,0.98)" });
      emitParticles(bounds.w / 2, bounds.h / 2, {
        count: 28,
        color: "rgba(246,211,122,0.9)",
        colorAlt: "rgba(111,167,155,0.7)",
        speedMin: 0.8,
        speedMax: 2.8,
        lifeMin: 520,
        lifeMax: 1200,
        gravity: -0.001,
        drag: 0.988,
      });
      woodfishTok(audio, 1.0);
      updateHUD();

      if (state.mode === MODE.CAMPAIGN) {
        save.progress.maxCampaignLevelCleared = Math.max(save.progress.maxCampaignLevelCleared ?? 0, state.levelIndex + 1);
        saveToStorage(save);
        state.levelIndex += 1;
        if (state.levelIndex >= 12) {
          save.progress.campaignCleared = true;
          saveToStorage(save);
          showOverlay(
            "闂叧鍦嗘弧",
            `你已完成 12 小关，本次已入账功德：<span class="mono">${fmtInt(state.bankedMerit)}</span><br/>可继续挑战无尽模式。`,
            { primary: "继续闯关循环", secondary: "去无尽" },
            () => {
              hideOverlay(true);
              state.levelIndex = 0;
              loadLevel(0);
            },
            () => {
              hideOverlay();
              startMode(MODE.ENDLESS);
            }
          );
          return;
        }
        loadLevel(state.levelIndex);
        showOverlay(
          `閫氬叧锛氱 ${state.levelIndex} 灏忓叧`,
          "本关功德已入账。下一关会进一步考验控球与预判。",
          { primary: "继续", secondary: "退出" },
          () => hideOverlay(true),
          () => {
            hideOverlay();
            endRun();
          }
        );
      } else {
        state.waveIndex += 1;
        loadWave(state.waveIndex);
        showOverlay(
          `波次清空：第 ${state.waveIndex} 波`,
          "本波功德已入账。下一波罪砖更重、更快、也更难命中。",
          { primary: "继续", secondary: "退出" },
          () => hideOverlay(true),
          () => {
            hideOverlay();
            endRun();
          }
        );
      }
    }

    function maybeDropPowerup(brick) {
      const r = Math.random();
      const dropChance = state.mode === MODE.ENDLESS ? 0.12 : 0.08;
      if (r > dropChance) return;
      const kind = r < 0.45 ? "wide" : r < 0.78 ? "slow" : "merit";
      state.powerups.push({ kind, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: 1.6, r: 10 });
    }

    function applyPowerup(kind) {
      const t = nowMs();
      const p = primaryPaddle();
      if (kind === "wide") {
        state.effects.wideUntilMs = Math.max(state.effects.wideUntilMs, t + 12000);
        state.floaters.push({ x: p.x, y: p.y - 24, text: "娉曞櫒鍔犲", ttl: 900, color: "rgba(120,170,255,0.95)" });
      } else if (kind === "slow") {
        state.effects.slowUntilMs = Math.max(state.effects.slowUntilMs, t + 9000);
        state.floaters.push({ x: p.x, y: p.y - 24, text: "蹇冨畾鍒欐參", ttl: 900, color: "rgba(120,255,210,0.86)" });
      } else if (kind === "merit") {
        state.pendingMerit += 60;
        state.floaters.push({ x: p.x, y: p.y - 24, text: "闅忓枩 +60", ttl: 900, color: "rgba(246,211,122,0.98)" });
        updateHUD();
      }
      emitParticles(p.x, p.y - 8, {
        count: 14,
        color: "rgba(246,211,122,0.8)",
        colorAlt: "rgba(111,167,155,0.8)",
        speedMin: 0.6,
        speedMax: 2.2,
        angle: -Math.PI / 2,
        spread: Math.PI * 0.9,
        lifeMin: 360,
        lifeMax: 860,
        gravity: 0.003,
      });
      woodfishTok(audio, 0.8);
    }

    function computeLaunchVector() {
      const ball = primaryBall();
      const dx = state.aim.tx - ball.x;
      const dy = state.aim.ty - ball.y;
      const angle = Math.atan2(dy, dx);
      const minAngle = (-Math.PI * 5) / 6;
      const maxAngle = (-Math.PI) / 6;
      const a = clamp(angle, minAngle, maxAngle);
      const speed = ball.baseSpeed;
      return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed };
    }

    function launchBall() {
      const ball = primaryBall();
      if (ball.launched) return;
      const woodfish = currentWoodfishTier();
      const v = computeLaunchVector();
      ball.vx = v.vx * woodfish.speedMul;
      ball.vy = v.vy * woodfish.speedMul;
      ball.launched = true;
      state.aim.active = false;
      woodfishTok(audio, 0.8);
    }

    function togglePause() {
      if (!state.isRunning) return;
      state.isPaused = !state.isPaused;
    }

    function restartStage() {
      state.pendingMerit = 0;
      state.bricks = deepCloneBricks(state.bricksSnapshot);
      resetPaddle();
      resetBallOnPaddle();
      state.aim.active = true;
      state.rage.active = false;
      state.rage.untilMs = 0;
      state.rage.combo = 0;
      state.rage.nextAutoAtMs = nowMs() + 52000;
      updateHUD();
    }

    function update(dtMs) {
      if (!state.isRunning || state.isPaused) return;
      const t = nowMs();
      const frameMs = Math.min(dtMs, 26);

      // Rage lifecycle
      if (state.rage.active && t >= state.rage.untilMs) {
        state.rage.active = false;
        state.rage.combo = 0;
        state.paddles = [state.paddles[0]];
        const keep = state.balls.find((b) => b.launched) ?? state.balls[0];
        state.balls = keep ? [keep] : [];
        if (!state.balls.length) resetBallOnPaddle();
      }

      if (!state.rage.active) {
        if (!state.rage.nextAutoAtMs) state.rage.nextAutoAtMs = t + 52000;
        if (state.rage.combo >= 20 || t >= state.rage.nextAutoAtMs) {
          state.rage.active = true;
          state.rage.untilMs = t + 10000;
          state.rage.nextAutoAtMs = t + 65000;

          const extraBalls = 3 + Math.floor(Math.random() * 4); // 3-6
          const totalPaddles = 3 + Math.floor(Math.random() * 4); // 3-6
          const addPaddles = totalPaddles - 1;

          // Add paddles (offset followers)
          const base = state.paddles[0];
          state.paddles = [base];
          for (let i = 0; i < addPaddles; i++) {
            const spread = 120 + i * 70;
            const side = i % 2 === 0 ? 1 : -1;
            const xOffset = side * spread;
            state.paddles.push({ id: i + 1, xOffset, x: base.x, y: base.y, w: base.w * 0.88, h: base.h });
          }

          // Add balls
          const src = primaryBall();
          const woodfish = currentWoodfishTier();
          for (let i = 0; i < extraBalls; i++) {
            const ang = (-Math.PI * 5) / 6 + Math.random() * ((Math.PI * 4) / 6);
            const sp = src.baseSpeed * woodfish.speedMul * 1.22;
            state.balls.push({
              id: state.balls.length,
              x: src.x,
              y: src.y,
              r: src.r,
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp,
              launched: true,
              baseSpeed: src.baseSpeed,
            });
          }

            state.floaters.push({ x: bounds.w / 2, y: bounds.h / 2, text: "鐙傛毚锛氫紬鏈ㄩ奔榻愰福", ttl: 900, color: "rgba(255,120,60,0.95)" });
            emitParticles(bounds.w / 2, bounds.h / 2, {
              count: 34,
              color: "rgba(255,120,60,0.9)",
              colorAlt: "rgba(255,220,120,0.8)",
              speedMin: 1.2,
              speedMax: 4.2,
              lifeMin: 460,
              lifeMax: 1300,
              gravity: 0.004,
            });
            woodfishTok(audio, 1.0);
          }
        }

      const slowMul = t < state.effects.slowUntilMs ? 0.68 : 1.0;
      const rageMul = state.rage.active ? 1.35 : 1.0;
      const dt = (frameMs / 16.6667) * slowMul * rageMul;
      const controlLerp = 1 - Math.pow(0.000001, frameMs / 220);
      state.controlX = lerp(state.controlX, state.targetControlX, controlLerp);

      // Paddle sizing + positions
      const paddleTier = currentPaddleTier();
      const paddleTargetW = paddleTier.baseW + (t < state.effects.wideUntilMs ? 50 : 0);
      for (const p of state.paddles) {
        p.w = lerp(p.w, paddleTargetW * (p.id === 0 ? 1 : 0.86), 0.18);
        const targetX = state.controlX + (p.xOffset ?? 0);
        p.x = clamp(targetX, p.w / 2 + 8, bounds.w - p.w / 2 - 8);
      }

      // Anchor unlaunched primary ball
      const pb = primaryBall();
      if (pb && !pb.launched) {
        const p0 = primaryPaddle();
        pb.x = p0.x;
        pb.y = p0.y - 18;
        pb.baseSpeed = state.stageBaseSpeed;
      }

      // Move balls + wall collisions
        for (const ball of state.balls) {
          if (!ball.launched) continue;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          if (Math.random() < (state.rage.active ? 0.9 : 0.35)) {
            state.particles.push({
              x: ball.x - ball.vx * 1.8,
              y: ball.y - ball.vy * 1.8,
              vx: -ball.vx * 0.05,
              vy: -ball.vy * 0.05,
              size: state.rage.active ? 3.2 : 2.1,
              ttl: state.rage.active ? 340 : 220,
              maxTtl: state.rage.active ? 340 : 220,
              gravity: 0,
              drag: 0.96,
              color: state.rage.active ? "rgba(255,120,60,0.55)" : "rgba(216,184,107,0.35)",
              glow: state.rage.active ? 0.95 : 0.4,
            });
          }

          if (ball.x - ball.r < 0) {
            ball.x = ball.r;
            ball.vx *= -1;
            emitParticles(ball.x, ball.y, { count: 8, color: "rgba(216,184,107,0.7)", lifeMin: 220, lifeMax: 500, speedMin: 0.8, speedMax: 2.0 });
            woodfishTok(audio, 0.35);
          } else if (ball.x + ball.r > bounds.w) {
            ball.x = bounds.w - ball.r;
            ball.vx *= -1;
            emitParticles(ball.x, ball.y, { count: 8, color: "rgba(216,184,107,0.7)", lifeMin: 220, lifeMax: 500, speedMin: 0.8, speedMax: 2.0 });
            woodfishTok(audio, 0.35);
          }
          if (ball.y - ball.r < 0) {
            ball.y = ball.r;
            ball.vy *= -1;
            emitParticles(ball.x, ball.y, { count: 8, color: "rgba(111,167,155,0.7)", lifeMin: 220, lifeMax: 500, speedMin: 0.8, speedMax: 2.0 });
            woodfishTok(audio, 0.35);
          }
        }

      // Paddle collisions (any ball vs any paddle)
      const deflectMul = paddleTier.deflectMul;
      for (const ball of state.balls) {
        if (!ball.launched) continue;
        for (const p of state.paddles) {
          if (!circleRectCollision(ball.x, ball.y, ball.r, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) continue;
          ball.y = p.y - p.h / 2 - ball.r - 0.5;
            ball.vy = -Math.abs(ball.vy);
            const offset = (ball.x - p.x) / (p.w / 2);
            ball.vx = clamp(ball.vx + offset * 1.5 * deflectMul, -15, 15);
            state.rage.combo = 0;
            emitParticles(ball.x, p.y - 4, {
              count: 12,
              color: "rgba(246,211,122,0.78)",
              colorAlt: "rgba(245,236,210,0.45)",
              angle: -Math.PI / 2,
              spread: Math.PI * 0.7,
              speedMin: 0.9,
              speedMax: 2.6,
              lifeMin: 260,
              lifeMax: 620,
              gravity: 0.004,
            });
            woodfishTok(audio, 0.55);
            break;
          }
      }

      // Brick movement
      for (const brick of state.bricks) {
        if (brick.moveType !== "none") {
          const s = Math.sin((t / 1000) * (brick.moveSpeed / 45) + brick.phase);
          if (brick.moveType === "h") brick.x = brick.ox + s * brick.moveRange;
          else brick.y = brick.oy + s * brick.moveRange * 0.7;
        }
      }

      // Brick collisions (per ball, at most one brick per frame)
      for (const ball of state.balls) {
        if (!ball.launched) continue;
        for (let i = 0; i < state.bricks.length; i++) {
          const b = state.bricks[i];
          if (!circleRectCollision(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h)) continue;
          reflectBallOnRect(ball, b.x, b.y, b.w, b.h);
          b.hp -= 1;
          state.rage.combo += 1;
            woodfishTok(audio, 0.6);
            if (b.hp <= 0) {
              state.pendingMerit += b.sin;
              state.floaters.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: `-${b.sin} 缃?鈫?+${b.sin} 鍔熷痉`, ttl: 900, color: "rgba(246,211,122,0.96)" });
              emitParticles(b.x + b.w / 2, b.y + b.h / 2, {
                count: 16 + Math.min(12, b.hpMax * 3),
                color: isFinite(b.moveSpeed) && b.moveSpeed > 0 ? "rgba(255,120,60,0.75)" : "rgba(246,211,122,0.82)",
                colorAlt: "rgba(111,167,155,0.62)",
                speedMin: 1.0,
                speedMax: 3.4,
                lifeMin: 360,
                lifeMax: 880,
                gravity: 0.006,
              });
              maybeDropPowerup(b);
              state.bricks.splice(i, 1);
              i -= 1;
              updateHUD();
              if (state.bricks.length === 0) bankPendingAndAdvance();
            } else {
              state.floaters.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: `罪孽尚存：${b.hp}`, ttl: 500, color: "rgba(233,238,248,0.72)" });
              emitParticles(b.x + b.w / 2, b.y + b.h / 2, {
                count: 7,
                color: "rgba(245,236,210,0.38)",
                colorAlt: "rgba(111,167,155,0.3)",
                speedMin: 0.6,
                speedMax: 1.8,
                lifeMin: 180,
                lifeMax: 420,
                gravity: 0.003,
              });
            }
            break;
          }
        }

      // Powerups
      for (let i = 0; i < state.powerups.length; i++) {
        const pu = state.powerups[i];
        pu.y += pu.vy * dt;
        let caught = false;
        for (const p of state.paddles) {
          if (!circleRectCollision(pu.x, pu.y, pu.r, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) continue;
          applyPowerup(pu.kind);
          caught = true;
          break;
        }
        if (caught) {
          state.powerups.splice(i, 1);
          i -= 1;
          continue;
        }
        if (pu.y - pu.r > bounds.h) {
          state.powerups.splice(i, 1);
          i -= 1;
        }
      }

      // Floaters
      for (let i = 0; i < state.floaters.length; i++) {
        const f = state.floaters[i];
        f.ttl -= frameMs;
        f.y -= 0.04 * frameMs;
        if (f.ttl <= 0) {
          state.floaters.splice(i, 1);
          i -= 1;
        }
      }

      for (let i = 0; i < state.particles.length; i++) {
        const p = state.particles[i];
        p.ttl -= frameMs;
        p.vx *= Math.pow(p.drag ?? 0.992, frameMs / 16.6667);
        p.vy *= Math.pow(p.drag ?? 0.992, frameMs / 16.6667);
        p.vy += (p.gravity ?? 0.006) * (frameMs / 16.6667);
        p.x += p.vx * (frameMs / 16.6667);
        p.y += p.vy * (frameMs / 16.6667);
        if (p.ttl <= 0) {
          state.particles.splice(i, 1);
          i -= 1;
        }
      }

      audio.updateBgm();

      // Fall out per ball
      for (let i = 0; i < state.balls.length; i++) {
        const ball = state.balls[i];
        if (!ball.launched) continue;
        if (ball.y - ball.r > bounds.h) {
          state.balls.splice(i, 1);
          i -= 1;
        }
      }
      if (!state.balls.length) loseLife();
    }

    function roundRect(ctx2, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx2.beginPath();
      ctx2.moveTo(x + rr, y);
      ctx2.arcTo(x + w, y, x + w, y + h, rr);
      ctx2.arcTo(x + w, y + h, x, y + h, rr);
      ctx2.arcTo(x, y + h, x, y, rr);
      ctx2.arcTo(x, y, x + w, y, rr);
      ctx2.closePath();
    }

    function clipRoundRect(ctx2, x, y, w, h, r) {
      roundRect(ctx2, x, y, w, h, r);
      ctx2.clip();
    }

    function drawWoodgrain(ctx2, x, y, r, tint) {
      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(x, y, r - 0.8, 0, Math.PI * 2);
      ctx2.clip();
      ctx2.strokeStyle = tint;
      for (let i = 0; i < 5; i++) {
        const rx = r * (0.22 + i * 0.13);
        const ry = r * (0.16 + i * 0.11);
        ctx2.lineWidth = Math.max(0.7, r * (0.02 + i * 0.004));
        ctx2.beginPath();
        ctx2.ellipse(x + r * 0.1 - i * 0.9, y + r * 0.08 + i * 0.55, rx, ry, 0.28, 0.15, Math.PI * 1.7);
        ctx2.stroke();
      }
      ctx2.restore();
    }

    function drawMetalBrushed(ctx2, x, y, r, tint) {
      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(x, y, r - 0.8, 0, Math.PI * 2);
      ctx2.clip();
      ctx2.strokeStyle = tint;
      ctx2.lineWidth = Math.max(0.8, r * 0.05);
      for (let i = -r; i < r; i += Math.max(3, r * 0.18)) {
        ctx2.beginPath();
        ctx2.moveTo(x - r * 0.9, y + i * 0.55);
        ctx2.lineTo(x + r * 0.9, y + i * 0.15);
        ctx2.stroke();
      }
      ctx2.restore();
    }

    function drawCrystalFacets(ctx2, x, y, r, tint) {
      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(x, y, r - 0.8, 0, Math.PI * 2);
      ctx2.clip();
      ctx2.strokeStyle = tint;
      ctx2.lineWidth = Math.max(0.9, r * 0.04);
      for (let i = 0; i < 4; i++) {
        const angle = -Math.PI / 4 + (i * Math.PI) / 4;
        ctx2.beginPath();
        ctx2.moveTo(x, y);
        ctx2.lineTo(x + Math.cos(angle) * r * 0.82, y + Math.sin(angle) * r * 0.82);
        ctx2.stroke();
      }
      ctx2.restore();
    }

    function drawBrickSurfaceNoise(ctx2, x, y, w, h, seed, tint) {
      ctx2.save();
      clipRoundRect(ctx2, x + 1, y + 1, w - 2, h - 2, 7);
      ctx2.fillStyle = tint;
      const dotCount = Math.max(8, Math.floor((w * h) / 180));
      for (let i = 0; i < dotCount; i++) {
        const sx = x + 3 + (((seed * 997 + i * 37) % 1000) / 1000) * (w - 6);
        const sy = y + 3 + (((seed * 619 + i * 53) % 1000) / 1000) * (h - 6);
        const rr = 0.6 + ((((seed * 409 + i * 23) % 1000) / 1000) * 1.4);
        ctx2.beginPath();
        ctx2.arc(sx, sy, rr, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.restore();
    }

    function getPaddlePalette(key, isFollower = false) {
      const palettes = {
        mortal: {
          core: isFollower ? "rgba(246,211,122,0.42)" : "rgba(246,211,122,0.6)",
          edge: isFollower ? "rgba(255,243,204,0.45)" : "rgba(255,243,204,0.68)",
          aura: isFollower ? "rgba(246,211,122,0.12)" : "rgba(246,211,122,0.22)",
          gem: "rgba(185,98,30,0.9)",
        },
        spirit: {
          core: isFollower ? "rgba(148,198,255,0.48)" : "rgba(148,198,255,0.68)",
          edge: isFollower ? "rgba(230,245,255,0.42)" : "rgba(230,245,255,0.72)",
          aura: isFollower ? "rgba(120,170,255,0.14)" : "rgba(120,170,255,0.24)",
          gem: "rgba(93,132,255,0.95)",
        },
        dharma: {
          core: isFollower ? "rgba(136,255,224,0.48)" : "rgba(136,255,224,0.68)",
          edge: isFollower ? "rgba(234,255,252,0.44)" : "rgba(234,255,252,0.74)",
          aura: isFollower ? "rgba(120,255,210,0.16)" : "rgba(120,255,210,0.26)",
          gem: "rgba(51,180,152,0.92)",
        },
        treasure: {
          core: isFollower ? "rgba(255,188,118,0.5)" : "rgba(255,188,118,0.72)",
          edge: isFollower ? "rgba(255,239,205,0.46)" : "rgba(255,239,205,0.76)",
          aura: isFollower ? "rgba(255,170,80,0.16)" : "rgba(255,170,80,0.28)",
          gem: "rgba(214,102,26,0.94)",
        },
        sacred: {
          core: isFollower ? "rgba(255,150,214,0.52)" : "rgba(255,150,214,0.76)",
          edge: isFollower ? "rgba(255,248,255,0.48)" : "rgba(255,248,255,0.8)",
          aura: isFollower ? "rgba(199,125,255,0.18)" : "rgba(199,125,255,0.3)",
          gem: "rgba(126,110,255,0.96)",
        },
      };
      return palettes[key] ?? palettes.mortal;
    }

    function drawPaddleInlay(ctx2, x, y, w, h, tint) {
      ctx2.save();
      clipRoundRect(ctx2, x, y, w, h, 10);
      ctx2.strokeStyle = tint;
      ctx2.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const yy = y + (h / 4) * i - h / 8;
        ctx2.beginPath();
        ctx2.moveTo(x + 10, yy);
        ctx2.lineTo(x + w - 10, yy);
        ctx2.stroke();
      }
      ctx2.restore();
    }

    function drawFlyingSwordPaddle(ctx2, paddle, tierKey, isRage, tMs) {
      const isFollower = paddle.id !== 0;
      const palette = getPaddlePalette(tierKey, isFollower);
      const length = paddle.w;
      const bladeHalf = Math.max(22, length * 0.46);
      const bladeHeight = paddle.h * (isFollower ? 0.76 : 0.9);
      const guardHalf = Math.max(11, length * 0.1);
      const glow = ctx2.createRadialGradient(0, 0, 0, 0, 0, bladeHalf * 1.15);
      glow.addColorStop(0, palette.aura);
      glow.addColorStop(1, "rgba(0,0,0,0)");

      ctx2.save();
      ctx2.fillStyle = glow;
      ctx2.beginPath();
      ctx2.ellipse(0, 0, bladeHalf * 1.04, bladeHeight * 2.3, 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();

      ctx2.save();
      ctx2.shadowColor = palette.aura;
      ctx2.shadowBlur = isFollower ? 10 : 16;
      ctx2.beginPath();
      ctx2.moveTo(-bladeHalf, 0);
      ctx2.lineTo(-bladeHalf * 0.78, -bladeHeight * 0.66);
      ctx2.lineTo(bladeHalf * 0.78, -bladeHeight * 0.66);
      ctx2.lineTo(bladeHalf, 0);
      ctx2.lineTo(bladeHalf * 0.78, bladeHeight * 0.66);
      ctx2.lineTo(-bladeHalf * 0.78, bladeHeight * 0.66);
      ctx2.closePath();
      const bladeGrad = ctx2.createLinearGradient(-bladeHalf, 0, bladeHalf, 0);
      bladeGrad.addColorStop(0, "rgba(255,255,255,0.14)");
      bladeGrad.addColorStop(0.2, palette.edge);
      bladeGrad.addColorStop(0.52, palette.core);
      bladeGrad.addColorStop(0.8, palette.edge);
      bladeGrad.addColorStop(1, "rgba(120,170,255,0.2)");
      ctx2.fillStyle = bladeGrad;
      ctx2.fill();
      ctx2.restore();

      ctx2.save();
      ctx2.strokeStyle = "rgba(255,255,255,0.28)";
      ctx2.lineWidth = isFollower ? 1 : 1.4;
      ctx2.beginPath();
      ctx2.moveTo(-bladeHalf * 0.82, 0);
      ctx2.lineTo(bladeHalf * 0.86, 0);
      ctx2.stroke();
      ctx2.restore();

      ctx2.save();
      const guardGrad = ctx2.createLinearGradient(-guardHalf, 0, guardHalf, 0);
      guardGrad.addColorStop(0, "rgba(255,245,220,0.15)");
      guardGrad.addColorStop(0.5, palette.core);
      guardGrad.addColorStop(1, "rgba(255,245,220,0.15)");
      ctx2.fillStyle = guardGrad;
      roundRect(ctx2, -guardHalf, -bladeHeight * 0.74, guardHalf * 2, bladeHeight * 1.48, bladeHeight * 0.42);
      ctx2.fill();
      ctx2.strokeStyle = "rgba(255,255,255,0.18)";
      ctx2.stroke();
      ctx2.restore();

      ctx2.save();
      const gemR = isFollower ? 4.2 : 5.4;
      const gem = ctx2.createRadialGradient(0, 0, 0, 0, 0, gemR * 2);
      gem.addColorStop(0, "rgba(255,255,255,0.92)");
      gem.addColorStop(0.28, palette.gem);
      gem.addColorStop(1, "rgba(0,0,0,0)");
      ctx2.fillStyle = gem;
      ctx2.beginPath();
      ctx2.arc(0, 0, gemR * 1.45, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();

      ctx2.save();
      ctx2.globalAlpha = isFollower ? 0.38 : 0.5;
      ctx2.strokeStyle = palette.edge;
      ctx2.lineWidth = 1.2;
      ctx2.beginPath();
      ctx2.moveTo(-bladeHalf * 0.95, 0);
      ctx2.quadraticCurveTo(-bladeHalf * 0.62, 0, -bladeHalf * 0.38, Math.sin(tMs / 280 + paddle.id) * bladeHeight * 0.45);
      ctx2.moveTo(bladeHalf * 0.95, 0);
      ctx2.quadraticCurveTo(bladeHalf * 0.62, 0, bladeHalf * 0.38, -Math.sin(tMs / 280 + paddle.id) * bladeHeight * 0.45);
      ctx2.stroke();
      ctx2.restore();

      if (isRage) {
        const flameR = Math.max(12, paddle.h * 1.5);
        drawFlame(ctx2, -bladeHalf * 0.25, 0, flameR, tMs);
        drawFlame(ctx2, bladeHalf * 0.35, 0, flameR * 0.92, tMs + 180);
      }
    }

    function drawSkyWisps(ctx2, t) {
      ctx2.save();
      ctx2.globalAlpha = 0.14;
      for (let i = 0; i < 4; i++) {
        const baseX = ((t * (12 + i * 4)) + i * 220) % (bounds.w + 280) - 140;
        const y = 74 + i * 58;
        const g = ctx2.createRadialGradient(baseX, y, 8, baseX, y, 120);
        g.addColorStop(0, i % 2 ? "rgba(216,184,107,0.28)" : "rgba(111,167,155,0.22)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx2.fillStyle = g;
        ctx2.beginPath();
        ctx2.ellipse(baseX, y, 140, 26 + i * 4, 0, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.restore();
    }

    function drawMountainLayer(ctx2, baseY, amp, color, seedShift) {
      ctx2.save();
      ctx2.fillStyle = color;
      ctx2.beginPath();
      ctx2.moveTo(0, bounds.h);
      ctx2.lineTo(0, baseY);
      for (let x = 0; x <= bounds.w + 20; x += 20) {
        const y =
          baseY -
          Math.sin((x + seedShift) * 0.014) * amp -
          Math.sin((x + seedShift * 0.7) * 0.028) * amp * 0.35 -
          Math.cos((x + seedShift * 0.31) * 0.006) * amp * 0.42;
        ctx2.lineTo(x, y);
      }
      ctx2.lineTo(bounds.w, bounds.h);
      ctx2.closePath();
      ctx2.fill();
      ctx2.restore();
    }

    function drawRuneCircle(ctx2, cx, cy, r, t) {
      ctx2.save();
      ctx2.translate(cx, cy);
      ctx2.rotate(t * 0.04);
      ctx2.globalAlpha = 0.22;
      ctx2.strokeStyle = "rgba(216,184,107,0.34)";
      ctx2.lineWidth = 1.2;
      ctx2.beginPath();
      ctx2.arc(0, 0, r, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx2.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const glyph = ["禅", "定", "破", "妄", "慧", "空", "明", "悟"][i % 8];
        ctx2.save();
        ctx2.rotate(a);
        ctx2.translate(0, -r * 0.86);
        ctx2.rotate(-a);
        ctx2.fillStyle = "rgba(245,236,210,0.18)";
        ctx2.font = "700 12px 'STZhongsong', 'Songti SC', serif";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText(glyph, 0, 0);
        ctx2.restore();
      }
      ctx2.restore();
    }

    function drawWoodfish(ctx2, x, y, r) {
      ctx2.save();
      const woodfish = currentWoodfishTier();
      const key = woodfish.key;
      const t = nowMs() / 1000;
      const palettes = {
        bronze: ["rgba(246,211,122,0.98)", "rgba(242,181,68,0.96)", "rgba(169,92,22,0.96)"],
        blackiron: ["rgba(210,220,230,0.78)", "rgba(90,105,120,0.86)", "rgba(26,30,38,0.98)"],
        gold: ["rgba(255,244,170,0.98)", "rgba(246,211,122,0.96)", "rgba(210,140,10,0.98)"],
        diamond: ["rgba(210,250,255,0.96)", "rgba(120,210,255,0.9)", "rgba(70,140,255,0.92)"],
        rainbow: null,
      };

      let grad = null;
      if (key === "rainbow") {
        const hue = (t * 70) % 360;
        const c0 = `hsla(${hue}, 90%, 72%, 0.98)`;
        const c1 = `hsla(${(hue + 90) % 360}, 90%, 62%, 0.96)`;
        const c2 = `hsla(${(hue + 190) % 360}, 90%, 52%, 0.96)`;
        grad = ctx2.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r * 1.35);
        grad.addColorStop(0, c0);
        grad.addColorStop(0.55, c1);
        grad.addColorStop(1, c2);
      } else {
        const p = palettes[key] ?? palettes.bronze;
        grad = ctx2.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r * 1.35);
        grad.addColorStop(0, p[0]);
        grad.addColorStop(0.55, p[1]);
        grad.addColorStop(1, p[2]);
      }
      ctx2.fillStyle = grad;
      ctx2.strokeStyle = "rgba(0,0,0,0.22)";
      ctx2.lineWidth = 1.5;
      ctx2.shadowColor = key === "rainbow" ? "rgba(255, 190, 120, 0.28)" : "rgba(0, 0, 0, 0.22)";
      ctx2.shadowBlur = r * 0.8;
      ctx2.beginPath();
      ctx2.arc(x, y, r, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.stroke();
      ctx2.shadowBlur = 0;

      ctx2.strokeStyle = "rgba(0,0,0,0.18)";
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.arc(x + r * 0.14, y + r * 0.12, r * 0.55, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(x - r * 0.06, y - r * 0.04, r * 0.3, 0, Math.PI * 2);
      ctx2.stroke();

      ctx2.fillStyle = "rgba(255,255,255,0.18)";
      ctx2.beginPath();
      ctx2.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.fillStyle = "rgba(255,255,255,0.06)";
      ctx2.beginPath();
      ctx2.arc(x + r * 0.18, y + r * 0.2, r * 0.62, 0.1, Math.PI * 1.25);
      ctx2.strokeStyle = "rgba(255,255,255,0.08)";
      ctx2.lineWidth = Math.max(1, r * 0.08);
      ctx2.stroke();

      if (key === "bronze" || key === "gold" || key === "rainbow") {
        drawWoodgrain(ctx2, x, y, r * 0.94, key === "gold" ? "rgba(120,72,12,0.18)" : "rgba(85,40,10,0.2)");
      }
      if (key === "blackiron" || key === "gold") {
        drawMetalBrushed(ctx2, x, y, r * 0.96, key === "gold" ? "rgba(255,248,170,0.11)" : "rgba(255,255,255,0.08)");
      }

      if (key === "diamond") {
        drawCrystalFacets(ctx2, x, y, r * 0.96, "rgba(255,255,255,0.16)");
        ctx2.save();
        ctx2.strokeStyle = "rgba(255,255,255,0.22)";
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.moveTo(x - r * 0.2, y);
        ctx2.lineTo(x, y - r * 0.35);
        ctx2.lineTo(x + r * 0.28, y);
        ctx2.lineTo(x, y + r * 0.32);
        ctx2.closePath();
        ctx2.stroke();
        ctx2.restore();
      } else if (key === "blackiron") {
        ctx2.save();
        ctx2.fillStyle = "rgba(0,0,0,0.18)";
        ctx2.beginPath();
        ctx2.arc(x + r * 0.2, y + r * 0.25, r * 0.28, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.restore();
      } else if (key === "rainbow") {
        drawCrystalFacets(ctx2, x, y, r * 0.92, "rgba(255,255,255,0.14)");
      }

      ctx2.restore();
    }

    function drawFlame(ctx2, x, y, r, tMs) {
      const t = tMs / 1000;
      ctx2.save();
      ctx2.globalCompositeOperation = "lighter";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 2.4;
        const wobble = 0.65 + 0.35 * Math.sin(t * 8 + i);
        const px = x + Math.cos(a) * (r * (0.6 + wobble * 0.55));
        const py = y + Math.sin(a) * (r * (0.6 + wobble * 0.55));
        const rr = r * (0.18 + wobble * 0.16);
        const g = ctx2.createRadialGradient(px, py, 0, px, py, rr * 2.2);
        g.addColorStop(0, "rgba(255,220,120,0.48)");
        g.addColorStop(0.35, "rgba(255,120,60,0.32)");
        g.addColorStop(1, "rgba(255,80,40,0.0)");
        ctx2.fillStyle = g;
        ctx2.beginPath();
        ctx2.arc(px, py, rr * 2.2, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, bounds.w, bounds.h);
      const sceneTime = nowMs() / 1000;

      ctx.save();
      const bg = ctx.createLinearGradient(0, 0, 0, bounds.h);
      bg.addColorStop(0, "rgba(9, 13, 20, 0.96)");
      bg.addColorStop(0.42, "rgba(18, 26, 36, 0.86)");
      bg.addColorStop(0.72, "rgba(30, 20, 16, 0.8)");
      bg.addColorStop(1, "rgba(23, 14, 10, 0.92)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, bounds.w, bounds.h);
      const glowA = ctx.createRadialGradient(bounds.w * 0.18, bounds.h * 0.12, 10, bounds.w * 0.18, bounds.h * 0.12, 260);
      glowA.addColorStop(0, "rgba(216,184,107,0.16)");
      glowA.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowA;
      ctx.fillRect(0, 0, bounds.w, bounds.h);
      const glowB = ctx.createRadialGradient(bounds.w * 0.82, bounds.h * 0.18, 10, bounds.w * 0.82, bounds.h * 0.18, 220);
      glowB.addColorStop(0, "rgba(111,167,155,0.12)");
      glowB.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowB;
      ctx.fillRect(0, 0, bounds.w, bounds.h);
      ctx.restore();

      drawSkyWisps(ctx, sceneTime);
      drawRuneCircle(ctx, bounds.w * 0.16, bounds.h * 0.22, 48, sceneTime);
      drawRuneCircle(ctx, bounds.w * 0.84, bounds.h * 0.18, 36, -sceneTime * 0.8);
      drawMountainLayer(ctx, bounds.h * 0.74, 34, "rgba(24, 32, 40, 0.82)", 0);
      drawMountainLayer(ctx, bounds.h * 0.8, 48, "rgba(17, 24, 31, 0.92)", 180);
      drawMountainLayer(ctx, bounds.h * 0.86, 26, "rgba(35, 23, 18, 0.95)", 420);

      ctx.save();
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 28; i++) {
        const px = (i * 137 + 40) % bounds.w;
        const py = (i * 83 + 20) % bounds.h;
        ctx.beginPath();
        ctx.arc(px, py, 1.2 + (i % 3), 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? "rgba(246,211,122,1)" : "rgba(120,170,255,1)";
        ctx.fill();
      }
      ctx.restore();

      // Bricks
      for (const b of state.bricks) {
        const isMoving = b.moveType !== "none";
        const heaviness = clamp((b.hpMax - 1) / 6, 0, 1);
        const speedFactor = clamp((b.moveSpeed ?? 0) / 220, 0, 1);
        const hue = isMoving ? 18 + 30 * speedFactor : 210 - 40 * heaviness;
        const sat = isMoving ? 82 : 70;
        const light = isMoving ? 55 : 58 - 10 * heaviness;
        const baseAlpha = 0.84;
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${baseAlpha})`;
        ctx.strokeStyle = "rgba(233,238,248,0.18)";

        // Glow for high sin
        if ((b.sin ?? 0) >= 120) {
          ctx.save();
          ctx.shadowColor = isMoving ? "rgba(255,120,60,0.35)" : "rgba(120,170,255,0.28)";
          ctx.shadowBlur = 16;
          roundRect(ctx, b.x, b.y, b.w, b.h, 8);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${baseAlpha})`;
        }

        roundRect(ctx, b.x, b.y, b.w, b.h, 8);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        const shine = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        shine.addColorStop(0, "rgba(255,255,255,0.14)");
        shine.addColorStop(0.45, "rgba(255,255,255,0.03)");
        shine.addColorStop(1, "rgba(0,0,0,0.08)");
        ctx.fillStyle = shine;
        roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 7);
        ctx.fill();
        ctx.restore();
        drawBrickSurfaceNoise(
          ctx,
          b.x,
          b.y,
          b.w,
          b.h,
          Math.floor((b.styleSeed ?? 0.37) * 1000),
          isMoving ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.06)"
        );

        ctx.save();
        clipRoundRect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 7);
        ctx.strokeStyle = isMoving ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + 6, b.y + 5);
        ctx.lineTo(b.x + b.w - 6, b.y + 5);
        ctx.stroke();
        ctx.restore();

        // Patterns
        if (b.variant === "stripes" || isMoving) {
          ctx.save();
          ctx.beginPath();
          roundRect(ctx, b.x, b.y, b.w, b.h, 8);
          ctx.clip();
          ctx.strokeStyle = "rgba(255,255,255,0.13)";
          ctx.lineWidth = 2;
          for (let k = -b.h; k < b.w + b.h; k += 10) {
            ctx.beginPath();
            ctx.moveTo(b.x + k, b.y);
            ctx.lineTo(b.x + k - b.h, b.y + b.h);
            ctx.stroke();
          }
          ctx.restore();
        } else if (b.variant === "cracked") {
          ctx.save();
          ctx.strokeStyle = "rgba(0,0,0,0.22)";
          ctx.lineWidth = 1;
          const sx = b.x + b.w * (0.35 + (b.styleSeed ?? 0.4) * 0.3);
          const sy = b.y + b.h * 0.25;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - b.w * 0.18, sy + b.h * 0.35);
          ctx.lineTo(sx + b.w * 0.1, sy + b.h * 0.55);
          ctx.lineTo(sx - b.w * 0.08, sy + b.h * 0.85);
          ctx.stroke();
          ctx.restore();
        } else if (b.variant === "rune") {
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.font = "900 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(b.glyph ?? "业", b.x + 8, b.y + b.h - 6);
          ctx.strokeStyle = "rgba(255,255,255,0.08)";
          ctx.lineWidth = 1;
          ctx.strokeText(b.glyph ?? "业", b.x + 8, b.y + b.h - 6);
          ctx.restore();
        } else if (b.hpMax >= 3) {
          ctx.save();
          ctx.fillStyle = "rgba(255,255,255,0.09)";
          ctx.beginPath();
          ctx.arc(b.x + b.w - 14, b.y + 12, 4, 0, Math.PI * 2);
          ctx.arc(b.x + b.w - 26, b.y + 12, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${b.sin}`, b.x + b.w / 2 + 0.5, b.y + b.h / 2 + 1.5);
        if (b.hpMax > 1) {
          ctx.fillStyle = "rgba(233,238,248,0.75)";
          ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillText(`脳${b.hp}`, b.x + b.w - 16, b.y + 10);
        }
      }

      for (const particle of state.particles) {
        const alpha = clamp(particle.ttl / particle.maxTtl, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 12 * (particle.glow ?? 0.4);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(0.6, particle.size * alpha), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Paddles (法器)
      const paddleTierVisual = currentPaddleTier();
      const drawTimeMs = nowMs();
      for (const p of state.paddles) {
        const isRage = state.rage.active;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (paddleTierVisual.key === "mortal") {
          const baseFill = p.id === 0 ? "rgba(246,211,122,0.22)" : "rgba(246,211,122,0.14)";
          const baseStroke = p.id === 0 ? "rgba(246,211,122,0.35)" : "rgba(246,211,122,0.22)";
          const paddleGrad = ctx.createLinearGradient(-p.w / 2, 0, p.w / 2, 0);
          paddleGrad.addColorStop(0, p.id === 0 ? "rgba(255,240,170,0.18)" : "rgba(255,240,170,0.08)");
          paddleGrad.addColorStop(0.5, baseFill);
          paddleGrad.addColorStop(1, "rgba(120,170,255,0.14)");
          ctx.fillStyle = baseFill;
          ctx.strokeStyle = baseStroke;
          ctx.shadowColor = "rgba(0,0,0,0.22)";
          ctx.shadowBlur = 10;
          roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 10);
          ctx.fillStyle = paddleGrad;
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
          drawPaddleInlay(ctx, -p.w / 2, -p.h / 2, p.w, p.h, p.id === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)");
          ctx.save();
          clipRoundRect(ctx, -p.w / 2 + 1, -p.h / 2 + 1, p.w - 2, p.h - 2, 9);
          const topShine = ctx.createLinearGradient(0, -p.h / 2, 0, p.h / 2);
          topShine.addColorStop(0, "rgba(255,255,255,0.16)");
          topShine.addColorStop(0.45, "rgba(255,255,255,0.03)");
          topShine.addColorStop(1, "rgba(0,0,0,0.08)");
          ctx.fillStyle = topShine;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
          if (isRage) {
            const g = ctx.createLinearGradient(0, -p.h, 0, p.h);
            g.addColorStop(0, "rgba(255,80,40,0.0)");
            g.addColorStop(0.55, "rgba(255,120,60,0.28)");
            g.addColorStop(1, "rgba(255,220,120,0.08)");
            ctx.fillStyle = g;
            roundRect(ctx, -p.w / 2, -p.h / 2 - 3, p.w, p.h + 6, 12);
            ctx.fill();
          }
        } else {
          drawFlyingSwordPaddle(ctx, p, paddleTierVisual.key, isRage, drawTimeMs);
        }
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "rgba(216,184,107,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, bounds.h - 78);
      ctx.bezierCurveTo(bounds.w * 0.28, bounds.h - 110, bounds.w * 0.72, bounds.h - 108, bounds.w - 20, bounds.h - 74);
      ctx.stroke();
      ctx.restore();

      // Aim line
      const aimBall = primaryBall();
      if (aimBall && !aimBall.launched && state.aim.active) {
        ctx.save();
        ctx.strokeStyle = "rgba(246,211,122,0.28)";
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        const a = computeLaunchVector();
        const len = 340;
        ctx.beginPath();
        ctx.moveTo(aimBall.x, aimBall.y);
        ctx.lineTo(aimBall.x + a.vx * (len / a.speed), aimBall.y + a.vy * (len / a.speed));
        ctx.stroke();
        ctx.restore();
      }

      // Balls (鏈ㄩ奔)
      for (const b of state.balls) {
        drawWoodfish(ctx, b.x, b.y, b.r);
        if (state.rage.active && b.launched) drawFlame(ctx, b.x, b.y, b.r, nowMs());
      }

      // Powerups
      for (const pu of state.powerups) {
        ctx.save();
        ctx.shadowColor = pu.kind === "wide" ? "rgba(120,170,255,0.45)" : pu.kind === "slow" ? "rgba(120,255,210,0.45)" : "rgba(246,211,122,0.45)";
        ctx.shadowBlur = 16;
        ctx.fillStyle = pu.kind === "wide" ? "rgba(120,170,255,0.92)" : pu.kind === "slow" ? "rgba(120,255,210,0.86)" : "rgba(246,211,122,0.94)";
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, pu.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.font = "800 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pu.kind === "wide" ? "宽" : pu.kind === "slow" ? "缓" : "福", pu.x, pu.y + 0.5);
        ctx.restore();
      }

      // Floaters
      for (const f of state.floaters) {
        const alpha = clamp(f.ttl / 900, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = f.color;
        ctx.font = "700 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      }

      if (state.isPaused && state.isRunning && !ui.overlayVisible() && !ui.recordsVisible()) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.42)";
        ctx.fillRect(0, 0, bounds.w, bounds.h);
        ctx.fillStyle = "rgba(233,238,248,0.9)";
        ctx.font = "800 22px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("暂停中", bounds.w / 2, bounds.h / 2);
        ctx.restore();
      }
    }

    function onPointerMove(clientX) {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * bounds.w;
      state.targetControlX = clamp(x, 8, bounds.w - 8);
      const b = primaryBall();
      const p0 = primaryPaddle();
      if (!b?.launched && p0) {
        state.controlX = state.targetControlX;
        p0.x = clamp(state.controlX, p0.w / 2 + 8, bounds.w - p0.w / 2 - 8);
        b.x = p0.x;
      }
    }

    function onAimMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      state.aim.tx = ((clientX - rect.left) / rect.width) * bounds.w;
      state.aim.ty = ((clientY - rect.top) / rect.height) * bounds.h;
    }

    function bindInput() {
      let activePointerId = null;
      canvas.addEventListener("pointerdown", async (e) => {
        activePointerId = e.pointerId;
        canvas.setPointerCapture(activePointerId);
        await audio.enable();
        audio.startBgm();
        ui.syncAudio(audio.bgmEnabled);
        onPointerMove(e.clientX);
        onAimMove(e.clientX, e.clientY);
      });
      canvas.addEventListener("pointermove", (e) => {
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        onPointerMove(e.clientX);
        onAimMove(e.clientX, e.clientY);
      });
      canvas.addEventListener("pointerup", (e) => {
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        onPointerMove(e.clientX);
        onAimMove(e.clientX, e.clientY);
        launchBall();
        activePointerId = null;
      });
      canvas.addEventListener("pointercancel", () => {
        activePointerId = null;
      });
      window.addEventListener("keydown", (e) => {
        if (!audio.enabled && (e.key === " " || e.key === "Enter")) {
          audio.enable().then(() => {
            audio.startBgm();
            ui.syncAudio(audio.bgmEnabled);
          });
        }
        if (e.key === "p" || e.key === "P") togglePause();
        if (e.key === "r" || e.key === "R") restartStage();
      });
    }

    function tick() {
      const t = nowMs();
      const dt = t - state.lastTickMs;
      state.lastTickMs = t;
      update(dt);
      draw();
      requestAnimationFrame(tick);
    }

    resizeCanvas();
    window.addEventListener("resize", () => {
      syncMobileViewportState();
      resizeCanvas();
    });
    window.addEventListener("orientationchange", () => {
      syncMobileViewportState();
      resizeCanvas();
    });
    document.addEventListener("fullscreenchange", () => {
      syncMobileViewportState();
      resizeCanvas();
    });
    bindInput();
    startMode(MODE.CAMPAIGN);
    requestAnimationFrame(tick);
  }

  function wireUI({ startMode, getSave, resetSave, buyWoodfish, buyPaddle }) {
      const els = {
        modeCampaign: document.getElementById("btnModeCampaign"),
        modeEndless: document.getElementById("btnModeEndless"),
        records: document.getElementById("btnRecords"),
        landscape: document.getElementById("btnLandscape"),
        audio: document.getElementById("btnAudio"),
        mobileTip: document.getElementById("mobileTip"),

      overlay: document.getElementById("overlay"),
      overlayTitle: document.getElementById("overlayTitle"),
      overlayBody: document.getElementById("overlayBody"),
      overlayPrimary: document.getElementById("btnOverlayPrimary"),
      overlaySecondary: document.getElementById("btnOverlaySecondary"),

        hudMode: document.getElementById("hudMode"),
        hudLevel: document.getElementById("hudLevel"),
        hudTitle: document.getElementById("hudTitle"),
        hudLives: document.getElementById("hudLives"),
        hudPending: document.getElementById("hudPending"),
        hudBanked: document.getElementById("hudBanked"),
        hudTotal: document.getElementById("hudTotal"),
        hudLifetime: document.getElementById("hudLifetime"),

      recordsWrap: document.getElementById("records"),
      tabBody: document.getElementById("tabBody"),
      btnCloseRecords: document.getElementById("btnCloseRecords"),
    };

    let overlayPrimaryHandler = null;
    let overlaySecondaryHandler = null;
    let currentTab = "leaderboard";

    function showOverlay(title, bodyHtml, labels, onPrimary, onSecondary) {
      els.overlayTitle.textContent = title;
      els.overlayBody.innerHTML = bodyHtml;
      els.overlayPrimary.textContent = labels?.primary ?? "缁х画";
      els.overlaySecondary.textContent = labels?.secondary ?? "杩斿洖";
      overlayPrimaryHandler = onPrimary ?? null;
      overlaySecondaryHandler = onSecondary ?? null;
      els.overlay.classList.remove("hidden");
    }

    function hideOverlay() {
      els.overlay.classList.add("hidden");
      overlayPrimaryHandler = null;
      overlaySecondaryHandler = null;
    }

    function overlayVisible() {
      return !els.overlay.classList.contains("hidden");
    }

    function recordsVisible() {
      return !els.recordsWrap.classList.contains("hidden");
    }

      function setHUD({ mode, stage, title, lives, pending, banked, total, lifetime }) {
        els.hudMode.textContent = `模式：${mode}`;
        els.hudLevel.textContent = `小关：${stage}`;
        if (els.hudTitle) els.hudTitle.textContent = `境界：${title ?? "—"}`;
        els.hudLives.textContent = `命：${lives}`;
        els.hudPending.textContent = `本关功德：${pending}`;
        els.hudBanked.textContent = `已入账：${banked}`;
        els.hudTotal.textContent = `余额功德：${total}`;
        if (els.hudLifetime) els.hudLifetime.textContent = `累计功德：${lifetime ?? "—"}`;
      }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    function renderTable(list) {
      if (!list.length) return `<div class="muted" style="margin: 0 4px;">鏆傛棤璁板綍</div>`;
      return `
        <table class="table">
          <thead><tr><th>#</th><th>鍔熷痉</th><th class="mono">鍒拌揪</th><th>鏃堕棿</th></tr></thead>
          <tbody>
            ${list
              .map((it, idx) => {
                const date = new Date(it.at).toLocaleString();
                return `<tr>
                  <td>${idx + 1}</td>
                  <td class="mono">${fmtInt(it.merit)}</td>
                  <td class="mono">${escapeHtml(it.reached ?? "")}</td>
                  <td>${escapeHtml(date)}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      `;
    }

    function renderLeaderboard() {
      const save = getSave();
      const c = save.leaderboard?.campaign ?? [];
      const e = save.leaderboard?.endless ?? [];
      els.tabBody.innerHTML = `
        <div class="muted" style="margin: 0 4px 10px;">鏈湴 Top 10锛堟寜鍗曟娓哥帺宸插叆璐﹀姛寰凤級銆?/div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-weight:750; margin: 0 4px 8px;">闂叧姒?/div>
            ${renderTable(c)}
          </div>
          <div>
            <div style="font-weight:750; margin: 0 4px 8px;">鏃犲敖姒?/div>
            ${renderTable(e)}
          </div>
        </div>
      `;
    }

    function renderHistory() {
      const save = getSave();
      const list = save.history ?? [];
      if (!list.length) {
        els.tabBody.innerHTML = `<div class="muted" style="margin: 0 4px;">鏆傛棤鍘嗗彶璁板綍</div>`;
        return;
      }
      els.tabBody.innerHTML = `
        <table class="table">
          <thead><tr><th>鏃堕棿</th><th>妯″紡</th><th class="mono">鍒拌揪</th><th class="mono">宸插叆璐?/th><th class="mono">鏃堕暱</th></tr></thead>
          <tbody>
            ${list
              .map((it) => {
                const date = new Date(it.at).toLocaleString();
                const modeLabel = it.mode === MODE.CAMPAIGN ? "闂叧" : "鏃犲敖";
                return `<tr>
                  <td>${escapeHtml(date)}</td>
                  <td>${escapeHtml(modeLabel)}</td>
                  <td class="mono">${escapeHtml(it.reached ?? "")}</td>
                  <td class="mono">${fmtInt(it.merit)}</td>
                  <td class="mono">${fmtInt(it.durationSec)}s</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <div class="muted" style="margin: 10px 4px 0;">鎻愮ず锛氭鍗?鍘嗗彶鍙繚瀛樺湪鏈満娴忚鍣?localStorage銆?/div>
      `;
    }

    function renderProfile() {
      const save = getSave();
      const p = save.profile ?? {};
      const realmInfo = getCurrentRealm(save);
      const woodfishTier = clamp(save.inventory?.woodfishTier ?? 0, 0, 4);
      const paddleTier = clamp(save.inventory?.paddleTier ?? 0, 0, 4);
      els.tabBody.innerHTML = `
        <div style="display:grid; gap: 10px; margin: 0 4px;">
          <div class="pill pill-gold">鍔熷痉浣欓锛?span class="mono">${fmtInt(p.totalMerit ?? 0)}</span></div>
          <div class="pill">绱鍔熷痉锛堢粓韬級锛?span class="mono">${fmtInt(p.lifetimeMeritEarned ?? 0)}</span></div>
          <div class="pill">澧冪晫锛?span class="mono">${escapeHtml(realmInfo.name)}</span>${realmInfo.locked ? "<span class='muted'>锛堝緟鍦嗘弧锛?/span>" : ""}</div>
          <div class="pill">鏈ㄩ奔锛?span class="mono">${escapeHtml(WOODFISH_TIERS[woodfishTier].name)}</span>銆€娉曞櫒锛?span class="mono">${escapeHtml(PADDLE_TIERS[paddleTier].name)}</span></div>
          <div class="muted">创建：${escapeHtml(new Date(p.createdAt ?? Date.now()).toLocaleString())}</div>
          <div class="muted">更新：${escapeHtml(new Date(p.updatedAt ?? Date.now()).toLocaleString())}</div>
          <div style="display:flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn" id="btnExport">瀵煎嚭瀛樻。</button>
            <button class="btn" id="btnReset">娓呯┖鏈湴璁板綍</button>
          </div>
          <div class="muted">瀵煎嚭鐢ㄤ簬鑷瓨/杩佺Щ锛涙竻绌轰細鍒犻櫎姒滃崟銆佸巻鍙层€佺疮璁″姛寰枫€?/div>
        </div>
      `;
      const btnExport = document.getElementById("btnExport");
      const btnReset = document.getElementById("btnReset");
      btnExport?.addEventListener("click", async () => {
        const payload = JSON.stringify(getSave(), null, 2);
        try {
          await navigator.clipboard?.writeText(payload);
          alert("已复制存档 JSON 到剪贴板。");
        } catch {
          alert("复制失败：浏览器未授权剪贴板。");
        }
      });
      btnReset?.addEventListener("click", () => {
        if (!confirm("确认清空本地记录？这会删除榜单、历史和累计功德。")) return;
        resetSave();
        location.reload();
      });
    }

    function renderShop() {
      const save = getSave();
      const woodfishTier = clamp(save.inventory?.woodfishTier ?? 0, 0, 4);
      const paddleTier = clamp(save.inventory?.paddleTier ?? 0, 0, 4);
      const balance = Math.floor(save.profile?.totalMerit ?? 0);

      els.tabBody.innerHTML = `
        <div style="display:grid; gap: 12px; margin: 0 4px;">
          <div class="pill pill-gold">鍔熷痉浣欓锛?span class="mono">${fmtInt(balance)}</span></div>
          <div>
            <div style="font-weight:800; margin: 0 2px 10px;">鏈ㄩ奔澶栬</div>
            <div class="skin-grid">
              ${WOODFISH_TIERS.map((t, idx) => {
                const unlocked = idx <= woodfishTier;
                const isCurrent = idx === woodfishTier;
                const buyable = idx === woodfishTier + 1;
                const klass = t.key === "bronze" ? "wf-bronze" : t.key === "blackiron" ? "wf-blackiron" : t.key === "gold" ? "wf-gold" : t.key === "diamond" ? "wf-diamond" : "wf-rainbow";
                return `
                  <div class="skin-card ${unlocked ? "" : "locked"}">
                    <div class="skin-preview">
                      <div class="skin-woodfish ${klass}"></div>
                      ${isCurrent ? `<div class="badge">宸茶澶?/div>` : ""}
                      ${unlocked ? "" : `<div class="lock">鏈В閿?/div>`}
                    </div>
                    <div class="skin-name">${escapeHtml(t.name)}</div>
                    <div class="skin-meta">鍗婂緞 脳${t.rMul}锛涢€熷害 脳${t.speedMul}</div>
                    <div class="skin-meta">${idx === 0 ? "初始" : `价格：${fmtInt(t.cost)}`}</div>
                    ${buyable ? `<div style="margin-top:8px;"><button class="btn btn-primary" data-buy="woodfish">瑙ｉ攣</button></div>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div>
            <div style="font-weight:800; margin: 2px 2px 10px;">娉曞櫒澶栬</div>
            <div class="skin-grid">
              ${PADDLE_TIERS.map((t, idx) => {
                const unlocked = idx <= paddleTier;
                const isCurrent = idx === paddleTier;
                const buyable = idx === paddleTier + 1;
                const klass = t.key === "mortal" ? "pd-mortal" : t.key === "spirit" ? "pd-spirit" : t.key === "dharma" ? "pd-dharma" : t.key === "treasure" ? "pd-treasure" : "pd-sacred";
                return `
                  <div class="skin-card ${unlocked ? "" : "locked"}">
                    <div class="skin-preview">
                      <div class="skin-paddle ${klass}"></div>
                      ${isCurrent ? `<div class="badge">宸茶澶?/div>` : ""}
                      ${unlocked ? "" : `<div class="lock">鏈В閿?/div>`}
                    </div>
                    <div class="skin-name">${escapeHtml(t.name)}</div>
                    <div class="skin-meta">${idx === 0 ? "基础法器" : "飞剑法器"} · 宽度 ${fmtInt(t.baseW)} · 偏转 ×${t.deflectMul}</div>
                    <div class="skin-meta">${idx === 0 ? "初始" : `价格：${fmtInt(t.cost)}`}</div>
                    ${buyable ? `<div style="margin-top:8px;"><button class="btn btn-primary" data-buy="paddle">升级</button></div>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div class="muted">鎻愮ず锛氬鐣岀敱鈥滅疮璁″姛寰凤紙缁堣韩锛夆€濆喅瀹氾紝涓嶄細鍥犳秷璐硅€岄檷浣庛€?/div>
        </div>
      `;

      els.tabBody.querySelectorAll("button[data-buy='woodfish']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const res = buyWoodfish?.();
          alert(res?.msg ?? "鎿嶄綔瀹屾垚");
          renderShop();
        });
      });
      els.tabBody.querySelectorAll("button[data-buy='paddle']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const res = buyPaddle?.();
          alert(res?.msg ?? "鎿嶄綔瀹屾垚");
          renderShop();
        });
      });
    }

    function renderTitles() {
      const save = getSave();
      const earned = Math.floor(save.profile?.lifetimeMeritEarned ?? 0);
      const realmInfo = getCurrentRealm(save);
      const gated = !titleGateSatisfied(save);
      const gateText = gated ? "（解锁散仙及以上：需通关闯关 12 小关并解锁全部木鱼）" : "";

      els.tabBody.innerHTML = `
        <div style="display:grid; gap: 10px; margin: 0 4px;">
          <div class="pill pill-gold">褰撳墠澧冪晫锛?span class="mono">${escapeHtml(realmInfo.name)}</span> ${realmInfo.locked ? "<span class='muted'>(寰呭渾婊?</span>" : ""}</div>
          <div class="muted">绱鍔熷痉锛堢粓韬級锛?span class="mono">${fmtInt(earned)}</span></div>
          <div class="muted">条件：${escapeHtml(gateText)}</div>
          <table class="table">
            <thead><tr><th>澧冪晫</th><th class="mono">鎵€闇€绱鍔熷痉</th><th>鐘舵€?/th></tr></thead>
            <tbody>
              ${TITLES.map((t) => {
                const okNeed = earned >= t.need;
                const okGate = t.gate !== "post_tribulation" || titleGateSatisfied(save);
                const status = okNeed && okGate ? "已达成" : okNeed && !okGate ? "条件未满足" : "未达成";
                return `<tr>
                  <td>${escapeHtml(t.name)}</td>
                  <td class="mono">${fmtInt(t.need)}</td>
                  <td>${escapeHtml(status)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
          ${realmInfo.locked ? `<div class="muted">${escapeHtml(realmInfo.reason)}</div>` : ""}
        </div>
      `;
    }

    function renderTab() {
      if (currentTab === "leaderboard") renderLeaderboard();
      else if (currentTab === "history") renderHistory();
      else if (currentTab === "profile") renderProfile();
      else if (currentTab === "shop") renderShop();
      else renderTitles();
    }

    function openRecords() {
      currentTab = "leaderboard";
      const tabs = els.recordsWrap.querySelectorAll(".tab");
      tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === currentTab));
      renderTab();
      els.recordsWrap.classList.remove("hidden");
    }

      function closeRecords() {
        els.recordsWrap.classList.add("hidden");
      }

      function syncAudio(enabled) {
        if (!els.audio) return;
        els.audio.textContent = `灵音：${enabled ? "开" : "关"}`;
        els.audio.classList.toggle("btn-primary", enabled);
      }

      function syncLandscape(enabled) {
        if (!els.landscape) return;
        els.landscape.textContent = `横屏：${enabled ? "开" : "关"}`;
        els.landscape.classList.toggle("btn-primary", enabled);
      }

      function setMobileTip(text) {
        if (!els.mobileTip) return;
        els.mobileTip.textContent = text ?? "";
        els.mobileTip.classList.toggle("hidden", !text);
      }

      els.overlayPrimary.addEventListener("click", () => overlayPrimaryHandler?.());
      els.overlaySecondary.addEventListener("click", () => overlaySecondaryHandler?.());

    els.modeCampaign.addEventListener("click", () => startMode(MODE.CAMPAIGN));
    els.modeEndless.addEventListener("click", () => startMode(MODE.ENDLESS));
      els.records.addEventListener("click", () => openRecords());
      els.btnCloseRecords.addEventListener("click", () => closeRecords());

    els.recordsWrap.addEventListener("click", (e) => {
      if (e.target === els.recordsWrap) closeRecords();
    });

    els.recordsWrap.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        currentTab = t.dataset.tab;
        els.recordsWrap.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === currentTab));
        renderTab();
      });
    });

      return {
        setHUD,
        showOverlay,
        hideOverlay,
        overlayVisible,
        recordsVisible,
        openRecords,
        syncAudio,
        syncLandscape,
        setMobileTip,
        audioButton: els.audio,
        landscapeButton: els.landscape,
      };
    }

  makeGame(document.getElementById("game"));
})();

