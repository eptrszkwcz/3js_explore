import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredObject = null;

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

const buildingFile = 'Context_bldg_brep'

// Load models
const objLoader = new OBJLoader();
const modelList = [
  { name: buildingFile, light: 0xabdbde, dark: 0x548487 },
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
// function animate() {
//   requestAnimationFrame(animate);
//   controls.update();
//   renderer.render(scene, camera);
// }

function animate() {
  requestAnimationFrame(animate);

  // Update raycaster with camera and mouse
  raycaster.setFromCamera(mouse, camera);

  // Get all building meshes (example: from Context_bldg)
  const buildingGroup = modelMap[buildingFile];
  if (buildingGroup) {
    const intersects = raycaster.intersectObjects(buildingGroup.children, true);

    if (intersects.length > 0) {
      const intersected = intersects[0].object;

      if (hoveredObject !== intersected) {
        if (hoveredObject) {
          hoveredObject.material.emissive?.set(0x000000); // Reset previous
        }
        hoveredObject = intersected;
        hoveredObject.material.emissive?.set(0x5a9094); // Highlight with yellow glow
      }
    } else {
      if (hoveredObject) {
        hoveredObject.material.emissive?.set(0x000000);
        hoveredObject = null;
      }
    }
  }

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

let unlockedBuilding = null;
let currentlyHovered = null;

// Hover interaction

window.addEventListener('mousemove', onMouseMove, false);

// function onMouseMove(event) {
//   // Normalize mouse coordinates to -1 to 1
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
// }

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // console.log(unlockedBuilding)
  if (unlockedBuilding) {
    console.log("MAMIII")
    const intersects = raycaster.intersectObjects(unlockedBuilding.children, true);
    if (intersects.length > 0) {
      const hovered = intersects[0].object;

      if (currentlyHovered !== hovered) {
        if (currentlyHovered) {
          currentlyHovered.material.color.set(0x5a9094); // reset to base
        }
        hovered.material.color.set(0xff0000); // highlight red
        currentlyHovered = hovered;
      }
    } else if (currentlyHovered) {
      currentlyHovered.material.color.set(0x5a9094); // reset if nothing hovered
      currentlyHovered = null;
    }
  }
}

// Click interaction 



// window.addEventListener('click', onMouseClick, false);

// function onMouseClick(event) {
//   raycaster.setFromCamera(mouse, camera);

//   if (!unlockedBuilding) {
//     const buildingGroup = modelMap[buildingFile]; //This is the building layer
//     // console.log("BLDG GRP:", buildingGroup);
//     if (!buildingGroup) return;

//     const intersects = raycaster.intersectObjects(buildingGroup.children, true);
//     if (intersects.length > 0) {
//       // unlockedBuilding = intersects[0].object.parent;
//       const intersects = raycaster.intersectObjects(buildingGroup.children, true);
//       // const clicked = raycaster.intersectObjects(unlockedBuilding.children, true);
//       unlockedBuilding = intersects[0].object;
//       applyUnlockedStyle(unlockedBuilding);
//       console.log('Building unlocked:', unlockedBuilding.name || unlockedBuilding.uuid);
//     }
//   }
// }


// function applyUnlockedStyle(object) {
//   object.traverse(child => {
//     if (child.isMesh) {
//       child.material = new THREE.MeshStandardMaterial({
//         color: 0x5a9094,
//         roughness: 0.5,
//         metalness: 0.2
//       });
//       child.material.needsUpdate = true;

//       // Optional: add edges
//       const edges = new THREE.EdgesGeometry(child.geometry);
//       const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff }));
//       child.add(line);
//     }
//   });
// }





