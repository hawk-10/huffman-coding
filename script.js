const $ = (s) => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const pal = ['#798DF9', '#00B0F4', '#35ED7E', '#5865F2'];
const tests = [
  ['abracadabra', 'abracadabra'],
  ['mississippi', 'mississippi'],
  ['sentence', 'this is an example of a huffman tree'],
  ['skewed', 'aaaaaaaabbbbccd'],
  ['uniform', 'abcdefgh'],
  ['single', 'zzzzzz'],
];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let steps = [],
  cur = 0,
  timer = null,
  codes = {},
  paths = {},
  text = '',
  ms = 1100,
  hl = new Set();
const nodes = new Map();
const vb = { x: 0, y: 0, w: 900, h: 400, tx: 0, ty: 0, tw: 900, th: 400 };
const vis = (c) => (c === ' ' ? '␣' : c);
const el = (t, a = {}, p) => {
  const e = document.createElementNS(NS, t);
  for (const k in a) e.setAttribute(k, a[k]);
  if (p) p.appendChild(e);
  return e;
};

function go(i, instant) {
  if (!steps.length) return;
  cur = Math.max(0, Math.min(steps.length - 1, i));
  const s = steps[cur];
  const L = layout(s.forest);
  const set = new Map();
  const walk = (n, par) => {
    set.set(n.id, { n, par });
    if (n.l) {
      walk(n.l, n);
      walk(n.r, n);
    }
  };
  s.forest.forEach((t) => walk(t, null));
  const codesIdx = steps.length - 2;
  [...set.keys()]
    .sort((a, b) => a - b)
    .forEach((id) => {
      const { n, par } = set.get(id);
      const p = L.pos.get(id);
      const tx = p.x,
        ty = 80 + p.d * 88;
      let e = nodes.get(id);
      if (!e) {
        const leaf = n.l === undefined;
        const g = el(
          'g',
          { class: 'node ' + (leaf ? 'leaf' : 'inner') },
          $('#nodes')
        );
        el('circle', { r: leaf ? 24 : 17 }, g);
        const c = el('text', { y: leaf ? 7 : 5, class: 'c' }, g);
        c.textContent = leaf ? vis(n.c) : n.w;
        let wt = null,
          kt = null;
        if (leaf) {
          wt = el('text', { y: 42, class: 'w' }, g);
          wt.textContent = n.w;
          kt = el('text', { y: 58, class: 'k mono' }, g);
        }
        let x0 = tx,
          y0 = ty - 24;
        if (n.l) {
          const a = nodes.get(n.l.id),
            b = nodes.get(n.r.id);
          if (a && b) {
            x0 = (a.x + b.x) / 2;
            y0 = (a.y + b.y) / 2;
          }
        }
        const path = el('path', { class: 'edge' }, $('#edges'));
        const lb = el('text', { class: 'lbl' }, $('#edges'));
        e = { id, n, g, path, lb, kt, x: x0, y: y0, o: 0, leaf };
        g.dataset.id = id;
        nodes.set(id, e);
      }
      e.tx = tx;
      e.ty = ty;
      e.to = 1;
      e.par = par ? par.id : null;
      e.side = par ? (par.l === n ? '0' : '1') : '';
      e.lb.textContent = e.side;
      e.hot =
        s.k === 'merge'
          ? id === s.p.id
            ? 1
            : id === s.p.l.id || id === s.p.r.id
              ? 2
              : 0
          : (s.k === 'codes' || s.k === 'encode') && !par
            ? 1
            : 0;
      e.g.classList.toggle('h1', e.hot === 1);
      e.g.classList.toggle('h2', e.hot === 2);
      if (e.kt) e.kt.textContent = cur >= codesIdx ? codes[n.c] : '';
      e.tip = n.l
        ? `Weight ${n.w} = ${n.l.w} + ${n.r.w}`
        : `“${vis(n.c)}” appears ${n.w}× ${cur >= codesIdx ? '· code ' + codes[n.c] : ''}`;
      if (instant) {
        e.x = tx;
        e.y = ty;
        e.o = 1;
      }
    });
  nodes.forEach((e, id) => {
    if (!set.has(id)) e.to = 0;
  });
  const pad = 70;
  const w = Math.max(L.w + pad * 2, 640),
    h = Math.max(80 + L.md * 88 + 110, 300);
  vb.tw = w;
  vb.th = h;
  vb.tx = L.w / 2 - w / 2;
  vb.ty = 0;
  if (instant) {
    vb.x = vb.tx;
    vb.y = 0;
    vb.w = w;
    vb.h = h;
  }
  paintSteps();
  paintPanels();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const k = reduce ? 1 : 1 - Math.exp(-dt * 6.5);
  for (const key of ['x', 'y', 'w', 'h']) {
    const t = vb['t' + key] !== undefined ? vb['t' + key] : vb[key];
    vb[key] += (t - vb[key]) * k;
  }
  $('#svg').setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  nodes.forEach((e, id) => {
    e.x += (e.tx - e.x) * k;
    e.y += (e.ty - e.y) * k;
    e.o += (e.to - e.o) * k;
    e.g.setAttribute('transform', `translate(${e.x} ${e.y})`);
    e.g.style.opacity = e.o;
    const p = e.par !== null ? nodes.get(e.par) : null;
    if (p && e.to === 1) {
      const rp = p.leaf ? 24 : 17,
        rc = e.leaf ? 24 : 17;
      const x1 = p.x,
        y1 = p.y + rp,
        x2 = e.x,
        y2 = e.y - rc,
        m = (y1 + y2) / 2;
      e.path.setAttribute(
        'd',
        `M${x1} ${y1}C${x1} ${m} ${x2} ${m} ${x2} ${y2}`
      );
      const o = Math.min(e.o, p.o);
      e.path.style.opacity = o;
      e.lb.style.opacity = o;
      e.lb.setAttribute('x', (x1 + x2) / 2);
      e.lb.setAttribute('y', m + 4);
    } else {
      e.path.style.opacity = 0;
      e.lb.style.opacity = 0;
    }
    if (e.to === 0 && e.o < 0.02) {
      e.g.remove();
      e.path.remove();
      e.lb.remove();
      nodes.delete(id);
    }
  });
  requestAnimationFrame(frame);
}

function paintSteps() {
  const box = $('#steps');
  if (box.children.length !== steps.length) {
    box.innerHTML = '';
    steps.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'step';
      b.textContent = s.label;
      b.dataset.tip = s.tip;
      b.onclick = () => {
        stop();
        go(i);
      };
      box.appendChild(b);
    });
  }
  [...box.children].forEach((b, i) => {
    b.classList.toggle('now', i === cur);
    b.classList.toggle('done', i < cur);
    b.dataset.tip = steps[i].tip;
  });
  $('#prev').disabled = cur === 0;
  $('#next').disabled = cur === steps.length - 1;
}

function paintCodes() {
  const box = $('#codeRows');
  box.innerHTML = '';
  const freq = {};
  for (const c of text) freq[c] = (freq[c] || 0) + 1;
  Object.keys(codes)
    .sort((a, b) => codes[a].length - codes[b].length || freq[b] - freq[a])
    .forEach((c) => {
      const r = document.createElement('div');
      r.className = 'row';
      r.innerHTML = `<div class="glyph">${vis(c)}</div><div class="mono" style="color:var(--green);word-break:break-all">${codes[c]}</div><div style="color:var(--muted);font-size:14px">${freq[c]}× · ${codes[c].length * freq[c]} bits</div>`;
      r.onmouseenter = () => setHl(paths[c]);
      r.onmouseleave = () => setHl(null);
      box.appendChild(r);
    });
}

function setHl(ids) {
  hl = new Set(ids || []);
  nodes.forEach((e, id) => {
    const on = hl.has(id);
    e.g.classList.toggle('hl', on);
    e.path.classList.toggle('hl', on);
  });
}

let shownEnc = false;
function paintPanels() {
  const ci = steps.length - 2,
    ei = steps.length - 1;
  $('#pCodes').classList.toggle('on', cur >= ci);
  $('#pOut').classList.toggle('on', cur >= ei);
  const orig = text.length * 8;
  const comp = encodeText(text, codes).length;
  const on = cur >= ei;
  if (on && !shownEnc) {
    let i = 0;
    $('#bits').innerHTML = [...text]
      .map((c) => {
        const ci2 = Object.keys(codes).indexOf(c);
        return `<span style="color:${pal[ci2 % pal.length]};animation-delay:${reduce ? 0 : Math.min(i++ * 35, 1600)}ms">${codes[c]}</span>`;
      })
      .join('');
  }
  if (!on)
    $('#bits').innerHTML =
      '<span style="opacity:1;animation:none;color:var(--dim)">Reach the last step to see the bits.</span>';
  shownEnc = on;
  const saved = Math.max(0, Math.round((1 - comp / orig) * 100));
  $('#saved').textContent = on ? saved + '% smaller' : '0%';
  $('#cmp').textContent = on
    ? `${orig} bits as ASCII, ${comp} bits with Huffman`
    : `${orig} bits as ASCII`;
  const fr = {};
  for (const c of text) fr[c] = (fr[c] || 0) + 1;
  let H = 0;
  for (const c in fr) {
    const q = fr[c] / text.length;
    H -= q * Math.log2(q);
  }
  $('#ent').textContent = on
    ? `Average ${(comp / text.length).toFixed(2)} bits per character, entropy ${Math.abs(H).toFixed(2)}`
    : '';
  $('#copy').disabled = !on;
  $('#b1').style.width = on ? '100%' : '0';
  $('#b2').style.width = on ? (comp / orig) * 100 + '%' : '0';
}

function stop() {
  clearInterval(timer);
  timer = null;
  $('#play').textContent = cur === steps.length - 1 ? 'Replay' : 'Play';
}
function play() {
  if (timer) {
    stop();
    return;
  }
  if (cur === steps.length - 1) go(0);
  $('#play').textContent = 'Pause';
  timer = setInterval(() => {
    if (cur >= steps.length - 1) {
      stop();
      return;
    }
    go(cur + 1);
    if (cur >= steps.length - 1) stop();
  }, ms);
}

function load(t, autoplay) {
  stop();
  const err = $('#err');
  err.textContent = '';
  if (!t) {
    err.textContent = 'Enter at least one character.';
    return;
  }
  if (new Set(t).size > 16) {
    err.textContent =
      'Use up to 16 different characters so the tree stays readable.';
    return;
  }
  text = t;
  $('#msg').style.display = 'none';
  $('#play').disabled = false;
  const r = build(t);
  steps = r.S;
  codes = r.cd;
  paths = r.ph;
  shownEnc = false;
  nodes.forEach((e) => {
    e.g.remove();
    e.path.remove();
    e.lb.remove();
  });
  nodes.clear();
  $('#steps').innerHTML = '';
  paintCodes();
  document
    .querySelectorAll('.chip')
    .forEach((c) => c.classList.toggle('on', c.dataset.t === t));
  go(0, true);
  decInit();
  $('#play').textContent = 'Play';
  if (autoplay && !reduce) setTimeout(play, 900);
  return true;
}

const chips = $('#chips');
tests.forEach(([n, t]) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.textContent = n;
  b.dataset.t = t;
  b.dataset.tip = `“${t}”`;
  b.onclick = () => {
    $('#inp').value = t;
    sel(t);
    $('#err').textContent = '';
  };
  chips.appendChild(b);
});
const sel = (t) =>
  document
    .querySelectorAll('.chip')
    .forEach((c) => c.classList.toggle('on', c.dataset.t === t));
$('#form').onsubmit = (e) => {
  e.preventDefault();
  if (load($('#inp').value, true))
    $('#stage').scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'center',
    });
};
$('#inp').oninput = (e) => sel(e.target.value);
$('#prev').onclick = () => {
  stop();
  go(cur - 1);
};
$('#next').onclick = () => {
  stop();
  go(cur + 1);
};
$('#play').onclick = play;
$('#speed').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  ms = +b.dataset.ms;
  [...$('#speed').children].forEach((x) => x.classList.toggle('on', x === b));
  if (timer) {
    stop();
    play();
  }
};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || !steps.length) return;
  if (e.key === 'ArrowRight') {
    stop();
    go(cur + 1);
  }
  if (e.key === 'ArrowLeft') {
    stop();
    go(cur - 1);
  }
  if (e.key === ' ') {
    e.preventDefault();
    play();
  }
});

const tip = $('#tip');
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest('[data-tip],.node');
  if (!t) {
    tip.classList.remove('on');
    return;
  }
  let txt = t.dataset.tip;
  if (t.classList.contains('node')) {
    const n = nodes.get(+t.dataset.id);
    txt = n && n.tip;
  }
  if (!txt) {
    tip.classList.remove('on');
    return;
  }
  tip.textContent = txt;
  const r = t.getBoundingClientRect(),
    w = tip.offsetWidth,
    h = tip.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(12, Math.min(innerWidth - w - 12, x));
  let y = r.top - h - 10;
  if (y < 8) y = r.bottom + 10;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
  tip.classList.add('on');
});
document.addEventListener('mouseout', (e) => {
  if (!e.relatedTarget || !e.relatedTarget.closest('[data-tip],.node'))
    tip.classList.remove('on');
});

let droot = null,
  dbits = [],
  dpos = 0,
  dn = null,
  dpath = [],
  dout = '',
  dtm = null;

function drawTape() {
  $('#tape').innerHTML = dbits
    .map(
      (x, k) =>
        `<span class="${(x.f ? 'f ' : '') + (k === dpos ? 'c' : '')}" style="${k < dpos ? 'color:' + x.col : ''}">${x.b}</span>`
    )
    .join('');
}

function drawDec() {
  const svg = $('#dsvg');
  svg.innerHTML = '';
  const L = layout([droot]),
    W = Math.max(L.w + 100, 260),
    ox = (W - L.w) / 2;
  svg.setAttribute('viewBox', `0 0 ${W} ${L.md * 88 + 130}`);
  const on = new Set(dpath),
    X = (p) => p.x + ox,
    Y = (p) => 40 + p.d * 88;
  const eg = el('g', {}, svg),
    ng = el('g', {}, svg);
  (function d(n) {
    const a = L.pos.get(n.id);
    if (n.l) {
      [
        [n.l, '0'],
        [n.r, '1'],
      ].forEach(([c, s]) => {
        const b = L.pos.get(c.id),
          m = (Y(a) + Y(b)) / 2;
        el(
          'path',
          {
            d: `M${X(a)} ${Y(a) + 17}C${X(a)} ${m} ${X(b)} ${m} ${X(b)} ${Y(b) - (c.l ? 17 : 24)}`,
            class: 'edge' + (on.has(n.id) && on.has(c.id) ? ' hl' : ''),
          },
          eg
        );
        const t = el(
          'text',
          { x: (X(a) + X(b)) / 2, y: m + 4, class: 'lbl' },
          eg
        );
        t.textContent = s;
        d(c);
      });
    }
    const leaf = !n.l;
    const g = el(
      'g',
      {
        class:
          'node ' +
          (leaf ? 'leaf' : 'inner') +
          (n === dn ? ' h1' : on.has(n.id) ? ' hl' : ''),
        transform: `translate(${X(a)} ${Y(a)})`,
      },
      ng
    );
    el('circle', { r: leaf ? 24 : 17 }, g);
    const t = el('text', { y: leaf ? 7 : 5, class: 'c' }, g);
    t.textContent = leaf ? vis(n.c) : n.w;
    if (leaf) {
      const k = el('text', { y: 44, class: 'k mono' }, g);
      k.textContent = codes[n.c];
    }
  })(droot);
}

function dstop() {
  clearInterval(dtm);
  dtm = null;
  $('#dplay').textContent = 'Play';
}

function decInit() {
  dstop();
  droot = steps[steps.length - 1].forest[0];
  const keys = Object.keys(codes);
  dbits = [];
  [...text].forEach((c, i) =>
    [...codes[c]].forEach((b, j) =>
      dbits.push({
        b,
        f: j === 0 && i > 0,
        col: pal[keys.indexOf(c) % pal.length],
      })
    )
  );
  dpos = 0;
  dn = droot;
  dpath = [droot.id];
  dout = '';
  $('#out').textContent = '';
  $('#dmsg').textContent =
    'Start at the root. Each bit picks a branch: 0 goes left, 1 goes right.';
  ['#dstep', '#dplay', '#dreset'].forEach((s) => ($(s).disabled = false));
  drawDec();
  drawTape();
}

function dstep() {
  if (dpos >= dbits.length) {
    dstop();
    return;
  }
  const b = dbits[dpos++].b;
  const result = decodeNext(droot, dn, b, dpath);
  dn = result.node;
  dpath = result.path;
  let m;
  if (result.character !== null) {
    dout += result.character;
    m = `Read ${b}. Reached a leaf: “${vis(dn.c)}”. Write it down and return to the root.`;
  } else
    m = `Read ${b}: go ${b === '0' ? 'left' : 'right'} to a node of weight ${dn.w}.`;
  if (dpos >= dbits.length) {
    m =
      (dout === text
        ? 'Done. The decoded text matches the original. '
        : 'Done. ') + 'Reset to watch it again.';
    dstop();
    $('#dplay').textContent = 'Replay';
  }
  $('#out').textContent = dout;
  $('#dmsg').textContent = m;
  drawDec();
  drawTape();
}

function dplay() {
  if (dtm) {
    dstop();
    return;
  }
  if (dpos >= dbits.length) decInit();
  $('#dplay').textContent = 'Pause';
  dtm = setInterval(dstep, Math.max(160, ms / 2.5));
}

$('#dstep').onclick = () => {
  dstop();
  dstep();
};
$('#dplay').onclick = dplay;
$('#dreset').onclick = decInit;
$('#copy').onclick = () => {
  const s = encodeText(text, codes);
  const done = () => {
    $('#copy').textContent = 'Copied';
    setTimeout(() => ($('#copy').textContent = 'Copy bits'), 1400);
  };
  try {
    navigator.clipboard.writeText(s).then(done, () => {});
  } catch (e) {}
};

function idle() {
  ['#prev', '#next', '#play', '#copy', '#dstep', '#dplay', '#dreset'].forEach(
    (s) => ($(s).disabled = true)
  );
  $('#bits').innerHTML =
    '<span style="opacity:1;animation:none;color:var(--dim)">Press Visualize to see the bits.</span>';
  $('#tape').innerHTML =
    '<span style="color:var(--dim)">Press Visualize first.</span>';
  $('#dmsg').textContent = 'The decoder walks the tree you build above.';
}

const secs = ['visualizer', 'codes', 'decode', 'learn'].map((id) =>
  document.getElementById(id)
);
const io = new IntersectionObserver(
  (es) => {
    es.forEach((en) => {
      if (en.isIntersecting)
        document
          .querySelectorAll('#links a')
          .forEach((a) =>
            a.classList.toggle(
              'on',
              a.getAttribute('href') === '#' + en.target.id
            )
          );
    });
  },
  { rootMargin: '-35% 0px -55% 0px' }
);
secs.forEach((s) => io.observe(s));

$('#inp').value = tests[0][1];
sel(tests[0][1]);
idle();
requestAnimationFrame(frame);

// Huffman coding, decoding, tree, and traversal data structures
function build(t) {
  let id = 0;
  const frequencies = new Map();
  for (const character of t)
    frequencies.set(character, (frequencies.get(character) || 0) + 1);
  const leaves = [...frequencies].map(([character, weight]) => ({
    id: id++,
    c: character,
    w: weight,
  }));
  const history = [
    {
      k: 'count',
      forest: leaves.slice(),
      label: 'Count',
      tip: `Count how often each character appears: ${t.length} characters, ${leaves.length} unique.`,
    },
  ];
  let forest = leaves.slice().sort((a, b) => a.w - b.w || a.id - b.id);
  history.push({
    k: 'sort',
    forest: forest.slice(),
    label: 'Sort',
    tip: 'Line the nodes up by weight. The lightest always go first.',
  });
  while (forest.length > 1) {
    const left = forest[0];
    const right = forest[1];
    const parent = { id: id++, w: left.w + right.w, l: left, r: right };
    forest = forest.slice(2);
    let index = forest.findIndex((node) => node.w > parent.w);
    if (index < 0) index = forest.length;
    forest.splice(index, 0, parent);
    history.push({
      k: 'merge',
      p: parent,
      forest: forest.slice(),
      label: `${left.w}+${right.w}`,
      tip: `Join the two lightest nodes, ${left.w} and ${right.w}, under a new parent of weight ${parent.w}.`,
    });
  }
  const root = forest[0];
  const codeTable = {};
  const paths = {};
  (function assignCodes(node, code, path) {
    const nextPath = path.concat(node.id);
    if (node.l === undefined) {
      codeTable[node.c] = code || '0';
      paths[node.c] = nextPath;
      return;
    }
    assignCodes(node.l, code + '0', nextPath);
    assignCodes(node.r, code + '1', nextPath);
  })(root, '', []);
  history.push({
    k: 'codes',
    forest: [root],
    label: 'Codes',
    tip: 'Walk from the root to each leaf. Left edge is 0, right edge is 1.',
  });
  history.push({
    k: 'encode',
    forest: [root],
    label: 'Encode',
    tip: 'Swap every character for its code. Frequent characters get shorter bits.',
  });
  return { S: history, cd: codeTable, ph: paths };
}

function encodeText(input, codeTable) {
  return [...input].map((character) => codeTable[character]).join('');
}

function decodeNext(root, node, bit, path) {
  if (node.l === undefined) {
    node = root;
    path = [root.id];
  }
  if (root.l !== undefined) {
    node = bit === '0' ? node.l : node.r;
    path = path.concat(node.id);
  }
  return {
    node,
    path,
    character: node.l === undefined ? node.c : null,
  };
}

function layout(forest) {
  const positions = new Map();
  let x = 0;
  let maxDepth = 0;
  const gap = 64;
  forest.forEach((tree) => {
    (function place(node, depth) {
      maxDepth = Math.max(maxDepth, depth);
      if (node.l === undefined) {
        positions.set(node.id, { x: x * gap, d: depth });
        x++;
        return;
      }
      place(node.l, depth + 1);
      place(node.r, depth + 1);
      positions.set(node.id, {
        x: (positions.get(node.l.id).x + positions.get(node.r.id).x) / 2,
        d: depth,
      });
    })(tree, 0);
    x += 0.7;
  });
  return { pos: positions, w: Math.max(x - 0.7, 0) * gap, md: maxDepth };
}
