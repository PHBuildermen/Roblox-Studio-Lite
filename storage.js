import { createProject, normalizeProject, deepClone } from "./engine.js";

const STORAGE_KEY = "roblox_studio_lite_v2_mobile_project";

export function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createProject();
    return normalizeProject(JSON.parse(raw));
  } catch {
    return createProject();
  }
}

export function saveProject(project) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function clearSavedProject() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportProject(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roblox-studio-lite-project.json";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importProjectFromFile(file) {
  const text = await file.text();
  return normalizeProject(JSON.parse(text));
}

export function cloneProject(project) {
  return deepClone(project);
}
