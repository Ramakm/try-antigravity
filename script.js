import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Configuration ---
const CONFIG = {
    fogColor: 0x020205, // Deep space blue-black
    fogDensity: 0.008,
    bloomStrength: 2.0,
    bloomRadius: 0.5,
    bloomThreshold: 0.1,
    neuronCount: 2000,
    connectionDistance: 15
};

// --- Scene Setup ---
console.log("Initializing Cosmic Neural Network...");
const canvas = document.querySelector('#universe-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.fogColor);
scene.fog = new THREE.FogExp2(CONFIG.fogColor, CONFIG.fogDensity);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 100);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Post-Processing ---
const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomStrength,
    CONFIG.bloomRadius,
    CONFIG.bloomThreshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- DEBUG CUBE ---
const debugGeo = new THREE.BoxGeometry(10, 10, 10);
const debugMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
const debugMesh = new THREE.Mesh(debugGeo, debugMat);
scene.add(debugMesh);

// --- Neural Network Generation ---
const neuronUniforms = {
    time: { value: 0 }
};

const synapseUniforms = {
    time: { value: 0 },
    color: { value: new THREE.Color(0x0088ff) } // Cyan connections
};

function generateNeuralNetwork() {
    const positions = [];
    const colors = [];
    const sizes = [];
    const particles = new THREE.BufferGeometry();

    // 1. Generate Neurons (Stars)
    // Use a spherical distribution with some noise for "brain" shape
    for (let i = 0; i < CONFIG.neuronCount; i++) {
        // Random point in sphere
        const r = 40 * Math.cbrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        let x = r * Math.sin(phi) * Math.cos(theta);
        let y = r * Math.sin(phi) * Math.sin(theta);
        let z = r * Math.cos(phi);

        // Flatten slightly to look like a galaxy/brain
        y *= 0.6;

        positions.push(x, y, z);

        // Color variation: Blue/White/Gold
        const colorType = Math.random();
        const color = new THREE.Color();
        if (colorType > 0.9) color.setHex(0xffd700); // Gold (rare)
        else if (colorType > 0.6) color.setHex(0x00ffff); // Cyan
        else color.setHex(0xffffff); // White

        colors.push(color.r, color.g, color.b);
        sizes.push(Math.random() * 2 + 1);
    }

    particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const neuronMaterial = new THREE.ShaderMaterial({
        uniforms: neuronUniforms,
        vertexShader: document.getElementById('neuronVertexShader').textContent,
        fragmentShader: document.getElementById('neuronFragmentShader').textContent,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const neuronSystem = new THREE.Points(particles, neuronMaterial);
    scene.add(neuronSystem);

    // 2. Generate Synapses (Connections)
    // Connect particles that are close to each other
    const linePositions = [];
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();

    // Optimization: Spatial hashing or just brute force for 2000 is okay (2000^2 is 4M checks, might be slow)
    // Let's limit connections per node to avoid n^2
    // Or just check a subset. 2000 is small enough for JS if we are careful.
    // Let's do a simple distance check but break early if too many connections

    for (let i = 0; i < CONFIG.neuronCount; i++) {
        p1.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        let connections = 0;

        for (let j = i + 1; j < CONFIG.neuronCount; j++) {
            p2.set(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
            const dist = p1.distanceTo(p2);

            if (dist < CONFIG.connectionDistance) {
                linePositions.push(p1.x, p1.y, p1.z);
                linePositions.push(p2.x, p2.y, p2.z);
                connections++;
                if (connections > 5) break; // Limit connections per neuron
            }
        }
    }

    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

    const synapseMaterial = new THREE.ShaderMaterial({
        uniforms: synapseUniforms,
        vertexShader: document.getElementById('synapseVertexShader').textContent,
        fragmentShader: document.getElementById('synapseFragmentShader').textContent,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        linewidth: 1 // WebGL limitation, but bloom helps
    });

    const synapseSystem = new THREE.LineSegments(linesGeometry, synapseMaterial);
    scene.add(synapseSystem);
}

generateNeuralNetwork();

// --- Interaction ---
let mouseX = 0;
let mouseY = 0;
let targetRadius = 80;
let targetY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.1;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.1;
});

document.addEventListener('wheel', (e) => {
    targetRadius += e.deltaY * 0.1;
    targetRadius = Math.max(20, Math.min(200, targetRadius));
});

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    // Update Uniforms
    neuronUniforms.time.value = time;
    synapseUniforms.time.value = time;

    // Camera Control
    // Orbit with mouse influence
    const speed = 0.1;
    const angle = time * speed + mouseX * 0.01;

    // Smooth zoom/height
    camera.position.x += (Math.sin(angle) * targetRadius - camera.position.x) * 0.05;
    camera.position.z += (Math.cos(angle) * targetRadius - camera.position.z) * 0.05;
    camera.position.y += (mouseY - camera.position.y) * 0.05;

    camera.lookAt(0, 0, 0);

    composer.render();
    // renderer.render(scene, camera);
}

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
