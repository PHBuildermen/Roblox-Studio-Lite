import { findNode } from "./engine.js";

function makeField(labelText, contentEl) {
  const wrap = document.createElement("div");
  wrap.className = "property-group";

  const label = document.createElement("div");
  label.className = "property-label";
  label.textContent = labelText;

  wrap.appendChild(label);
  wrap.appendChild(contentEl);
  return wrap;
}

function numericInput(value, step = "0.1") {
  const input = document.createElement("input");
  input.type = "number";
  input.step = step;
  input.className = "property-input";
  input.value = String(value);
  return input;
}

export function renderExplorer(container, project, handlers) {
  container.innerHTML = "";

  const renderNode = (nodeId, depth = 0) => {
    const node = findNode(project, nodeId);
    if (!node) return;

    const item = document.createElement("button");
    item.className = `tree-item ${project.selectedId === node.id ? "selected" : ""}`;
    item.style.paddingLeft = `${12 + depth * 16}px`;

    const left = document.createElement("div");
    left.className = "tree-left";

    const name = document.createElement("div");
    name.className = "tree-name";
    name.textContent = node.name || node.type;

    const meta = document.createElement("div");
    meta.className = "tree-meta";
    meta.textContent = node.type;

    left.appendChild(name);
    left.appendChild(meta);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = node.children?.length ? `${node.children.length} children` : "leaf";

    item.appendChild(left);
    item.appendChild(badge);

    item.addEventListener("click", () => handlers.onSelect?.(node.id));
    item.addEventListener("dblclick", () => {
      if (node.type === "Script" || node.type === "LocalScript") {
        handlers.onOpenScript?.(node.id);
      }
    });

    container.appendChild(item);

    for (const childId of node.children ?? []) {
      renderNode(childId, depth + 1);
    }
  };

  const rootHeader = document.createElement("div");
  rootHeader.className = "tree-item selected";
  rootHeader.style.cursor = "default";
  rootHeader.style.opacity = "0.96";
  rootHeader.innerHTML = `
    <div class="tree-left">
      <div class="tree-name">Workspace</div>
      <div class="tree-meta">Root container</div>
    </div>
    <div class="badge">${project.workspace.children.length} children</div>
  `;
  container.appendChild(rootHeader);

  for (const childId of project.workspace.children) {
    renderNode(childId, 0);
  }
}

export function renderProperties(container, project, node, handlers) {
  container.innerHTML = "";

  if (!node || node.id === "workspace") {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Select an object in the Explorer or on the viewport to edit its properties.";
    container.appendChild(empty);
    return;
  }

  const nameInput = document.createElement("input");
  nameInput.className = "property-input";
  nameInput.value = node.name ?? "";
  nameInput.addEventListener("input", () => handlers.onPatch?.(node.id, { name: nameInput.value }));
  container.appendChild(makeField("Name", nameInput));

  const typeBox = document.createElement("input");
  typeBox.className = "property-input";
  typeBox.value = node.type;
  typeBox.disabled = true;
  container.appendChild(makeField("Type", typeBox));

  if (node.type === "Part") {
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "property-input property-color";
    colorInput.value = node.color || "#4da3ff";
    colorInput.addEventListener("input", () => handlers.onPatch?.(node.id, { color: colorInput.value }));
    container.appendChild(makeField("Color", colorInput));

    const posGrid = document.createElement("div");
    posGrid.className = "property-grid";

    const px = numericInput(node.x ?? 0);
    const py = numericInput(node.y ?? 0);
    const pz = numericInput(node.z ?? 0);

    px.addEventListener("input", () => handlers.onPatch?.(node.id, { x: Number(px.value) }));
    py.addEventListener("input", () => handlers.onPatch?.(node.id, { y: Number(py.value) }));
    pz.addEventListener("input", () => handlers.onPatch?.(node.id, { z: Number(pz.value) }));

    posGrid.appendChild(px);
    posGrid.appendChild(py);
    posGrid.appendChild(pz);

    container.appendChild(makeField("Position X / Y / Z", posGrid));

    const sizeGrid = document.createElement("div");
    sizeGrid.className = "property-grid";

    const sx = numericInput(node.sizeX ?? 4);
    const sy = numericInput(node.sizeY ?? 2);
    const sz = numericInput(node.sizeZ ?? 4);

    sx.addEventListener("input", () => handlers.onPatch?.(node.id, { sizeX: Math.max(0.25, Number(sx.value)) }));
    sy.addEventListener("input", () => handlers.onPatch?.(node.id, { sizeY: Math.max(0.25, Number(sy.value)) }));
    sz.addEventListener("input", () => handlers.onPatch?.(node.id, { sizeZ: Math.max(0.25, Number(sz.value)) }));

    sizeGrid.appendChild(sx);
    sizeGrid.appendChild(sy);
    sizeGrid.appendChild(sz);

    container.appendChild(makeField("Size X / Y / Z", sizeGrid));

    const rotInput = numericInput(node.rotation ?? 0, "1");
    rotInput.addEventListener("input", () => handlers.onPatch?.(node.id, { rotation: Number(rotInput.value) }));
    container.appendChild(makeField("Rotation (degrees)", rotInput));

    const anchoredRow = document.createElement("div");
    anchoredRow.className = "checkbox-row";

    const anchored = document.createElement("input");
    anchored.type = "checkbox";
    anchored.checked = Boolean(node.anchored);
    anchored.addEventListener("change", () => handlers.onPatch?.(node.id, { anchored: anchored.checked }));

    const anchoredLabel = document.createElement("label");
    anchoredLabel.textContent = "Anchored";

    anchoredRow.appendChild(anchored);
    anchoredRow.appendChild(anchoredLabel);
    container.appendChild(makeField("Physics", anchoredRow));
  }

  if (node.type === "Script" || node.type === "LocalScript") {
    const sourceArea = document.createElement("textarea");
    sourceArea.className = "property-textarea";
    sourceArea.value = node.source ?? "";
    sourceArea.readOnly = true;
    container.appendChild(makeField("Script Source", sourceArea));

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-primary";
    editBtn.textContent = "Open Script Editor";
    editBtn.addEventListener("click", () => handlers.onOpenScript?.(node.id));
    container.appendChild(editBtn);
  }

  if (node.type === "RemoteEvent") {
    const evInput = document.createElement("input");
    evInput.className = "property-input";
    evInput.value = node.eventName ?? "RemoteEvent";
    evInput.addEventListener("input", () => handlers.onPatch?.(node.id, { eventName: evInput.value }));
    container.appendChild(makeField("Event Name", evInput));
  }

  const childInfo = document.createElement("div");
  childInfo.className = "hint";
  childInfo.textContent = `Children: ${node.children?.length ?? 0}`;
  container.appendChild(childInfo);
}

export function renderConsole(container, logs) {
  container.innerHTML = "";
  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No output yet.";
    container.appendChild(empty);
    return;
  }

  for (const entry of logs.slice(-100).reverse()) {
    const line = document.createElement("div");
    line.className = `console-line ${entry.isError ? "error" : ""}`;
    line.textContent = entry.message;
    container.appendChild(line);
  }
}

export function openScriptModal(modalEl, titleEl, subtitleEl, editorEl, node) {
  titleEl.textContent = `${node.type} Editor`;
  subtitleEl.textContent = node.name || node.type;
  editorEl.value = node.source ?? "";
  modalEl.classList.remove("hidden");
  modalEl.setAttribute("aria-hidden", "false");
  editorEl.focus();
}

export function closeScriptModal(modalEl) {
  modalEl.classList.add("hidden");
  modalEl.setAttribute("aria-hidden", "true");
}
