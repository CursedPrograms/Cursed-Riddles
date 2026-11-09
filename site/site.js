// Cursed Riddles - play the Brainfuck riddles in the browser
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORE = 'cursed-riddles-solved';
  let data = null;          // riddles/riddles.json
  const sources = {};       // file -> code
  let current = 0;
  let runner = null;

  // ---------- Brainfuck interpreter ----------
  class BF {
    constructor(src, input) {
      this.ops = [];          // index into src for highlighting
      this.code = [];
      for (let i = 0; i < src.length; i++) if ('+-<>[].,'.indexOf(src[i]) >= 0) { this.code.push(src[i]); this.ops.push(i); }
      this.jump = new Int32Array(this.code.length);
      const stack = [];
      this.code.forEach((c, i) => {
        if (c === '[') stack.push(i);
        else if (c === ']') {
          if (!stack.length) throw new Error('Unmatched ] in the code');
          const j = stack.pop(); this.jump[i] = j; this.jump[j] = i;
        }
      });
      if (stack.length) throw new Error('Unmatched [ in the code');
      this.tape = new Uint8Array(30000);
      this.ptr = 0; this.pc = 0; this.out = ''; this.input = input || ''; this.inPos = 0; this.steps = 0;
    }
    get done() { return this.pc >= this.code.length; }
    run(maxSteps) {
      const code = this.code, tape = this.tape;
      let n = 0;
      while (this.pc < code.length && n < maxSteps) {
        const c = code[this.pc];
        switch (c) {
          case '>': this.ptr = (this.ptr + 1) % tape.length; break;
          case '<': this.ptr = (this.ptr - 1 + tape.length) % tape.length; break;
          case '+': tape[this.ptr]++; break;
          case '-': tape[this.ptr]--; break;
          case '.': this.out += String.fromCharCode(tape[this.ptr]); break;
          case ',': tape[this.ptr] = this.inPos < this.input.length ? this.input.charCodeAt(this.inPos) & 255 : 0; this.inPos++; break;
          case '[': if (!tape[this.ptr]) this.pc = this.jump[this.pc]; break;
          case ']': if (tape[this.ptr]) this.pc = this.jump[this.pc]; break;
        }
        this.pc++; n++; this.steps++;
      }
      return this.out;
    }
  }

  function runAll(src, input) {
    const bf = new BF(src, input);
    bf.run(20000000);
    if (!bf.done) throw new Error('The program ran too long');
    return bf.out;
  }

  function encode(text) {
    let code = '>', cur = 0;
    for (const ch of text) {
      const t = ch.charCodeAt(0) & 255, d = t - cur;
      let best = d >= 0 ? '+'.repeat(d) : '-'.repeat(-d);
      for (let a = 2; a < 16; a++) for (let b = 2; b < 16; b++) for (const sign of [1, -1]) {
        const rem = d - sign * a * b;
        const c = '<' + '+'.repeat(a) + '[>' + (sign > 0 ? '+' : '-').repeat(b) + '<-]>' + (rem >= 0 ? '+'.repeat(rem) : '-'.repeat(-rem));
        if (c.length < best.length) best = c;
      }
      code += best + '.'; cur = t;
    }
    return code.match(/.{1,64}/g).join('\n');
  }

  // ---------- Answers ----------
  function normalise(s) {
    s = s.toLowerCase().replace(/[^a-z0-9*]+/g, ' ').trim();
    s = s.replace(/^(a|an|the) /, '');
    return s.replace(/ /g, '');
  }
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------- Progress ----------
  function solved() { try { return new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); } catch (e) { return new Set(); } }
  function markSolved(id) { const s = solved(); s.add(id); localStorage.setItem(STORE, JSON.stringify(Array.from(s))); }

  // ---------- UI ----------
  function drawPicker() {
    const s = solved();
    const picker = $('picker');
    picker.innerHTML = '';
    data.riddles.forEach((r, i) => {
      const b = document.createElement('button');
      b.textContent = String(i + 1).padStart(2, '0');
      b.title = s.has(r.id) ? 'Solved: ' + runAll(r.reveal) : 'Riddle ' + (i + 1);
      if (s.has(r.id)) b.classList.add('solved');
      if (i === current) b.classList.add('current');
      b.addEventListener('click', () => show(i));
      picker.appendChild(b);
    });
    $('progress').textContent = 'Solved ' + s.size + ' of ' + data.riddles.length + (s.size === data.riddles.length ? '. Every riddle solved!' : '');
  }

  function drawTape(bf) {
    const tape = $('tape');
    const start = Math.max(0, Math.min(bf ? bf.ptr - 2 : 0, 29990));
    let html = '';
    for (let i = start; i < start + 8; i++) {
      const v = bf ? bf.tape[i] : 0;
      const ch = v >= 32 && v < 127 ? escapeHtml(String.fromCharCode(v)) : '';
      html += '<div class="cell' + (bf && i === bf.ptr ? ' ptr' : '') + '"><small>#' + i + '</small>' + v + '<small>' + (ch || '&nbsp;') + '</small></div>';
    }
    tape.innerHTML = html;
  }

  function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function drawCode(src, at) {
    const pre = $('riddle-code');
    if (at === undefined || at < 0) { pre.textContent = src; return; }
    pre.innerHTML = escapeHtml(src.slice(0, at)) + '<span class="pc">' + escapeHtml(src[at]) + '</span>' + escapeHtml(src.slice(at + 1));
    const mark = pre.querySelector('.pc');
    if (mark) {
      const top = mark.offsetTop - pre.offsetTop;
      if (top < pre.scrollTop || top > pre.scrollTop + pre.clientHeight - 20) pre.scrollTop = top - 40;
    }
  }

  function stopRun() { if (runner) { cancelAnimationFrame(runner.raf); runner = null; } $('run').textContent = 'Run'; }

  async function show(i) {
    stopRun();
    current = (i + data.riddles.length) % data.riddles.length;
    const r = data.riddles[current];
    $('riddle-panel').hidden = false;
    $('riddle-title').textContent = 'Riddle ' + (current + 1);
    $('riddle-file').textContent = r.file;
    $('riddle-output').textContent = '';
    $('verdict').textContent = ''; $('verdict').className = 'verdict';
    $('answer').value = '';
    if (!sources[r.file]) {
      $('riddle-code').textContent = 'Loading...';
      const res = await fetch('riddles/' + r.file);
      sources[r.file] = await res.text();
    }
    drawCode(sources[r.file]);
    drawTape(null);
    if (solved().has(r.id)) {
      $('riddle-output').textContent = runAll(sources[r.file]);
      verdict('Solved: ' + runAll(r.reveal), true);
    }
    drawPicker();
  }

  function startRun(instant) {
    const r = data.riddles[current];
    const src = sources[r.file];
    if (runner) { stopRun(); return; }
    const bf = new BF(src);
    if (instant) {
      bf.run(20000000);
      $('riddle-output').textContent = bf.out;
      drawTape(bf); drawCode(src);
      return;
    }
    const speeds = [1, 3, 10, 40, 150, 800];
    runner = { bf: bf };
    $('run').textContent = 'Stop';
    const tick = () => {
      const steps = speeds[Number($('speed').value) - 1] || 40;
      bf.run(steps);
      $('riddle-output').textContent = bf.out;
      drawTape(bf);
      if (bf.done) { drawCode(src); stopRun(); return; }
      drawCode(src, bf.ops[bf.pc]);
      runner.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function verdict(text, good) {
    const v = $('verdict');
    v.textContent = text;
    v.className = 'verdict ' + (good ? 'good' : 'bad');
  }

  async function check(e) {
    e.preventDefault();
    const r = data.riddles[current];
    const guess = $('answer').value;
    if (!guess.trim()) return;
    if (!window.crypto || !crypto.subtle) { verdict('Checking answers needs a secure (https) page.', false); return; }
    const h = await sha256(data.salt + normalise(guess));
    if (r.answers.indexOf(h) >= 0) {
      if ($('riddle-output').textContent === '') $('riddle-output').textContent = runAll(sources[r.file]);
      markSolved(r.id);
      verdict('Correct: ' + runAll(r.reveal) + '.', true);
      drawPicker();
    } else {
      verdict('Not quite. Try again, or take a hint.', false);
    }
  }

  // ---------- Playground ----------
  function playground() {
    $('pg-code').value = encode('Hello from the tape!');
    $('pg-run').addEventListener('click', () => {
      try { $('pg-output').textContent = runAll($('pg-code').value, $('pg-input').value) || '(no output)'; }
      catch (err) { $('pg-output').textContent = err.message; }
    });
    const enc = () => { $('enc-output').textContent = $('enc-text').value ? encode($('enc-text').value) : ''; };
    $('enc-run').addEventListener('click', enc);
    $('enc-copy').addEventListener('click', () => {
      enc();
      const text = $('enc-output').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { $('enc-copy').textContent = 'Copied'; setTimeout(() => { $('enc-copy').textContent = 'Copy'; }, 1500); });
    });
    enc();
  }

  // ---------- Start ----------
  async function init() {
    playground();
    try {
      const res = await fetch('riddles/riddles.json');
      data = await res.json();
    } catch (err) {
      $('progress').textContent = 'Could not load the riddles. Open this page from a web server (or GitHub Pages).';
      return;
    }
    const s = solved();
    const first = data.riddles.findIndex((r) => !s.has(r.id));
    $('run').addEventListener('click', () => startRun(false));
    $('run-instant').addEventListener('click', () => { stopRun(); startRun(true); });
    $('answer-form').addEventListener('submit', check);
    $('hint').addEventListener('click', () => verdict('Hint: ' + runAll(data.riddles[current].hint), false));
    $('prev').addEventListener('click', () => show(current - 1));
    $('next').addEventListener('click', () => show(current + 1));
    $('reset').addEventListener('click', () => { localStorage.removeItem(STORE); show(0); });
    show(first < 0 ? 0 : first);
  }

  init();
})();
