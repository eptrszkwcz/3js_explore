import * as THREE from 'three';
import { MeshLine, MeshLineMaterial } from 'three.meshline';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let camera, scene, renderer, controls, raycaster;
let mouse = new THREE.Vector2();

let hoveredBlock = null;
let activeBlockId = null;
let activeBuildingId = null;
let hoveredMeshes = [];

const blockMap = new Map();       // blockId → Mesh[]
const buildingMap = new Map();    // blockId + buildingId → Mesh[]

const meshKey = (block, building) => `${block}-${building}`;
const edgeLines = [];            // 👈 add this
const vertexPoints = [];  

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0xf0f0f0);
  scene.background = new THREE.Color(0x3b3b3b); // dark gray

  // Camera
  camera = new THREE.PerspectiveCamera(
    50,           // field of view
    window.innerWidth / window.innerHeight,
    0.1,          // near clipping plane (was likely 1)
    10000         // far clipping plane (was maybe 2000)
  );
  camera.position.set(0, 1500, 1500);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0); // aligns with block center
  controls.update();

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1000, 2000, 1000);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);


  // Raycaster
  raycaster = new THREE.Raycaster();

  // Load JSON scene

  const loader = new THREE.ObjectLoader();
  loader.load('/models/trial6.json', (loadedScene) => {
    
    loadedScene.traverse((child) => {
      if (child.isMesh) {
        const blockId = child.userData.block;
        const buildingId = child.userData.building;

        // Populate block map
        if (blockId !== undefined) {
          if (!blockMap.has(blockId)) blockMap.set(blockId, []);
          blockMap.get(blockId).push(child);
        }

        // Populate building map
        if (blockId !== undefined && buildingId !== undefined) {
          const key = meshKey(blockId, buildingId);
          if (!buildingMap.has(key)) buildingMap.set(key, []);
          buildingMap.get(key).push(child);
        }

        child.userData.originalMaterial = child.material.clone();
      }
    });
    scene.add(loadedScene);
  });

  // Mouse move listener
  window.addEventListener('mousemove', onMouseMove, false);

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const allMeshes = Array.from(blockMap.values()).flat();
  const intersects = raycaster.intersectObjects(allMeshes);

  clearHighlights();

  if (intersects.length === 0) return;

  const hovered = intersects[0].object;
  const blockId = hovered.userData.block;
  const buildingId = hovered.userData.building;

  if (!activeBlockId) {
    // Block level
    hoveredMeshes = blockMap.get(blockId) || [];
  } else if (!activeBuildingId && blockId === activeBlockId && buildingId !== undefined) {
    // Building level
    const key = meshKey(blockId, buildingId);
    hoveredMeshes = buildingMap.get(key) || [];
  } else if (blockId === activeBlockId && buildingId === activeBuildingId) {
    // Face level
    hoveredMeshes = [hovered];
  }

  hoveredMeshes.forEach((m) => {
    m.material = m.material.clone();
    m.material.color.set(0xff69b4); // pink
  });
}


// function onMouseMove(event) {
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   raycaster.setFromCamera(mouse, camera);

//   let allMeshes = Array.from(blockMap.values()).flat();
//   const intersects = raycaster.intersectObjects(allMeshes);

//   clearHighlights();

//   if (intersects.length > 0) {
//     const hovered = intersects[0].object;
//     const blockId = hovered.userData.block;

//     if (activeBlockId === null) {
//       // Block-level hover
//       hoveredMeshes = blockMap.get(blockId) || [];
//     }  else if (
//       blockId === activeBlockId &&
//       (hovered.userData.building !== undefined || hovered.userData.park !== undefined)
//     ) {
//       // Hover within unlocked block, only buildings or parks
//       hoveredMeshes = [hovered];
//     }

//     hoveredMeshes.forEach(mesh => {
//       mesh.material = mesh.material.clone();
//       mesh.material.color.set(0xff69b4); // pink
//     });
//   }
// }

window.addEventListener('click', onClick, false);

function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const allMeshes = Array.from(blockMap.values()).flat();
  const intersects = raycaster.intersectObjects(allMeshes);

  if (intersects.length === 0) {
    // Reset
    activeBlockId = null;
    activeBuildingId = null;
    clearHighlights();
    clearBlockEdges();
    clearBlockVertices();
    return;
  }

  const clicked = intersects[0].object;
  const blockId = clicked.userData.block;
  const buildingId = clicked.userData.building;

  if (!activeBlockId) {
    activeBlockId = blockId;
    showBlockEdges(blockId);
    showBlockVertices(blockId);
  } else if (!activeBuildingId && blockId === activeBlockId && buildingId !== undefined) {
    activeBuildingId = buildingId;
  } else {
    // Deselect
    activeBlockId = null;
    activeBuildingId = null;
    clearBlockEdges();
    clearBlockVertices();
  }

  clearHighlights();
}


// function onClick(event) {
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   raycaster.setFromCamera(mouse, camera);
//   const allMeshes = Array.from(blockMap.values()).flat();
//   const intersects = raycaster.intersectObjects(allMeshes);

//   if (intersects.length > 0) {
//     const clicked = intersects[0].object;
//     const clickedBlock = clicked.userData.block;

//     if (activeBlockId === clickedBlock) {
//       activeBlockId = null;
//       clearBlockEdges();
//       clearBlockVertices();
//     } else {
//       activeBlockId = clickedBlock;
//       showBlockEdges(clickedBlock);
//       showBlockVertices(clickedBlock); 
//     }
    
//   } else {
//     // Clicked outside → lock
//     activeBlockId = null;
//     clearBlockEdges();
//     clearBlockVertices();
//   }

//   clearHighlights();
// }



function clearHighlights() {
  hoveredMeshes.forEach(mesh => {
    mesh.material = mesh.userData.originalMaterial.clone();
  });
  hoveredMeshes = [];
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

function showBlockEdges(blockId) {
  clearBlockEdges();

  const meshes = blockMap.get(blockId) || [];
  meshes.forEach((mesh) => {
    const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000});
    const edgeLine = new THREE.LineSegments(edgeGeometry, edgeMaterial,);

    // Apply same transformation matrix directly
    edgeLine.matrix.copy(mesh.matrix);
    edgeLine.matrixAutoUpdate = false;

    // Add to the scene (same parent as mesh)
    scene.add(edgeLine);
    edgeLines.push(edgeLine);
  });
}

// const vertexPoints = []; // store to remove later

function showBlockVertices(blockId) {
  clearBlockVertices();

  const meshes = blockMap.get(blockId) || [];
  meshes.forEach((mesh) => {
    const geometry = mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const pointsGeom = new THREE.BufferGeometry();
    const points = [];

    for (let i = 0; i < positionAttr.count; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(positionAttr, i);
      vertex.applyMatrix4(mesh.matrix); // apply mesh transformation
      points.push(vertex.x, vertex.y, vertex.z);
    }

    pointsGeom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3)
    );

    const pointsMaterial = new THREE.PointsMaterial({
      color: 0x000000, 
      size: 4,
      sizeAttenuation: false
    });

    const pointCloud = new THREE.Points(pointsGeom, pointsMaterial);
    scene.add(pointCloud);
    vertexPoints.push(pointCloud);
  });
}

function clearBlockVertices() {
  vertexPoints.forEach(p => scene.remove(p));
  vertexPoints.length = 0;
}



function clearBlockEdges() {
  edgeLines.forEach((line) => {
    scene.remove(line);
  });
  edgeLines.length = 0;
}

