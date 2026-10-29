import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./style.css";

const TARGET = new THREE.Vector3(0, 5, 0);
// How far past the orbit target the frustum's far plane reaches.
const FAR_MARGIN = 120;

const canvas = document.querySelector("#canvas");
const cameraView = document.querySelector("#camera-view");
const observerView = document.querySelector("#observer-view");
const modeButtons = document.querySelectorAll("[data-mode]");
const modeContent = document.querySelectorAll("[data-show]");
const fovInput = document.querySelector("#fov");
const fovOutput = document.querySelector("#fov-value");

// Renderer: one canvas, two scissored viewports
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setScissorTest(true);

// Scene: two rows of identical pillars on a grid, so size falloff and
// converging lines are easy to spot.
const scene = new THREE.Scene();

const grid = new THREE.GridHelper(300, 30, 0x666666, 0x333333);
scene.add(grid);

const ROWS = [-12, 12];
const PILLARS_PER_ROW = 12;
const pillarGeometry = new THREE.BoxGeometry(4, 10, 4).translate(0, 5, 0);
const pillars = new THREE.InstancedMesh(
  pillarGeometry,
  new THREE.MeshNormalMaterial(),
  ROWS.length * PILLARS_PER_ROW
);
const matrix = new THREE.Matrix4();
let index = 0;
for (const x of ROWS) {
  for (let i = 0; i < PILLARS_PER_ROW; i++) {
    matrix.setPosition(x, 0, 55 - i * 10);
    pillars.setMatrixAt(index++, matrix);
  }
}
scene.add(pillars);

// Cameras under comparison. Only one is active at a time; switching keeps
// the same viewpoint and framing so the projection is the only difference.
const perspective = new THREE.PerspectiveCamera(Number(fovInput.value), 1, 1);
perspective.position.set(18, 18, 85);
perspective.lookAt(TARGET);

const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 1);

const helpers = new Map([
  [perspective, new THREE.CameraHelper(perspective)],
  [orthographic, new THREE.CameraHelper(orthographic)],
]);
for (const helper of helpers.values()) scene.add(helper);

let active = perspective;

const controls = new OrbitControls(active, cameraView);
controls.target.copy(TARGET);
controls.enableDamping = true;

// Observer camera looking at the active camera and its frustum from outside
const observer = new THREE.PerspectiveCamera(45, 1, 1, 5000);
observer.position.set(-200, 160, 140);

const observerControls = new OrbitControls(observer, observerView);
observerControls.target.set(0, 0, 20);
observerControls.enableDamping = true;

// Framing math

const tanHalfFov = (fov) => Math.tan(THREE.MathUtils.degToRad(fov / 2));

// World-space height visible at the orbit target
function visibleHeight() {
  return active.isPerspectiveCamera
    ? 2 * controls.getDistance() * tanHalfFov(active.fov)
    : (active.top - active.bottom) / active.zoom;
}

// Move the perspective camera along its view direction so that `height`
// fills the screen at the target.
function frameHeight(height) {
  const distance = height / (2 * tanHalfFov(perspective.fov));
  perspective.position
    .sub(controls.target)
    .setLength(distance)
    .add(controls.target);
}

// Rendering

let cameraRect;
let observerRect;
let needsRender = true;

function requestRender() {
  needsRender = true;
}

function updateProjection() {
  const aspect = cameraRect.width / cameraRect.height;

  if (active.isPerspectiveCamera) {
    active.aspect = aspect;
  } else {
    active.left = -active.top * aspect;
    active.right = active.top * aspect;
  }
  active.far = controls.getDistance() + FAR_MARGIN;
  active.updateProjectionMatrix();
  helpers.get(active).update();

  requestRender();
}

function onResize() {
  cameraRect = cameraView.getBoundingClientRect();
  observerRect = observerView.getBoundingClientRect();

  renderer.setSize(window.innerWidth, window.innerHeight, false);

  observer.aspect = observerRect.width / observerRect.height;
  observer.updateProjectionMatrix();

  updateProjection();
}

function renderView(rect, camera, background) {
  // WebGL viewports are measured from the bottom-left corner
  const y = window.innerHeight - rect.bottom;
  renderer.setViewport(rect.left, y, rect.width, rect.height);
  renderer.setScissor(rect.left, y, rect.width, rect.height);
  renderer.setClearColor(background);
  renderer.render(scene, camera);
}

function render() {
  const helper = helpers.get(active);

  helper.visible = false;
  renderView(cameraRect, active, 0x1a1a1a);

  helper.visible = true;
  renderView(observerRect, observer, 0x0e0e0e);
}

// UI

function setMode(mode) {
  const next = mode === "orthographic" ? orthographic : perspective;

  if (next !== active) {
    const height = visibleHeight();

    next.position.copy(active.position);
    next.quaternion.copy(active.quaternion);
    if (next.isPerspectiveCamera) {
      frameHeight(height);
    } else {
      next.top = height / 2;
      next.bottom = -height / 2;
      next.zoom = 1;
    }

    active = next;
    controls.object = next;
  }

  for (const [camera, helper] of helpers) helper.visible = camera === active;
  for (const button of modeButtons) {
    button.setAttribute("aria-checked", button.dataset.mode === mode);
  }
  for (const element of modeContent) {
    element.hidden = element.dataset.show !== mode;
  }
  history.replaceState(null, "", `#${mode}`);

  updateProjection();
}

for (const button of modeButtons) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}

// Dolly zoom: changing the FOV moves the camera so the framing at the target
// stays constant, which isolates how strong the perspective distortion is.
fovInput.addEventListener("input", () => {
  const height = visibleHeight();
  perspective.fov = Number(fovInput.value);
  fovOutput.value = `${perspective.fov}°`;
  frameHeight(height);
  updateProjection();
});
fovOutput.value = `${perspective.fov}°`;

// Keep the camera view unobstructed on small screens
if (window.matchMedia("(max-width: 600px)").matches) {
  document.querySelector(".panel").open = false;
}

controls.addEventListener("change", updateProjection);
observerControls.addEventListener("change", requestRender);
window.addEventListener("resize", onResize);

onResize();
setMode(location.hash === "#orthographic" ? "orthographic" : "perspective");

renderer.setAnimationLoop(() => {
  // Advances damping and dispatches "change" while the cameras are moving
  controls.update();
  observerControls.update();

  if (needsRender) {
    needsRender = false;
    render();
  }
});
