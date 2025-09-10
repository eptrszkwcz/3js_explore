// Import Three.js and related libraries
import * as THREE from 'three';
import { MeshLine, MeshLineMaterial } from 'three.meshline';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Global variables for Three.js components
let camera, scene, renderer, controls, raycaster;
let mouse = new THREE.Vector2();

// Selection state variables - track what the user has currently selected
let hoveredBlock = null;
let activeBlockId = null;
let activeParcelId = null;
let activeBuildingId = null;
let activeFaceId = null;
let hoveredMeshes = []; // Currently hovered meshes for highlighting
let popup = null; // Reference to the popup element

// Data structure maps to organize geometry by hierarchy level
const blockMap = new Map();       // Maps blockId → Array of Mesh objects
const parcelMap = new Map();      // Maps "blockId-parcelId" → Array of Mesh objects
const buildingMap = new Map();    // Maps "blockId-parcelId-buildingId" → Array of Mesh objects
const faceMap = new Map();        // Maps "blockId-parcelId-buildingId-faceId" → Array of Mesh objects

// Helper function to create consistent keys for face-level mapping
const meshKey = (block, parcel, building, face) => `${block}-${parcel}-${building}-${face}`;

// Array to store edge lines for visual highlighting
const edgeLines = [];

init();
animate();

/**
 * Initialize the Three.js scene, camera, lights, and event listeners
 */
function init() {

  // Create WebGL renderer with antialiasing
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Create scene with dark gray background
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3b3b3b); // dark gray

  // Create perspective camera with adjusted clipping planes to reduce z-fighting
  camera = new THREE.PerspectiveCamera(
    50,           // field of view
    window.innerWidth / window.innerHeight,
    1,            // near clipping plane (increased from 0.1 to reduce z-fighting)
    50000         // far clipping plane (increased from 10000 to accommodate larger scenes)
  );
  camera.position.set(0, 1500, 1500);

  // Set up orbit controls for camera manipulation
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0); // aligns with block center
  controls.update();

  // Enable shadow mapping for realistic lighting
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Main directional light (sun) - primary light source
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(1000, 2000, 1000);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 5000;
  directionalLight.shadow.camera.left = -2000;
  directionalLight.shadow.camera.right = 2000;
  directionalLight.shadow.camera.top = 2000;
  directionalLight.shadow.camera.bottom = -2000;
  scene.add(directionalLight);

  // Ambient light for overall illumination and to fill shadows
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Additional fill light from opposite direction to reduce harsh shadows
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-1000, 1500, -1000);
  scene.add(fillLight);

  // Top-down light for better illumination from above
  const topLight = new THREE.DirectionalLight(0xffffff, 0.3);
  topLight.position.set(0, 3000, 0);
  scene.add(topLight);


  // Create raycaster for mouse interaction
  raycaster = new THREE.Raycaster();

  // Load 3D model from JSON file
  const loader = new THREE.ObjectLoader();
  const loadFile = '/models/masterplan-0828-1-area.json';
  loader.load(loadFile, (loadedScene) => {
    
    // Traverse all objects in the loaded scene to organize them by hierarchy
    loadedScene.traverse((child) => {
      if (child.isMesh) {
        // Extract hierarchy information from userData
        const blockId = child.userData.block;
        const parcelId = child.userData.parcel;
        const buildingId = child.userData.building;
        const faceId = child.userData.face;

        // Enable shadows for all meshes
        child.castShadow = true;
        child.receiveShadow = true;



        // Organize meshes into hierarchical data structures for efficient lookup
        
        // Populate block map - groups all meshes by block ID
        if (blockId !== undefined) {
          if (!blockMap.has(blockId)) blockMap.set(blockId, []);
          blockMap.get(blockId).push(child);
        }

        // Populate parcel map - groups meshes by block-parcel combination
        if (blockId !== undefined && parcelId !== undefined) {
          const parcelKey = `${blockId}-${parcelId}`;
          if (!parcelMap.has(parcelKey)) parcelMap.set(parcelKey, []);
          parcelMap.get(parcelKey).push(child);
        }

        // Populate building map - groups meshes by block-parcel-building combination
        if (blockId !== undefined && parcelId !== undefined && buildingId !== undefined) {
          const buildingKey = `${blockId}-${parcelId}-${buildingId}`;
          if (!buildingMap.has(buildingKey)) buildingMap.set(buildingKey, []);
          buildingMap.get(buildingKey).push(child);
        }

        // Populate face map - groups meshes by complete hierarchy (block-parcel-building-face)
        if (blockId !== undefined && parcelId !== undefined && buildingId !== undefined && faceId !== undefined) {
          const key = meshKey(blockId, parcelId, buildingId, faceId);
          if (!faceMap.has(key)) faceMap.set(key, []);
          faceMap.get(key).push(child);
        }

        // Store original material for restoration when highlighting is cleared
        child.userData.originalMaterial = child.material.clone();
      }
    });
    
    // Add the loaded scene to the main scene
    scene.add(loadedScene);
    
    // Auto-center and zoom camera to fit the entire model
    fitCameraToModel(loadedScene);
  });

  // Set up event listeners for user interaction
  window.addEventListener('mousemove', onMouseMove, false); // Handle mouse hover
  window.addEventListener('click', onClick, false); // Handle mouse clicks

  // Handle window resize to maintain proper aspect ratio
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Create popup element for displaying information
  createPopup();
}

/**
 * Handle mouse movement for hover effects and popup display
 * @param {MouseEvent} event - The mouse move event
 */
function onMouseMove(event) {
  // Convert mouse coordinates to normalized device coordinates (-1 to 1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Set up raycaster from camera through mouse position
  raycaster.setFromCamera(mouse, camera);
  
  // Collect all meshes from the scene for intersection testing
  const allMeshes = [];
  scene.traverse((child) => {
    if (child.isMesh) {
      allMeshes.push(child);
    }
  });
  
  // Find all objects that intersect with the ray
  const intersects = raycaster.intersectObjects(allMeshes);

  // Clear any existing highlights and hide popup
  clearHighlights();
  hidePopup();
  
  // Reset cursor to default arrow
  document.body.style.cursor = 'default';

  // If no objects are intersected, exit early
  if (intersects.length === 0) {
    return;
  }
  
  // Find the first intersection with valid hierarchy data (must have block ID)
  let validIntersect = null;
  for (let i = 0; i < intersects.length; i++) {
    const intersect = intersects[i];
    if (intersect.object.userData && intersect.object.userData.block !== undefined) {
      validIntersect = intersect;
      break;
    }
  }
  
  // If no valid intersection found, exit early
  if (!validIntersect) return;

  // Extract hierarchy information from the intersected object
  const hovered = validIntersect.object;
  const blockId = hovered.userData.block;
  const parcelId = hovered.userData.parcel;
  const buildingId = hovered.userData.building;
  const faceId = hovered.userData.face;
  


  // Determine hover level based on current selection state and hierarchy
  if (activeBlockId === null) {
    // BLOCK LEVEL: No block selected yet, hover over any block
    hoveredMeshes = blockMap.get(blockId) || [];
    
    // Set cursor to pointer to indicate interactivity
    document.body.style.cursor = 'pointer';
    
    // Calculate total areas for all parcels in this block
    let popupText = `Block: ${blockId}`;
    let totalAreaRet = 0, totalAreaOff = 0, totalAreaCFa = 0, totalAreaHot = 0, totalAreaRes = 0;
    
    // Get all unique parcel IDs within this block
    const blockParcels = new Set();
    hoveredMeshes.forEach(mesh => {
      if (mesh.userData.parcel) {
        blockParcels.add(mesh.userData.parcel);
      }
    });
    
    // Sum up area values from all parcels within the block
    blockParcels.forEach(parcelId => {
      const parcelKey = `${blockId}-${parcelId}`;
      const parcelMeshes = parcelMap.get(parcelKey) || [];
      
      parcelMeshes.forEach(mesh => {
        if (mesh && mesh.userData) {
          totalAreaRet += mesh.userData['area-Ret'] || 0;
          totalAreaOff += mesh.userData['area-Off'] || 0;
          totalAreaCFa += mesh.userData['area-CFa'] || 0;
          totalAreaHot += mesh.userData['area-Hot'] || 0;
          totalAreaRes += mesh.userData['area-Res'] || 0;
        }
      });
    });
    
    // Build area display text, only showing areas with values > 0
    const areas = [];
    if (totalAreaRet > 0) {
      areas.push(`Retail: ${formatArea(totalAreaRet)}`);
    }
    if (totalAreaOff > 0) {
      areas.push(`Office: ${formatArea(totalAreaOff)}`);
    }
    if (totalAreaCFa > 0) {
      areas.push(`Com. Fac.: ${formatArea(totalAreaCFa)}`);
    }
    if (totalAreaHot > 0) {
      areas.push(`Hotel: ${formatArea(totalAreaHot)}`);
    }
    if (totalAreaRes > 0) {
      areas.push(`Residential: ${formatArea(totalAreaRes)}`);
    }
    
    // Add area information to popup text if any areas exist
    if (areas.length > 0) {
      popupText += '\n' + areas.join('\n');
    }
    
    // Display popup with block information and total areas
    showPopup(event.clientX, event.clientY, popupText);
  } else if (activeParcelId === null && blockId === activeBlockId && parcelId !== undefined) {
    // PARCEL LEVEL: Block selected, hover over parcels within that block
    const parcelKey = `${blockId}-${parcelId}`;
    hoveredMeshes = parcelMap.get(parcelKey) || [];
    
    // Set cursor to pointer to indicate interactivity
    document.body.style.cursor = 'pointer';

    // Get area data from all meshes in the parcel
    let popupText = `Parcel: ${parcelId}`;
    

    
        // Sum up area values from all meshes in the parcel
    let areaRet = 0, areaOff = 0, areaCFa = 0, areaHot = 0, areaRes = 0;
    
    for (const mesh of hoveredMeshes) {
      if (mesh && mesh.userData) {
        // Accumulate area values from each mesh
        areaRet += mesh.userData['area-Ret'] || 0;
        areaOff += mesh.userData['area-Off'] || 0;
        areaCFa += mesh.userData['area-CFa'] || 0;
        areaHot += mesh.userData['area-Hot'] || 0;
        areaRes += mesh.userData['area-Res'] || 0;
      }
    }
    
    // Build area display text, only showing areas with values > 0
    const areas = [];
    
    if (areaRet > 0) {
      areas.push(`Retail: ${formatArea(areaRet)}`);
    }
    if (areaOff > 0) {
      areas.push(`Office: ${formatArea(areaOff)}`);
    }
    if (areaCFa > 0) {
      areas.push(`Com. Fac.: ${formatArea(areaCFa)}`);
    }
    if (areaHot > 0) {
      areas.push(`Hotel: ${formatArea(areaHot)}`);
    }
    if (areaRes > 0) {
      areas.push(`Residential: ${formatArea(areaRes)}`);
    }
    
    // Add area information to popup text if any areas exist
    if (areas.length > 0) {
      popupText += '\n' + areas.join('\n');
    } else {
      // Fallback: Show area values even if they're 0 (for debugging)
      const debugAreas = [];
      if (areaRet !== 0) debugAreas.push(`Retail: ${areaRet}`);
      if (areaOff !== 0) debugAreas.push(`Office: ${areaOff}`);
      if (areaCFa !== 0) debugAreas.push(`Com. Fac.: ${areaCFa}`);
      if (areaHot !== 0) debugAreas.push(`Hotel: ${areaHot}`);
      if (areaRes !== 0) debugAreas.push(`Residential: ${areaRes}`);
      if (debugAreas.length > 0) {
        popupText += '\n' + debugAreas.join('\n');
      } else {
        popupText += '\nNo area data found';
      }
    }

    // Display popup with parcel information and areas
    showPopup(event.clientX, event.clientY, popupText);
  } else if (activeBuildingId === null && blockId === activeBlockId && parcelId === activeParcelId && buildingId !== undefined) {
    // BUILDING LEVEL: Parcel selected, hover over buildings within that parcel
    const buildingKey = `${blockId}-${parcelId}-${buildingId}`;
    hoveredMeshes = buildingMap.get(buildingKey) || [];
    
    // Set cursor to pointer to indicate interactivity
    document.body.style.cursor = 'pointer';
    
    // Display popup with building information
    showPopup(event.clientX, event.clientY, `Building: ${buildingId}`);
  } else if (activeFaceId === null && blockId === activeBlockId && parcelId === activeParcelId && buildingId === activeBuildingId && faceId !== undefined) {
    // FACE LEVEL: Building selected, hover over faces within that building
    const key = meshKey(blockId, parcelId, buildingId, faceId);
    hoveredMeshes = faceMap.get(key) || [];
    
    // Set cursor to pointer to indicate interactivity
    document.body.style.cursor = 'pointer';
    
    // Display popup with face information
    showPopup(event.clientX, event.clientY, `Face: ${faceId}`);
  } else if (blockId === activeBlockId && parcelId === activeParcelId && buildingId === activeBuildingId && faceId === activeFaceId) {
    // INDIVIDUAL MESH LEVEL: All levels selected, hover over specific mesh
    hoveredMeshes = [hovered];
  }

  // Apply hover highlighting: add bright blue edges to hovered meshes
  hoveredMeshes.forEach((m) => {
    // Create edge geometry for highlighting
    const edgeGeometry = new THREE.EdgesGeometry(m.geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x002fff }); // Bright blue
    const edgeLine = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    
    // Apply same transformation matrix as the original mesh
    edgeLine.matrix.copy(m.matrix);
    edgeLine.matrixAutoUpdate = false;
    
    // Add to scene and store for later removal
    scene.add(edgeLine);
    if (!m.userData.highlightEdges) {
      m.userData.highlightEdges = [];
    }
    m.userData.highlightEdges.push(edgeLine);
  });
}


window.addEventListener('click', onClick, false);

/**
 * Handle mouse clicks for selection progression through hierarchy levels
 * @param {MouseEvent} event - The mouse click event
 */
function onClick(event) {
  // Convert mouse coordinates to normalized device coordinates (-1 to 1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Set up raycaster from camera through mouse position
  raycaster.setFromCamera(mouse, camera);
  
  // Collect all meshes from the scene for intersection testing
  const allMeshes = [];
  scene.traverse((child) => {
    if (child.isMesh) {
      allMeshes.push(child);
    }
  });
  
  // Find all objects that intersect with the ray
  const intersects = raycaster.intersectObjects(allMeshes);

  // If clicking outside any geometry, reset all selections
  if (intersects.length === 0) {
    // Reset all selection states
    activeBlockId = null;
    activeParcelId = null;
    activeBuildingId = null;
    activeFaceId = null;
    clearHighlights();
    clearBlockEdges();
    restoreAllColors(); // Restore all colors when clicking outside
    return;
  }

  // Find the first intersection with valid hierarchy data for clicking
  let validClickIntersect = null;
  for (let i = 0; i < intersects.length; i++) {
    const intersect = intersects[i];
    if (intersect.object.userData && intersect.object.userData.block !== undefined) {
      validClickIntersect = intersect;
      break;
    }
  }
  
  // If no valid intersection found, exit early
  if (!validClickIntersect) return;
  
  // Extract hierarchy information from the clicked object
  const clicked = validClickIntersect.object;
  const blockId = clicked.userData.block;
  const parcelId = clicked.userData.parcel;
  const buildingId = clicked.userData.building;
  const faceId = clicked.userData.face;
  
  // Selection progression: Block → Parcel → Building → Face
  if (activeBlockId === null) {
    // FIRST CLICK: Select block
    activeBlockId = blockId;
    showBlockEdges(blockId);
    
    // Get all meshes in the selected block and gray out everything else
    const selectedBlockMeshes = blockMap.get(blockId) || [];
    grayOutNonSelected(selectedBlockMeshes);
    

  } else if (activeParcelId === null && blockId === activeBlockId && parcelId !== undefined) {
    // SECOND CLICK: Select parcel within the selected block
    activeParcelId = parcelId;
    showParcelEdges(blockId, parcelId);
    
    // Get all meshes in the selected parcel and gray out everything else
    const parcelKey = `${blockId}-${parcelId}`;
    const selectedParcelMeshes = parcelMap.get(parcelKey) || [];
    grayOutNonSelected(selectedParcelMeshes);
    

  } else if (activeBuildingId === null && blockId === activeBlockId && parcelId === activeParcelId && buildingId !== undefined) {
    // THIRD CLICK: Select building within the selected parcel
    activeBuildingId = buildingId;
    showBuildingEdges(blockId, parcelId, buildingId);
    
    // Get all meshes in the selected building and gray out everything else
    const buildingKey = `${blockId}-${parcelId}-${buildingId}`;
    const selectedBuildingMeshes = buildingMap.get(buildingKey) || [];
    grayOutNonSelected(selectedBuildingMeshes);
    

  } else if (activeFaceId === null && blockId === activeBlockId && parcelId === activeParcelId && buildingId === activeBuildingId && faceId !== undefined) {
    // FOURTH CLICK: Select face within the selected building
    activeFaceId = faceId;
    showFaceEdges(blockId, parcelId, buildingId, faceId);
    
    // Get all meshes in the selected face and gray out everything else
    const key = meshKey(blockId, parcelId, buildingId, faceId);
    const selectedFaceMeshes = faceMap.get(key) || [];
    grayOutNonSelected(selectedFaceMeshes);
    

  } else {
    // RESET: Clicking on already selected level or different level - reset all selections
    activeBlockId = null;
    activeParcelId = null;
    activeBuildingId = null;
    activeFaceId = null;
    clearBlockEdges();
    restoreAllColors(); // Restore all colors when deselecting
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



/**
 * Clear all hover highlights from the scene
 * Removes edge highlights and resets hovered meshes array
 */
function clearHighlights() {
  hoveredMeshes.forEach(mesh => {
    // Remove edge highlights from each hovered mesh
    if (mesh.userData.highlightEdges) {
      mesh.userData.highlightEdges.forEach(edgeLine => {
        scene.remove(edgeLine);
      });
      mesh.userData.highlightEdges = [];
    }
  });
  hoveredMeshes = [];
}

/**
 * Animation loop - continuously renders the scene
 */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

/**
 * Show edge highlights for a selected block (currently disabled)
 * @param {number} blockId - The ID of the block to highlight
 */
function showBlockEdges(blockId) {
  // clearBlockEdges();

  // const meshes = blockMap.get(blockId) || [];
  // meshes.forEach((mesh) => {
  //   const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry);
  //   const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00});
  //   const edgeLine = new THREE.LineSegments(edgeGeometry, edgeMaterial,);

  //   // Apply same transformation matrix directly
  //   edgeLine.matrix.copy(mesh.matrix);
  //   edgeLine.matrixAutoUpdate = false;

  //   // Add to the scene (same parent as mesh)
  //   scene.add(edgeLine);
  //   edgeLines.push(edgeLine);
  // });
}

/**
 * Show edge highlights for a selected parcel (currently disabled)
 * @param {number} blockId - The ID of the block containing the parcel
 * @param {number} parcelId - The ID of the parcel to highlight
 */
function showParcelEdges(blockId, parcelId) {
  // clearBlockEdges();

  // const parcelKey = `${blockId}-${parcelId}`;
  // const meshes = parcelMap.get(parcelKey) || [];
  // meshes.forEach((mesh) => {
  //   const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry);
  //   const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00}); // Green for parcels
  //   const edgeLine = new THREE.LineSegments(edgeGeometry, edgeMaterial,);

  //   // Apply same transformation matrix directly
  //   edgeLine.matrix.copy(mesh.matrix);
  //   edgeLine.matrixAutoUpdate = false;

  //   // Add to the scene (same parent as mesh)
  //   // scene.add(edgeLine);
  //   // edgeLines.push(edgeLine);
  // });
}

/**
 * Show edge highlights for a selected building
 * @param {number} blockId - The ID of the block containing the building
 * @param {number} parcelId - The ID of the parcel containing the building
 * @param {number} buildingId - The ID of the building to highlight
 */
function showBuildingEdges(blockId, parcelId, buildingId) {
  clearBlockEdges();

  const buildingKey = `${blockId}-${parcelId}-${buildingId}`;
  const meshes = buildingMap.get(buildingKey) || [];
  meshes.forEach((mesh) => {
    const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff}); // Blue for buildings
    const edgeLine = new THREE.LineSegments(edgeGeometry, edgeMaterial,);

    // Apply same transformation matrix directly
    edgeLine.matrix.copy(mesh.matrix);
    edgeLine.matrixAutoUpdate = false;

    // Add to the scene (same parent as mesh)
    scene.add(edgeLine);
    edgeLines.push(edgeLine);
  });
}

/**
 * Show edge highlights for a selected face (currently disabled)
 * @param {number} blockId - The ID of the block containing the face
 * @param {number} parcelId - The ID of the parcel containing the face
 * @param {number} buildingId - The ID of the building containing the face
 * @param {number} faceId - The ID of the face to highlight
 */
function showFaceEdges(blockId, parcelId, buildingId, faceId) {
  // clearBlockEdges();

  // const key = meshKey(blockId, parcelId, buildingId, faceId);
  // const meshes = faceMap.get(key) || [];
  // meshes.forEach((mesh) => {
  //   const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry);
  //   const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffff00}); // Yellow for faces
  //   const edgeLine = new THREE.LineSegments(edgeGeometry, edgeMaterial,);

  //   // Apply same transformation matrix directly
  //   edgeLine.matrix.copy(mesh.matrix);
  //   edgeLine.matrixAutoUpdate = false;

  //   // Add to the scene (same parent as mesh)
  //   scene.add(edgeLine);
  //   edgeLines.push(edgeLine);
  // });
}





/**
 * Clear all edge highlight lines from the scene
 */
function clearBlockEdges() {
  edgeLines.forEach((line) => {
    scene.remove(line);
  });
  edgeLines.length = 0;
}

/**
 * Turn all geometry gray except the selected elements
 * Creates a visual focus effect by graying out non-selected geometry
 * @param {Array} selectedMeshes - Array of meshes that should remain in original color
 */
function grayOutNonSelected(selectedMeshes) {
  scene.traverse((child) => {
    if (child.isMesh && child.userData.block !== undefined) {
      // Check if this mesh is in the selected group
      const isSelected = selectedMeshes.some(selectedMesh => selectedMesh === child);
      
      if (!isSelected) {
        // Turn non-selected geometry gray
        if (!child.userData.grayedOut) {
          child.userData.grayedOut = true;
          child.userData.originalMaterialForGray = child.material.clone();
          child.material = child.material.clone();
          child.material.color.setHex(0xb3b3b3); // Lighter gray color
        }
      } else {
        // Restore selected geometry to original color
        if (child.userData.grayedOut) {
          child.userData.grayedOut = false;
          child.material = child.userData.originalMaterialForGray.clone();
        }
      }
    }
  });
}

/**
 * Restore all geometry to original colors
 * Removes the gray-out effect from all meshes
 */
function restoreAllColors() {
  scene.traverse((child) => {
    if (child.isMesh && child.userData.grayedOut) {
      child.userData.grayedOut = false;
      child.material = child.userData.originalMaterialForGray.clone();
    }
  });
}

/**
 * Compute bounding box of a model or group of objects
 * @param {Object|Array} objects - Single object or array of objects to compute bounding box for
 * @returns {THREE.Box3} The computed bounding box
 */
function computeBoundingBox(objects) {
  const box = new THREE.Box3();
  
  if (Array.isArray(objects)) {
    // If objects is an array, compute bounding box of all objects
    objects.forEach(obj => {
      if (obj.geometry) {
        obj.geometry.computeBoundingBox();
        box.expandByObject(obj);
      }
    });
  } else {
    // If objects is a single object, compute its bounding box
    box.expandByObject(objects);
  }
  
  return box;
}

/**
 * Automatically center and zoom camera to fit the entire model in view
 * @param {Object} model - The model to fit in the camera view
 */
function fitCameraToModel(model) {
  // Compute bounding box of the entire model
  const boundingBox = computeBoundingBox(model);
  
  if (boundingBox.isEmpty()) {
    console.warn('Model has no geometry to fit camera to');
    return;
  }
  
  // Get the center and size of the bounding box
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());
  
  // Calculate the maximum dimension
  const maxDim = Math.max(size.x, size.y, size.z);
  
  // Calculate distance needed to fit the model in view
  // Add some padding (1.5x) to ensure the model fits comfortably
  const distance = (maxDim / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.5;
  
  // Position camera at a good viewing angle
  const cameraPosition = new THREE.Vector3(
    center.x + distance * 0.7,
    center.y + distance * 0.5,
    center.z + distance * 0.7
  );
  
  // Update camera position and look at center
  camera.position.copy(cameraPosition);
  camera.lookAt(center);
  
  // Update controls target to center
  controls.target.copy(center);
  controls.update();
}

/**
 * Create the popup element for displaying information on hover
 */
function createPopup() {
  popup = document.createElement('div');
  popup.style.position = 'absolute';
  popup.style.backgroundColor = '#303030';
  popup.style.color = 'white';
  popup.style.padding = '8px 12px';
  popup.style.borderRadius = '8px';
  popup.style.fontFamily = 'Arial, sans-serif';
  popup.style.fontSize = '14px';
  popup.style.pointerEvents = 'none';
  popup.style.zIndex = '1000';
  popup.style.display = 'none';
  popup.style.width = '200px';
  popup.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
  document.body.appendChild(popup);
}

/**
 * Display popup with formatted information at specified coordinates
 * @param {number} x - X coordinate for popup position
 * @param {number} y - Y coordinate for popup position
 * @param {string} text - Text to display (first line is title, rest is content)
 */
function showPopup(x, y, text) {
  if (!popup) return;
  
  // Split the text into title and content
  const lines = text.split('\n');
  const title = lines[0];
  const content = lines.slice(1);
  
  // Create HTML with gray title
  let html = `<div style="color:rgb(153, 153, 153); margin-bottom: 8px;">${title}</div>`;
  
  if (content.length > 0) {
    // Process each area line with flexbox layout and colored styling
    content.forEach(line => {
      if (line.trim()) {
        // Create flexbox row for each area line
        let flexRow = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
        
        // Extract label and value with specific colors for each area type
        let label = '';
        let value = '';
        let color = '';
        
        if (line.includes('Retail')) {
          label = 'Retail';
          color = 'rgb(252,134,77)';
          value = line.match(/Retail: ([\d,]+)/)?.[1] || '';
        } else if (line.includes('Office')) {
          label = 'Office';
          color = 'rgb(138,183,255)';
          value = line.match(/Office: ([\d,]+)/)?.[1] || '';
        } else if (line.includes('Com. Fac.')) {
          label = 'Com. Fac.';
          color = 'rgb(39,158,125)';
          value = line.match(/Com\. Fac\.: ([\d,]+)/)?.[1] || '';
        } else if (line.includes('Hotel')) {
          label = 'Hotel';
          color = '#7c4ab5';
          value = line.match(/Hotel: ([\d,]+)/)?.[1] || '';
        } else if (line.includes('Residential')) {
          label = 'Residential';
          color = 'rgb(255,186,84)';
          value = line.match(/Residential: ([\d,]+)/)?.[1] || '';
        }
        
        if (label && value) {
          flexRow += `<span style="color: ${color};">${label}</span>`;
          flexRow += `<span style="color: ${color}; font-weight: bold;">${value} sm</span>`;
        }
        
        flexRow += '</div>';
        html += flexRow;
      }
    });
  }
  
  // Set popup content and make it visible
  popup.innerHTML = html;
  popup.style.display = 'block';
  
  // Position popup near mouse cursor but ensure it stays within viewport
  const offset = 15;
  let left = x + offset;
  let top = y - offset;
  
  // Adjust if popup would go outside viewport boundaries
  const rect = popup.getBoundingClientRect();
  if (left + rect.width > window.innerWidth) {
    left = x - rect.width - offset;
  }
  if (top < 0) {
    top = y + offset;
  }
  
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

/**
 * Hide the popup element
 */
function hidePopup() {
  if (popup) {
    popup.style.display = 'none';
  }
}

// Function to format area values with commas for thousands
/**
 * Format area numbers with locale-specific thousands separators
 * @param {number} area - The area value to format
 * @returns {string} Formatted area string with commas
 */
function formatArea(area) {
  return area.toLocaleString();
}

