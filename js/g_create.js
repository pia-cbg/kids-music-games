// 만들기·색칠 게임 4개(cat: "create"): 음표 색칠하기, 소리 그림판, 멜로디 만들기, 비트 만들기
(function () {
  const SCALE_MIDI = [60, 62, 64, 65, 67, 69, 71];       // 도~시

  // ── 합성 소리(모두 Sound.dest() 로 연결 → Sound.stopAll() 로 함께 끊김) ──
  let noiseBuf = null, noiseCtx = null;
  function noise() {
    const c = Sound.ac();
    if (!noiseBuf || noiseCtx !== c) {
      noiseCtx = c;
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function env(g, t, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  }
  function noiseHit(t, peak, dec, type, freq, q = 1) {
    const c = Sound.ac(), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f).connect(g).connect(Sound.dest());
    env(g, t, peak, dec);
    s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.02);
  }
  function toneHit(t, freq, peak, dec, type = "sine", endFreq) {
    const c = Sound.ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dec);
    o.connect(g).connect(Sound.dest());
    env(g, t, peak, dec);
    o.start(t); o.stop(t + dec + 0.02);
  }
  const DRUMS = {
    kick: (t) => toneHit(t, 150, 0.9, 0.3, "sine", 45),
    snare: (t) => { noiseHit(t, 0.45, 0.18, "highpass", 1300); toneHit(t, 200, 0.25, 0.09, "triangle"); },
    hat: (t) => noiseHit(t, 0.22, 0.05, "highpass", 7500),
    clap: (t) => { [0, 0.012, 0.024].forEach((d) => noiseHit(t + d, 0.35, 0.09, "bandpass", 1500, 1.2)); },
    tom: (t) => toneHit(t, 190, 0.7, 0.28, "sine", 95),
    bell: (t) => { toneHit(t, 810, 0.16, 0.14, "square"); toneHit(t, 545, 0.12, 0.14, "square"); },
  };
  // 음색이 다른 음 하나(그림판·멜로디용)
  function voice(midi, dur, type = "triangle", vol = 0.28) {
    const c = Sound.ac(), t = c.currentTime;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    f.type = "lowpass"; f.frequency.value = type === "sawtooth" || type === "square" ? 1800 : 5000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * (type === "square" || type === "sawtooth" ? 0.45 : 1), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    o.connect(f).connect(g).connect(Sound.dest());
    o.start(t); o.stop(t + dur + 0.3);
  }

  // 음표 그림(작은 SVG): 0 온 · 1 2분 · 2 4분 · 3 8분 · 4 16분 · 5 점2분 · 6 점4분
  const DUR_NAMES = ["온음표", "2분음표", "4분음표", "8분음표", "16분음표", "점2분음표", "점4분음표"];
  function noteIcon(k) {
    const filled = [2, 3, 4, 6].includes(k), stem = k !== 0, dot = k === 5 || k === 6;
    const flags = k === 3 ? 1 : k === 4 ? 2 : 0;
    let s = `<svg viewBox="0 0 34 44" class="gc-icon" aria-hidden="true">`;
    s += `<ellipse cx="12" cy="34" rx="8" ry="5.6" transform="rotate(-22 12 34)" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="${filled ? 0 : 3}"/>`;
    if (stem) s += `<line x1="19" y1="33" x2="19" y2="4" stroke="currentColor" stroke-width="2.6"/>`;
    for (let i = 0; i < flags; i++) s += `<path d="M19 ${4 + i * 8} q 11 6 6 17" fill="none" stroke="currentColor" stroke-width="2.8"/>`;
    if (dot) s += `<circle cx="29" cy="34" r="3" fill="currentColor"/>`;
    return s + `</svg>`;
  }

  // 색칠 그림(모두 음악 주제): 숫자 = 색 번호(0 도 빨강 · 1 레 주황 · 2 미 노랑 · 3 파 청록 · 4 솔 초록 · 5 라 파랑 · 6 시 보라), '.' = 빈칸
  const PICTURES = [
    { name: "8분음표", rows: [
      "......6...",
      "......66..",
      "......6.6.",
      "......6..6",
      "......6..6",
      "......6...",
      "..66666...",
      ".666666...",
      ".66666....",
      "..222.....",
    ] },
    { name: "잇단 8분음표", rows: [
      "..555555555",
      "..555555555",
      "..5.......5",
      "..5.......5",
      "..5.......5",
      "555.....555",
      "555.....555",
      ".5.......5.",
    ] },
    { name: "피아노 건반", rows: [
      "00000000000000",
      "26262226262622",
      "26262226262622",
      "26262226262622",
      "22222222222222",
      "22222222222222",
      "00000000000000",
    ] },
    { name: "북", rows: [
      "1........1",
      ".1......1.",
      "..1....1..",
      ".55555555.",
      "5333333335",
      "0555555550",
      "0200200200",
      "0020020020",
      "0000000000",
      ".00000000.",
    ] },
    { name: "기타", rows: [
      "........66",
      ".......66.",
      "......66..",
      ".....66...",
      "...116....",
      "..11111...",
      ".1116111..",
      ".1161111..",
      ".111111...",
      "..1111....",
    ] },
    { name: "트라이앵글", rows: [
      ".....4.....",
      ".....4.....",
      ".....5.....",
      "....5.5....",
      "...5...5...",
      "..5.....5..",
      ".5.....2.5.",
      "55555552555",
      ".......2...",
    ] },
    { name: "마라카스", rows: [
      ".44....00.",
      "4444..0000",
      "4324..0230",
      "4444..0000",
      ".44....00.",
      "..1....1..",
      "..1....1..",
      "..1....1..",
      "..1....1..",
    ] },
    { name: "헤드폰", rows: [
      "...6666...",
      "..6....6..",
      ".6......6.",
      ".6......6.",
      "00......00",
      "00......00",
      "00......00",
    ] },
  ].map((p) => {
    const w = Math.max(...p.rows.map((r) => r.length));
    return { name: p.name, w, rows: p.rows.map((r) => r.padEnd(w, ".")) };
  });

  GAMES.push(
    // ── 1. 음표 색칠하기 ──
    {
      id: "color", cat: "create", emoji: "🎨", title: "음표 색칠하기",
      desc: (g) => (g === "low" ? "계이름 색깔로 칸을 칠해 그림 완성" : "음표 모양을 보고 알맞은 색으로 칠하기"),
      start(api) {
        const low = api.grade === "low";
        const pic = pick(PICTURES);
        const used = [...new Set(pic.rows.join("").replace(/\./g, ""))].map(Number).sort();
        const cells = [];
        pic.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ".") cells.push({ x, y, k: +ch }); }));
        const total = cells.length;
        let sel = used[0], filled = 0, mistakes = 0, painting = false;
        const left = {};
        used.forEach((k) => { left[k] = cells.filter((c) => c.k === k).length; });

        const label = (k) => (low ? SOLFA[k] : noteIcon(k));
        api.stage.innerHTML = `
          <p class="ask">색을 고르고, 같은 ${low ? "계이름" : "음표"} 칸을 칠해요! <span class="gc-pic">(${pic.name})</span></p>
          <div class="gc-grid ${low ? "" : "icons"}" id="gcGrid" style="--cols:${pic.w}">
            ${pic.rows.map((r, y) => [...r].map((ch, x) => ch === "."
              ? `<div class="gc-cell empty"></div>`
              : `<div class="gc-cell" data-x="${x}" data-y="${y}" data-k="${ch}">${label(+ch)}</div>`).join("")).join("")}
          </div>
          <div class="gc-palette" id="gcPal">
            ${used.map((k) => `<button data-k="${k}" style="--c:${NOTE_COLORS[k]}">
              <span class="sw"></span><span class="nm">${low ? SOLFA[k] : noteIcon(k) + `<small>${DUR_NAMES[k]}</small>`}</span></button>`).join("")}
          </div>`;
        const grid = api.stage.querySelector("#gcGrid"), pal = api.stage.querySelector("#gcPal");
        const mark = () => pal.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.k === sel));
        mark();
        pal.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          sel = +b.dataset.k;
          mark();
          voice(SCALE_MIDI[sel], 0.25, "sine", 0.2);
        });

        function paint(cell, fromTap) {
          if (!cell || cell.classList.contains("empty") || cell.classList.contains("done")) return;
          const k = +cell.dataset.k;
          if (k !== sel) {
            if (!fromTap) return;                                // 끌면서 지나간 다른 색 칸은 그냥 무시
            mistakes++;
            cell.classList.remove("nope"); void cell.offsetWidth; cell.classList.add("nope");
            Sound.buzz();
            return;
          }
          cell.classList.add("done");
          cell.style.setProperty("--c", NOTE_COLORS[k]);
          Sound.note(SCALE_MIDI[k] + (low ? 0 : 12), 0.25, 0, 0.22);
          filled++;
          api.progress(filled, total);
          if (--left[k] === 0) {
            api.correct();
            const b = pal.querySelector(`button[data-k="${k}"]`);
            b.classList.add("finished");
            const nx = used.find((u) => left[u] > 0);
            if (nx !== undefined) { sel = nx; mark(); }
          }
          if (filled === total) {
            painting = false;
            grid.classList.add("complete");
            setTimeout(() => {
              if (!api.alive()) return;
              const stars = mistakes <= 2 ? 3 : mistakes <= 5 ? 2 : 1;
              api.finish({ stars, title: `${pic.name} 그림 완성! 🎉`, score: filled });
            }, 1200);
          }
        }
        const cellAt = (e) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          return el ? el.closest(".gc-cell") : null;
        };
        grid.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          painting = true;
          paint(cellAt(e), true);
        });
        const move = (e) => { if (painting) paint(cellAt(e), false); };
        const up = () => { painting = false; };
        grid.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        api.progress(0, total);
        return () => {
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
        };
      },
    },

    // ── 2. 소리 그림판 ──
    {
      id: "draw", cat: "create", emoji: "🖌️", title: "소리 그림판",
      desc: (g) => (g === "low" ? "그리면 소리가 나요! 위는 높은 소리, 아래는 낮은 소리" : "붓마다 다른 악기 소리, 그린 그림을 음악으로 연주"),
      start(api) {
        const low = api.grade === "low";
        // 5음 음계 2옥타브(위 = 높음)
        const PENTA = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76];
        const BRUSHES = [
          { c: "#ff5a5f", name: "피아노", type: "triangle", oct: 12 },
          { c: "#3a86ff", name: "플루트", type: "sine", oct: 12 },
          { c: "#0ead69", name: "마림바", type: "sine", oct: 0 },
          { c: "#ff9f1c", name: "트럼펫", type: "sawtooth", oct: 0 },
          { c: "#8338ec", name: "신디", type: "square", oct: 0 },
          { c: "#ff6b9d", name: "종소리", type: "sine", oct: 24 },
        ].slice(0, low ? 4 : 6);
        let brush = 0, strokes = [], curStroke = null, lastT = 0, lastMidi = -1;
        let playing = false, timers = [];
        api.stage.innerHTML = `
          <p class="ask">손가락으로 그려 보세요! 🎵</p>
          <div class="gc-brushes" id="gdB">${BRUSHES.map((b, i) =>
            `<button data-i="${i}" style="--c:${b.c}"><span class="sw"></span>${b.name}</button>`).join("")}</div>
          <div class="gc-canvas-wrap"><canvas id="gdC"></canvas><div class="gc-playhead" id="gdP"></div></div>
          <div class="gc-row">
            <button class="btn" id="gdPlay">▶ 그림 연주하기</button>
            <button class="btn" id="gdClear">🧽 지우기</button>
            <button class="btn primary" id="gdDone">완성!</button>
          </div>`;
        const $ = (s) => api.stage.querySelector(s);
        const cv = $("#gdC"), wrap = cv.parentElement, ctx = cv.getContext("2d");
        let W = 0, H = 0;
        function resize() {
          const dpr = window.devicePixelRatio || 1;
          W = wrap.clientWidth; H = Math.round(Math.min(W * 0.62, window.innerHeight * 0.52));
          cv.width = W * dpr; cv.height = H * dpr;
          cv.style.width = W + "px"; cv.style.height = H + "px";
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          redraw();
        }
        function guides() {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, W, H);
          for (let i = 0; i < PENTA.length; i++) {
            const y = H - ((i + 0.5) / PENTA.length) * H;
            ctx.strokeStyle = "rgba(43,34,64,0.06)";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          }
          ctx.fillStyle = "rgba(43,34,64,0.25)";
          ctx.font = "14px Jua, sans-serif";
          ctx.fillText("높은 소리 ▲", 10, 20);
          ctx.fillText("낮은 소리 ▼", 10, H - 10);
        }
        function drawStroke(s) {
          const b = BRUSHES[s.b];
          ctx.strokeStyle = b.c;
          ctx.lineWidth = 12;
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath();
          s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)));
          if (s.pts.length === 1) ctx.lineTo(s.pts[0].x * W + 0.1, s.pts[0].y * H);
          ctx.stroke();
        }
        function redraw() { guides(); strokes.forEach(drawStroke); }
        const midiAt = (yNorm, b) => {
          const i = Math.max(0, Math.min(PENTA.length - 1, Math.floor((1 - yNorm) * PENTA.length)));
          return PENTA[i] + BRUSHES[b].oct;
        };
        function sing(p, force) {
          const now = performance.now(), m = midiAt(p.y, brush);
          if (!force && (now - lastT < 120 || m === lastMidi)) return;
          lastT = now; lastMidi = m;
          voice(m, 0.3, BRUSHES[brush].type);
        }
        const pt = (e) => {
          const r = cv.getBoundingClientRect();
          return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
        };
        cv.addEventListener("pointerdown", (e) => {
          if (playing) return;
          e.preventDefault();
          cv.setPointerCapture(e.pointerId);
          curStroke = { b: brush, pts: [pt(e)] };
          strokes.push(curStroke);
          lastMidi = -1;
          sing(curStroke.pts[0], true);
          redraw();
        });
        cv.addEventListener("pointermove", (e) => {
          if (!curStroke) return;
          e.preventDefault();
          const p = pt(e);
          curStroke.pts.push(p);
          sing(p, false);
          redraw();
        });
        const end = () => { curStroke = null; };
        cv.addEventListener("pointerup", end);
        cv.addEventListener("pointercancel", end);

        const bb = $("#gdB");
        const markB = () => bb.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.i === brush));
        markB();
        bb.addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          brush = +b.dataset.i;
          markB();
          voice(midiAt(0.4, brush), 0.3, BRUSHES[brush].type);
        });

        function stopPlay() {
          timers.forEach(clearTimeout); timers = [];
          playing = false;
          $("#gdP").style.opacity = 0;
          $("#gdPlay").textContent = "▶ 그림 연주하기";
        }
        function play() {
          if (playing) { stopPlay(); return; }
          if (!strokes.length) { api.wrong("먼저 그림을 그려 보세요!"); return; }
          playing = true;
          $("#gdPlay").textContent = "■ 멈추기";
          const N = 32, dur = 5000, step = dur / N;
          const buckets = Array.from({ length: N }, () => new Map());
          strokes.forEach((s) => s.pts.forEach((p) => {
            const i = Math.min(N - 1, Math.floor(p.x * N));
            const m = midiAt(p.y, s.b);
            buckets[i].set(m + ":" + s.b, [m, s.b]);
          }));
          const ph = $("#gdP");
          ph.style.opacity = 1;
          for (let i = 0; i < N; i++) {
            timers.push(setTimeout(() => {
              if (!api.alive() || !playing) return;
              ph.style.left = ((i + 0.5) / N) * 100 + "%";
              [...buckets[i].values()].slice(0, 4).forEach(([m, b]) => voice(m, step / 1000 * 1.4, BRUSHES[b].type, 0.2));
            }, i * step));
          }
          timers.push(setTimeout(() => { if (api.alive()) stopPlay(); }, dur + 300));
        }
        $("#gdPlay").addEventListener("click", play);
        $("#gdClear").addEventListener("click", () => { stopPlay(); strokes = []; redraw(); });
        $("#gdDone").addEventListener("click", () => {
          if (!strokes.length) { api.wrong("먼저 그림을 그려 보세요!"); return; }
          stopPlay();
          api.finish({ stars: 3, title: "멋진 작품이에요! 🖼️", score: strokes.length });
        });
        resize();
        window.addEventListener("resize", resize);
        return () => { stopPlay(); window.removeEventListener("resize", resize); };
      },
    },

    // ── 3. 멜로디 만들기 ──
    {
      id: "melody", cat: "create", emoji: "🎶", title: "멜로디 만들기",
      desc: (g) => (g === "low" ? "8칸 × 도~솔, 칸을 눌러 나만의 노래" : "16칸 × 도~높은 도, 빠르기 조절"),
      start(api) {
        const low = api.grade === "low";
        const steps = low ? 8 : 16;
        const notes = low ? [60, 62, 64, 65, 67] : [60, 62, 64, 65, 67, 69, 71, 72];   // 아래 → 위
        const names = low ? SOLFA.slice(0, 5) : [...SOLFA, "도"];
        const grid = notes.map(() => new Array(steps).fill(false));
        let tempo = low ? 100 : 110, pos = -1, timer = null;
        const rowsTopDown = notes.map((_, i) => notes.length - 1 - i);
        api.stage.innerHTML = `
          <p class="ask">칸을 눌러 음을 놓고 ▶ 재생해 보세요!</p>
          <div class="gc-seq ${low ? "" : "wide"}" id="gmG" style="--steps:${steps}">
            ${rowsTopDown.map((r) => `<div class="gc-lab" style="--c:${NOTE_COLORS[r % 7]}">${names[r]}</div>` +
              Array.from({ length: steps }, (_, s) => `<button class="gc-step${s % 4 === 0 ? " beat" : ""}" data-r="${r}" data-s="${s}" style="--c:${NOTE_COLORS[r % 7]}"></button>`).join("")).join("")}
          </div>
          <div class="gc-row">
            <button class="btn primary" id="gmPlay">▶ 재생</button>
            <button class="btn" id="gmRand">🎲 랜덤 예시</button>
            <button class="btn" id="gmClear">🧽 지우기</button>
          </div>
          <div class="gc-row"><label class="gc-tempo">🐢 <input type="range" id="gmT" min="60" max="160" value="${tempo}"> 🐇 <b id="gmTv">${tempo}</b></label>
            <button class="btn primary" id="gmDone">완성!</button></div>`;
        const $ = (s) => api.stage.querySelector(s);
        const cell = (r, s) => $(`.gc-step[data-r="${r}"][data-s="${s}"]`);
        const render = () => grid.forEach((row, r) => row.forEach((on, s) => cell(r, s).classList.toggle("on", on)));
        $("#gmG").addEventListener("click", (e) => {
          const b = e.target.closest(".gc-step");
          if (!b) return;
          const r = +b.dataset.r, s = +b.dataset.s;
          grid[r][s] = !grid[r][s];
          if (grid[r][s]) voice(notes[r], 0.3, "triangle");
          render();
        });
        const stepMs = () => 60000 / tempo / 2;             // 한 칸 = 8분음표
        function tick() {
          if (!api.alive()) return stop();
          api.stage.querySelectorAll(".gc-step.now").forEach((x) => x.classList.remove("now"));
          pos = (pos + 1) % steps;
          for (let r = 0; r < notes.length; r++) {
            cell(r, pos).classList.add("now");
            if (grid[r][pos]) voice(notes[r], stepMs() / 1000 * 0.9, "triangle", 0.26);
          }
          timer = setTimeout(tick, stepMs());
        }
        function stop() {
          clearTimeout(timer); timer = null; pos = -1;
          api.stage.querySelectorAll(".gc-step.now").forEach((x) => x.classList.remove("now"));
          const b = $("#gmPlay");
          if (b) b.textContent = "▶ 재생";
        }
        $("#gmPlay").addEventListener("click", () => {
          if (timer) return stop();
          $("#gmPlay").textContent = "■ 정지";
          tick();
        });
        $("#gmClear").addEventListener("click", () => { grid.forEach((row) => row.fill(false)); render(); });
        $("#gmRand").addEventListener("click", () => {
          grid.forEach((row) => row.fill(false));
          let r = rnd(3);
          for (let s = 0; s < steps; s++) {
            if (s > 0 && s % 4 === 3 && rnd(3) === 0) continue;       // 가끔 쉬기
            r = Math.max(0, Math.min(notes.length - 1, r + pick([-1, -1, 0, 1, 1, 2, -2])));
            if (s === steps - 1) r = 0;                                // 끝은 도
            grid[r][s] = true;
          }
          render();
        });
        $("#gmT").addEventListener("input", (e) => { tempo = +e.target.value; $("#gmTv").textContent = tempo; });
        $("#gmDone").addEventListener("click", () => {
          const n = grid.flat().filter(Boolean).length;
          if (!n) { api.wrong("칸을 눌러 음을 놓아 보세요!"); return; }
          stop();
          api.finish({ stars: 3, title: "멋진 멜로디 완성! 🎼", score: n });
        });
        render();
        return stop;
      },
    },

    // ── 4. 비트 만들기 ──
    {
      id: "beat", cat: "create", emoji: "🥁", title: "비트 만들기",
      desc: (g) => (g === "low" ? "킥·스네어·하이햇·박수 8칸 드럼 박자" : "탐·카우벨까지 6악기 16칸 드럼 박자"),
      start(api) {
        const low = api.grade === "low";
        const steps = low ? 8 : 16;
        const ROWS = [
          { id: "kick", name: "킥", emoji: "🦶", c: "#ff5a5f" },
          { id: "snare", name: "스네어", emoji: "🥁", c: "#ff9f1c" },
          { id: "hat", name: "하이햇", emoji: "🔔", c: "#3bceac" },
          { id: "clap", name: "박수", emoji: "👏", c: "#3a86ff" },
          ...(low ? [] : [{ id: "tom", name: "탐", emoji: "🪘", c: "#8338ec" }, { id: "bell", name: "카우벨", emoji: "🐮", c: "#ff6b9d" }]),
        ];
        // 16칸 기준 패턴(8칸이면 짝수 칸만)
        const PRESETS = {
          "🎸 록": { kick: "x.......x.x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." },
          "🎺 행진곡": { kick: "x.......x.......", snare: "....x.x.....x.x.", hat: "x...x...x...x...", clap: "................" },
          "🕺 댄스": { kick: "x...x...x...x...", hat: "..x...x...x...x.", clap: "....x.......x..." },
          "👏 신나는 박수": { kick: "x.......x.......", clap: "x...x...x.x.x...", hat: "x.x.x.x.x.x.x.x.", bell: "x...x...x...x..." },
        };
        const grid = ROWS.map(() => new Array(steps).fill(false));
        let tempo = low ? 96 : 104, pos = -1, timer = null;
        api.stage.innerHTML = `
          <p class="ask">칸을 눌러 나만의 드럼 박자를 만들어요!</p>
          <div class="gc-presets" id="gbP">${Object.keys(PRESETS).map((k) => `<button class="chip-b">${k}</button>`).join("")}</div>
          <div class="gc-seq drums ${low ? "" : "wide"}" id="gbG" style="--steps:${steps}">
            ${ROWS.map((row, r) => `<div class="gc-lab" style="--c:${row.c}">${row.emoji}<small>${row.name}</small></div>` +
              Array.from({ length: steps }, (_, s) => `<button class="gc-step${s % (steps / 4) === 0 ? " beat" : ""}" data-r="${r}" data-s="${s}" style="--c:${row.c}"></button>`).join("")).join("")}
          </div>
          <div class="gc-row">
            <button class="btn primary" id="gbPlay">▶ 재생</button>
            <button class="btn" id="gbClear">🧽 지우기</button>
            <label class="gc-tempo">🐢 <input type="range" id="gbT" min="70" max="160" value="${tempo}"> 🐇 <b id="gbTv">${tempo}</b></label>
          </div>
          <div class="gc-row"><button class="btn primary" id="gbDone">완성!</button></div>`;
        const $ = (s) => api.stage.querySelector(s);
        const cell = (r, s) => $(`#gbG .gc-step[data-r="${r}"][data-s="${s}"]`);
        const render = () => grid.forEach((row, r) => row.forEach((on, s) => cell(r, s).classList.toggle("on", on)));
        const hit = (r) => DRUMS[ROWS[r].id](Sound.ac().currentTime + 0.005);
        $("#gbG").addEventListener("click", (e) => {
          const b = e.target.closest(".gc-step");
          if (!b) return;
          const r = +b.dataset.r, s = +b.dataset.s;
          grid[r][s] = !grid[r][s];
          if (grid[r][s]) hit(r);
          render();
        });
        $("#gbG").addEventListener("click", (e) => {
          const l = e.target.closest(".gc-lab");
          if (!l) return;
          const r = [...$("#gbG").querySelectorAll(".gc-lab")].indexOf(l);
          if (r >= 0) hit(r);
        });
        const stepMs = () => 60000 / tempo / (steps / 4);
        function tick() {
          if (!api.alive()) return stop();
          api.stage.querySelectorAll(".gc-step.now").forEach((x) => x.classList.remove("now"));
          pos = (pos + 1) % steps;
          ROWS.forEach((_, r) => {
            cell(r, pos).classList.add("now");
            if (grid[r][pos]) hit(r);
          });
          timer = setTimeout(tick, stepMs());
        }
        function stop() {
          clearTimeout(timer); timer = null; pos = -1;
          api.stage.querySelectorAll(".gc-step.now").forEach((x) => x.classList.remove("now"));
          const b = $("#gbPlay");
          if (b) b.textContent = "▶ 재생";
        }
        $("#gbPlay").addEventListener("click", () => {
          if (timer) return stop();
          $("#gbPlay").textContent = "■ 정지";
          tick();
        });
        $("#gbClear").addEventListener("click", () => { grid.forEach((row) => row.fill(false)); render(); });
        $("#gbP").addEventListener("click", (e) => {
          const b = e.target.closest("button");
          if (!b) return;
          const p = PRESETS[b.textContent];
          ROWS.forEach((row, r) => {
            const pat = p[row.id] || "";
            for (let s = 0; s < steps; s++) grid[r][s] = pat[low ? s * 2 : s] === "x";
          });
          render();
          if (!timer) { $("#gbPlay").textContent = "■ 정지"; tick(); }
        });
        $("#gbT").addEventListener("input", (e) => { tempo = +e.target.value; $("#gbTv").textContent = tempo; });
        $("#gbDone").addEventListener("click", () => {
          const n = grid.flat().filter(Boolean).length;
          if (!n) { api.wrong("칸을 눌러 박자를 만들어 보세요!"); return; }
          stop();
          api.finish({ stars: 3, title: "신나는 비트 완성! 🥁", score: n });
        });
        render();
        return stop;
      },
    },
  );
})();
