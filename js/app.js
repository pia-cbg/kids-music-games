// 화면 전환·점수·별·기록 저장
(function () {
  const $ = (s) => document.querySelector(s);
  const LS = "kmg-v1";
  let store = {};
  try { store = JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { /* 저장 불가 */ }
  store.best = store.best || {};
  let grade = store.grade || "low";
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) { /* 무시 */ } };

  const show = (id) => ["home", "game", "result", "timeup"].forEach((s) => { $("#" + s).hidden = s !== id; });

  // ── 15분 제한: 게임을 처음 누른 순간부터. 시작 시각을 기기에 저장 → 새로고침·다시 열기로 초기화 안 됨 ──
  const LIMIT_MS = 15 * 60 * 1000;
  const startedAt = () => store.sessionStart || null;
  const left = () => (startedAt() ? LIMIT_MS - (Date.now() - startedAt()) : LIMIT_MS);
  const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function tickTimer() {
    const ms = left();
    const running = !!startedAt();
    $("#timerLine").innerHTML = running ? `⏰ 남은 놀이 시간 <b>${fmtLeft(ms)}</b>` : "⏰ 게임을 누르면 15분 놀이 시간이 시작돼요";
    $("#gTimer").textContent = running ? "⏰ " + fmtLeft(ms) : "";
    $("#gTimer").classList.toggle("warn", running && ms < 60 * 1000);
    if (running && ms <= 0 && $("#timeup").hidden) timeUp();
  }
  function timeUp() {
    stopGame();
    show("timeup");
    window.scrollTo(0, 0);
  }
  // 선생님 해제: 로고 3초 꾹 누르기
  (function unlock() {
    const el = $("#unlock"), bar = $("#holdBar");
    let t = null, t0 = 0, raf = 0;
    const stop = () => { clearTimeout(t); cancelAnimationFrame(raf); bar.style.width = "0"; };
    const step = () => { bar.style.width = Math.min(100, ((Date.now() - t0) / 3000) * 100) + "%"; raf = requestAnimationFrame(step); };
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      t0 = Date.now(); step();
      t = setTimeout(() => {
        stop();
        delete store.sessionStart; save();
        Sound.fanfare();
        home();
        tickTimer();
      }, 3000);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => el.addEventListener(ev, stop));
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  })();
  setInterval(tickTimer, 1000);
  const starStr = (n, max = 3) => "★".repeat(n) + "☆".repeat(max - n);

  // ── 홈 ──
  function home() {
    stopGame();
    if (startedAt() && left() <= 0) return timeUp();
    document.querySelectorAll(".grade button").forEach((b) => b.classList.toggle("on", b.dataset.grade === grade));
    $("#cards").innerHTML = GAMES.map((g) => {
      const best = store.best[`${g.id}-${grade}`] || 0;
      return `<button class="gcard" data-id="${g.id}">
        <span class="gemoji">${g.emoji}</span>
        <span class="gtext"><b>${g.title}</b><small>${g.desc(grade)}</small></span>
        <span class="gstars ${best ? "" : "none"}">${starStr(best)}</span></button>`;
    }).join("");
    show("home");
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".grade button").forEach((b) => b.addEventListener("click", () => {
    grade = b.dataset.grade;
    store.grade = grade;
    save();
    home();
  }));
  $("#cards").addEventListener("click", (e) => {
    const c = e.target.closest(".gcard");
    if (c) startGame(c.dataset.id);
  });

  // ── 게임 진행 ──
  let cur = null;          // { game, token, cleanup, score, combo }
  function stopGame() {
    if (cur && cur.cleanup) cur.cleanup();
    if (cur) cur.token.alive = false;
    cur = null;
  }
  function toast(msg, kind) {
    const t = $("#toast");
    t.className = "toast show " + (kind || "");
    t.textContent = msg;
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => { t.className = "toast"; }, 1100);
  }
  const CHEERS = ["잘했어요! 🎉", "정답! 👏", "최고예요! ⭐", "멋져요! 🌈", "딩동댕! 🔔"];

  function startGame(id) {
    if (startedAt() && left() <= 0) return timeUp();
    if (!startedAt()) { store.sessionStart = Date.now(); save(); }
    stopGame();
    Sound.ac();                              // 휴대폰은 터치해야 소리가 켜짐
    const game = GAMES.find((g) => g.id === id);
    const token = { alive: true };
    cur = { game, token, score: 0, combo: 0 };
    $("#gTitle").textContent = `${game.emoji} ${game.title}`;
    $("#gScore").textContent = "0";
    $("#gCombo").textContent = "";
    $("#gProg").style.width = "0%";
    $("#stage").innerHTML = "";
    show("game");
    window.scrollTo(0, 0);
    const st = cur;
    const api = {
      stage: $("#stage"),
      grade,
      alive: () => token.alive,
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      progress: (i, n) => { $("#gProg").style.width = `${Math.round((i / n) * 100)}%`; },
      correct: () => {
        st.combo++;
        st.score += 10 + (st.combo > 1 ? (st.combo - 1) * 2 : 0);
        $("#gScore").textContent = st.score;
        $("#gCombo").textContent = st.combo >= 2 ? `🔥${st.combo} ` : "";
        Sound.ding();
        toast(CHEERS[Math.floor(Math.random() * CHEERS.length)], "good");
      },
      wrong: (msg) => {
        st.combo = 0;
        $("#gCombo").textContent = "";
        Sound.buzz();
        toast(msg || "아쉬워요!", "bad");
      },
      finish: ({ stars, title }) => {
        if (!token.alive) return;
        token.alive = false;
        $("#gProg").style.width = "100%";
        const k = `${game.id}-${grade}`;
        const isBest = stars > (store.best[k] || 0);
        if (isBest) { store.best[k] = stars; save(); }
        result(game, stars, title, st.score, isBest);
      },
    };
    cur.cleanup = game.start(api) || null;
  }

  // ── 결과 ──
  const MSG = [
    "괜찮아요, 다시 해 보면 더 잘할 수 있어요! 💪",
    "좋아요! 조금만 더 연습하면 별 두 개! ✨",
    "잘했어요! 별 세 개까지 거의 다 왔어요! 🌟",
    "완벽해요! 음악 천재! 🏆",
  ];
  function result(game, stars, title, score, isBest) {
    if (cur && cur.cleanup) cur.cleanup();
    $("#rStars").innerHTML = [0, 1, 2].map((k) => `<span class="${k < stars ? "on" : ""}" style="animation-delay:${0.25 + k * 0.25}s">★</span>`).join("");
    $("#rTitle").textContent = title;
    $("#rMsg").innerHTML = `${MSG[stars]}<br><small>점수 ${score}점${isBest ? " · 새 기록! 🎊" : ""}</small>`;
    $("#again").onclick = () => startGame(game.id);
    show("result");
    if (stars >= 2) { Sound.fanfare(); confetti(); }
  }
  function confetti() {
    const box = $("#confetti");
    box.innerHTML = Array.from({ length: 36 }, () => {
      const e = ["🎵", "🎶", "⭐", "🎉", "✨", "🎈"][Math.floor(Math.random() * 6)];
      return `<i style="left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.8}s;animation-duration:${1.8 + Math.random() * 1.4}s">${e}</i>`;
    }).join("");
    setTimeout(() => { box.innerHTML = ""; }, 4000);
  }

  $("#back").addEventListener("click", home);
  $("#home2").addEventListener("click", home);
  document.querySelectorAll(".yr").forEach((e) => { e.textContent = new Date().getFullYear(); });
  home();
  tickTimer();
})();
