// 놀이 게임 4개: 짝 맞추기 · 계이름 스피드 · 마디 채우기(박수 세기) · 노래 제목 맞히기
// games.js 의 전역(SOLFA, NOTE_COLORS, rnd, pick, starsOf, shuffle, quiz, drawNote, drawSnippet, posMidi, GAMES)을 씀

// 작은 VexFlow 그림(음표 여러 개, 박자표 없음) — 카드·보기 버튼 안에
function drawMini(el, durs, { width = 150, height = 84, key = "a/4", clef = null, color = null } = {}) {
  const VF = Vex.Flow;
  el.innerHTML = "";
  const r = new VF.Renderer(el, VF.Renderer.Backends.SVG);
  r.resize(width, height);
  const ctx = r.getContext();
  const st = new VF.Stave(4, -16, width - 8);                // 오선이 그림 가운데 오게(위쪽 여백 줄임)
  if (clef) st.addClef(clef);
  st.setContext(ctx).draw();
  const fixed = durs.map((d) => {
    const n = new VF.StaveNote({ keys: [d === "wr" ? "d/5" : key], duration: d, auto_stem: true });
    if (d.includes("d")) VF.Dot.buildAndAttach([n], { all: true });      // 점음표
    if (color) n.setStyle({ fillStyle: color, strokeStyle: color });
    return n;
  });
  const v = new VF.Voice({ num_beats: 4, beat_value: 4 }).setMode(VF.Voice.Mode.SOFT).addTickables(fixed);
  const beams = VF.Beam.generateBeams(fixed);
  new VF.Formatter().joinVoices([v]).format([v], Math.max(20, st.getNoteEndX() - st.getNoteStartX() - 16));
  v.draw(ctx, st);
  beams.forEach((b) => b.setContext(ctx).draw());
  const svg = el.querySelector("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.removeAttribute("width"); svg.removeAttribute("height");
  svg.style.width = "100%"; svg.style.height = "auto";
}

GAMES.push(
  // ── 짝 맞추기 ──
  {
    id: "memory", cat: "play", emoji: "🃏", title: "짝 맞추기",
    desc: (g) => (g === "low" ? "음표 그림과 이름 짝 찾기 (12장)" : "음악 기호와 뜻 짝 찾기 (16장)"),
    start(api) {
      const low = api.grade === "low";
      // [짝 번호, 앞면 A(그림), 앞면 B(글자)]
      const LOW_POOL = [
        [{ mini: ["w"] }, "온음표"], [{ mini: ["h"] }, "2분음표"], [{ mini: ["q"] }, "4분음표"],
        [{ mini: ["8"] }, "8분음표"], [{ mini: ["qr"] }, "4분쉼표"], [{ mini: ["8", "8"] }, "8분음표 2개"],
        [{ note: 28 }, "도"], [{ note: 30 }, "미"], [{ note: 32 }, "솔"],
      ];
      const HIGH_POOL = [
        [{ txt: "p", cls: "it" }, "여리게"], [{ txt: "f", cls: "it" }, "세게"], [{ txt: "mf", cls: "it" }, "조금 세게"],
        [{ txt: "pp", cls: "it" }, "매우 여리게"], [{ txt: "♯", cls: "acc" }, "올림표 (반음 올림)"], [{ txt: "♭", cls: "acc" }, "내림표 (반음 내림)"],
        [{ txt: "♮", cls: "acc" }, "제자리표"], [{ mini: ["qr"] }, "4분쉼표 (1박 쉬기)"], [{ mini: ["hd"] }, "점2분음표 (3박)"],
        [{ mini: ["qd"] }, "점4분음표 (1박 반)"], [{ txt: "Allegro", cls: "word" }, "빠르게"], [{ txt: "rit.", cls: "word" }, "점점 느리게"],
        [{ note: 35 }, "높은 도"], [{ note: 33 }, "라"],
      ];
      const pairs = shuffle(low ? LOW_POOL : HIGH_POOL).slice(0, low ? 6 : 8);
      const cards = shuffle(pairs.flatMap(([face, name], id) => [{ id, face }, { id, face: { name } }]));
      const total = pairs.length;
      let open = [], matched = 0, tries = 0, locked = false;
      api.stage.innerHTML = `<p class="ask">같은 짝을 찾아 카드를 뒤집어요!</p>
        <div class="mem-info">뒤집은 횟수 <b id="mTries">0</b>번</div>
        <div class="mem-grid ${low ? "g12" : "g16"}" id="mGrid">${cards.map((c, k) => `
          <button class="mem-card" data-k="${k}"><span class="mem-in">
            <span class="mem-back">🎵</span><span class="mem-front" id="mf${k}"></span></span></button>`).join("")}</div>`;
      const $ = (s) => api.stage.querySelector(s);
      cards.forEach((c, k) => {
        const el = $(`#mf${k}`), f = c.face;
        if (f.name) { el.innerHTML = `<span class="mem-name">${f.name}</span>`; el.classList.add("is-name"); }
        else if (f.txt) el.innerHTML = `<span class="mem-sym ${f.cls}">${f.txt}</span>`;
        else if (f.mini) { const box = document.createElement("span"); box.className = "mem-svg"; el.appendChild(box); drawMini(box, f.mini, { width: 120, height: 84 }); }
        else if (f.note !== undefined) {
          const box = document.createElement("span"); box.className = "mem-svg"; el.appendChild(box);
          const key = "cdefgab"[f.note % 7] + "/" + Math.floor(f.note / 7);
          drawMini(box, ["w"], { width: 120, height: 96, key, clef: "treble", color: low ? NOTE_COLORS[f.note % 7] : null });
        }
      });
      api.progress(0, total);
      $("#mGrid").addEventListener("click", async (e) => {
        const b = e.target.closest(".mem-card");
        if (!b || locked || b.classList.contains("up") || b.classList.contains("done")) return;
        b.classList.add("up");
        Sound.note(72 + open.length * 4, 0.12, 0, 0.15);
        open.push(b);
        if (open.length < 2) return;
        tries++;
        $("#mTries").textContent = tries;
        const [a, c] = open;
        open = [];
        if (cards[+a.dataset.k].id === cards[+c.dataset.k].id) {
          a.classList.add("done"); c.classList.add("done");
          matched++;
          api.correct();
          api.progress(matched, total);
          if (matched === total) {
            await api.wait(900);
            if (!api.alive()) return;
            const best = total, t = low ? [best + 8, best + 5, best + 3] : [best + 11, best + 7, best + 4];   // 적게 뒤집을수록 별↑
            const stars = tries <= t[2] ? 3 : tries <= t[1] ? 2 : tries <= t[0] ? 1 : 1;
            api.finish({ stars, title: `${tries}번 만에 모두 찾았어요!` });
          }
        } else {
          locked = true;
          await api.wait(850);
          if (!api.alive()) return;
          a.classList.remove("up"); c.classList.remove("up");
          locked = false;
        }
      });
    },
  },

  // ── 계이름 스피드 ──
  {
    id: "speed", cat: "score", emoji: "⚡", title: "계이름 스피드",
    desc: (g) => (g === "low" ? "30초 동안 도~솔 많이 맞히기 (색깔 힌트)" : "30초 동안 덧줄 음까지 많이 맞히기"),
    start(api) {
      const low = api.grade === "low", LIMIT = 30;
      let count = 0, left = LIMIT, timer = null, q = null, running = false;
      api.stage.innerHTML = `
        <div class="spd-top"><div class="spd-bar"><div id="spdBar"></div></div><div class="spd-num"><b id="spdLeft">${LIMIT}</b>초 · <b id="spdCnt">0</b>개</div></div>
        <div class="staff" id="spdStaff"></div>
        <div class="solfa" id="spdSolfa">${SOLFA.map((s, k) => `<button data-k="${k}" style="--c:${NOTE_COLORS[k]}">${s}</button>`).join("")}</div>
        <button class="btn primary start" id="go">▶ 시작하기</button>`;
      const $ = (s) => api.stage.querySelector(s);
      const nextNote = () => {
        let p;
        do { p = low ? 28 + rnd(5) : 27 + rnd(14); } while (q !== null && p === q);
        q = p;
        drawNote($("#spdStaff"), p, "treble", low ? NOTE_COLORS[p % 7] : null);
      };
      const paint = () => {
        $("#spdLeft").textContent = Math.max(0, Math.ceil(left));
        $("#spdCnt").textContent = count;
        $("#spdBar").style.width = `${Math.max(0, (left / LIMIT) * 100)}%`;
        $("#spdBar").classList.toggle("low", left < 8);
      };
      async function end() {
        running = false;
        clearInterval(timer);
        await api.wait(300);
        if (!api.alive()) return;
        const t = low ? [6, 10, 14] : [8, 13, 18];
        api.finish({ stars: Math.max(count > 0 ? 1 : 0, starsOf(count, t)), title: `30초 동안 ${count}개 맞혔어요!` });
      }
      $("#go").addEventListener("click", (e) => {
        e.target.remove();
        running = true;
        nextNote();
        let last = Date.now();
        timer = setInterval(() => {
          const now = Date.now();
          left -= (now - last) / 1000;
          last = now;
          paint();
          if (left <= 0) end();
        }, 100);
      });
      $("#spdSolfa").addEventListener("pointerdown", (e) => {
        const b = e.target.closest("button");
        if (!b || !running) return;
        e.preventDefault();
        const ans = q % 7;
        Sound.note(posMidi(q), 0.25, 0, 0.2);
        if (+b.dataset.k === ans) {
          count++;
          api.correct();
          api.progress(Math.min(count, 20), 20);
          nextNote();
        } else {
          left -= 1;                                     // 틀리면 1초 감점
          api.wrong(`'${SOLFA[ans]}'였어요 (−1초)`);
          b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 250);
          nextNote();
        }
        paint();
      });
      paint();
      drawNote($("#spdStaff"), low ? 28 : 31, "treble", null);
      return () => clearInterval(timer);
    },
  },

  // ── 마디 채우기 / 박수 세기 ──
  {
    id: "measure", cat: "rhythm", emoji: "🧩", title: "마디 채우기",
    desc: (g) => (g === "low" ? "박수 세기 + 빈 박에 알맞은 음표 찾기" : "빈 박(1~2박 반)을 딱 맞게 채우기, 3/4박자도"),
    start(api) {
      const low = api.grade === "low";
      // 보기 조각: VexFlow 음가들, 박 수, 이름
      const OPTS = [
        { vf: ["q"], b: 1, name: "4분음표" }, { vf: ["h"], b: 2, name: "2분음표" }, { vf: ["hd"], b: 3, name: "점2분음표" },
        { vf: ["w"], b: 4, name: "온음표" }, { vf: ["8", "8"], b: 1, name: "8분음표 2개" }, { vf: ["qr"], b: 1, name: "4분쉼표" },
        { vf: ["qd", "8"], b: 2, name: "점4분+8분" }, { vf: ["q", "8"], b: 1.5, name: "4분+8분" }, { vf: ["8"], b: 0.5, name: "8분음표" },
        { vf: ["hr"], b: 2, name: "2분쉼표" }, { vf: ["qd"], b: 1.5, name: "점4분음표" },
      ];
      const LOW_OPTS = OPTS.filter((o) => ["4분음표", "2분음표", "점2분음표", "온음표"].includes(o.name));
      // 채워진 부분 만들기: 박 단위 조각
      const fillBeats = (beats) => {
        const out = [];
        let b = beats;
        while (b > 0) {
          if (b % 1 === 0.5) { out.push("8"); b -= 0.5; continue; }
          const c = b >= 2 && rnd(3) === 0 ? ["h", 2] : rnd(3) === 0 && !low ? [["8", "8"], 1] : ["q", 1];
          if (Array.isArray(c[0])) out.push(...c[0]); else out.push(c[0]);
          b -= c[1];
        }
        return out;
      };
      const ghostDur = { 0.5: "8", 1: "q", 1.5: "qd", 2: "h", 3: "hd" };

      function drawBar(el, q) {
        const VF = Vex.Flow;
        el.innerHTML = "";
        const W = 360, H = 130;
        const r = new VF.Renderer(el, VF.Renderer.Backends.SVG);
        r.resize(W, H);
        const ctx = r.getContext();
        const st = new VF.Stave(6, 18, W - 12).addClef("treble").addTimeSignature(`${q.num}/4`);
        st.setContext(ctx).draw();
        const notes = q.have.map((d) => new VF.StaveNote({ keys: ["b/4"], duration: d, stem_direction: 1 }));
        const ghost = new VF.GhostNote({ duration: ghostDur[q.m] });
        if (q.m === 1.5 || q.m === 3) VF.Dot.buildAndAttach([ghost], { all: true });
        const all = [...notes, ghost];
        const v = new VF.Voice({ num_beats: q.num, beat_value: 4 }).setMode(VF.Voice.Mode.SOFT).addTickables(all);
        const beams = VF.Beam.generateBeams(notes, { stem_direction: 1 });
        new VF.Formatter().joinVoices([v]).format([v], W - 110);
        v.draw(ctx, st);
        beams.forEach((b) => b.setContext(ctx).draw());
        const x0 = ghost.getAbsoluteX() - 6, x1 = st.getNoteEndX() - 4;
        const y0 = st.getYForLine(0) - 14, y1 = st.getYForLine(4) + 14;
        // 빈칸: 점선 분홍 상자 + ? (SVG 에 직접 추가)
        const svg0 = el.querySelector("svg"), NS = "http://www.w3.org/2000/svg", w = Math.max(34, x1 - x0);
        const box = document.createElementNS(NS, "rect");
        Object.entries({ x: x0, y: y0, width: w, height: y1 - y0, rx: 8, fill: "rgba(255,107,157,0.08)", stroke: "#ff6b9d", "stroke-width": 2.5, "stroke-dasharray": "7 5" })
          .forEach(([k, v]) => box.setAttribute(k, v));
        const qm = document.createElementNS(NS, "text");
        Object.entries({ x: x0 + w / 2, y: (y0 + y1) / 2 + 11, "text-anchor": "middle", "font-size": 32, "font-weight": 700, fill: "#ff6b9d", "font-family": "Arial" })
          .forEach(([k, v]) => qm.setAttribute(k, v));
        qm.textContent = "?";
        svg0.appendChild(box); svg0.appendChild(qm);
        const svg = el.querySelector("svg");
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.removeAttribute("width"); svg.removeAttribute("height");
        svg.style.width = "100%"; svg.style.height = "auto";
      }

      let playing = false;
      const clap = async (n) => {
        if (playing) return;
        playing = true;
        for (let k = 0; k < n; k++) Sound.drum(0.15 + k * 0.5, 0.8);
        await api.wait(300 + n * 500);
        playing = false;
      };

      quiz(api, {
        N: 10, cols: 2,
        make: () => {
          if (low && rnd(2) === 0) {
            const n = 2 + rnd(5);
            return { key: "c" + n, type: "clap", n, opts: [2, 3, 4, 5, 6].map((x) => ({ label: `${x}번`, v: x })) };
          }
          const num = !low && rnd(10) < 3 ? 3 : 4;
          const ms = low ? [1, 2] : num === 3 ? [1, 1.5, 2] : [1, 1.5, 2];
          const m = pick(ms);
          const have = fillBeats(num - m);
          const pool = low ? LOW_OPTS : OPTS;
          const right = pick(pool.filter((o) => o.b === m));
          const wrongs = shuffle(pool.filter((o) => o.b !== m));
          const seenB = new Set([m]), picked = [];
          for (const w of wrongs) { if (!seenB.has(w.b) && picked.length < 3) { seenB.add(w.b); picked.push(w); } }
          const opts = shuffle([right, ...picked]).map((o) => ({ label: `<span class="opt-svg"></span><span class="opt-name">${low ? o.name : ""}</span>`, v: o.b, o }));
          return { key: have.join(",") + m, type: "bar", num, m, have, opts };
        },
        render: (q, card, ask, extra) => {
          extra.innerHTML = "";
          if (q.type === "clap") {
            ask.textContent = "박수 소리가 몇 번 났을까요?";
            card.innerHTML = `<div class="clap-ico">👏</div>`;
            extra.innerHTML = `<button class="btn ghost" id="clapAgain">🔁 다시 듣기</button>`;
            extra.querySelector("#clapAgain").onclick = () => clap(q.n);
          } else {
            ask.textContent = `${q.num}/4박자예요. 빈칸 ? 에 딱 맞는 것은?`;
            drawBar(card, q);
          }
        },
        choices: (q) => q.opts,
        check: (q, c) => c.v === (q.type === "clap" ? q.n : q.m),
        explain: (q) => (q.type === "clap" ? `${q.n}번 쳤어요` : `빈칸은 ${q.m === 1.5 ? "1박 반" : q.m + "박"}이에요`),
        onShow: (q) => {
          if (q.type === "clap") { clap(q.n); return; }
          api.stage.querySelectorAll("#qCh button").forEach((b, k) => drawMini(b.querySelector(".opt-svg"), q.opts[k].o.vf, { width: 110, height: 82 }));
        },
      });
    },
  },

  // ── 노래 제목 맞히기(저작권 없는 곡만) ──
  {
    id: "song", cat: "listen", emoji: "🎵", title: "노래 제목 맞히기",
    desc: (g) => (g === "low" ? "앞부분을 듣고 어떤 노래인지 맞히기" : "첫 4음만 듣고, 조도 바뀌어요"),
    start(api) {
      const low = api.grade === "low";
      // [미디, 박]. 모두 전래·민요이거나 저작권이 끝난 곡
      const SONGS = [
        { t: "반짝반짝 작은별", e: "⭐", m: [[60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2], [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2]] },
        { t: "나비야", e: "🦋", m: [[67, 1], [64, 1], [64, 2], [65, 1], [62, 1], [62, 2], [60, 1], [62, 1], [64, 1], [65, 1], [67, 1], [67, 1], [67, 2]] },
        { t: "떴다 떴다 비행기", e: "✈️", m: [[64, 1.5], [62, 0.5], [60, 1], [62, 1], [64, 1], [64, 1], [64, 2], [62, 1], [62, 1], [62, 2], [64, 1], [67, 1], [67, 2]] },
        { t: "생일 축하합니다", e: "🎂", m: [[67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2], [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2]] },
        { t: "징글벨", e: "🔔", m: [[64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4]] },
        { t: "런던 다리", e: "🌉", m: [[67, 1.5], [69, 0.5], [67, 1], [65, 1], [64, 1], [65, 1], [67, 2], [62, 1], [64, 1], [65, 2], [64, 1], [65, 1], [67, 2]] },
        { t: "환희의 송가 (베토벤)", e: "🎼", m: [[64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2]] },
        { t: "맥도날드 할아버지", e: "🐮", m: [[67, 1], [67, 1], [67, 1], [62, 1], [64, 1], [64, 1], [62, 2], [71, 1], [71, 1], [69, 1], [69, 1], [67, 2]] },
      ];
      const spb = 60 / 112;
      let playing = false;
      const play = async (q) => {
        if (playing) return;
        playing = true;
        let t = 0.1;
        for (const [m, b] of q.clip) { Sound.note(m + q.shift, Math.max(0.15, b * spb * 0.85), t, 0.3); t += b * spb; }
        await api.wait(t * 1000 + 200);
        playing = false;
      };
      quiz(api, {
        N: 10, cols: 2,
        make: () => {
          const s = pick(SONGS);
          const clip = low ? s.m : s.m.slice(0, 4);
          const shift = low ? 0 : rnd(11) - 5;
          const others = shuffle(SONGS.filter((x) => x !== s)).slice(0, 3);
          const opts = shuffle([s, ...others]).map((x) => ({ label: `<span class="song-e">${x.e}</span>${x.t}`, t: x.t }));
          return { key: s.t, s, clip, shift, opts };
        },
        render: (q, card, ask, extra) => {
          ask.textContent = low ? "어떤 노래일까요?" : "첫 4음만 들려줄게요. 어떤 노래일까요?";
          card.innerHTML = `<div class="song-ico">🎶</div>`;
          extra.innerHTML = `<button class="btn ghost" id="songAgain">🔁 다시 듣기</button>`;
          extra.querySelector("#songAgain").onclick = () => play(q);
        },
        choices: (q) => q.opts,
        check: (q, c) => c.t === q.s.t,
        explain: (q) => `정답: ${q.s.e} ${q.s.t}`,
        onShow: (q) => play(q),
      });
    },
  },
);
