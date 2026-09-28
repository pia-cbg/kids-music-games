// 소리: 샘플 파일 없이 Web Audio 로 합성(파일을 바로 열어도 소리 남)
const Sound = (() => {
  let ctx = null, out = null;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      out = ctx.createGain();
      out.gain.value = 0.85;
      out.connect(ctx.destination);
    }
    if (ctx.state !== "running") ctx.resume();
    return ctx;
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // 실로폰·피아노 느낌의 음 하나. when = 지금부터 몇 초 뒤
  function note(midi, dur = 0.6, when = 0, vol = 0.32) {
    const c = ac(), t = c.currentTime + when;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + Math.min(0.25, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    g.connect(out);
    for (const [type, mult, v] of [["triangle", 1, 1], ["sine", 2, 0.25], ["sine", 3, 0.08]]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = hz(midi) * mult; og.gain.value = v;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + dur + 0.4);
    }
  }

  function click(when = 0, accent = false) {
    const c = ac(), t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = "square"; o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.15, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.06);
  }

  // 북소리(리듬 게임)
  function drum(when = 0, vol = 0.8) {
    const c = ac(), t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
  }

  const ding = () => { note(84, 0.15, 0, 0.22); note(88, 0.3, 0.09, 0.22); };
  function buzz() {
    const c = ac(), t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = "sawtooth"; o.frequency.value = 110;
    f.type = "lowpass"; f.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.32);
  }
  const fanfare = () => [72, 76, 79, 84].forEach((m, i) => note(m, i === 3 ? 0.8 : 0.18, i * 0.13, 0.25));
  const now = () => ac().currentTime;

  return { ac, note, click, drum, ding, buzz, fanfare, now };
})();
