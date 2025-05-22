import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// // Controls
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 10, 10);
scene.add(dirLight);

// Helpers (optional)
scene.add(new THREE.GridHelper(10, 10));
scene.add(new THREE.AxesHelper(2));

// Load context model
const loader = new GLTFLoader();
loader.load('./models/context.glb', (gltf) => {
  gltf.scene.name = "context";
  scene.add(gltf.scene);
}, undefined, (error) => {
  console.error('Error loading context.glb:', error);
});

// Load building model
loader.load('./models/ADU.glb', (gltf) => {
  gltf.scene.name = "ADU";
  scene.add(gltf.scene);
}, undefined, (error) => {
  console.error('Error loading ADU.glb:', error);
});

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate/render loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
