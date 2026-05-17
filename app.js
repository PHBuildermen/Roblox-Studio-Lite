import {
  addNode,
  clamp,
  createNode,
  findNode,
  hitTestPart,
  normalizeProject,
  removeNode,
  renderScene,
  screenDeltaToWorldDelta,
  screenToWorld,
  setNodeProperty,
} from "./engine.js";

import { createScriptRuntime } from "./scriptRunner.js";
import {
  clearSavedProject,
  exportProject,
  importProjectFromFile,
  loadProject,
  saveProject,
} from "./storage.js";

import {
  closeScriptModal,
  openScriptModal,
  renderConsole,
  renderExplorer,
  renderProperties,
} from "./ui.js";

const canvas = document.getElementById("viewportCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const explorerTree = document.getElementById("explorerTree");
const propertiesPanel = document.getElementById("propertiesPanel");
const consolePanel = document.getElementById("consolePanel");
const modeLabel = document.getElementById("modeLabel");

const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const saveBtn = document.getElementById("saveBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");

const scriptModal = document.getElementById("scriptModal");
const scriptModalTitle = document.getElementById("scriptModalTitle");
const scriptModalSubtitle = document.getElementById("scriptModalSubtitle");
const scriptEditor = document.getElementById("scriptEditor");
const closeScriptModalBtn = document.getElementById("closeScriptModalBtn");
const saveScriptBtn = document.getElementById("saveScriptBtn");

let project = normalizeProject(loadProject());
let runtime = null;
let logs = [];
let dirtyTimer = null;
let canvasSize = { width: 0, height: 0 };
let editingScriptId = null;

const pointerMap = new Map();
let gesture = null;

function setCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvasSize = { width, height };
  }
}

function syncTopbar() {
  modeLabel.textContent = project.mode === "play" ? "Play Mode" : "Edit Mode";
  playBtn.disabled = project.mode === "play";
  stopBtn.disabled = project.mode !== "play";
}

function persistSoon() {
  clearTimeout(dirtyTimer);
  dirtyTimer = setTimeout(() => {
    saveProject(project);
  }, 150);
}

function refreshUI() {
  renderExplorer(explorerTree, project, {
    onSelect: selectNode,
    onOpenScript: openScriptForNode,
  });

  renderProperties(propertiesPanel, project, getSelectedNode(), {
    onPatch: patchNode,
    onOpenScript: openScriptForNode,
  });

  renderConsole(consolePanel, logs);
  syncTopbar();
  updateToolButtons();
}

function updateToolButtons() {
  document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === project.tool);
  });
}

function appendLog(entry) {
  logs.push(entry);
  if (logs.length > 200) logs = logs.slice(-200);
  renderConsole(consolePanel, logs);
}

function getSelectedNode() {
  return findNode(project, project.selectedId);
}

function selectNode(id) {
  project.selectedId = id;
  refreshUI();
  persistSoon();
}

function patchNode(id, patch) {
  const node = findNode(project, id);
  if (!node) return;

  Object.assign(node, patch);
  refreshUI();
  persistSoon();
}

function addObject(type) {
  const parentId = project.selectedId && findNode(project, project.selectedId) ? project.selectedId : "workspace";
  const node = createNode(type, parentId);
  addNode(project, node, parentId);

  project.selectedId = node.id;

  refreshUI();
  persistSoon();

  if ((type === "Script" || type === "LocalScript") && !project.mode) {
    openScriptForNode(node.id);
  }
}

function deleteSelected() {
  if (!project.selectedId) return;
  removeNode(project, project.selectedId);
  refreshUI();
  persistSoon();
}

function openScriptForNode(id) {
  const node = findNode(project, id);
  if (!node || (node.type !== "Script" && node.type !== "LocalScript")) return;

  editingScriptId = id;
  openScriptModal(scriptModal, scriptModalTitle, scriptModalSubtitle, scriptEditor, node);
}

function saveScriptFromModal() {
  const node = findNode(project, editingScriptId);
  if (!node) return;

  node.source = scriptEditor.value;
  refreshUI();
  persistSoon();
  closeScriptModal(scriptModal);
}

function startPlayMode() {
  if (project.mode === "play") return;

  project.mode = "play";
  runtime = createScriptRuntime(project, {
    onLog: appendLog,
    onChange: () => {
      renderScene(ctx, canvas, project);
      persistSoon();
      refreshUI();
    },
  });

  runtime.start();
  refreshUI();
}

function stopPlayMode() {
  if (runtime) {
    runtime.stop();
    runtime = null;
  }

  project.mode = "edit";
  refreshUI();
  persistSoon();
}

function resizeAndRender() {
  setCanvasSize();
  renderScene(ctx, canvas, project);
}

function stepFrame(now) {
  if (!stepFrame.last) stepFrame.last = now;
  const dt = Math.min(0.05, (now - stepFrame.last) / 1000);
  stepFrame.last = now;

  if (project.mode === "play" && runtime) {
    runtime.tick(dt);
  }

  renderScene(ctx, canvas, project);
  requestAnimationFrame(stepFrame);
}

function updateCamera(deltaX, deltaY) {
  const delta = screenDeltaToWorldDelta(deltaX, deltaY, project.camera);
  project.camera.x -= delta.x;
  project.camera.z -= delta.z;
}

function beginGesture(e) {
  const activePointers = [...pointerMap.values()];

  if (activePointers.length >= 2) {
    const [a, b] = activePointers;
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    gesture = {
      type: "cameraGesture",
      startCamera: { ...project.camera },
      startDistance: Math.hypot(dx, dy),
      startAngle: Math.atan2(dy, dx),
      startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    return;
  }

  const { x, y } = activePointers[0];
  const world = screenToWorld(x, y, project.camera, canvasSize.width, canvasSize.height);
  const hit = hitTestPart(project, world.x, world.z);

  if (project.tool === "select") {
    if (hit) {
      project.selectedId = hit;
      gesture = {
        type: "selectDrag",
        hitId: hit,
        startPointer: { x, y },
        startWorld: world,
        startNode: { ...findNode(project, hit) },
        moved: false,
      };
    } else {
      project.selectedId = null;
      gesture = {
        type: "panCamera",
        startPointer: { x, y },
        startCamera: { ...project.camera },
      };
    }
    refreshUI();
    persistSoon();
    return;
  }

  if (hit) {
    project.selectedId = hit;
    gesture = {
      type: project.tool,
      hitId: hit,
      startPointer: { x, y },
      startWorld: world,
      startNode: { ...findNode(project, hit) },
    };
    refreshUI();
    persistSoon();
  } else {
    gesture = {
      type: "panCamera",
      startPointer: { x, y },
      startCamera: { ...project.camera },
    };
  }
}

function updateGesture(e) {
  const activePointers = [...pointerMap.values()];

  if (gesture?.type === "cameraGesture" && activePointers.length >= 2) {
    const [a, b] = activePointers;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    project.camera.zoom = clamp(gesture.startCamera.zoom * (distance / Math.max(40, gesture.startDistance)), 0.2, 4);
    project.camera.rotation = gesture.startCamera.rotation + ((angle - gesture.startAngle) * 180) / Math.PI;

    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const midDeltaX = mid.x - gesture.startMid.x;
    const midDeltaY = mid.y - gesture.startMid.y;
    const worldDelta = screenDeltaToWorldDelta(midDeltaX, midDeltaY, gesture.startCamera);
    project.camera.x = gesture.startCamera.x - worldDelta.x;
    project.camera.z = gesture.startCamera.z - worldDelta.z;

    return;
  }

  if (!gesture) return;

  const pointer = [...pointerMap.values()][0];
  if (!pointer) return;

  const currentWorld = screenToWorld(pointer.x, pointer.y, project.camera, canvasSize.width, canvasSize.height);
  const node = gesture.hitId ? findNode(project, gesture.hitId) : null;
  if (!node) return;

  const dx = currentWorld.x - gesture.startWorld.x;
  const dz = currentWorld.z - gesture.startWorld.z;

  if (gesture.type === "move") {
    node.x = gesture.startNode.x + dx;
    node.z = gesture.startNode.z + dz;
  }

  if (gesture.type === "rotate") {
    const screenDx = pointer.x - gesture.startPointer.x;
    node.rotation = gesture.startNode.rotation + screenDx * 0.5;
  }

  if (gesture.type === "scale") {
    const screenDx = pointer.x - gesture.startPointer.x;
    const screenDy = pointer.y - gesture.startPointer.y;
    const factor = clamp(1 + (screenDx - screenDy) * 0.004, 0.1, 20);

    node.sizeX = Math.max(0.25, gesture.startNode.sizeX * factor);
    node.sizeZ = Math.max(0.25, gesture.startNode.sizeZ * factor);
    node.sizeY = Math.max(0.25, gesture.startNode.sizeY * factor);
  }

  if (gesture.type === "panCamera") {
    const dxScreen = pointer.x - gesture.startPointer.x;
    const dyScreen = pointer.y - gesture.startPointer.y;
    const delta = screenDeltaToWorldDelta(dxScreen, dyScreen, gesture.startCamera);
    project.camera.x = gesture.startCamera.x - delta.x;
    project.camera.z = gesture.startCamera.z - delta.z;
  }

  if (gesture.type === "selectDrag") {
    const moved = Math.hypot(pointer.x - gesture.startPointer.x, pointer.y - gesture.startPointer.y);
    if (moved > 6) gesture.moved = true;

    // In select mode, dragging a selected object still lets the user reposition it.
    node.x = gesture.startNode.x + dx;
    node.z = gesture.startNode.z + dz;
  }

  refreshUI();
  persistSoon();
}

function endGesture() {
  gesture = null;
}

canvas.addEventListener("pointerdown", (e) => {
  if (project.mode === "play") return;

  canvas.setPointerCapture(e.pointerId);
  pointerMap.set(e.pointerId, { x: e.clientX, y: e.clientY });
  beginGesture(e);
});

canvas.addEventListener("pointermove", (e) => {
  if (!pointerMap.has(e.pointerId)) return;

  pointerMap.set(e.pointerId, { x: e.clientX, y: e.clientY });
  updateGesture(e);
});

canvas.addEventListener("pointerup", (e) => {
  pointerMap.delete(e.pointerId);
  if (pointerMap.size === 0) endGesture();
});

canvas.addEventListener("pointercancel", (e) => {
  pointerMap.delete(e.pointerId);
  if (pointerMap.size === 0) endGesture();
});

window.addEventListener("resize", resizeAndRender);

document.querySelectorAll("[data-insert]").forEach((btn) => {
  btn.addEventListener("click", () => addObject(btn.dataset.insert));
});

document.querySelectorAll("[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    project.tool = btn.dataset.tool;
    updateToolButtons();
    persistSoon();
  });
});

playBtn.addEventListener("click", startPlayMode);
stopBtn.addEventListener("click", stopPlayMode);

saveBtn.addEventListener("click", () => {
  saveProject(project);
  appendLog({ message: "Project saved to LocalStorage.", isError: false, timestamp: Date.now() });
});

exportBtn.addEventListener("click", () => {
  exportProject(project);
});

importBtn.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;

  try {
    const imported = await importProjectFromFile(file);
    project = normalizeProject(imported);
    runtime?.stop?.();
    runtime = null;
    logs = [];
    refreshUI();
    saveProject(project);
    appendLog({ message: "Project imported successfully.", isError: false, timestamp: Date.now() });
  } catch (error) {
    appendLog({ message: `Import failed: ${error.message}`, isError: true, timestamp: Date.now() });
  } finally {
    importFile.value = "";
  }
});

zoomOutBtn.addEventListener("click", () => {
  project.camera.zoom = clamp(project.camera.zoom - 0.1, 0.2, 4);
  persistSoon();
});

zoomInBtn.addEventListener("click", () => {
  project.camera.zoom = clamp(project.camera.zoom + 0.1, 0.2, 4);
  persistSoon();
});

zoomResetBtn.addEventListener("click", () => {
  project.camera.zoom = 1;
  project.camera.rotation = 0;
  project.camera.x = 0;
  project.camera.z = 0;
  persistSoon();
});

rotateLeftBtn.addEventListener("click", () => {
  project.camera.rotation -= 10;
  persistSoon();
});

rotateRightBtn.addEventListener("click", () => {
  project.camera.rotation += 10;
  persistSoon();
});

closeScriptModalBtn.addEventListener("click", () => {
  closeScriptModal(scriptModal);
});

saveScriptBtn.addEventListener("click", saveScriptFromModal);

scriptModal.addEventListener("click", (e) => {
  if (e.target === scriptModal) {
    closeScriptModal(scriptModal);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Delete" && project.mode === "edit") {
    deleteSelected();
  }

  if (e.key === "Escape") {
    closeScriptModal(scriptModal);
  }
});

function boot() {
  resizeAndRender();
  refreshUI();
  saveProject(project);
  requestAnimationFrame(stepFrame);
}

boot();
