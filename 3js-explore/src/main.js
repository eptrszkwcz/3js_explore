import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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

// const buildingFile = 'Context_bldg_brep'
// const buildingFile = 'Small_bldgs2';
const buildingFile = 'site-sample';

const lotFile = 'Small_lots2';


// Load models
const objLoader = new OBJLoader();
const modelList = [
  // { name: buildingFile, light: 0xabdbde, dark: 0x548487 },
  // { name: lotFile, light: 0xbcf2bb, dark: 0x588558 },
  // { name: 'Context_roads', light: 0xbfbdac, dark: 0x525143 },
  // { name: 'Context_sidewalk', light: 0xd6d4c5, dark: 0x878470 },
  // { name: 'Site', light: 0xff6bc4, dark: 0xff6bc4 }, // same color in both modes
  { name: 'site-sample', light: 0xff6bc4, dark: 0xff6bc4 }, // GLB
];

const modelColors = {
  [buildingFile]: { light: 0xabdbde, dark: 0x548487 },
  [lotFile]: { light: 0xbcf2bb, dark: 0x588558 },
  // 'site-sample': { light: 0xff6bc4, dark: 0xff6bc4 },
};

const gltfLoader = new GLTFLoader();

gltfLoader.load('/models/site-sample.glb', (gltf) => {
  const glbScene = gltf.scene;

  glbScene.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshStandardMaterial({
        color: modelColors['site-sample'].dark,
        roughness: 0.6,
        metalness: 0.1,
      });
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  glbScene.name = 'site-sample';
  modelMap['site-sample'] = glbScene;
  scene.add(glbScene);

}, undefined, (err) => {
  console.error('Error loading site-sample.glb:', err);
});



const modelMap = {};

[buildingFile, lotFile].forEach((name) => {
  objLoader.load(`/models/${name}.obj`, (object) => {
    object.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: modelColors[name].dark,
          roughness: 0.6,
          metalness: 0.1,
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

Object.keys(modelMap).forEach((name) => {
  const model = modelMap[name];
  const { light, dark } = modelColors[name];
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material.color.set(isDarkMode ? dark : light);
      }
    });
  }
});



// const modelMap = {};

// modelList.forEach(({ name, light, dark }) => {
//   objLoader.load(`/models/${name}.obj`, (object) => {
//     object.traverse((child) => {
//       if (child.isMesh) {
//         child.material = new THREE.MeshStandardMaterial({
//           color: dark,
//           roughness: 0.6,
//           metalness: 0.1
//         });
//         child.castShadow = true;
//         child.receiveShadow = true;
//       }
//     });
//     object.name = name;
//     modelMap[name] = object;
//     scene.add(object);
//   }, undefined, (err) => {
//     console.error(`Error loading ${name}.obj:`, err);
//   });
// });

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
        hoveredObject.material.emissive?.set(0x5a9094); // Highlight 
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


let currentlyHoveredFace = null;

window.addEventListener('click', onMouseClick, false);

let clickedMesh = null;
let selectedMesh = null;
let selectedEdges = null;
let selectedVertices = null;

function onMouseClick(event) {
  raycaster.setFromCamera(mouse, camera);

  const buildingGroup = modelMap[buildingFile];
  if (!buildingGroup) return;

  const intersects = raycaster.intersectObjects(buildingGroup.children, true);

  if (intersects.length > 0) {
    clickedMesh = intersects[0].object;
    console.log(clickedMesh.children)

    if (selectedMesh === clickedMesh) return;

    // Reset previous selection
    if (selectedMesh) {
      selectedMesh.material.color.set(isDarkMode ? 0x548487 : 0xabdbde);
      if (selectedEdges) {
        selectedMesh.remove(selectedEdges);
        selectedEdges.geometry.dispose();
        selectedEdges.material.dispose();
        selectedEdges = null;
      }
      if (selectedVertices) {
        selectedMesh.remove(selectedVertices);
        selectedVertices.geometry.dispose();
        selectedVertices.material.dispose();
        selectedVertices = null;
      }
    }

    // Set new selection color
    // clickedMesh.material.color.set(0xff0000);
    clickedMesh.material.color.set(0xfffb00);
    selectedMesh = clickedMesh;

    // Edges
    const edgeGeo = new THREE.EdgesGeometry(clickedMesh.geometry);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xeeff00 });
    selectedEdges = new THREE.LineSegments(edgeGeo, edgeMat);
    clickedMesh.add(selectedEdges);

    // Vertices
    const vertexGeo = new THREE.BufferGeometry();
    const positions = clickedMesh.geometry.attributes.position.array;
    vertexGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const vertexMat = new THREE.PointsMaterial({
      color: 0x000000,
      size: 8,
      sizeAttenuation: false
    });

    selectedVertices = new THREE.Points(vertexGeo, vertexMat);
    clickedMesh.add(selectedVertices);

  } else {
    // Clicked on empty space: clear selection
    if (selectedMesh) {
      console.log("resetting")
      // clickedMesh = null;
      // clickedMesh.material.color.dispose();
      clickedMesh.material.color.set(isDarkMode ? 0x548487 : 0xabdbde);
      selectedMesh.material.color.set(isDarkMode ? 0x548487 : 0xabdbde);
      if (selectedEdges) {
        selectedMesh.remove(selectedEdges);
        selectedEdges.geometry.dispose();
        selectedEdges.material.dispose();
        selectedEdges = null;
      }
      if (selectedVertices) {
        selectedMesh.remove(selectedVertices);
        selectedVertices.geometry.dispose();
        selectedVertices.material.dispose();
        selectedVertices = null;
      }
      selectedMesh = null;
    }
  }
}



// let currentlyHoveredFace = null;

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  if (selectedMesh) {
    const intersects = raycaster.intersectObject(selectedMesh, true);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const face = intersect.face;
      // console.log(intersect.object.geometry)
      let geometry = intersect.object.geometry;

      if (!geometry || !face) return;

      // Convert to non-indexed geometry if needed
      if (geometry.index) {
        geometry = geometry.toNonIndexed();
        intersect.object.geometry = geometry; // update reference
      }

      // Reset previously hovered face color
      if (currentlyHoveredFace && currentlyHoveredFace.object) {
        const geo = currentlyHoveredFace.object.geometry;
        const colorAttr = geo.attributes.color;
        if (colorAttr && currentlyHoveredFace.faceIndex !== undefined) {
          for (let i = 0; i < 3; i++) {
            const vertexIndex = currentlyHoveredFace.faceIndex * 3 + i;
            colorAttr.setXYZ(vertexIndex, 1.0, 0.0, 0.0); // reset to red
          }
          colorAttr.needsUpdate = true;
        }
      }

      // Ensure geometry has vertex colors
      if (!geometry.attributes.color) {
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          colors[i * 3] = 1.0;   // R
          colors[i * 3 + 1] = 0.0; // G
          colors[i * 3 + 2] = 0.0; // B
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }

      // Highlight hovered face in green
      const colorAttr = geometry.attributes.color;
      const faceIndex = intersect.faceIndex;

      for (let i = 0; i < 3; i++) {
        const vertexIndex = faceIndex * 3 + i;
        colorAttr.setXYZ(vertexIndex, 0.0, 1.0, 0.0); // green
      }
      colorAttr.needsUpdate = true;

      intersect.object.material.vertexColors = true;
      intersect.object.material.needsUpdate = true;

      currentlyHoveredFace = { object: intersect.object, faceIndex: intersect.faceIndex };
    } else if (currentlyHoveredFace && currentlyHoveredFace.object) {
      const geo = currentlyHoveredFace.object.geometry;
      const colorAttr = geo.attributes.color;
      if (colorAttr && currentlyHoveredFace.faceIndex !== undefined) {
        for (let i = 0; i < 3; i++) {
          const vertexIndex = currentlyHoveredFace.faceIndex * 3 + i;
          colorAttr.setXYZ(vertexIndex, 1.0, 0.0, 0.0); // back to red
        }
        colorAttr.needsUpdate = true;
      }
      currentlyHoveredFace = null;
    }
  }
}



