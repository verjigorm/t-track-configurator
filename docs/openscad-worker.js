let createOpenSCAD = null;

async function ensureFactory() {
    if (!createOpenSCAD) {
        self.postMessage({ type: 'status', message: 'Loading OpenSCAD...' });
        try {
            const module = await import('https://cdn.jsdelivr.net/npm/openscad-wasm@0.0.4/openscad.js');
            createOpenSCAD = module.createOpenSCAD;
        } catch (e) {
            throw new Error('Failed to load OpenSCAD WASM: ' + (e.message || e));
        }
    }
    return createOpenSCAD;
}

self.onmessage = async (event) => {
    const { type, params } = event.data;

    if (type === 'generate') {
        try {
            const factory = await ensureFactory();

            self.postMessage({ type: 'status', message: 'Generating model...' });

            const scadText = await fetch('./insert.scad').then(r => r.text());

            // Fresh instance per render — callMain can only be called once per instance
            const inst = await factory();
            const openscad = inst.getInstance();

            openscad.FS.writeFile('/input.scad', scadText);

            const dArgs = Object.entries(params).flatMap(([k, v]) => ['-D', `${k}=${v}`]);
            openscad.callMain(['/input.scad', '--enable=manifold', ...dArgs, '-o', '/output.stl']);

            const stlData = openscad.FS.readFile('/output.stl', { encoding: 'binary' });
            const buffer = stlData.buffer.slice(stlData.byteOffset, stlData.byteOffset + stlData.byteLength);

            self.postMessage({ type: 'result', stl: buffer }, [buffer]);
        } catch (err) {
            self.postMessage({ type: 'error', message: err.message || String(err) });
        }
    }
};
