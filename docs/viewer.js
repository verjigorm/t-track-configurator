import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const stlLoader = new STLLoader();

let scene, camera, renderer, controls, currentMesh;

export function init(container) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(40, 30, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 50, 50);
    scene.add(dirLight);

    // Grid helper
    const grid = new THREE.GridHelper(100, 20, 0x0f3460, 0x0f3460);
    scene.add(grid);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 5, 0);
    controls.update();

    // Resize handler
    const onResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);
    new ResizeObserver(onResize).observe(container);

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

export function updateModel(stlArrayBuffer) {
    // Remove previous mesh
    if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh.geometry.dispose();
        currentMesh.material.dispose();
    }

    const geometry = stlLoader.parse(stlArrayBuffer);
    geometry.computeVertexNormals();

    // Center the geometry
    geometry.computeBoundingBox();
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    // Shift up so it sits on the grid
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    geometry.translate(0, size.y / 2, 0);

    const material = new THREE.MeshPhongMaterial({
        color: 0x4fc3f7,
        specular: 0x222222,
        shininess: 40,
    });

    currentMesh = new THREE.Mesh(geometry, material);
    scene.add(currentMesh);
}