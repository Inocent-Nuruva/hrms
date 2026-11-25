import type { ReactNode } from 'react';
import { cn } from './cn';

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}
function colorIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 6;
}

export function Avatar({ name, src, size = 32, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn('v2-ava', `v2-ava-${colorIndex(name)}`, className)}
      style={size !== 32 ? { width: size, height: size } : undefined}
    >
      {src ? <img src={src} alt="" /> : initialsOf(name)}
    </span>
  );
}

/** Avatar + name + a muted second line (ID, department…). */
export function EmployeeCell({ name, meta, avatarUrl }: { name: string; meta?: ReactNode; avatarUrl?: string | null }) {
  return (
    <div className="v2-who">
      <Avatar name={name} src={avatarUrl} />
      <div style={{ minWidth: 0 }}>
        <b>{name}</b>
        {meta && <small>{meta}</small>}
      </div>
    </div>
  );
}
