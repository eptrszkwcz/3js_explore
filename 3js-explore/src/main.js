import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 20, 30);
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Square setup
const squareSize = 3.048; // 10 feet in meters
const spacing = 0.914; // 3 feet in meters
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
const squares = [];

for (let i = 0; i < 3; i++) {
  const geometry = new THREE.BoxGeometry(squareSize, 0.1, squareSize);
  const mesh = new THREE.Mesh(geometry, floorMaterial.clone());
  mesh.position.x = (i - 1) * (squareSize + spacing);
  scene.add(mesh);
  squares.push(mesh);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSquare = null;

window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(squares);

  if (intersects.length > 0) {
    selectedSquare = intersects[0].object;
    document.getElementById('extrude-input').style.display = 'block';
  }
});

document.getElementById('apply-height').addEventListener('click', () => {
  const value = parseFloat(document.getElementById('height-value').value);
  if (selectedSquare && !isNaN(value)) {
    const newGeometry = new THREE.BoxGeometry(squareSize, value, squareSize);
    selectedSquare.geometry.dispose();
    selectedSquare.geometry = newGeometry;
    selectedSquare.position.y = value / 2;
    document.getElementById('extrude-input').style.display = 'none';
    selectedSquare = null;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

