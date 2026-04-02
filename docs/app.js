import { init as initViewer, updateModel } from './viewer.js';

// --- State ---
let currentUnit = 'mm'; // 'mm' or 'in'
let currentStl = null;
const MM_PER_INCH = 25.4;

// --- DOM ---
const paramInputs = document.querySelectorAll('input[data-param]');
const unitMmBtn = document.getElementById('unit-mm');
const unitInBtn = document.getElementById('unit-in');
const renderBtn = document.getElementById('render-btn');
const downloadBtn = document.getElementById('download-btn');
const statusEl = document.getElementById('status');
const viewerContainer = document.getElementById('viewer-container');

// --- Worker ---
const worker = new Worker('./openscad-worker.js', { type: 'module' });

worker.onmessage = (event) => {
    const { type, stl, message } = event.data;

    if (type === 'status') {
        setStatus(message, 'loading');
    } else if (type === 'result') {
        currentStl = stl;
        updateModel(stl);
        downloadBtn.disabled = false;
        setStatus('Ready');
    } else if (type === 'error') {
        setStatus(message, 'error');
    }
};

worker.onerror = (err) => {
    setStatus('Worker error: ' + err.message, 'error');
};

// --- Functions ---

function setStatus(msg, className) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (className ? ' ' + className : '');
}

function getParamsMm() {
    const params = {};
    paramInputs.forEach(input => {
        let val = parseFloat(input.value);
        if (isNaN(val)) val = parseFloat(input.dataset.defaultMm);
        // Convert to mm if currently displaying inches
        if (currentUnit === 'in') {
            val = val * MM_PER_INCH;
        }
        params[input.dataset.param] = val;
    });
    return params;
}

function requestGeneration() {
    downloadBtn.disabled = true;
    setStatus('Generating...', 'loading');
    worker.postMessage({ type: 'generate', params: getParamsMm() });
}

// Unit switching
function setUnit(unit) {
    if (unit === currentUnit) return;

    // Convert displayed values
    paramInputs.forEach(input => {
        let val = parseFloat(input.value);
        if (isNaN(val)) return;

        if (unit === 'in') {
            // mm → inches
            val = val / MM_PER_INCH;
        } else {
            // inches → mm
            val = val * MM_PER_INCH;
        }
        input.value = parseFloat(val.toFixed(3));
        input.step = unit === 'in' ? '0.01' : '0.1';
    });

    currentUnit = unit;
    unitMmBtn.classList.toggle('active', unit === 'mm');
    unitInBtn.classList.toggle('active', unit === 'in');
}

// Download
function downloadStl() {
    if (!currentStl) return;
    const blob = new Blob([currentStl], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 't-track-insert.stl';
    a.click();
    URL.revokeObjectURL(url);
}

// --- Event Listeners ---
renderBtn.addEventListener('click', requestGeneration);
unitMmBtn.addEventListener('click', () => setUnit('mm'));
unitInBtn.addEventListener('click', () => setUnit('in'));
downloadBtn.addEventListener('click', downloadStl);

async function loadScadDefaults() {
    const text = await fetch('./insert.scad').then(r => r.text());
    const re = /^(\w+)\s*=\s*([\d.]+)\s*;/gm;
    const defaults = {};
    let m;
    while ((m = re.exec(text)) !== null) {
        defaults[m[1]] = parseFloat(m[2]);
    }
    paramInputs.forEach(input => {
        const key = input.dataset.param;
        if (key in defaults) {
            input.value = defaults[key];
            input.dataset.defaultMm = defaults[key];
        }
    });
}

// --- Diagram highlight ---
const DIAGRAM_BASE = '#8090a8';
const DIAGRAM_HIGHLIGHT = '#e94560';

const DIAGRAM_MAP = {
    slot_width: { line: 'infoline-0-path-effect21', label: 'text23' },
    lip_width:  { line: 'infoline-8-path-effect10', label: 'text23-8' },
    slot_depth: { line: 'infoline-5-path-effect10', label: 'text23-8-1' },
    lip_depth:  { line: 'infoline-7-path-effect10', label: 'text23-8-2' },
};

function applyDiagramTheme() {
    // T-track body: light fill so the shape reads on dark background
    const track = document.getElementById('path1');
    if (track) { track.style.fill = '#c8d4e0'; track.style.stroke = '#c8d4e0'; }
    // All dimension/helper lines and arrows
    document.querySelectorAll('#track-diagram .measure-line').forEach(el => {
        el.style.stroke = DIAGRAM_BASE;
    });
    // All text labels
    document.querySelectorAll('#track-diagram text').forEach(el => {
        el.style.fill = DIAGRAM_BASE;
        el.style.stroke = 'none';
    });
}

function highlightDiagram({ line, label }, active) {
    const color = active ? DIAGRAM_HIGHLIGHT : DIAGRAM_BASE;
    const lineEl = document.getElementById(line);
    const labelEl = document.getElementById(label);
    if (lineEl) lineEl.style.stroke = color;
    if (labelEl) { labelEl.style.fill = color; }
}

async function loadDiagram() {
    const container = document.getElementById('track-diagram');
    const text = await fetch('./t_track_diagram.svg').then(r => r.text());
    container.innerHTML = text;
    applyDiagramTheme();
    paramInputs.forEach(input => {
        const map = DIAGRAM_MAP[input.dataset.param];
        if (!map) return;
        input.addEventListener('focus', () => highlightDiagram(map, true));
        input.addEventListener('blur',  () => highlightDiagram(map, false));
    });
}

// --- Init ---
initViewer(viewerContainer);
loadScadDefaults().then(() => requestGeneration());
loadDiagram();
