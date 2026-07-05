"use client";

import { parseVideoUrl } from "@/lib/video";

export function VideoEmbed({ url }: { url: string }) {
  const parsed = parseVideoUrl(url);

  if (!parsed.embedUrl) {
    return (
      <a
        href={parsed.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        ▶ Watch video
      </a>
    );
  }

  return (
    <div className="space-y-1">
      <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={parsed.embedUrl}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      <a
        href={parsed.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-400 hover:text-indigo-600"
      >
        Open video in new tab ↗
      </a>
    </div>
  );
}
