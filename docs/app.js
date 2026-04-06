import { init as initViewer, updateModel } from './viewer.js';
import {
    TRACK_PRESETS, BOLT_PRESETS, DOVETAIL_DEFAULTS, KNOB_DEFAULTS,
    TRACK_PARAM_KEYS, BOLT_PARAM_KEYS,
} from './presets.js';

// --- Analytics ---
function trackEvent(path, title) {
    if (window.goatcounter?.count) {
        window.goatcounter.count({ path, title, event: true });
    }
}

// --- State ---
let currentUnit = 'mm'; // 'mm' or 'in'
let currentMode = 'ttrack'; // 'ttrack' or 'dovetail'
let currentStl  = null;
let ttrackScadDefaults = {};
const MM_PER_INCH = 25.4;

// --- DOM ---
const paramInputs    = document.querySelectorAll('input[data-param]');
const unitMmBtn      = document.getElementById('unit-mm');
const unitInBtn      = document.getElementById('unit-in');
const modeTtrackBtn  = document.getElementById('mode-ttrack');
const modeDovetailBtn= document.getElementById('mode-dovetail');
const modeKnobBtn    = document.getElementById('mode-knob');
const renderBtn      = document.getElementById('render-btn');
const downloadBtn    = document.getElementById('download-btn');
const shareBtn       = document.getElementById('share-btn');
const statusEl       = document.getElementById('status');
const viewerContainer= document.getElementById('viewer-container');
const ttracksection  = document.getElementById('ttrack-section');
const dovetailSection= document.getElementById('dovetail-section');
const knobSection    = document.getElementById('knob-section');
const insertSection  = document.getElementById('insert-section');
const modeTitleEl    = document.getElementById('mode-title');
const dvTopDisplay   = document.getElementById('dv_top_width_display');

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

// Recompute and display the derived top width from bottom width, height and angle
function updateDerivedTopWidth() {
    const bwInput = document.getElementById('dv_bottom_width');
    const hInput  = document.getElementById('dv_height');
    const aInput  = document.getElementById('wall_angle');
    if (!bwInput || !hInput || !aInput || !dvTopDisplay) return;

    let bw = parseFloat(bwInput.value);
    let h  = parseFloat(hInput.value);
    const a = parseFloat(aInput.value); // degrees — never converted

    // Input values are already in current display unit (except angle)
    if (currentUnit === 'in') { bw *= MM_PER_INCH; h *= MM_PER_INCH; }

    if (isNaN(bw) || isNaN(h) || isNaN(a)) return;
    const twMm = bw - 2 * h * Math.tan(a * Math.PI / 180);
    dvTopDisplay.value = currentUnit === 'in'
        ? parseFloat((twMm / MM_PER_INCH).toFixed(3))
        : parseFloat(twMm.toFixed(2));
}

// Returns only params relevant to the current mode, in mm
function getParamsMm() {
    const params = {};
    paramInputs.forEach(input => {
        const inputMode = input.dataset.mode;
        if (inputMode && inputMode !== currentMode) return;
        let val = parseFloat(input.value);
        if (isNaN(val)) val = parseFloat(input.dataset.defaultMm);
        // Angle params are in degrees — never multiplied by MM_PER_INCH
        if (currentUnit === 'in' && !input.dataset.noUnitConvert) val *= MM_PER_INCH;
        params[input.dataset.param] = val;
    });
    return params;
}

function requestGeneration() {
    downloadBtn.disabled = true;
    currentStl = null;
    setStatus('Generating...', 'loading');
    const scadFile = currentMode === 'dovetail' ? 'dovetail_insert.scad'
                   : currentMode === 'knob'     ? 'knob.scad'
                   : 'insert.scad';
    worker.postMessage({ type: 'generate', params: getParamsMm(), scadFile });
}

// Unit switching — converts all displayed values (skips angle inputs)
function setUnit(unit) {
    if (unit === currentUnit) return;
    paramInputs.forEach(input => {
        if (input.dataset.noUnitConvert) return;
        let val = parseFloat(input.value);
        if (isNaN(val)) return;
        val = unit === 'in' ? val / MM_PER_INCH : val * MM_PER_INCH;
        input.value = parseFloat(val.toFixed(3));
        input.step  = unit === 'in' ? '0.01' : '0.1';
    });
    currentUnit = unit;
    unitMmBtn.classList.toggle('active', unit === 'mm');
    unitInBtn.classList.toggle('active', unit === 'in');
    updateDerivedTopWidth();
}

// Apply a values object (mm / degrees) to matching inputs
function applyDefaults(defaults) {
    Object.entries(defaults).forEach(([key, mmVal]) => {
        const input = document.querySelector(`input[data-param="${key}"]`);
        if (!input) return;
        const isAngle = !!input.dataset.noUnitConvert;
        const displayVal = (!isAngle && currentUnit === 'in')
            ? parseFloat((mmVal / MM_PER_INCH).toFixed(3))
            : mmVal;
        input.value = displayVal;
        input.dataset.defaultMm = mmVal;
    });
}

// Download
function downloadStl() {
    if (!currentStl) return;
    const blob = new Blob([currentStl], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = currentMode === 'dovetail' ? 'dovetail-insert.stl'
               : currentMode === 'knob'     ? 'knob.stl'
               : 't-track-insert.stl';
    a.click();
    URL.revokeObjectURL(url);
    trackEvent('stl-download', 'STL Download');
}

// Share URL
function buildShareUrl() {
    const params = getParamsMm();
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => sp.set(k, v));
    sp.set('u',    currentUnit);
    sp.set('mode', currentMode);
    if (currentMode === 'ttrack' && trackPresetEl.value) sp.set('tp', trackPresetEl.value);
    if (boltPresetEl.value) sp.set('bp', boltPresetEl.value);
    return `${location.origin}${location.pathname}?${sp.toString()}`;
}

function copyShareUrl() {
    const url = buildShareUrl();
    navigator.clipboard.writeText(url).then(() => {
        shareBtn.textContent = 'Copied!';
        shareBtn.classList.add('copied');
        setTimeout(() => {
            shareBtn.textContent = 'Share';
            shareBtn.classList.remove('copied');
        }, 2000);
    });
}

// Apply URL params on load — returns true if any params were found
function applyUrlParams() {
    const sp = new URLSearchParams(location.search);
    if (sp.size === 0) return false;

    const urlMode = sp.get('mode');
    if (urlMode === 'dovetail' || urlMode === 'ttrack' || urlMode === 'knob') {
        applyMode(urlMode, false);
    }

    paramInputs.forEach(input => {
        const mmVal = sp.get(input.dataset.param);
        if (mmVal === null) return;
        const v = parseFloat(mmVal);
        if (isNaN(v)) return;
        // Values are stored in mm (or degrees for angle); convert to display unit if needed
        const isAngle = !!input.dataset.noUnitConvert;
        input.value = (!isAngle && sp.get('u') === 'in')
            ? parseFloat((v / MM_PER_INCH).toFixed(3))
            : v;
        input.dataset.defaultMm = v;
    });

    const tp = sp.get('tp');
    if (tp) trackPresetEl.value = tp;
    const bp = sp.get('bp');
    if (bp) boltPresetEl.value = bp;

    const unit = sp.get('u');
    if (unit === 'in') {
        // Step sizes for non-angle inputs
        paramInputs.forEach(input => {
            if (!input.dataset.noUnitConvert) input.step = '0.01';
        });
        currentUnit = 'in';
        unitMmBtn.classList.remove('active');
        unitInBtn.classList.add('active');
    }

    updateDerivedTopWidth();
    return true;
}

// --- Mode switching ---

const TTRACK_BOLT_OPTIONS = [
    { value: 'm8',  label: 'M8'  },
    { value: 'm6',  label: 'M6'  },
    { value: 'm10', label: 'M10' },
];
const DOVETAIL_BOLT_OPTIONS = [
    { value: 'm5', label: 'M5' },
    { value: 'm4', label: 'M4' },
    { value: 'm6', label: 'M6' },
];
const KNOB_BOLT_OPTIONS = [
    { value: 'm6', label: 'M6' },
    { value: 'm5', label: 'M5' },
    { value: 'm4', label: 'M4' },
];

function updateBoltPresetOptions(mode) {
    const options = mode === 'dovetail' ? DOVETAIL_BOLT_OPTIONS
                  : mode === 'knob'     ? KNOB_BOLT_OPTIONS
                  : TTRACK_BOLT_OPTIONS;
    boltPresetEl.innerHTML =
        options.map(o => `<option value="${o.value}">${o.label}</option>`).join('') +
        '<option value="custom">Custom</option>';
}

function applyMode(mode, render = true) {
    currentMode = mode;
    const sp = new URLSearchParams(location.search);
    sp.set('mode', mode);
    history.replaceState(null, '', `?${sp.toString()}`);

    ttracksection.style.display   = mode === 'ttrack'   ? '' : 'none';
    dovetailSection.style.display  = mode === 'dovetail' ? '' : 'none';
    knobSection.style.display      = mode === 'knob'     ? '' : 'none';
    insertSection.style.display    = mode === 'knob'     ? 'none' : '';

    modeTtrackBtn.classList.toggle('active',   mode === 'ttrack');
    modeDovetailBtn.classList.toggle('active', mode === 'dovetail');
    modeKnobBtn.classList.toggle('active',     mode === 'knob');

    const titles = { ttrack: 'T-Track', dovetail: 'Dovetail', knob: 'Knob' };
    modeTitleEl.textContent = titles[mode] ?? 'T-Track';

    updateBoltPresetOptions(mode);

    if (mode === 'dovetail') {
        applyDefaults(DOVETAIL_DEFAULTS);
        boltPresetEl.value = 'm5';
        updateDerivedTopWidth();
    } else if (mode === 'knob') {
        applyDefaults(KNOB_DEFAULTS);
        boltPresetEl.value = 'm6';
    } else {
        applyDefaults(ttrackScadDefaults);
        trackPresetEl.value = 'wide-metric';
        applyPreset(TRACK_PRESETS['wide-metric']);
        boltPresetEl.value  = 'm8';
        applyPreset(BOLT_PRESETS['m8']);
    }
    syncSelectTooltip(boltPresetEl);
    if (render) requestGeneration();
}

// --- Diagram highlight ---
const DIAGRAM_BASE      = '#8090a8';
const DIAGRAM_HIGHLIGHT = '#e94560';

const DIAGRAM_MAP = {
    slot_width: { line: 'infoline-0-path-effect21', label: 'text23'     },
    lip_width:  { line: 'infoline-8-path-effect10', label: 'text23-8'   },
    slot_depth: { line: 'infoline-5-path-effect10', label: 'text23-8-1' },
    lip_depth:  { line: 'infoline-7-path-effect10', label: 'text23-8-2' },
};

const BOLT_DIAGRAM_MAP = {
    head_width:     { line: 'infoline-0-path-effect9', label: 'text18' },
    head_height:    { line: 'infoline-7-path-effect9', label: 'text17' },
    shaft_diameter: { line: 'infoline-4-path-effect9', label: 'text19' },
};

const DOVETAIL_DIAGRAM_MAP = {
    dv_bottom_width: { line: 'infoline-0-path-effect1', label: 'text4' },
    dv_height:       { line: 'infoline-0-path-effect6', label: 'text7' },
};
// The derived top-width display highlights T in the diagram on focus
const DOVETAIL_TOP_MAP = { line: 'infoline-2-path-effect1', label: 'text5' };

function highlightIn(container, { line, label }, active) {
    const color  = active ? DIAGRAM_HIGHLIGHT : DIAGRAM_BASE;
    const lineEl = container.querySelector(`[id="${line}"]`);
    const labEl  = container.querySelector(`[id="${label}"]`);
    if (lineEl) lineEl.style.stroke = color;
    if (labEl)  labEl.style.fill    = color;
}

function applyDiagramTheme() {
    const container = document.getElementById('track-diagram');
    const track = container.querySelector('#path1');
    if (track) { track.style.fill = '#c8d4e0'; track.style.stroke = '#c8d4e0'; }
    container.querySelectorAll('.measure-line').forEach(el => { el.style.stroke = DIAGRAM_BASE; });
    container.querySelectorAll('text').forEach(el => { el.style.fill = DIAGRAM_BASE; el.style.stroke = 'none'; });
}

function applyBoltDiagramTheme() {
    const container = document.getElementById('bolt-diagram');
    const bolt = container.querySelector('#path1');
    if (bolt) { bolt.style.fill = '#c8d4e0'; bolt.style.stroke = '#c8d4e0'; }
    ['path2','path3','path4','path5','path6','path7','path8','path9'].forEach(id => {
        const el = container.querySelector(`#${id}`);
        if (el) el.style.stroke = '#16213e';
    });
    container.querySelectorAll('.measure-line').forEach(el => { el.style.stroke = DIAGRAM_BASE; });
    container.querySelectorAll('text').forEach(el => { el.style.fill = DIAGRAM_BASE; el.style.stroke = 'none'; });
}

function applyDovetailDiagramTheme() {
    const container = document.getElementById('dovetail-diagram');
    const shape = container.querySelector('#path1');
    if (shape) { shape.style.fill = '#c8d4e0'; shape.style.stroke = '#c8d4e0'; }
    container.querySelectorAll('.measure-line').forEach(el => { el.style.stroke = DIAGRAM_BASE; });
    container.querySelectorAll('text').forEach(el => { el.style.fill = DIAGRAM_BASE; el.style.stroke = 'none'; });
}

function fixSvgDimensions(container) {
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const vbStr = svgEl.getAttribute('viewBox');
    if (!vbStr) return;
    const parts = vbStr.trim().split(/[\s,]+/).map(Number);
    const vbW = parts[2], vbH = parts[3];
    if (!vbW || !vbH) return;
    svgEl.setAttribute('width',  vbW);
    svgEl.setAttribute('height', vbH);
}

async function loadDiagram() {
    const container = document.getElementById('track-diagram');
    const text = await fetch('./t_track_diagram.svg').then(r => r.text());
    container.innerHTML = text;
    fixSvgDimensions(container);
    applyDiagramTheme();
    paramInputs.forEach(input => {
        const map = DIAGRAM_MAP[input.dataset.param];
        if (!map) return;
        input.addEventListener('focus', () => highlightIn(container, map, true));
        input.addEventListener('blur',  () => highlightIn(container, map, false));
    });
}

async function loadBoltDiagram() {
    const container = document.getElementById('bolt-diagram');
    const text = await fetch('./bolt_diagram.svg').then(r => r.text());
    container.innerHTML = text;
    fixSvgDimensions(container);
    applyBoltDiagramTheme();
    paramInputs.forEach(input => {
        const map = BOLT_DIAGRAM_MAP[input.dataset.param];
        if (!map) return;
        input.addEventListener('focus', () => highlightIn(container, map, true));
        input.addEventListener('blur',  () => highlightIn(container, map, false));
    });
}

async function loadDovetailDiagram() {
    const container = document.getElementById('dovetail-diagram');
    const text = await fetch('./dovetail_diagram.svg').then(r => r.text());
    container.innerHTML = text;
    fixSvgDimensions(container);
    applyDovetailDiagramTheme();
    // Wire editable inputs
    paramInputs.forEach(input => {
        const map = DOVETAIL_DIAGRAM_MAP[input.dataset.param];
        if (!map) return;
        input.addEventListener('focus', () => highlightIn(container, map, true));
        input.addEventListener('blur',  () => highlightIn(container, map, false));
    });
    // Wire readonly derived display → highlights T dimension
    if (dvTopDisplay) {
        dvTopDisplay.addEventListener('focus', () => highlightIn(container, DOVETAIL_TOP_MAP, true));
        dvTopDisplay.addEventListener('blur',  () => highlightIn(container, DOVETAIL_TOP_MAP, false));
    }
    // Live-update derived top width whenever any dovetail input changes
    ['dv_bottom_width', 'dv_height', 'wall_angle'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateDerivedTopWidth);
    });
}

// --- Presets ---

function applyPreset(presetValues) {
    Object.entries(presetValues).forEach(([key, mmVal]) => {
        const input = document.querySelector(`input[data-param="${key}"]`);
        if (!input) return;
        const isAngle = !!input.dataset.noUnitConvert;
        const displayVal = (!isAngle && currentUnit === 'in')
            ? parseFloat((mmVal / MM_PER_INCH).toFixed(3))
            : mmVal;
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

// --- Event Listeners ---
renderBtn.addEventListener('click', requestGeneration);
unitMmBtn.addEventListener('click', () => setUnit('mm'));
unitInBtn.addEventListener('click', () => setUnit('in'));
downloadBtn.addEventListener('click', downloadStl);
shareBtn.addEventListener('click', copyShareUrl);

modeTtrackBtn.addEventListener('click', () => {
    if (currentMode !== 'ttrack') applyMode('ttrack');
});
modeDovetailBtn.addEventListener('click', () => {
    if (currentMode !== 'dovetail') applyMode('dovetail');
});
modeKnobBtn.addEventListener('click', () => {
    if (currentMode !== 'knob') applyMode('knob');
});

// --- Init ---

async function loadScadDefaults() {
    const text = await fetch('./insert.scad').then(r => r.text());
    const re   = /^(\w+)\s*=\s*([\d.]+)\s*;/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
        ttrackScadDefaults[m[1]] = parseFloat(m[2]);
    }
    paramInputs.forEach(input => {
        const key = input.dataset.param;
        if (key in ttrackScadDefaults) {
            input.value = ttrackScadDefaults[key];
            input.dataset.defaultMm = ttrackScadDefaults[key];
        }
    });
}

initViewer(viewerContainer);

loadScadDefaults().then(() => {
    // Pre-populate knob inputs with their defaults (they aren't in insert.scad)
    applyDefaults(KNOB_DEFAULTS);

    const fromUrl = applyUrlParams();
    if (!fromUrl) {
        trackPresetEl.value = 'wide-metric';
        boltPresetEl.value  = 'm8';
    }
    syncSelectTooltip(trackPresetEl);
    syncSelectTooltip(boltPresetEl);
    setCustomOnChange(TRACK_PARAM_KEYS, trackPresetEl);
    setCustomOnChange(BOLT_PARAM_KEYS,  boltPresetEl);
    requestGeneration();
});

loadDiagram();
loadBoltDiagram();
loadDovetailDiagram();
