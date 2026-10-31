import { validateClip, type SavedClip } from "./clip";

const KEY = "cuttertube.library.v1";
export const LIBRARY_EVENT = "cuttertube:library";

export function readLibrary(): SavedClip[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedClip => Boolean(
      item && typeof item === "object" && typeof item.id === "string" && typeof item.savedAt === "string" &&
      typeof item.videoId === "string" && typeof item.title === "string" && typeof item.note === "string" && !validateClip(item),
    )).slice(0, 100);
  } catch { return []; }
}

export function saveToLibrary(clip: SavedClip): void {
  const next = [clip, ...readLibrary().filter((item) => item.id !== clip.id)].slice(0, 100);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(LIBRARY_EVENT));
}

export function removeFromLibrary(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(readLibrary().filter((item) => item.id !== id)));
  window.dispatchEvent(new Event(LIBRARY_EVENT));
}
