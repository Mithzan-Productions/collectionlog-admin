"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";

/**
 * Minecraft player head from api.mcheads.org.
 * Pixel-perfect rendering (no smoothing), sharp border, square.
 * Falls back to a generic icon if the API 404s (e.g. fake seed names).
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

  // The API serves at any requested size — fetch what we display to save bytes.
  const src = `https://api.mcheads.org/head/${encodeURIComponent(name)}/${size}`;

  return (
    <img
      src={src}
      alt={`${name} head`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className={"shrink-0 border border-[var(--color-rule-2)] bg-[var(--color-paper-2)] " + className}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  );
}
