import { useState } from "react";

type AvatarProps = { name: string; src?: string; size?: number };

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, src, size = 28 }: AvatarProps) {
  const [broken, setBroken] = useState<string>();

  if (src && broken !== src) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(src)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-muted-hover object-cover"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-muted-hover text-[10.5px] font-semibold text-muted-foreground"
    >
      {initials(name)}
    </div>
  );
}
