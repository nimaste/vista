"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  size?: number;
  showText?: boolean;
  className?: string;
};

// Primary: /vista-icon.png (user-provided).
// Fallback: /vista-icon.svg (generated).
const SOURCES = ["/vista-icon.png", "/vista-icon.svg"];

export const Logo = ({ size = 40, showText = true, className }: Props) => {
  const [idx, setIdx] = useState(0);
  const src = SOURCES[idx];

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {src ? (
        <Image
          src={src}
          alt="Vista"
          width={size}
          height={size}
          priority
          unoptimized
          className="shrink-0"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : null}
      {showText ? <span className="text-lg font-semibold tracking-tight">Vista</span> : null}
    </span>
  );
};
