import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let isDarkMode = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(-400, 400, 200);
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(60, 0, -240);
controls.update();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.7;
controls.enableDamping = true;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 1));  //was 0.5

const dirLight = new THREE.DirectionalLight(0xffffff, 2);  //was 0.8
dirLight.position.set(3, 40, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;

dirLight.shadow.camera.left = -500;
dirLight.shadow.camera.right = 500;
dirLight.shadow.camera.top = 500;
dirLight.shadow.camera.bottom = -500;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 2000;

scene.add(dirLight);

// Enable shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Optional: Add a softer fill light
const fillLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
scene.add(fillLight);

// HELPERS
// scene.add(new THREE.GridHelper(20, 20));
// scene.add(new THREE.AxesHelper(2));

// Load models
const objLoader = new OBJLoader();
const modelList = [
  { name: 'Context_bldg', light: 0xabdbde, dark: 0x548487 },
  { name: 'Context_lots', light: 0xbcf2bb, dark: 0x588558 },
  { name: 'Context_roads', light: 0xbfbdac, dark: 0x525143 },
  { name: 'Context_sidewalk', light: 0xd6d4c5, dark: 0x878470 },
  { name: 'Site', light: 0xff6bc4, dark: 0xff6bc4 }, // same color in both modes
];

const modelMap = {};

modelList.forEach(({ name, light, dark }) => {
  objLoader.load(`/models/${name}.obj`, (object) => {
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: dark,
          roughness: 0.6,
          metalness: 0.1
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    object.name = name;
    modelMap[name] = object;
    scene.add(object);
  }, undefined, (err) => {
    console.error(`Error loading ${name}.obj:`, err);
  });
});

// Add button to toggle style
const view_mod = document.getElementById('but-view-mod');
view_mod.addEventListener('click', () => {
  isDarkMode = !isDarkMode;

  scene.background = new THREE.Color(isDarkMode ? 0x202020 : 0xf0f0f0);

  modelList.forEach(({ name, light, dark }) => {
    const model = modelMap[name];
    if (model) {
      model.traverse((child) => {
        if (child.isMesh) {
          child.material.color.set(isDarkMode ? dark : light);
        }
      });
    }
  });
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();


let isAutoRotateOn = true;
const auto_rot = document.getElementById('but-auto-rot');
auto_rot.addEventListener('click', () => {
  isAutoRotateOn = !isAutoRotateOn;
  controls.autoRotate = isAutoRotateOn;
  rotateButton.textContent = isAutoRotateOn ? 'Turn Off Auto-Rotate' : 'Turn On Auto-Rotate';
});


// SHADOW DROP DOWN 
const shadowContainer = document.getElementById('shadow-drop-down')
const shadowSelect = document.createElement('select');
shadowSelect.classList.add('dropdown-menu');

const options = ['Noon', 'Morning','Afternoon'];
options.forEach(optionText => {
  const option = document.createElement('option');
  option.value = optionText;
  option.textContent = optionText;
  shadowSelect.appendChild(option);
});

shadowContainer.appendChild(shadowSelect);
// document.body.appendChild(shadowSelect);

shadowSelect.addEventListener('change', () => {
  const choice = shadowSelect.value;

  switch (choice) {
    case 'No Shadows':
      dirLight.visible = false;
      break;
    case 'Morning':
      dirLight.visible = true;
      dirLight.position.set(400, 180.65, 120.65);
      break;
    case 'Noon':
      dirLight.visible = true;
      dirLight.position.set(30, 400, 100);
      break;
    case 'Afternoon':
      dirLight.visible = true;
      dirLight.position.set(-400, 180.65, 120.65);
      break;
  }
});

