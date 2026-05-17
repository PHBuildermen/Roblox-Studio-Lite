import { addNode, createNode, findNode, setNodeProperty } from "./engine.js";

function walkScriptNodes(project) {
  const result = [];

  const visit = (id) => {
    const node = findNode(project, id);
    if (!node) return;

    result.push(node);
    for (const childId of node.children ?? []) {
      visit(childId);
    }
  };

  for (const childId of project.workspace.children) {
    visit(childId);
  }

  return result;
}

export function createScriptRuntime(project, hooks = {}) {
  const runtime = {
    active: true,
    updaters: [],
    startedAt: performance.now(),
  };

  function logLine(message, isError = false) {
    hooks.onLog?.({
      message,
      isError,
      timestamp: Date.now(),
    });
  }

  function makeAPI(node) {
    return {
      project,
      self: node,
      log: (...args) => logLine(`[${node.name}] ${args.map(String).join(" ")}`),
      getObject: (id) => findNode(project, id),
      findByName: (name) => {
        const nodes = walkScriptNodes(project);
        return nodes.find((n) => n?.name === name) ?? null;
      },
      setProperty: (id, prop, value) => {
        setNodeProperty(project, id, prop, value);
        hooks.onChange?.();
      },
      createPart: (options = {}) => {
        const part = createNode("Part", node.id);
        Object.assign(part, options);
        addNode(project, part, node.id);
        hooks.onChange?.();
        return part;
      },
      onUpdate: (fn) => {
        if (typeof fn === "function") {
          runtime.updaters.push({ nodeId: node.id, fn });
        }
      },
      onError: (message) => logLine(String(message), true),
    };
  }

  function runNode(node) {
    if (!node || (node.type !== "Script" && node.type !== "LocalScript")) return;

    const code = String(node.source ?? "");
    try {
      const fn = new Function("api", `"use strict";\n${code}`);
      fn(makeAPI(node));
      logLine(`Executed ${node.type}: ${node.name}`);
    } catch (error) {
      logLine(`${node.name} error: ${error.message}`, true);
    }
  }

  function start() {
    runtime.active = true;
    runtime.updaters = [];

    const nodes = walkScriptNodes(project);
    for (const node of nodes) {
      runNode(node);
    }
  }

  function tick(dt) {
    if (!runtime.active) return;

    for (const entry of runtime.updaters) {
      const node = findNode(project, entry.nodeId);
      if (!node) continue;

      try {
        entry.fn(dt, node);
      } catch (error) {
        logLine(`${node.name} update error: ${error.message}`, true);
      }
    }
  }

  function stop() {
    runtime.active = false;
    runtime.updaters = [];
  }

  return {
    start,
    tick,
    stop,
  };
}
