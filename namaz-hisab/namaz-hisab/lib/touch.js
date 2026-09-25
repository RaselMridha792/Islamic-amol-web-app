// স্পর্শ — সঙ্গীর স্ক্রিনে আঁকা। আঁকার খাতার মাপ আর রঙ এখানে, যাতে যে আঁকে
// আর যে দেখে, দুজনে একই হিসাব ধরে।
//
// আঁকার বিন্দুগুলো পিক্সেলে নয়, খাতার মাপে: প্রস্থ সবসময় ১০০০ একক, আর
// উচ্চতা = aspect × ১০০০। দুই ফোনের পর্দা আলাদা হলেও আঁকাটা চ্যাপ্টা বা লম্বা
// হয়ে যায় না — দেখার ফোনে পুরো খাতাটা মাঝখানে বসে।
//
// একেকটা টুকরো (part) হলো কয়েকটা অংশের তালিকা:
//   { k: দাগের নম্বর, c: রঙের নম্বর, p: [x, y, x, y, …] }
//   { x: 1 }  — খাতা মুছে ফেলা
// একই দাগ কয়েক টুকরোয় ভাগ হয়ে আসতে পারে; দেখার দিক আগের বিন্দু থেকে জুড়ে নেয়।

export const UNIT = 1000;

// দাগের মোটা — খাতার এককে; ৩৯০ পিক্সেল চওড়া ফোনে প্রায় সাড়ে পাঁচ পিক্সেল
export const LINE = 14;

export const TOUCH_COLORS = ['#ff3d82', '#e7c27d', '#fbeaf2', '#35c79a', '#6ec6ff'];

// যে ফোনে দেখানো হবে, তার পর্দায় খাতাটা কোথায় আর কত বড়
export function fitBox(width, height, aspect) {
  const scale = Math.min(width / UNIT, height / (UNIT * aspect));
  return {
    scale,
    ox: (width - UNIT * scale) / 2,
    oy: (height - UNIT * aspect * scale) / 2,
  };
}

// একটা টুকরো ঠিকঠাক কি না — সার্ভার এটা দিয়েই যাচাই করে, যাতে উল্টোপাল্টা
// কিছু জমা না হয়। ঠিক থাকলে পরিষ্কার কপি, না থাকলে null।
export function cleanPart(data) {
  if (!Array.isArray(data) || !data.length || data.length > 200) return null;
  const out = [];
  for (const s of data) {
    if (s && s.x === 1) {
      out.push({ x: 1 });
      continue;
    }
    if (!s || !Number.isInteger(s.k) || s.k < 0 || s.k > 100000) return null;
    if (!Number.isInteger(s.c) || s.c < 0 || s.c >= TOUCH_COLORS.length) return null;
    if (!Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2 || s.p.length > 4000) return null;
    if (!s.p.every((v) => Number.isInteger(v) && v >= -200 && v <= 4000)) return null;
    out.push({ k: s.k, c: s.c, p: s.p });
  }
  return out;
}

// একটা টুকরোকে একেকটা বিন্দুর কাজে ভাঙি — দেখার দিক এগুলো একটা একটা করে
// আঁকে, তাই আঁকাটা হঠাৎ করে না এসে ধাপে ধাপে ফুটে ওঠে
export function partOps(data) {
  const ops = [];
  data.forEach((s) => {
    if (s.x === 1) {
      ops.push({ clear: true });
      return;
    }
    for (let i = 0; i < s.p.length; i += 2) ops.push({ k: s.k, c: s.c, x: s.p[i], y: s.p[i + 1] });
  });
  return ops;
}

// ক্যানভাসে আঁকার যন্ত্র — যে আঁকে আর যে দেখে, দুজনেই এটাই ব্যবহার করে।
// শুধু ব্রাউজারে ডাকা হয়।
export function createPainter(canvas, { glow = false } = {}) {
  const ctx = canvas.getContext('2d');
  const last = new Map();   // দাগ → তার শেষ বিন্দু, পরের বিন্দুকে জুড়তে
  const drawn = [];         // এ পর্যন্ত যা আঁকা, পর্দার মাপ বদলালে আবার আঁকার জন্য
  let aspect = 2;
  let box = { scale: 1, ox: 0, oy: 0 };

  function size() {
    // ২-এর বেশি ঘনত্বে ছবি আর স্পষ্ট হয় না, শুধু খাটুনি বাড়ে
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    box = fitBox(w, h, aspect);
  }

  function wipe() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    last.clear();
  }

  function point(op) {
    const color = TOUCH_COLORS[op.c] || TOUCH_COLORS[0];
    const x = box.ox + op.x * box.scale;
    const y = box.oy + op.y * box.scale;
    const width = LINE * box.scale;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? 12 : 0;
    const prev = last.get(op.k);
    ctx.beginPath();
    if (prev) {
      ctx.moveTo(box.ox + prev[0] * box.scale, box.oy + prev[1] * box.scale);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    last.set(op.k, [op.x, op.y]);
  }

  function redraw() {
    wipe();
    drawn.forEach(point);
  }

  size();

  return {
    setAspect(value) {
      aspect = value;
      size();
      redraw();
    },
    resize() {
      size();
      redraw();
    },
    // একটা কাজ: { k, c, x, y } — একটা বিন্দু, বা { clear: true } — সব মুছে ফেলা
    apply(op) {
      if (op.clear) {
        drawn.length = 0;
        wipe();
        return;
      }
      point(op);
      drawn.push(op);
    },
  };
}
