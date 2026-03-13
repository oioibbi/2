(() => {
  "use strict";

  const MODE = { CAMPAIGN: "campaign", ENDLESS: "endless" };
  const STORAGE_KEY = "muyu-breaker.v1";

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const nowMs = () => performance.now();
  const fmtInt = (n) => `${Math.max(0, Math.floor(n))}`;

  const WOODFISH_TIERS = [
    { key: "bronze", name: "青铜木鱼", rMul: 1.0, speedMul: 1.0, cost: 0 },
    { key: "blackiron", name: "黑铁木鱼", rMul: 1.12, speedMul: 0.95, cost: 2400 },
    { key: "gold", name: "黄金木鱼", rMul: 1.25, speedMul: 0.9, cost: 8200 },
    { key: "diamond", name: "钻石木鱼", rMul: 1.42, speedMul: 0.86, cost: 22000 },
    { key: "rainbow", name: "七彩木鱼", rMul: 1.62, speedMul: 0.82, cost: 52000 },
  ];

  const PADDLE_TIERS = [
    { key: "mortal", name: "凡器", baseW: 140, deflectMul: 1.0, cost: 0 },
    { key: "spirit", name: "灵器", baseW: 152, deflectMul: 1.08, cost: 1800 },
    { key: "dharma", name: "法器", baseW: 168, deflectMul: 1.16, cost: 7200 },
    { key: "treasure", name: "宝器", baseW: 186, deflectMul: 1.24, cost: 20000 },
    { key: "sacred", name: "圣器", baseW: 206, deflectMul: 1.33, cost: 48000 },
  ];

  const TITLES = [
    { name: "筑基", need: 0 },
    { name: "开光", need: 500 },
    { name: "融合", need: 1500 },
    { name: "心动", need: 3500 },
    { name: "金丹", need: 7000 },
    { name: "元婴", need: 12000 },
    { name: "出窍", need: 20000 },
    { name: "分神", need: 32000 },
    { name: "合体", need: 50000 },
    { name: "洞虚", need: 76000 },
    { name: "大乘", need: 110000 },
    { name: "渡劫", need: 160000 },
    { name: "散仙", need: 230000, gate: "post_tribulation" },
    { name: "真仙", need: 320000, gate: "post_tribulation" },
    { name: "太乙散仙", need: 420000, gate: "post_tribulation" },
    { name: "太乙真仙", need: 540000, gate: "post_tribulation" },
    { name: "太乙玄仙", need: 680000, gate: "post_tribulation" },
    { name: "太乙金仙", need: 850000, gate: "post_tribulation" },
    { name: "大罗金仙", need: 1050000, gate: "post_tribulation" },
    { name: "混元大罗金仙", need: 1300000, gate: "post_tribulation" },
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
      const trib = TITLES.find((t) => t.name === "渡劫") ?? TITLES[0];
      return {
        name: trib.name,
        locked: true,
        reason: "解锁“散仙”需：通关全部闯关小关 + 解锁全部木鱼。",
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
        woodfishTier: 0, // 0-4: 青铜/黑铁/黄金/钻石/七彩
        paddleTier: 0, // 0-4
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
    return {
      get enabled() {
        return enabled;
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
        } catch {
          enabled = false;
        }
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
        const glyphs = ["罪", "业", "劫", "妄", "贪", "嗔", "痴"];
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
        const glyphs = ["罪", "业", "劫", "妄", "贪", "嗔", "痴"];
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
    const bounds = { w: canvas.width, h: canvas.height };

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
      paddles: [{ id: 0, xOffset: 0, x: bounds.w / 2, y: bounds.h - 44, w: 140, h: 16 }],
      balls: [{ id: 0, x: bounds.w / 2, y: bounds.h - 62, r: 12, vx: 0, vy: 0, launched: false, baseSpeed: 7.2 }],
      aim: { active: true, tx: bounds.w / 2, ty: bounds.h / 2 },

      powerups: [],
      effects: { slowUntilMs: 0, wideUntilMs: 0 },

      rage: { active: false, untilMs: 0, combo: 0, nextAutoAtMs: 0 },
      floaters: [],
      lastTickMs: nowMs(),
    };

    const ui = wireUI({ startMode, getSave: () => save, resetSave, buyWoodfish, buyPaddle });
    let save = migrateSave(loadSave() ?? defaultSave());
    saveToStorage(save);

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
      return { ok: true, msg: `已升级：${item.name}` };
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
      state.paddles = [{ id: 0, xOffset: 0, x, y, w: tier.baseW, h: 16 }];
    }

    function showOverlay(title, bodyHtml, labels, onPrimary, onSecondary) {
      ui.showOverlay(title, bodyHtml, labels, onPrimary, onSecondary);
      state.isPaused = true;
    }

    function hideOverlay() {
      ui.hideOverlay();
    }

    function updateHUD() {
      const realmInfo = getCurrentRealm(save);
      ui.setHUD({
        mode: state.mode === MODE.CAMPAIGN ? "闯关" : "无尽",
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
      state.floaters = [];
      state.rage.active = false;
      state.rage.untilMs = 0;
      state.rage.combo = 0;
      state.rage.nextAutoAtMs = nowMs() + 52000;

      resetPaddle();
      resetBallOnPaddle();
      if (mode === MODE.CAMPAIGN) loadLevel(0);
      else loadWave(0);

      showOverlay(
        mode === MODE.CAMPAIGN ? "闯关：第 1 小关" : "无尽：第 1 波",
        ["打碎罪砖会获得本关功德，但只有清空本关砖块才会把功德入账。", "失败会丢失本关未入账功德，并重试本关。", "点击/轻触发射木鱼；拖动控制挡板。"].join("<br/>"),
        { primary: "开始", secondary: "返回" },
        () => {
          hideOverlay();
          state.isPaused = false;
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
        "本次修行结束",
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
      state.floaters.push({ x: bounds.w / 2, y: bounds.h / 2, text: `功德入账 +${gained}`, ttl: 1200, color: "rgba(246,211,122,0.98)" });
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
            "闯关圆满",
            `你已完成 12 小关，本次已入账功德：<span class="mono">${fmtInt(state.bankedMerit)}</span><br/>可继续挑战无尽模式。`,
            { primary: "继续闯关循环", secondary: "去无尽" },
            () => {
              hideOverlay();
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
          `通关：第 ${state.levelIndex} 小关`,
          "本关功德已入账。下一关将更考验控球与预判。",
          { primary: "继续", secondary: "退出" },
          () => hideOverlay(),
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
          "本波功德已入账。下一波罪砖更重、更快、更难命中。",
          { primary: "继续", secondary: "退出" },
          () => hideOverlay(),
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
        state.floaters.push({ x: p.x, y: p.y - 24, text: "法器加宽", ttl: 900, color: "rgba(120,170,255,0.95)" });
      } else if (kind === "slow") {
        state.effects.slowUntilMs = Math.max(state.effects.slowUntilMs, t + 9000);
        state.floaters.push({ x: p.x, y: p.y - 24, text: "心定则慢", ttl: 900, color: "rgba(120,255,210,0.86)" });
      } else if (kind === "merit") {
        state.pendingMerit += 60;
        state.floaters.push({ x: p.x, y: p.y - 24, text: "随喜 +60", ttl: 900, color: "rgba(246,211,122,0.98)" });
        updateHUD();
      }
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

          state.floaters.push({ x: bounds.w / 2, y: bounds.h / 2, text: "狂暴：众木鱼齐鸣", ttl: 900, color: "rgba(255,120,60,0.95)" });
          woodfishTok(audio, 1.0);
        }
      }

      const slowMul = t < state.effects.slowUntilMs ? 0.68 : 1.0;
      const rageMul = state.rage.active ? 1.35 : 1.0;
      const dt = (dtMs / 16.6667) * slowMul * rageMul;

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

        if (ball.x - ball.r < 0) {
          ball.x = ball.r;
          ball.vx *= -1;
          woodfishTok(audio, 0.35);
        } else if (ball.x + ball.r > bounds.w) {
          ball.x = bounds.w - ball.r;
          ball.vx *= -1;
          woodfishTok(audio, 0.35);
        }
        if (ball.y - ball.r < 0) {
          ball.y = ball.r;
          ball.vy *= -1;
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
            state.floaters.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: `-${b.sin} 罪 → +${b.sin} 功德`, ttl: 900, color: "rgba(246,211,122,0.96)" });
            maybeDropPowerup(b);
            state.bricks.splice(i, 1);
            i -= 1;
            updateHUD();
            if (state.bricks.length === 0) bankPendingAndAdvance();
          } else {
            state.floaters.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: `罪孽尚存（${b.hp}）`, ttl: 500, color: "rgba(233,238,248,0.72)" });
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
        f.ttl -= dtMs;
        f.y -= 0.04 * dtMs;
        if (f.ttl <= 0) {
          state.floaters.splice(i, 1);
          i -= 1;
        }
      }

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
      ctx2.beginPath();
      ctx2.arc(x, y, r, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.stroke();

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

      if (key === "diamond") {
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

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, bounds.w, bounds.h);
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
          ctx.fillText(`×${b.hp}`, b.x + b.w - 16, b.y + 10);
        }
      }

      // Paddles (法器)
      for (const p of state.paddles) {
        const isRage = state.rage.active;
        ctx.save();
        ctx.translate(p.x, p.y);
        const baseFill = p.id === 0 ? "rgba(246,211,122,0.22)" : "rgba(246,211,122,0.14)";
        const baseStroke = p.id === 0 ? "rgba(246,211,122,0.35)" : "rgba(246,211,122,0.22)";
        ctx.fillStyle = baseFill;
        ctx.strokeStyle = baseStroke;
        roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 10);
        ctx.fill();
        ctx.stroke();
        if (isRage) {
          const g = ctx.createLinearGradient(0, -p.h, 0, p.h);
          g.addColorStop(0, "rgba(255,80,40,0.0)");
          g.addColorStop(0.55, "rgba(255,120,60,0.28)");
          g.addColorStop(1, "rgba(255,220,120,0.08)");
          ctx.fillStyle = g;
          roundRect(ctx, -p.w / 2, -p.h / 2 - 3, p.w, p.h + 6, 12);
          ctx.fill();
        }
        ctx.restore();
      }

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

      // Balls (木鱼)
      for (const b of state.balls) {
        drawWoodfish(ctx, b.x, b.y, b.r);
        if (state.rage.active && b.launched) drawFlame(ctx, b.x, b.y, b.r, nowMs());
      }

      // Powerups
      for (const pu of state.powerups) {
        ctx.save();
        ctx.fillStyle = pu.kind === "wide" ? "rgba(120,170,255,0.92)" : pu.kind === "slow" ? "rgba(120,255,210,0.86)" : "rgba(246,211,122,0.94)";
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, pu.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.font = "800 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pu.kind === "wide" ? "宽" : pu.kind === "slow" ? "慢" : "喜", pu.x, pu.y + 0.5);
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
        ctx.fillText("暂停（按 P 继续）", bounds.w / 2, bounds.h / 2);
        ctx.restore();
      }
    }

    function onPointerMove(clientX) {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * bounds.w;
      state.controlX = clamp(x, 8, bounds.w - 8);
      const b = primaryBall();
      const p0 = primaryPaddle();
      if (p0) p0.x = clamp(state.controlX, p0.w / 2 + 8, bounds.w - p0.w / 2 - 8);
      if (b && !b.launched && p0) b.x = p0.x;
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
      window.addEventListener("keydown", (e) => {
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

    bindInput();
    startMode(MODE.CAMPAIGN);
    requestAnimationFrame(tick);
  }

  function wireUI({ startMode, getSave, resetSave, buyWoodfish, buyPaddle }) {
      const els = {
      modeCampaign: document.getElementById("btnModeCampaign"),
      modeEndless: document.getElementById("btnModeEndless"),
      records: document.getElementById("btnRecords"),

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
      els.overlayPrimary.textContent = labels?.primary ?? "继续";
      els.overlaySecondary.textContent = labels?.secondary ?? "返回";
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
      if (!list.length) return `<div class="muted" style="margin: 0 4px;">暂无记录</div>`;
      return `
        <table class="table">
          <thead><tr><th>#</th><th>功德</th><th class="mono">到达</th><th>时间</th></tr></thead>
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
        <div class="muted" style="margin: 0 4px 10px;">本地 Top 10（按单次游玩已入账功德）。</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-weight:750; margin: 0 4px 8px;">闯关榜</div>
            ${renderTable(c)}
          </div>
          <div>
            <div style="font-weight:750; margin: 0 4px 8px;">无尽榜</div>
            ${renderTable(e)}
          </div>
        </div>
      `;
    }

    function renderHistory() {
      const save = getSave();
      const list = save.history ?? [];
      if (!list.length) {
        els.tabBody.innerHTML = `<div class="muted" style="margin: 0 4px;">暂无历史记录</div>`;
        return;
      }
      els.tabBody.innerHTML = `
        <table class="table">
          <thead><tr><th>时间</th><th>模式</th><th class="mono">到达</th><th class="mono">已入账</th><th class="mono">时长</th></tr></thead>
          <tbody>
            ${list
              .map((it) => {
                const date = new Date(it.at).toLocaleString();
                const modeLabel = it.mode === MODE.CAMPAIGN ? "闯关" : "无尽";
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
        <div class="muted" style="margin: 10px 4px 0;">提示：榜单/历史只保存在本机浏览器 localStorage。</div>
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
          <div class="pill pill-gold">功德余额：<span class="mono">${fmtInt(p.totalMerit ?? 0)}</span></div>
          <div class="pill">累计功德（终身）：<span class="mono">${fmtInt(p.lifetimeMeritEarned ?? 0)}</span></div>
          <div class="pill">境界：<span class="mono">${escapeHtml(realmInfo.name)}</span>${realmInfo.locked ? "<span class='muted'>（待圆满）</span>" : ""}</div>
          <div class="pill">木鱼：<span class="mono">${escapeHtml(WOODFISH_TIERS[woodfishTier].name)}</span>　法器：<span class="mono">${escapeHtml(PADDLE_TIERS[paddleTier].name)}</span></div>
          <div class="muted">创建：${escapeHtml(new Date(p.createdAt ?? Date.now()).toLocaleString())}</div>
          <div class="muted">更新：${escapeHtml(new Date(p.updatedAt ?? Date.now()).toLocaleString())}</div>
          <div style="display:flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn" id="btnExport">导出存档</button>
            <button class="btn" id="btnReset">清空本地记录</button>
          </div>
          <div class="muted">导出用于自存/迁移；清空会删除榜单、历史、累计功德。</div>
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
        if (!confirm("确认清空本地记录？这会删除榜单、历史、累计功德。")) return;
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
          <div class="pill pill-gold">功德余额：<span class="mono">${fmtInt(balance)}</span></div>
          <div>
            <div style="font-weight:800; margin: 0 2px 10px;">木鱼外观</div>
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
                      ${isCurrent ? `<div class="badge">已装备</div>` : ""}
                      ${unlocked ? "" : `<div class="lock">未解锁</div>`}
                    </div>
                    <div class="skin-name">${escapeHtml(t.name)}</div>
                    <div class="skin-meta">半径 ×${t.rMul}；速度 ×${t.speedMul}</div>
                    <div class="skin-meta">${idx === 0 ? "初始" : `价格：${fmtInt(t.cost)}`}</div>
                    ${buyable ? `<div style="margin-top:8px;"><button class="btn btn-primary" data-buy="woodfish">解锁</button></div>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div>
            <div style="font-weight:800; margin: 2px 2px 10px;">法器外观</div>
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
                      ${isCurrent ? `<div class="badge">已装备</div>` : ""}
                      ${unlocked ? "" : `<div class="lock">未解锁</div>`}
                    </div>
                    <div class="skin-name">${escapeHtml(t.name)}</div>
                    <div class="skin-meta">基础宽度 ${fmtInt(t.baseW)}；偏转 ×${t.deflectMul}</div>
                    <div class="skin-meta">${idx === 0 ? "初始" : `价格：${fmtInt(t.cost)}`}</div>
                    ${buyable ? `<div style="margin-top:8px;"><button class="btn btn-primary" data-buy="paddle">升级</button></div>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div class="muted">提示：境界由“累计功德（终身）”决定，不会因消费而降低。</div>
        </div>
      `;

      els.tabBody.querySelectorAll("button[data-buy='woodfish']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const res = buyWoodfish?.();
          alert(res?.msg ?? "操作完成");
          renderShop();
        });
      });
      els.tabBody.querySelectorAll("button[data-buy='paddle']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const res = buyPaddle?.();
          alert(res?.msg ?? "操作完成");
          renderShop();
        });
      });
    }

    function renderTitles() {
      const save = getSave();
      const earned = Math.floor(save.profile?.lifetimeMeritEarned ?? 0);
      const realmInfo = getCurrentRealm(save);
      const gated = !titleGateSatisfied(save);
      const gateText = gated ? "（解锁散仙及以上：需通关闯关 12 小关 + 解锁全部木鱼）" : "";

      els.tabBody.innerHTML = `
        <div style="display:grid; gap: 10px; margin: 0 4px;">
          <div class="pill pill-gold">当前境界：<span class="mono">${escapeHtml(realmInfo.name)}</span> ${realmInfo.locked ? "<span class='muted'>(待圆满)</span>" : ""}</div>
          <div class="muted">累计功德（终身）：<span class="mono">${fmtInt(earned)}</span></div>
          <div class="muted">条件：${escapeHtml(gateText)}</div>
          <table class="table">
            <thead><tr><th>境界</th><th class="mono">所需累计功德</th><th>状态</th></tr></thead>
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

    return { setHUD, showOverlay, hideOverlay, overlayVisible, recordsVisible, openRecords };
  }

  makeGame(document.getElementById("game"));
})();
