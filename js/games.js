// 게임 4개. 각 게임 = { id, emoji, title, desc(grade), start(api) → 정리 함수 }
// api: stage(엘리먼트), grade("low"|"high"), correct(), wrong(), progress(i, n), toast(글, 종류), finish({stars, title, msg}), wait(ms), alive()
const SOLFA = ["도", "레", "미", "파", "솔", "라", "시"];
const NOTE_COLORS = ["#ff5a5f", "#ff9f1c", "#ffd23f", "#3bceac", "#0ead69", "#3a86ff", "#8338ec"];   // 도~시 색
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const posMidi = (p) => 12 * (Math.floor(p / 7) + 1) + LETTER_PC[((p % 7) + 7) % 7];   // 오선 위치(C4 = 28) → 미디
const starsOf = (score, [a, b, c]) => (score >= c ? 3 : score >= b ? 2 : score >= a ? 1 : 0);

// VexFlow 로 음표 하나를 크게
function drawNote(el, pos, clef, color) {
  const VF = Vex.Flow;
  el.innerHTML = "";
  const W = 260, H = 170, S = 1;
  const r = new VF.Renderer(el, VF.Renderer.Backends.SVG);
  r.resize(W * S, H * S);
  const ctx = r.getContext();

  const stave = new VF.Stave(10, 35, 230).addClef(clef);
  stave.setContext(ctx).draw();
  const letter = "cdefgab"[((pos % 7) + 7) % 7], oct = Math.floor(pos / 7);
  const n = new VF.StaveNote({ keys: [`${letter}/${oct}`], duration: "w", clef });
  if (color) n.setStyle({ fillStyle: color, strokeStyle: color });
  const v = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables([n]);
  new VF.Formatter().joinVoices([v]).format([v], 120);
  v.draw(ctx, stave);
  const svg = el.querySelector("svg");
  svg.setAttribute("viewBox", `0 0 ${W * S} ${H * S}`);
  svg.removeAttribute("width"); svg.removeAttribute("height"); svg.style.width = "100%"; svg.style.height = "auto";
}

const GAMES = [
  // ── 1. 계이름 맞히기 ──
  {
    id: "notes", cat: "score", emoji: "🎼", title: "계이름 맞히기",
    desc: (g) => (g === "low" ? "높은음자리표 도~도, 색깔 힌트" : "높은음·낮은음자리표, 덧줄까지"),
    start(api) {
      const N = 10, low = api.grade === "low";
      let i = 0, score = 0, prev = null, hint = low;
      api.stage.innerHTML = `
        <p class="ask">이 음은 무슨 계이름일까요?</p>
        <div class="staff" id="staff"></div>
        <label class="hint-toggle"><input type="checkbox" id="hint" ${hint ? "checked" : ""}> 색깔 힌트</label>
        <div class="solfa" id="solfa">${SOLFA.map((s, k) => `<button data-k="${k}" style="--c:${NOTE_COLORS[k]}">${s}</button>`).join("")}</div>`;
      const staff = api.stage.querySelector("#staff");
      let q = null, locked = false;
      api.stage.querySelector("#hint").addEventListener("change", (e) => { hint = e.target.checked; show(); });
      const show = () => drawNote(staff, q.pos, q.clef, hint ? NOTE_COLORS[((q.pos % 7) + 7) % 7] : null);
      function next() {
        if (i >= N) {
          return api.finish({ stars: starsOf(score, [5, 7, 9]), title: `${N}문제 중 ${score}개 맞혔어요!`, score });
        }
        api.progress(i, N);
        let pos;
        do {
          if (low) q = { clef: "treble", pos: 28 + rnd(8) };                        // C4 ~ C5
          else q = rnd(3) ? { clef: "treble", pos: 27 + rnd(14) } : { clef: "bass", pos: 17 + rnd(12) };   // B3~A5 / F2~E4
          pos = q.pos;
        } while (pos === prev);
        prev = pos;
        show();
        locked = false;
      }
      api.stage.querySelector("#solfa").addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b || locked) return;
        locked = true;
        const k = +b.dataset.k, ans = ((q.pos % 7) + 7) % 7;
        Sound.note(posMidi(q.pos), 0.6);
        const right = api.stage.querySelector(`#solfa button[data-k="${ans}"]`);
        if (k === ans) { score++; api.correct(); b.classList.add("good"); }
        else { api.wrong(`정답은 '${SOLFA[ans]}'`); b.classList.add("bad"); right.classList.add("good"); }
        await api.wait(k === ans ? 700 : 1300);
        if (!api.alive()) return;
        api.stage.querySelectorAll("#solfa button").forEach((x) => x.classList.remove("good", "bad"));
        i++;
        next();
      });
      next();
    },
  },

  // ── 2. 높은 소리 낮은 소리 ──
  {
    id: "pitch", cat: "listen", emoji: "👂", title: "높은 소리 낮은 소리",
    desc: (g) => (g === "low" ? "두 소리 중 더 높은 소리 찾기" : "아주 비슷한 소리도 구별해요 + 같아요"),
    start(api) {
      const N = 10, low = api.grade === "low";
      let i = 0, score = 0, q = null, locked = true;
      api.stage.innerHTML = `
        <p class="ask">더 <b>높은</b> 소리는 몇 번째일까요?</p>
        <div class="speakers"><div class="spk" id="s1">🔊<span>1</span></div><div class="spk" id="s2">🔊<span>2</span></div></div>
        <button class="btn ghost" id="replay">🔁 다시 듣기</button>
        <div class="choices" id="ch">
          <button data-a="1">1번이 높아요</button>
          ${low ? "" : `<button data-a="0">똑같아요</button>`}
          <button data-a="2">2번이 높아요</button>
        </div>`;
      const s1 = api.stage.querySelector("#s1"), s2 = api.stage.querySelector("#s2");
      async function play() {
        locked = true;
        s1.classList.add("on"); Sound.note(q.a, 0.7);
        await api.wait(800); if (!api.alive()) return;
        s1.classList.remove("on"); s2.classList.add("on"); Sound.note(q.b, 0.7);
        await api.wait(800); if (!api.alive()) return;
        s2.classList.remove("on");
        locked = false;
      }
      function next() {
        if (i >= N) return api.finish({ stars: starsOf(score, [5, 7, 9]), title: `${N}문제 중 ${score}개 맞혔어요!`, score });
        api.progress(i, N);
        const base = 55 + rnd(20);
        let d = low ? 4 + rnd(9) : 1 + rnd(3);
        if (!low && rnd(8) === 0) d = 0;
        const up = rnd(2) === 0;
        q = { a: base, b: base + (up ? d : -d) };
        q.ans = d === 0 ? 0 : q.a > q.b ? 1 : 2;
        play();
      }
      api.stage.querySelector("#replay").addEventListener("click", () => { if (!locked) play(); });
      api.stage.querySelector("#ch").addEventListener("click", async (e) => {
        const b = e.target.closest("button");
        if (!b || locked) return;
        locked = true;
        const a = +b.dataset.a;
        if (a === q.ans) { score++; api.correct(); b.classList.add("good"); }
        else {
          api.wrong(q.ans === 0 ? "두 소리가 똑같았어요" : `${q.ans}번이 더 높았어요`);
          b.classList.add("bad");
          const r = api.stage.querySelector(`#ch button[data-a="${q.ans}"]`);
          if (r) r.classList.add("good");
        }
        await api.wait(1100);
        if (!api.alive()) return;
        api.stage.querySelectorAll("#ch button").forEach((x) => x.classList.remove("good", "bad"));
        i++;
        next();
      });
      api.stage.insertAdjacentHTML("beforeend", `<button class="btn primary start" id="go">▶ 시작하기</button>`);
      api.stage.querySelector("#go").addEventListener("click", (e) => { e.target.remove(); next(); });
    },
  },

  // ── 3. 리듬 따라치기 ──
  {
    id: "rhythm", cat: "rhythm", emoji: "🥁", title: "리듬 따라치기",
    desc: (g) => (g === "low" ? "4분·8분음표, 4분쉼표, 2분음표" : "점4분음표·당김음·엇박까지"),
    start(api) {
      const N = 8, low = api.grade === "low";
      const bpm = low ? 80 : 92, spb = 60 / bpm, tol = low ? 0.17 : 0.12;
      // 박 단위 조각: 길이(박), 치는 시점(박), VexFlow 음가
      const LOW = [
        { len: 1, hits: [0], vf: ["q"] }, { len: 1, hits: [0], vf: ["q"] }, { len: 1, hits: [0, 0.5], vf: ["8", "8"] },
        { len: 1, hits: [], vf: ["qr"] }, { len: 2, hits: [0], vf: ["h"] },
      ];
      const HIGH = [...LOW, { len: 2, hits: [0, 1.5], vf: ["qd", "8"] }, { len: 2, hits: [0, 0.5, 1.5], vf: ["8", "q", "8"] },
        { len: 1, hits: [0.5], vf: ["8r", "8"] }, { len: 1, hits: [0, 0.5], vf: ["8", "8"] }];
      let i = 0, score = 0, pat = null, busy = false, taps = null, barStart = 0;

      api.stage.innerHTML = `
        <p class="ask" id="rAsk">리듬을 듣고, 똑같이 북을 쳐 보세요!</p>
        <div class="staff rhythm" id="rStaff"></div>
        <div class="marks" id="marks"></div>
        <div class="rbtns"><button class="btn" id="listen">👂 듣기</button><button class="btn primary" id="mine">🥁 내 차례</button></div>
        <button class="pad" id="pad">🥁<small>여기를 두드려요</small></button>`;
      const $ = (s) => api.stage.querySelector(s);

      function makePattern() {
        for (;;) {
          const parts = [];
          let beats = 0;
          while (beats < 4) {
            const c = pick(low ? LOW : HIGH);
            if (beats + c.len > 4) continue;
            parts.push({ ...c, at: beats });
            beats += c.len;
          }
          const hits = parts.flatMap((p) => p.hits.map((h) => p.at + h));
          if (hits.length >= 3 && hits[0] === 0 && hits.length <= (low ? 6 : 7)) return { parts, hits };
        }
      }
      function drawPattern() {
        const VF = Vex.Flow, el = $("#rStaff");
        el.innerHTML = "";
        const W = 360, H = 110, S = 1;
        const r = new VF.Renderer(el, VF.Renderer.Backends.SVG);
        r.resize(W * S, H * S);
        const ctx = r.getContext();
      
        const st = new VF.Stave(6, 10, 346).addTimeSignature("4/4");
        st.setContext(ctx).draw();
        const notes = pat.parts.flatMap((p) => p.vf.map((d) => {
          const n = new VF.StaveNote({ keys: ["b/4"], duration: d, stem_direction: 1 });
          if (d === "qd") VF.Dot.buildAndAttach([n], { all: true });
          return n;
        }));
        const v = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables(notes);
        const beams = VF.Beam.generateBeams(notes, { stem_direction: 1 });
        new VF.Formatter().joinVoices([v]).format([v], 280);
        v.draw(ctx, st);
        beams.forEach((b) => b.setContext(ctx).draw());
        const svg = el.querySelector("svg");
        svg.setAttribute("viewBox", `0 0 ${W * S} ${H * S}`);
        svg.removeAttribute("width"); svg.removeAttribute("height"); svg.style.width = "100%"; svg.style.height = "auto";
      }
      const setBusy = (b) => { busy = b; $("#listen").disabled = b; $("#mine").disabled = b; };

      async function listen() {
        if (busy) return;
        setBusy(true);
        $("#rAsk").textContent = "하나, 둘, 셋, 넷 다음에 잘 들어요 👂";
        for (let k = 0; k < 4; k++) Sound.click(k * spb, k === 0);
        pat.hits.forEach((h) => Sound.drum(4 * spb + h * spb));
        for (let k = 0; k < 4; k++) Sound.click((4 + k) * spb, false);
        await api.wait((8 * spb + 0.2) * 1000);
        if (!api.alive()) return;
        $("#rAsk").textContent = "이제 🥁 내 차례를 눌러 따라 쳐 봐요!";
        setBusy(false);
      }
      async function mine() {
        if (busy) return;
        setBusy(true);
        $("#marks").innerHTML = "";
        $("#rAsk").textContent = "하나, 둘, 셋, 넷 하고 시작! 🥁";
        const t0 = Sound.now() + 0.1;
        for (let k = 0; k < 8; k++) Sound.click(0.1 + k * spb, k % 4 === 0);
        barStart = t0 + 4 * spb;
        taps = [];
        $("#pad").classList.add("live");
        await api.wait((0.1 + 8 * spb + 0.35) * 1000);
        if (!api.alive()) return;
        $("#pad").classList.remove("live");
        const t = taps;
        taps = null;
        judge(t);
      }
      async function judge(t) {
        // 박 기준 시각으로 바꿔 가장 가까운 탭과 짝짓기
        const got = t.map((x) => (x - barStart) / spb).filter((b) => b > -0.5 && b < 4.3);
        const used = new Set();
        const res = pat.hits.map((h) => {
          let best = -1, bd = 1e9;
          got.forEach((g, k) => { const d = Math.abs(g - h) * spb; if (!used.has(k) && d < bd) { bd = d; best = k; } });
          if (best >= 0 && bd <= tol) { used.add(best); return true; }
          return false;
        });
        const extra = got.length - used.size;
        $("#marks").innerHTML = res.map((ok) => `<span class="${ok ? "ok" : "no"}">${ok ? "⭕" : "❌"}</span>`).join("") +
          (extra > 0 ? `<span class="no">+${extra}번 더 쳤어요</span>` : "");
        const perfect = res.every(Boolean) && extra === 0;
        if (perfect) { score++; api.correct(); } else api.wrong(res.every(Boolean) ? "한 번 더 쳤어요" : "박자가 조금 달랐어요");
        await api.wait(1500);
        if (!api.alive()) return;
        i++;
        setBusy(false);
        next();
      }
      function next() {
        if (i >= N) return api.finish({ stars: starsOf(score, [3, 5, 7]), title: `${N}개 중 ${score}개 성공!`, score });
        api.progress(i, N);
        pat = makePattern();
        drawPattern();
        $("#marks").innerHTML = "";
        listen();
      }
      const tap = (e) => {
        e.preventDefault();
        const p = $("#pad");
        p.classList.remove("hit"); void p.offsetWidth; p.classList.add("hit");
        Sound.drum(0, 0.7);
        if (taps) taps.push(Sound.now());
      };
      $("#pad").addEventListener("pointerdown", tap);
      $("#listen").addEventListener("click", listen);
      $("#mine").addEventListener("click", mine);
      const key = (e) => { if (e.code === "Space") tap(e); };
      document.addEventListener("keydown", key);
      setBusy(true);
      api.stage.insertAdjacentHTML("beforeend", `<button class="btn primary start" id="go">▶ 시작하기</button>`);
      $("#go").addEventListener("click", (e) => { e.target.remove(); setBusy(false); next(); });
      return () => document.removeEventListener("keydown", key);
    },
  },

  // ── 4. 건반 따라치기(기억력) ──
  {
    id: "simon", cat: "play", emoji: "🎹", title: "건반 따라치기",
    desc: (g) => (g === "low" ? "도~솔 5건반, 들은 순서대로 누르기" : "도~높은 도 8건반, 더 빠르게"),
    start(api) {
      const low = api.grade === "low";
      const keys = low ? [60, 62, 64, 65, 67] : [60, 62, 64, 65, 67, 69, 71, 72];
      const gap = low ? 620 : 460;
      let seq = [], idx = 0, best = 0, locked = true;
      api.stage.innerHTML = `
        <p class="ask" id="kAsk">잘 듣고 똑같은 순서로 눌러요!</p>
        <div class="level" id="kLv">1단계</div>
        <div class="keys ${low ? "k5" : "k8"}" id="keys">${keys.map((m, k) =>
          `<button data-k="${k}" style="--c:${NOTE_COLORS[k % 7]}"><span>${SOLFA[k % 7]}</span></button>`).join("")}</div>`;
      const $ = (s) => api.stage.querySelector(s);
      const light = (k, on) => $(`#keys button[data-k="${k}"]`).classList.toggle("lit", on);

      async function playSeq() {
        locked = true;
        $("#kAsk").textContent = "잘 들어요 👂";
        await api.wait(500);
        for (const k of seq) {
          if (!api.alive()) return;
          light(k, true); Sound.note(keys[k], gap / 1000 * 0.8);
          await api.wait(gap * 0.7);
          light(k, false);
          await api.wait(gap * 0.3);
        }
        if (!api.alive()) return;
        $("#kAsk").textContent = "이제 눌러 보세요! 🎹";
        idx = 0;
        locked = false;
      }
      function grow() {
        seq.push(rnd(keys.length));
        $("#kLv").textContent = `${seq.length - (low ? 1 : 2)}단계 · 음 ${seq.length}개`;
        api.progress(Math.min(seq.length, 12), 12);
        playSeq();
      }
      $("#keys").addEventListener("pointerdown", async (e) => {
        const b = e.target.closest("button");
        if (!b || locked) return;
        e.preventDefault();
        const k = +b.dataset.k;
        Sound.note(keys[k], 0.35);
        b.classList.add("lit"); setTimeout(() => b.classList.remove("lit"), 180);
        if (k !== seq[idx]) {
          locked = true;
          api.wrong("앗, 순서가 달라요!");
          light(seq[idx], true);
          await api.wait(1200);
          if (!api.alive()) return;
          const t = low ? [3, 5, 7] : [4, 7, 10];
          return api.finish({ stars: starsOf(best, t), title: `음 ${best}개까지 기억했어요!`, score: best });
        }
        idx++;
        if (idx === seq.length) {
          locked = true;
          best = seq.length;
          api.correct();
          await api.wait(700);
          if (api.alive()) grow();
        }
      });
      seq = Array.from({ length: low ? 1 : 2 }, () => rnd(keys.length));
      api.stage.insertAdjacentHTML("beforeend", `<button class="btn primary start" id="go">▶ 시작하기</button>`);
      $("#go").addEventListener("click", (e) => { e.target.remove(); grow(); });
    },
  },
];

// ── 공통: 보기 고르기 퀴즈 틀(문제 N개, 문제마다 보여주기 → 보기 버튼) ──
function quiz(api, { N, make, render, choices, check, explain, onShow, thresholds = [5, 7, 9], cols = 2 }) {
  let i = 0, score = 0, q = null, locked = true, prev = null;
  api.stage.innerHTML = `<p class="ask" id="qAsk"></p><div class="card-q" id="qCard"></div>
    <div class="extra" id="qExtra"></div><div class="choices c${cols}" id="qCh"></div>`;
  const $ = (s) => api.stage.querySelector(s);
  function next() {
    if (i >= N) return api.finish({ stars: starsOf(score, thresholds), title: `${N}문제 중 ${score}개 맞혔어요!`, score });
    api.progress(i, N);
    let tries = 0;
    do { q = make(); } while (prev !== null && q.key === prev && tries++ < 20);
    prev = q.key;
    render(q, $("#qCard"), $("#qAsk"), $("#qExtra"));
    $("#qCh").innerHTML = choices(q).map((c, k) => `<button data-k="${k}">${c.label}</button>`).join("");
    q._choices = choices(q);
    locked = false;
    if (onShow) onShow(q);
  }
  $("#qCh").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b || locked) return;
    locked = true;
    const c = q._choices[+b.dataset.k];
    const ok = check(q, c);
    if (ok) { score++; api.correct(); b.classList.add("good"); }
    else {
      api.wrong(explain(q));
      b.classList.add("bad");
      q._choices.forEach((x, k) => { if (check(q, x)) $(`#qCh button[data-k="${k}"]`).classList.add("good"); });
    }
    await api.wait(ok ? 750 : 1500);
    if (!api.alive()) return;
    i++;
    next();
  });
  next();
  return { next, get q() { return q; } };
}
const shuffle = (a) => { const b = [...a]; for (let k = b.length - 1; k > 0; k--) { const j = rnd(k + 1); [b[k], b[j]] = [b[j], b[k]]; } return b; };

// VexFlow 로 작은 악보 조각(음표·쉼표·기호) 그리기
function drawSnippet(el, { dur = "q", key = "b/4", clef = null, artic = null, repeat = false, width = 200, dot = false }) {
  const VF = Vex.Flow;
  el.innerHTML = "";
  const W = width, H = 150, S = 1;
  const r = new VF.Renderer(el, VF.Renderer.Backends.SVG);
  r.resize(W * S, H * S);
  const ctx = r.getContext();

  const st = new VF.Stave(8, 25, W - 16);
  if (clef) st.addClef(clef);
  if (repeat) { st.setBegBarType(VF.Barline.type.REPEAT_BEGIN); st.setEndBarType(VF.Barline.type.REPEAT_END); }
  st.setContext(ctx).draw();
  if (dur) {
    const n = new VF.StaveNote({ keys: [key], duration: dur, clef: clef || "treble", auto_stem: true });
    if (dot) VF.Dot.buildAndAttach([n], { all: true });
    if (artic) n.addModifier(new VF.Articulation(artic).setPosition(VF.Modifier.Position.ABOVE), 0);
    const v = new VF.Voice({ num_beats: 4, beat_value: 4 }).setMode(VF.Voice.Mode.SOFT).addTickables([n]);
    new VF.Formatter().joinVoices([v]).format([v], W - 90);
    v.draw(ctx, st);
  }
  const svg = el.querySelector("svg");
  svg.setAttribute("viewBox", `0 0 ${W * S} ${H * S}`);
  svg.removeAttribute("width"); svg.removeAttribute("height"); svg.style.width = "100%"; svg.style.height = "auto";
}

GAMES.push(
  // ── 5. 박자 퀴즈 ──
  {
    id: "beats", cat: "score", emoji: "⏱️", title: "몇 박일까요?",
    desc: (g) => (g === "low" ? "온·2분·4분·8분음표와 쉼표" : "점음표·16분음표·여러 쉼표까지"),
    start(api) {
      const low = api.grade === "low";
      const ITEMS = low
        ? [["w", 4, "온음표"], ["h", 2, "2분음표"], ["q", 1, "4분음표"], ["8", 0.5, "8분음표"], ["qr", 1, "4분쉼표"], ["hr", 2, "2분쉼표"]]
        : [["w", 4, "온음표"], ["hd", 3, "점2분음표"], ["h", 2, "2분음표"], ["qd", 1.5, "점4분음표"], ["q", 1, "4분음표"], ["8", 0.5, "8분음표"],
          ["16", 0.25, "16분음표"], ["wr", 4, "온쉼표"], ["hr", 2, "2분쉼표"], ["qr", 1, "4분쉼표"], ["8r", 0.5, "8분쉼표"]];
      const OPTS = low ? [0.5, 1, 2, 4] : [0.25, 0.5, 1, 1.5, 2, 3, 4];
      const fmt = (b) => ({ 0.25: "¼박", 0.5: "½박", 1.5: "1½박" }[b] || `${b}박`);
      quiz(api, {
        N: 10, cols: low ? 2 : 4,
        make: () => { const [d, b, name] = pick(ITEMS); return { key: d, d, b, name }; },
        render: (q, card, ask) => {
          ask.textContent = "이 음표(쉼표)는 몇 박일까요?";
          const base = q.d.replace("r", "").replace("d", "");
          drawSnippet(card, { dur: q.d.includes("d") ? base + "d" : q.d, key: q.d.includes("r") ? (q.d === "wr" ? "d/5" : "b/4") : "b/4", dot: q.d.includes("d") });
        },
        choices: () => OPTS.map((b) => ({ label: fmt(b), b })),
        check: (q, c) => c.b === q.b,
        explain: (q) => `${q.name}는 ${fmt(q.b)}이에요`,
      });
    },
  },

  // ── 6. 건반 찾기 ──
  {
    id: "keys", cat: "score", emoji: "🔍", title: "건반 찾기",
    desc: (g) => (g === "low" ? "말한 계이름의 흰 건반 누르기" : "검은 건반(♯·♭)까지 찾기"),
    start(api) {
      const low = api.grade === "low", N = 10;
      // 한 옥타브 반: 도(60) ~ 미(76)
      const WHITE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76];
      const BLACK = [61, 63, 66, 68, 70, 73, 75];
      const PCNAME = { 0: "도", 2: "레", 4: "미", 5: "파", 7: "솔", 9: "라", 11: "시",
        1: ["도♯", "레♭"], 3: ["레♯", "미♭"], 6: ["파♯", "솔♭"], 8: ["솔♯", "라♭"], 10: ["라♯", "시♭"] };
      let i = 0, score = 0, q = null, locked = true;
      const whiteIdx = (m) => WHITE.indexOf(m);
      api.stage.innerHTML = `<p class="ask big-ask" id="fAsk"></p>
        <div class="piano" id="piano">
          ${WHITE.map((m) => `<button class="w" data-m="${m}"></button>`).join("")}
          ${BLACK.map((m) => { const left = whiteIdx(m - 1) + 1; return `<button class="b" data-m="${m}" style="left:calc(${left} * 10% - 3.2%)"></button>`; }).join("")}
        </div><p class="sub-ask" id="fSub"></p>`;
      const $ = (s) => api.stage.querySelector(s);
      function next() {
        if (i >= N) return api.finish({ stars: starsOf(score, [5, 7, 9]), title: `${N}문제 중 ${score}개 맞혔어요!`, score });
        api.progress(i, N);
        const pcs = low ? [0, 2, 4, 5, 7, 9, 11] : [...Array(12).keys()];
        let pc;
        do { pc = pick(pcs); } while (q && pc === q.pc);
        const nm = PCNAME[pc];
        const label = Array.isArray(nm) ? pick(nm) : nm;
        q = { pc, label };
        $("#fAsk").innerHTML = `<b>${label}</b> 건반을 눌러 보세요!`;
        $("#fSub").textContent = low ? "" : Array.isArray(nm) ? `(${nm[0]} = ${nm[1]}, 같은 건반이에요)` : "";
        if (!low && Array.isArray(nm)) $("#fSub").textContent = "";
        locked = false;
      }
      $("#piano").addEventListener("pointerdown", async (e) => {
        const b = e.target.closest("button");
        if (!b || locked) return;
        e.preventDefault();
        locked = true;
        const m = +b.dataset.m;
        Sound.note(m, 0.5);
        const ok = m % 12 === q.pc;
        if (ok) { score++; api.correct(); b.classList.add("good"); }
        else {
          api.wrong(`${q.label} 건반은 여기예요`);
          b.classList.add("bad");
          api.stage.querySelectorAll("#piano button").forEach((x) => { if (+x.dataset.m % 12 === q.pc) x.classList.add("good"); });
        }
        await api.wait(ok ? 700 : 1500);
        if (!api.alive()) return;
        api.stage.querySelectorAll("#piano button").forEach((x) => x.classList.remove("good", "bad"));
        i++;
        next();
      });
      next();
    },
  },

  // ── 7. 음악 기호 퀴즈 ──
  {
    id: "symbols", cat: "score", emoji: "🔣", title: "음악 기호 퀴즈",
    desc: (g) => (g === "low" ? "p·f, 도돌이표, 쉼표, 높은음자리표" : "셈여림·빠르기말·임시표·늘임표·스타카토"),
    start(api) {
      const low = api.grade === "low";
      const txt = (s, cls = "sym-it") => (card) => { card.innerHTML = `<div class="sym ${cls}">${s}</div>`; };
      const hair = (dir) => (card) => {
        card.innerHTML = `<svg class="sym-svg" viewBox="0 0 220 80"><path d="${dir === "cresc" ? "M20 40 L200 15 M20 40 L200 65" : "M20 15 L200 40 M20 65 L200 40"}" stroke="#222" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
      };
      const vf = (o) => (card) => drawSnippet(card, o);
      const LOW = [
        ["p", "여리게", txt("p")], ["f", "세게", txt("f")],
        ["treble", "높은음자리표", vf({ dur: null, clef: "treble", width: 140 })],
        ["repeat", "도돌이표 (다시 돌아가서 한 번 더)", vf({ dur: "w", repeat: true, key: "c/5" })],
        ["qr", "4분쉼표 (1박 쉬기)", vf({ dur: "qr" })],
        ["cresc", "점점 세게", hair("cresc")], ["decresc", "점점 여리게", hair("decresc")],
      ];
      const HIGH = [
        ...LOW.filter(([k]) => !["qr", "treble"].includes(k)),
        ["pp", "매우 여리게", txt("pp")], ["ff", "매우 세게", txt("ff")], ["mp", "조금 여리게", txt("mp")], ["mf", "조금 세게", txt("mf")],
        ["bass", "낮은음자리표", vf({ dur: null, clef: "bass", width: 140 })],
        ["sharp", "샵 (반음 올림)", txt("♯", "sym-acc")], ["flat", "플랫 (반음 내림)", txt("♭", "sym-acc")], ["natural", "제자리표", txt("♮", "sym-acc")],
        ["fermata", "늘임표 (알맞게 늘여서)", vf({ dur: "q", key: "b/4", artic: "a@a" })],
        ["stacc", "스타카토 (짧게 끊어서)", vf({ dur: "q", key: "b/4", artic: "a." })],
        ["allegro", "빠르게", txt("Allegro", "sym-word")], ["andante", "느리게 걷는 빠르기로", txt("Andante", "sym-word")],
        ["moderato", "보통 빠르기로", txt("Moderato", "sym-word")], ["rit", "점점 느리게", txt("rit.", "sym-word")],
      ];
      const pool = low ? LOW : HIGH;
      quiz(api, {
        N: 10, cols: 2,
        make: () => { const [key, ans, draw] = pick(pool); return { key, ans, draw }; },
        render: (q, card, ask) => { ask.textContent = "이 기호의 뜻은 무엇일까요?"; q.draw(card); },
        choices: (q) => {
          if (!q.opts) q.opts = shuffle([q.ans, ...shuffle(pool.filter(([, a]) => a !== q.ans)).slice(0, 3).map(([, a]) => a)]);
          return q.opts.map((a) => ({ label: a, a }));
        },
        check: (q, c) => c.a === q.ans,
        explain: (q) => `정답: ${q.ans}`,
      });
    },
  },

  // ── 8. 소리 듣고 계이름 ──
  {
    id: "ear", cat: "listen", emoji: "🎧", title: "소리 듣고 계이름",
    desc: (g) => (g === "low" ? "도 소리를 듣고 → 도·미·솔 중 맞히기" : "도 소리를 듣고 → 도~시 7음 맞히기"),
    start(api) {
      const low = api.grade === "low";
      const set = low ? [0, 2, 4] : [0, 1, 2, 3, 4, 5, 6];        // 계이름 번호(도=0)
      const MIDI = [60, 62, 64, 65, 67, 69, 71];
      let playing = false;
      const play = async (q) => {
        if (playing) return;
        playing = true;
        Sound.note(60, 0.6);
        await api.wait(750);
        if (api.alive()) Sound.note(MIDI[q.k], 0.8);
        await api.wait(600);
        playing = false;
      };
      const game = quiz(api, {
        N: 10, cols: low ? 3 : 4,
        make: () => { const k = pick(set); return { key: k, k }; },
        render: (q, card, ask, extra) => {
          ask.textContent = "처음 소리는 '도'예요. 두 번째 소리는?";
          card.innerHTML = `<div class="ear-ico">🎧</div>`;
          extra.innerHTML = `<button class="btn ghost" id="again2">🔁 다시 듣기</button>`;
          extra.querySelector("#again2").onclick = () => play(q);
        },
        choices: () => set.map((k) => ({ label: `<span class="dot" style="background:${NOTE_COLORS[k]}"></span>${SOLFA[k]}`, k })),
        check: (q, c) => c.k === q.k,
        explain: (q) => `정답은 '${SOLFA[q.k]}'`,
        onShow: (q) => play(q),
      });
      return () => {};
    },
  },
);
