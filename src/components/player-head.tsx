"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";

/**
 * Minecraft player head from api.mcheads.org, proxied through next/image so
 * Vercel's CDN caches the optimized variant. Once a head has been fetched
 * successfully it keeps rendering even when the upstream API is rate-limited
 * or down.
 *
 * Pixel-perfect rendering (no smoothing), sharp border, square.
 * Falls back to a generic icon on first-load failure (404 / timeout / etc).
 */
export function PlayerHead({
  name,
  size = 32,
  className = "",
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!name || errored) {
    return (
      <div
        className={
          "flex shrink-0 items-center justify-center border border-[var(--color-rule-2)] bg-[var(--color-paper-2)] text-[var(--color-fg-dim)] " +
          className
        }
        style={{ width: size, height: size }}
        aria-hidden
      >
        <UserRound style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
    );
  }

  // Request the exact display size from mcheads.org so the upstream payload —
  // and the cached variant — stays small.
  const src = `https://api.mcheads.org/head/${encodeURIComponent(name)}/${size}`;

  return (
    <Image
      src={src}
      alt={`${name} head`}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={"shrink-0 border border-[var(--color-rule-2)] bg-[var(--color-paper-2)] " + className}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}
