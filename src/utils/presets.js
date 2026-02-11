const STORAGE_KEY = 'visuefect-presets-v1';

export function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (e) { console.warn('loadPresets failed', e); return []; }
}

export function savePreset(preset) {
  try {
    const list = loadPresets();
    const id = preset.id || `preset-${Date.now()}`;
    const p = { ...preset, id };
    const next = [p, ...list.filter(x => x.id !== id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return p;
  } catch (e) { console.warn('savePreset failed', e); return null; }
}

export function removePreset(id) {
  try {
    const list = loadPresets().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) { console.warn('removePreset failed', e); return false; }
}

export function clearPresets() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

export default { loadPresets, savePreset, removePreset, clearPresets };