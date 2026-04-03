import { init as initViewer, updateModel } from './viewer.js';
import { TRACK_PRESETS, BOLT_PRESETS, TRACK_PARAM_KEYS, BOLT_PARAM_KEYS } from './presets.js';

// --- Analytics ---
function trackEvent(path, title) {
    if (window.goatcounter?.count) {
        window.goatcounter.count({ path, title, event: true });
    }
}

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
const shareBtn = document.getElementById('share-btn');
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
        trackEvent('render', 'Render');
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
    trackEvent('stl-download', 'STL Download');
}

// Share URL
function buildShareUrl() {
    const params = getParamsMm();
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    sp.set('u', currentUnit);
    if (trackPresetEl.value) sp.set('tp', trackPresetEl.value);
    if (boltPresetEl.value)  sp.set('bp', boltPresetEl.value);
    return `${location.origin}${location.pathname}?${sp.toString()}`;
}

function copyShareUrl() {
    const url = buildShareUrl();
    navigator.clipboard.writeText(url).then(() => {
        shareBtn.textContent = 'Copied!';
        shareBtn.classList.add('copied');
        setTimeout(() => {
            shareBtn.textContent = 'Copy Share Link';
            shareBtn.classList.remove('copied');
        }, 2000);
    });
}

// Apply URL params on load — returns true if any params were found
function applyUrlParams() {
    const sp = new URLSearchParams(location.search);
    if (sp.size === 0) return false;

    paramInputs.forEach(input => {
        const mmVal = sp.get(input.dataset.param);
        if (mmVal === null) return;
        const v = parseFloat(mmVal);
        if (isNaN(v)) return;
        input.value = v;
        input.dataset.defaultMm = v;
    });

    const tp = sp.get('tp');
    if (tp) trackPresetEl.value = tp;
    const bp = sp.get('bp');
    if (bp) boltPresetEl.value = bp;

    const unit = sp.get('u');
    if (unit === 'in') {
        // Values were stored in mm; convert display to inches
        paramInputs.forEach(input => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                input.value = parseFloat((val / MM_PER_INCH).toFixed(3));
                input.step = '0.01';
            }
        });
        currentUnit = 'in';
        unitMmBtn.classList.remove('active');
        unitInBtn.classList.add('active');
    }

    return true;
}

// --- Event Listeners ---
renderBtn.addEventListener('click', requestGeneration);
unitMmBtn.addEventListener('click', () => setUnit('mm'));
unitInBtn.addEventListener('click', () => setUnit('in'));
downloadBtn.addEventListener('click', downloadStl);
shareBtn.addEventListener('click', copyShareUrl);

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

const BOLT_DIAGRAM_MAP = {
    head_width:     { line: 'infoline-0-path-effect9', label: 'text18' },
    head_height:    { line: 'infoline-7-path-effect9', label: 'text17' },
    shaft_diameter: { line: 'infoline-4-path-effect9', label: 'text19' },
};

function applyBoltDiagramTheme() {
    const bolt = document.querySelector('#bolt-diagram #path1');
    if (bolt) { bolt.style.fill = '#c8d4e0'; bolt.style.stroke = '#c8d4e0'; }
    // Internal drawing lines (threads, dividers) — blend into panel background
    ['path2','path3','path4','path5','path6','path7','path8','path9'].forEach(id => {
        const el = document.querySelector(`#bolt-diagram #${id}`);
        if (el) el.style.stroke = '#16213e';
    });
    document.querySelectorAll('#bolt-diagram .measure-line').forEach(el => {
        el.style.stroke = DIAGRAM_BASE;
    });
    document.querySelectorAll('#bolt-diagram text').forEach(el => {
        el.style.fill = DIAGRAM_BASE;
        el.style.stroke = 'none';
    });
}

async function loadBoltDiagram() {
    const container = document.getElementById('bolt-diagram');
    const text = await fetch('./bolt_diagram.svg').then(r => r.text());
    container.innerHTML = text;
    applyBoltDiagramTheme();
    paramInputs.forEach(input => {
        const map = BOLT_DIAGRAM_MAP[input.dataset.param];
        if (!map) return;
        input.addEventListener('focus', () => highlightDiagram(map, true));
        input.addEventListener('blur',  () => highlightDiagram(map, false));
    });
}

// --- Presets ---

function applyPreset(presetValues) {
    // Always apply in mm; if user is in inches, convert
    Object.entries(presetValues).forEach(([key, mmVal]) => {
        const input = document.querySelector(`input[data-param="${key}"]`);
        if (!input) return;
        const displayVal = currentUnit === 'in' ? parseFloat((mmVal / MM_PER_INCH).toFixed(3)) : mmVal;
        input.value = displayVal;
        input.dataset.defaultMm = mmVal;
    });
}

const trackPresetEl = document.getElementById('track-preset');
const boltPresetEl  = document.getElementById('bolt-preset');


function setCustomOnChange(paramKeys, selectEl) {
    paramKeys.forEach(key => {
        const input = document.querySelector(`input[data-param="${key}"]`);
        if (!input) return;
        input.addEventListener('input', () => selectEl.value = 'custom');
    });
}

function syncSelectTooltip(selectEl) {
    const selected = selectEl.options[selectEl.selectedIndex];
    selectEl.title = selected ? selected.text : '';
}

trackPresetEl.addEventListener('change', () => {
    const preset = TRACK_PRESETS[trackPresetEl.value];
    if (preset) applyPreset(preset);
    syncSelectTooltip(trackPresetEl);
});

boltPresetEl.addEventListener('change', () => {
    const preset = BOLT_PRESETS[boltPresetEl.value];
    if (preset) applyPreset(preset);
    syncSelectTooltip(boltPresetEl);
});

// --- Init ---
initViewer(viewerContainer);
loadScadDefaults().then(() => {
    const fromUrl = applyUrlParams();
    if (!fromUrl) {
        // Set preset dropdowns to match loaded defaults
        trackPresetEl.value = 'wide-metric';
        boltPresetEl.value = 'm8';
    }
    syncSelectTooltip(trackPresetEl);
    syncSelectTooltip(boltPresetEl);
    // After presets are set, wire up "custom" detection
    setCustomOnChange(TRACK_PARAM_KEYS, trackPresetEl);
    setCustomOnChange(BOLT_PARAM_KEYS, boltPresetEl);
    requestGeneration();
});
loadDiagram();
loadBoltDiagram();
