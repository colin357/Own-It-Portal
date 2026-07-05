import type { VideoProvider } from "./types";

export interface ParsedVideo {
  provider: VideoProvider;
  embedUrl: string | null;
  originalUrl: string;
}

export function parseVideoUrl(url: string): ParsedVideo {
  const trimmed = url.trim();

  const loom = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loom) {
    return {
      provider: "loom",
      embedUrl: `https://www.loom.com/embed/${loom[1]}`,
      originalUrl: trimmed,
    };
  }

  const drive = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (drive) {
    return {
      provider: "gdrive",
      embedUrl: `https://drive.google.com/file/d/${drive[1]}/preview`,
      originalUrl: trimmed,
    };
  }

  const openDrive = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openDrive) {
    return {
      provider: "gdrive",
      embedUrl: `https://drive.google.com/file/d/${openDrive[1]}/preview`,
      originalUrl: trimmed,
    };
  }

  const yt = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  if (yt) {
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
      originalUrl: trimmed,
    };
  }

  return { provider: "other", embedUrl: null, originalUrl: trimmed };
}
