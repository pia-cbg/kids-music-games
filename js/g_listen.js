// 듣기 게임 4개: 크게?작게?(셈여림) · 밝은?슬픈?(장조·단조) · 빠르게?느리게?(빠르기) · 올라가요?내려가요?(방향·음정)
// quiz() 틀 사용. 소리가 나는 동안에는 보기를 못 누르게 막고(.lis-wait), 🔁 다시 듣기 제공
(function () {
  const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
  const MINOR = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

  // 듣기 공통: 카드(아이콘) + 다시 듣기 버튼, 재생 중 잠금
  function listenQuiz(api, opt) {
    let playing = false, token = 0;
    const ch = () => api.stage.querySelector("#qCh");
    async function play(q) {
      if (playing || !api.alive()) return;
      playing = true;
      const my = ++token;
      const card = api.stage.querySelector(".lis-ico");
      if (card) card.classList.add("on");
      ch().classList.add("lis-wait");
      const ms = opt.play(q);                       // 재생 길이(ms)
      await api.wait(ms + 150);
      if (!api.alive() || my !== token) return;
      if (card) card.classList.remove("on");
      ch().classList.remove("lis-wait");
      playing = false;
    }
    return quiz(api, {
      N: 10, cols: opt.cols || 2,
      make: opt.make,
      render: (q, card, ask, extra) => {
        ask.innerHTML = opt.ask(q);
        card.innerHTML = `<div class="lis-ico">${opt.icon(q)}</div>`;
        extra.innerHTML = `<button class="btn ghost lis-again">🔁 다시 듣기</button>`;
        extra.querySelector(".lis-again").onclick = () => play(q);
      },
      choices: (q) => (q.opts || (q.opts = opt.choices(q))),
      check: (q, c) => c.v === q.ans,
      explain: opt.explain,
      onShow: (q) => { playing = false; play(q); },
    });
  }

  // 짧은 멜로디(음계 번호 배열) → [미디]
  const PHRASES = [[0, 1, 2, 3, 4, 4], [4, 3, 2, 1, 0, 0], [0, 2, 4, 2, 0], [0, 0, 4, 4, 5, 5, 4], [2, 1, 0, 1, 2, 2, 2], [4, 2, 2, 3, 1, 1, 0]];
  const phrase = (root, scale = MAJOR) => pick(PHRASES).map((d) => root + scale[d]);

  // 음 여러 개를 순서대로(길이 dur 초씩, 볼륨 목록)
  function seq(midis, dur, vols, start = 0) {
    let t = start;
    midis.forEach((m, k) => { Sound.note(m, dur * 0.9, t, Array.isArray(vols) ? vols[k] : vols); t += dur; });
    return t;
  }
  const chord = (notes, when, dur, vol = 0.14) => notes.forEach((m) => Sound.note(m, dur, when, vol));

  // 셈여림 기호(작은 그림)
  const hair = (d) => `<svg class="lis-hair" viewBox="0 0 120 40"><path d="${d === "cresc" ? "M8 20 L112 5 M8 20 L112 35" : "M8 5 L112 20 M8 35 L112 20"}" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

  GAMES.push(
    // ── 크게? 작게? ──
    {
      id: "dynamics", cat: "listen", emoji: "🔊", title: "크게? 작게?",
      desc: (g) => (g === "low" ? "두 번째 소리가 더 큰지 작은지" : "점점 세게 · 점점 여리게 · 그대로"),
      start(api) {
        const low = api.grade === "low";
        return void listenQuiz(api, {
          cols: low ? 2 : 3,
          make: () => {
            const root = 57 + rnd(10), notes = phrase(root);
            if (low) { const ans = pick(["loud", "soft"]); return { key: ans + root, ans, notes }; }
            const ans = pick(["cresc", "decresc", "same"]);
            return { key: ans + root, ans, notes: [...notes, ...notes.slice(0, 2)] };
          },
          ask: () => (low ? "처음 소리보다 두 번째 소리는 <b>크게</b>? <b>작게</b>?" : "소리가 어떻게 변했나요?"),
          icon: () => "🔊",
          play: (q) => {
            const dur = 0.36;
            if (low) {
              const t = seq(q.notes, dur, 0.16);
              const end = seq(q.notes, dur, q.ans === "loud" ? 0.45 : 0.035, t + 0.7);
              return end * 1000 + 300;
            }
            const n = q.notes.length;
            const vols = q.notes.map((_, k) => {
              const x = k / (n - 1);
              return q.ans === "cresc" ? 0.03 + 0.42 * x : q.ans === "decresc" ? 0.45 - 0.42 * x : 0.18;
            });
            return seq(q.notes, dur, vols) * 1000 + 300;
          },
          choices: () => (low
            ? [{ label: "<span class='lis-big'>🦁</span>크게 (f)", v: "loud" }, { label: "<span class='lis-big'>🐭</span>작게 (p)", v: "soft" }]
            : [{ label: `${hair("cresc")}점점 세게<br><small>crescendo</small>`, v: "cresc" },
              { label: `${hair("decresc")}점점 여리게<br><small>decrescendo</small>`, v: "decresc" },
              { label: `<span class='lis-big'>➡️</span>그대로`, v: "same" }]),
          explain: (q) => ({ loud: "두 번째가 더 컸어요 🦁", soft: "두 번째가 더 작았어요 🐭", cresc: "점점 세게였어요", decresc: "점점 여리게였어요", same: "크기가 그대로였어요" }[q.ans]),
        });
      },
    },

    // ── 밝은 음악? 슬픈 음악? ──
    {
      id: "mode", cat: "listen", emoji: "😊", title: "밝은 음악? 슬픈 음악?",
      desc: (g) => (g === "low" ? "밝은 느낌인지 슬픈 느낌인지" : "장조·단조, 장3화음·단3화음"),
      start(api) {
        const low = api.grade === "low";
        return void listenQuiz(api, {
          cols: 2,
          make: () => {
            const root = 55 + rnd(9), minor = rnd(2) === 1;
            const type = low ? "prog" : pick(["prog", "chord"]);
            return { key: type + minor + root, type, minor, root, ans: minor ? "minor" : "major" };
          },
          ask: (q) => (low ? "이 음악은 어떤 느낌일까요?" : q.type === "chord" ? "이 화음은 무엇일까요?" : "이 음악은 장조? 단조?"),
          icon: (q) => (q.type === "chord" ? "🎹" : "🎼"),
          play: (q) => {
            const r = q.root, third = q.minor ? 3 : 4;
            if (q.type === "chord") {
              [0, third, 7].forEach((x, k) => Sound.note(r + x, 0.5, k * 0.35, 0.22));
              chord([r, r + third, r + 7], 1.2, 1.3, 0.16);
              return 2700;
            }
            const sc = q.minor ? MINOR : MAJOR;
            const tri = (d) => [r + sc[d], r + sc[d + 2], r + sc[d + 4]];
            const V = [r + 7, r + 11, r + 14];                    // 단조도 V 는 이끎음(화성단음계)
            const prog = [tri(0), tri(3), V, tri(0)];
            prog.forEach((c, k) => { chord(c, k * 0.75, 0.8, 0.12); Sound.note(r - 12 + (k === 1 ? 5 : k === 2 ? 7 : 0), 0.8, k * 0.75, 0.2); });
            const mel = [0, 1, 2, 1, 0].map((d) => r + 12 + sc[d]);
            mel.forEach((m, k) => Sound.note(m, 0.4, 3.2 + k * 0.38, 0.28));
            chord(tri(0).map((m) => m + 12), 3.2 + 5 * 0.38, 1.2, 0.1);
            return 6200;
          },
          choices: (q) => (low || q.type === "prog"
            ? [{ label: `<span class='lis-big'>😊</span>${low ? "밝아요" : "장조"}`, v: "major" }, { label: `<span class='lis-big'>😢</span>${low ? "슬퍼요" : "단조"}`, v: "minor" }]
            : [{ label: "<span class='lis-big'>😊</span>장3화음", v: "major" }, { label: "<span class='lis-big'>😢</span>단3화음", v: "minor" }]),
          explain: (q) => (q.ans === "major" ? (low ? "밝은 음악(장조)이었어요 😊" : "장조(장3화음)였어요 😊") : (low ? "슬픈 음악(단조)이었어요 😢" : "단조(단3화음)였어요 😢")),
        });
      },
    },

    // ── 빠르게? 느리게? ──
    {
      id: "tempo", cat: "listen", emoji: "🐇", title: "빠르게? 느리게?",
      desc: (g) => (g === "low" ? "빠른 음악인지 느린 음악인지" : "점점 빠르게 · 점점 느리게 · 그대로"),
      start(api) {
        const low = api.grade === "low";
        return void listenQuiz(api, {
          cols: low ? 2 : 3,
          make: () => {
            const root = 58 + rnd(8);
            const notes = [...phrase(root), ...phrase(root)].slice(0, low ? 8 : 12);
            const ans = low ? pick(["fast", "slow"]) : pick(["accel", "rit", "same"]);
            return { key: ans + root, ans, notes };
          },
          ask: () => (low ? "이 음악은 <b>빠르게</b>? <b>느리게</b>?" : "빠르기가 어떻게 변했나요?"),
          icon: (q) => "🎵",
          play: (q) => {
            const n = q.notes.length;
            let t = 0;
            q.notes.forEach((m, k) => {
              let bpm;
              if (q.ans === "fast") bpm = 150;
              else if (q.ans === "slow") bpm = 60;
              else if (q.ans === "same") bpm = 110;
              else { const x = k / (n - 1); bpm = q.ans === "accel" ? 70 + 110 * x : 180 - 110 * x; }
              const dur = 60 / bpm;
              Sound.note(m, Math.min(0.5, dur * 0.85), t, 0.28);
              Sound.click(t, k % 4 === 0);
              t += dur;
            });
            return t * 1000 + 300;
          },
          choices: () => (low
            ? [{ label: "<span class='lis-big'>🐇</span>빠르게", v: "fast" }, { label: "<span class='lis-big'>🐢</span>느리게", v: "slow" }]
            : [{ label: "<span class='lis-big'>🚀</span>점점 빠르게<br><small>accel.</small>", v: "accel" },
              { label: "<span class='lis-big'>🐌</span>점점 느리게<br><small>rit.</small>", v: "rit" },
              { label: "<span class='lis-big'>➡️</span>그대로<br><small>a tempo</small>", v: "same" }]),
          explain: (q) => ({ fast: "빠른 음악이었어요 🐇", slow: "느린 음악이었어요 🐢", accel: "점점 빨라졌어요 🚀", rit: "점점 느려졌어요 🐌", same: "빠르기가 그대로였어요" }[q.ans]),
        });
      },
    },

    // ── 올라가요? 내려가요? ──
    {
      id: "contour", cat: "listen", emoji: "🪜", title: "올라가요? 내려가요?",
      desc: (g) => (g === "low" ? "멜로디가 올라가는지 내려가는지" : "음정(2·3·4·5·8도)과 멜로디 모양"),
      start(api) {
        const low = api.grade === "low";
        const INT = [["2도", 2, 1], ["3도", 4, 2], ["4도", 5, 3], ["5도", 7, 4], ["8도", 12, 7]];   // 이름, 반음, 도→계이름 번호
        // 모양: 4음의 음계 번호 윤곽
        const SHAPES = [
          { id: "up", pts: [0, 1, 2, 3], name: "계속 올라가요" }, { id: "down", pts: [3, 2, 1, 0], name: "계속 내려가요" },
          { id: "updown", pts: [0, 2, 3, 1], name: "올라갔다 내려와요" }, { id: "downup", pts: [3, 1, 0, 2], name: "내려갔다 올라가요" },
        ];
        const shapeSvg = (pts) => {
          const xs = pts.map((_, k) => 15 + k * 30), ys = pts.map((p) => 50 - p * 13);
          return `<svg class="lis-shape" viewBox="0 0 120 60"><polyline points="${xs.map((x, k) => `${x},${ys[k]}`).join(" ")}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${xs.map((x, k) => `<circle cx="${x}" cy="${ys[k]}" r="5" fill="currentColor"/>`).join("")}</svg>`;
        };
        return void listenQuiz(api, {
          cols: low ? 3 : 3,
          make: () => {
            if (low) {
              const ans = pick(["up", "down", "same"]), n = 3 + rnd(2), base = 60 + rnd(7);
              const step = () => 2 + rnd(2);
              const notes = [base];
              for (let k = 1; k < n; k++) notes.push(ans === "same" ? base : notes[k - 1] + (ans === "up" ? step() : -step()));
              return { key: ans + n, type: "dir", ans, notes };
            }
            if (rnd(2)) {
              const [name, semi] = pick(INT), base = 57 + rnd(8);
              return { key: "i" + name, type: "int", ans: name, notes: [base, base + semi] };
            }
            const s = pick(SHAPES), base = 60 + rnd(5);
            const opts = shuffle([s, ...shuffle(SHAPES.filter((x) => x.id !== s.id)).slice(0, 2)]);
            return { key: "s" + s.id, type: "shape", ans: s.id, shape: s, notes: s.pts.map((p) => base + MAJOR[p * 2 > 6 ? 6 : p * 2]), opts2: opts };
          },
          ask: (q) => (q.type === "dir" ? "멜로디가 어디로 가나요?" : q.type === "int" ? "두 음 사이는 몇 도일까요?" : "멜로디 모양을 골라요"),
          icon: (q) => (q.type === "int" ? "📏" : "🪜"),
          play: (q) => {
            if (q.type === "int") {
              Sound.note(q.notes[0], 0.6, 0, 0.3);
              Sound.note(q.notes[1], 0.6, 0.75, 0.3);
              chord(q.notes, 1.6, 1.0, 0.18);
              return 2800;
            }
            return seq(q.notes, 0.55, 0.3) * 1000 + 300;
          },
          choices: (q) => {
            if (q.type === "dir") return [{ label: "<span class='lis-big'>⬆️</span>올라가요", v: "up" }, { label: "<span class='lis-big'>⬇️</span>내려가요", v: "down" }, { label: "<span class='lis-big'>➡️</span>같은 음", v: "same" }];
            if (q.type === "int") return INT.map(([name]) => ({ label: `<span class='lis-int'>${name}</span>`, v: name }));
            return q.opts2.map((s) => ({ label: `${shapeSvg(s.pts)}<small>${s.name}</small>`, v: s.id }));
          },
          explain: (q) => (q.type === "dir" ? { up: "올라가는 멜로디였어요 ⬆️", down: "내려가는 멜로디였어요 ⬇️", same: "같은 음이었어요 ➡️" }[q.ans]
            : q.type === "int" ? `정답은 ${q.ans}` : `정답: ${q.shape.name}`),
        });
      },
    },
  );
})();
