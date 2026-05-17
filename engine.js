export function uid(prefix = "node") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function deepClone(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

export function createNode(type, parentId = "workspace") {
  const id = uid(type.toLowerCase());

  const base = {
    id,
    type,
    parentId,
    children: [],
    name: type,
    visible: true,
  };

  if (type === "Part") {
    return {
      ...base,
      name: "Part",
      x: 0,
      y: 0,
      z: 0,
      sizeX: 4,
      sizeY: 2,
      sizeZ: 4,
      rotation: 0,
      color: "#4da3ff",
      anchored: true,
    };
  }

  if (type === "Script" || type === "LocalScript") {
    return {
      ...base,
      name: type,
      source:
`api.log("Running ${type}:", api.self.name);

api.onUpdate((dt) => {
  // Example script: rotate the selected object while the game is playing.
  if (api.self.type === "Part") {
    api.self.rotation = (api.self.rotation + dt * 18) % 360;
  }
});`,
    };
  }

  if (type === "RemoteEvent") {
    return {
      ...base,
      name: "RemoteEvent",
      eventName: "RemoteEvent",
    };
  }

  return base;
}

export function createProject() {
  return {
    version: 2,
    name: "Roblox Studio Lite Version 2 Mobile",
    mode: "edit",
    tool: "select",
    selectedId: null,
    camera: {
      x: 0,
      z: 0,
      zoom: 1,
      rotation: 0,
    },
    workspace: {
      id: "workspace",
      type: "Workspace",
      name: "Workspace",
      parentId: null,
      children: [],
    },
    nodes: {},
  };
}

export function normalizeProject(raw) {
  const project = createProject();

  if (!raw || typeof raw !== "object") return project;

  project.version = raw.version ?? 2;
  project.name = raw.name ?? project.name;
  project.mode = raw.mode === "play" ? "play" : "edit";
  project.tool = ["select", "move", "rotate", "scale"].includes(raw.tool) ? raw.tool : "select";
  project.selectedId = typeof raw.selectedId === "string" ? raw.selectedId : null;

  project.camera.x = Number(raw?.camera?.x ?? 0);
  project.camera.z = Number(raw?.camera?.z ?? 0);
  project.camera.zoom = clamp(Number(raw?.camera?.zoom ?? 1), 0.2, 4);
  project.camera.rotation = Number(raw?.camera?.rotation ?? 0);

  if (raw.workspace && Array.isArray(raw.workspace.children)) {
    project.workspace.children = [...raw.workspace.children];
  }

  if (raw.nodes && typeof raw.nodes === "object") {
    project.nodes = raw.nodes;
  }

  return project;
}

export function findNode(project, id) {
  if (!id || id === "workspace") return project.workspace;
  return project.nodes[id] ?? null;
}

export function addNode(project, node, parentId = "workspace") {
  const parent = findNode(project, parentId) ?? project.workspace;
  node.parentId = parent.id;
  project.nodes[node.id] = node;
  parent.children.push(node.id);
  return node;
}

export function removeNode(project, id) {
  const node = project.nodes[id];
  if (!node) return;

  for (const childId of [...node.children]) {
    removeNode(project, childId);
  }

  const parent = findNode(project, node.parentId) ?? project.workspace;
  parent.children = parent.children.filter((childId) => childId !== id);

  delete project.nodes[id];

  if (project.selectedId === id) {
    project.selectedId = null;
  }
}

export function setNodeProperty(project, id, prop, value) {
  const node = findNode(project, id);
  if (!node) return;

  node[prop] = value;
}

export function collectNodesDepthFirst(project) {
  const out = [];
  const visit = (id) => {
    const node = findNode(project, id);
    if (!node) return;
    out.push(node);
    for (const childId of node.children ?? []) {
      visit(childId);
    }
  };

  for (const childId of project.workspace.children) {
    visit(childId);
  }

  return out;
}

export function worldToScreen(worldX, worldZ, camera, canvasWidth, canvasHeight) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const zoom = camera.zoom;
  const r = degToRad(camera.rotation);
  const dx = worldX - camera.x;
  const dz = worldZ - camera.z;
  const rx = dx * Math.cos(r) - dz * Math.sin(r);
  const rz = dx * Math.sin(r) + dz * Math.cos(r);

  return {
    x: cx + rx * zoom,
    y: cy + rz * zoom,
  };
}

export function screenToWorld(screenX, screenY, camera, canvasWidth, canvasHeight) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const zoom = camera.zoom || 1;
  const r = degToRad(camera.rotation);
  const rx = (screenX - cx) / zoom;
  const rz = (screenY - cy) / zoom;

  const dx = rx * Math.cos(r) + rz * Math.sin(r);
  const dz = -rx * Math.sin(r) + rz * Math.cos(r);

  return {
    x: dx + camera.x,
    z: dz + camera.z,
  };
}

export function screenDeltaToWorldDelta(deltaX, deltaY, camera) {
  const zoom = camera.zoom || 1;
  const r = degToRad(camera.rotation);
  const rx = deltaX / zoom;
  const rz = deltaY / zoom;

  return {
    x: rx * Math.cos(r) + rz * Math.sin(r),
    z: -rx * Math.sin(r) + rz * Math.cos(r),
  };
}

export function hitTestPart(project, worldX, worldZ) {
  const nodes = collectNodesDepthFirst(project);

  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.type !== "Part" || node.visible === false) continue;

    const px = worldX - Number(node.x ?? 0);
    const pz = worldZ - Number(node.z ?? 0);
    const r = degToRad(Number(node.rotation ?? 0));
    const localX = px * Math.cos(-r) - pz * Math.sin(-r);
    const localZ = px * Math.sin(-r) + pz * Math.cos(-r);

    const halfX = Number(node.sizeX ?? 0) / 2;
    const halfZ = Number(node.sizeZ ?? 0) / 2;

    if (Math.abs(localX) <= halfX && Math.abs(localZ) <= halfZ) {
      return node.id;
    }
  }

  return null;
}

function drawGrid(ctx, camera, width, height) {
  const step = 32;
  const halfW = width / 2;
  const halfH = height / 2;
  const worldSpan = Math.ceil(Math.max(width, height) / step) + 20;

  ctx.save();
  ctx.translate(halfW, halfH);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.rotate(degToRad(camera.rotation));
  ctx.translate(-camera.x, -camera.z);

  const startX = Math.floor((camera.x - worldSpan * step) / step) * step;
  const endX = Math.ceil((camera.x + worldSpan * step) / step) * step;
  const startZ = Math.floor((camera.z - worldSpan * step) / step) * step;
  const endZ = Math.ceil((camera.z + worldSpan * step) / step) * step;

  ctx.lineWidth = 1 / camera.zoom;
  ctx.strokeStyle = "rgba(255,255,255,0.05)";

  for (let x = startX; x <= endX; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, startZ);
    ctx.lineTo(x, endZ);
    ctx.stroke();
  }

  for (let z = startZ; z <= endZ; z += step) {
    ctx.beginPath();
    ctx.moveTo(startX, z);
    ctx.lineTo(endX, z);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(77,163,255,0.28)";
  ctx.beginPath();
  ctx.moveTo(-100000, 0);
  ctx.lineTo(100000, 0);
  ctx.stroke();

  ctx.strokeStyle = "rgba(102,217,166,0.28)";
  ctx.beginPath();
  ctx.moveTo(0, -100000);
  ctx.lineTo(0, 100000);
  ctx.stroke();

  ctx.restore();
}

function drawPart(ctx, node, selected) {
  const x = Number(node.x ?? 0);
  const z = Number(node.z ?? 0);
  const sizeX = Number(node.sizeX ?? 2);
  const sizeZ = Number(node.sizeZ ?? 2);
  const rotation = degToRad(Number(node.rotation ?? 0));

  ctx.save();
  ctx.translate(x, z);
  ctx.rotate(rotation);

  ctx.fillStyle = node.color || "#4da3ff";
  ctx.fillRect(-sizeX / 2, -sizeZ / 2, sizeX, sizeZ);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(-sizeX / 2, -sizeZ / 2, sizeX, Math.max(0.35, sizeZ * 0.14));

  ctx.lineWidth = selected ? 0.25 : 0.15;
  ctx.strokeStyle = selected ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.28)";
  ctx.strokeRect(-sizeX / 2, -sizeZ / 2, sizeX, sizeZ);

  if (selected) {
    ctx.setLineDash([0.55, 0.35]);
    ctx.lineWidth = 0.2;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeRect(-sizeX / 2 - 0.1, -sizeZ / 2 - 0.1, sizeX + 0.2, sizeZ + 0.2);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawLabel(ctx, node) {
  const x = Number(node.x ?? 0);
  const z = Number(node.z ?? 0);
  const name = node.name || node.type;

  ctx.save();
  ctx.translate(x, z - Number(node.sizeZ ?? 2) / 2 - 0.8);
  ctx.scale(1, 1);
  ctx.fillStyle = "rgba(7,10,15,0.68)";
  const textWidth = Math.max(42, ctx.measureText(name).width + 12);
  ctx.fillRect(-textWidth / 2, -10, textWidth, 18);

  ctx.fillStyle = "#eef3ff";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 0, -1);
  ctx.restore();
}

export function renderScene(ctx, canvas, project) {
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, project.camera, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(project.camera.zoom, project.camera.zoom);
  ctx.rotate(degToRad(project.camera.rotation));
  ctx.translate(-project.camera.x, -project.camera.z);

  const nodes = collectNodesDepthFirst(project);
  for (const node of nodes) {
    if (node.visible === false) continue;
    if (node.type === "Part") {
      drawPart(ctx, node, project.selectedId === node.id && project.mode === "edit");
      drawLabel(ctx, node);
    }
  }

  ctx.restore();

  // HUD text
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText(
    `${project.mode === "play" ? "PLAY" : "EDIT"} • Tool: ${project.tool.toUpperCase()} • Objects: ${nodes.length}`,
    12,
    18
  );
  ctx.restore();
}
