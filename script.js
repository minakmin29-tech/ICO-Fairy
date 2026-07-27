const SIZES = [16, 24, 32, 48, 64, 128, 256];
const DEFAULT_CHECKED = [16, 32, 48, 64];
const MAX = 20;

let fileQueue = [];
let results = [];

const sizeGrid = document.getElementById('size-grid');
SIZES.forEach(s => {
  const wrap = document.createElement('div');
  wrap.className = 'size-chip';
  const id = `sz-${s}`;
  wrap.innerHTML = `<input type="checkbox" id="${id}" value="${s}" ${DEFAULT_CHECKED.includes(s)?'checked':''}><label for="${id}">${s}×${s}</label>`;
  sizeGrid.appendChild(wrap);
});

const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  addFiles([...e.dataTransfer.files]);
});

document.getElementById('file-input').addEventListener('change', e => {
  addFiles([...e.target.files]); e.target.value = '';
});
document.getElementById('btn-add-more').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('btn-clear').addEventListener('click', resetAll);
document.getElementById('btn-convert').addEventListener('click', convertAll);
document.getElementById('btn-again').addEventListener('click', resetAll);
document.getElementById('btn-dl-all').addEventListener('click', downloadAll);

function addFiles(files) {
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (!imgs.length) { showError('Пожалуйста, выбери файлы изображений.'); return; }
  hideError();
  const free = MAX - fileQueue.length;
  if (free <= 0) { showError(`Уже добавлено ${MAX} файлов — это максимум.`); return; }
  const toAdd = imgs.slice(0, free);
  if (imgs.length > free) showError(`Добавлено ${toAdd.length} из ${imgs.length} — лимит ${MAX} файлов.`);

  toAdd.forEach(file => {
    const item = { id: Date.now() + Math.random(), file, thumb: null };
    fileQueue.push(item);
    const reader = new FileReader();
    reader.onload = e => { item.thumb = e.target.result; renderQueue(); };
    reader.readAsDataURL(file);
  });

  renderQueue();
  show('multi-preview');
  show('settings');
  show('convert-wrap');
  hide('result-section');
  hide('progress-wrap');
}

function renderQueue() {
  const grid = document.getElementById('mp-grid');
  grid.innerHTML = '';
  document.getElementById('mp-count').textContent = `${fileQueue.length} / ${MAX}`;
  fileQueue.forEach(item => {
    const div = document.createElement('div');
    div.className = 'mp-item';
    div.dataset.id = item.id;
    const kb = (item.file.size / 1024).toFixed(0);
    div.innerHTML = `
      <div class="mp-thumb-wrap">
        ${item.thumb ? `<img class="mp-thumb" src="${item.thumb}" alt="">` : `<div class="mp-placeholder">🖼️</div>`}
        <div class="mp-spin-overlay"><div class="mp-spinner"></div></div>
      </div>
      <div class="mp-info">
        <div class="mp-name">${item.file.name}</div>
        <div class="mp-size">${kb} KB</div>
        <div class="mp-status">Ожидание</div>
      </div>
      <button class="mp-remove" onclick="removeFile('${item.id}')">✕</button>
    `;
    grid.appendChild(div);
  });
  if (!fileQueue.length) {
    hide('multi-preview'); hide('settings'); hide('convert-wrap');
  }
}

function removeFile(id) {
  fileQueue = fileQueue.filter(f => String(f.id) !== String(id));
  renderQueue();
  if (!fileQueue.length) { hide('settings'); hide('convert-wrap'); }
}

async function convertAll() {
  const checked = [...document.querySelectorAll('#size-grid input:checked')].map(i => +i.value);
  if (!checked.length) { showError('Выбери хотя бы один размер!'); return; }
  if (!fileQueue.length) return;

  hideError();
  hide('convert-wrap');
  show('progress-wrap');
  results = [];

  for (let i = 0; i < fileQueue.length; i++) {
    const item = fileQueue[i];
    const pct = Math.round(5 + (i / fileQueue.length) * 88);
    setProgress(pct, `Обрабатываем ${i+1} из ${fileQueue.length}: ${item.file.name}`);

    const qEl = document.querySelector(`.mp-item[data-id="${item.id}"]`);
    if (qEl) { qEl.classList.add('processing'); qEl.querySelector('.mp-status').textContent = 'Конвертация…'; }

    await delay(20);

    try {
      const img = await loadImage(item.file);
      const canvases = {};
      for (const size of checked) { canvases[size] = renderToCanvas(img, size); await delay(4); }
      results.push({ id: item.id, name: item.file.name, canvases });
      if (qEl) { qEl.classList.remove('processing'); qEl.classList.add('done'); qEl.querySelector('.mp-status').textContent = '✓ Готово'; }
    } catch(e) {
      if (qEl) { qEl.classList.remove('processing'); qEl.classList.add('error'); qEl.querySelector('.mp-status').textContent = '✗ Ошибка'; }
    }
  }

  setProgress(100, 'Всё готово!');
  await delay(200);
  hide('progress-wrap');
  buildResults(checked);
  show('result-section');
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => rej(new Error('load error'));
    img.src = url;
  });
}

function renderToCanvas(img, size) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const scale = Math.max(size / img.width, size / img.height);
  const sw = img.width * scale, sh = img.height * scale;
  ctx.drawImage(img, (size-sw)/2, (size-sh)/2, sw, sh);
  return cv;
}

function buildResults(sizes) {
  const rows = document.getElementById('result-rows');
  rows.innerHTML = '';
  const ok = results.length;
  const fail = fileQueue.length - ok;
  let sub = `${ok} файл${ok===1?'':ok<5?'а':'ов'} успешно конвертирован${ok===1?'':'о'}`;
  if (fail > 0) sub += `, ${fail} с ошибкой`;
  document.getElementById('result-sub').textContent = sub;

  results.forEach((r, idx) => {
    const baseName = r.name.replace(/\.[^.]+$/, '');
    const div = document.createElement('div');
    div.className = 'result-row';

    const pngBtns = sizes.map(size => {
      const url = r.canvases[size].toDataURL('image/png');
      return `<a class="btn-dl" href="${url}" download="${baseName}_${size}x${size}.png">⬇︎ ${size}px</a>`;
    }).join('');

    div.innerHTML = `
      <div class="rr-name">🖼 ${r.name}</div>
      <div class="rr-btns">
        ${pngBtns}
        <button class="btn-dl ico-btn" onclick="downloadIcoFor('${r.id}','${baseName}')">🔲 .ico</button>
      </div>
    `;
    rows.appendChild(div);
  });
}

function downloadIcoFor(id, baseName) {
  const r = results.find(x => String(x.id) === String(id));
  if (!r) return;
  const sizes = Object.keys(r.canvases).map(Number);
  const buf = buildIcoBlob(sizes, r.canvases);
  triggerDownload(buf, baseName + '.ico');
}

function downloadAll() {
  results.forEach(r => {
    const baseName = r.name.replace(/\.[^.]+$/, '');
    const sizes = Object.keys(r.canvases).map(Number);
    const buf = buildIcoBlob(sizes, r.canvases);
    triggerDownload(buf, baseName + '.ico');
  });
}

function triggerDownload(buf, filename) {
  const url = URL.createObjectURL(new Blob([buf], {type:'image/x-icon'}));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildIcoBlob(sizes, canvases) {
  const pngs = sizes.map(s => { const b64 = canvases[s].toDataURL('image/png').split(',')[1]; return base64ToUint8Array(b64); });
  const count = sizes.length;
  const HEADER = 6, DIR = 16, dirOffset = HEADER + DIR * count;
  let total = dirOffset; pngs.forEach(d => total += d.length);
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  view.setUint16(0,0,true); view.setUint16(2,1,true); view.setUint16(4,count,true);
  let off = dirOffset;
  pngs.forEach((png, i) => {
    const s = sizes[i], b = HEADER + i * DIR;
    view.setUint8(b+0, s>=256?0:s); view.setUint8(b+1, s>=256?0:s);
    view.setUint8(b+2,0); view.setUint8(b+3,0);
    view.setUint16(b+4,1,true); view.setUint16(b+6,32,true);
    view.setUint32(b+8,png.length,true); view.setUint32(b+12,off,true);
    new Uint8Array(buf,off,png.length).set(png); off+=png.length;
  });
  return buf;
}

function base64ToUint8Array(b64) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr;
}

function resetAll() {
  fileQueue = []; results = [];
  document.getElementById('file-input').value = '';
  hide('multi-preview'); hide('settings'); hide('convert-wrap');
  hide('progress-wrap'); hide('result-section');
  hideError(); setProgress(0,'');
  renderQueue();
}

function setProgress(pct, text) {
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = text;
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function show(id) { document.getElementById(id).classList.add('visible'); }
function hide(id) { document.getElementById(id).classList.remove('visible'); }
function showError(msg) { const el=document.getElementById('error-msg'); el.textContent=msg; el.classList.add('visible'); }
function hideError() { document.getElementById('error-msg').classList.remove('visible'); }