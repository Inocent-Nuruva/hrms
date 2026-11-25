import type { Tone } from './StatusBadge';
import { formatTime, toMinutes } from './time';

type TimeLike = string | number | null | undefined;

type Props = {
  checkIn?: TimeLike;
  checkOut?: TimeLike;
  shiftStart?: TimeLike;
  shiftEnd?: TimeLike;
  /** Left and right edges of the bar. */
  dayStart?: TimeLike;
  dayEnd?: TimeLike;
  /** Current time. Pass it from a client hook so server and browser render the same. */
  now?: TimeLike;
  tone?: Tone;
  /** Show 06:00 / 12:00 / 20:00 under the bar (used in mobile cards). */
  showScale?: boolean;
};

/** Small bar showing when someone was in, against the shift window. */
export function ShiftTimeline({
  checkIn, checkOut, shiftStart = '08:00', shiftEnd = '17:00',
  dayStart = '06:00', dayEnd = '20:00', now, tone = 'ok', showScale,
}: Props) {
  const d0 = toMinutes(dayStart) ?? 360;
  const d1 = toMinutes(dayEnd) ?? 1200;
  const pct = (m: number) => `${Math.max(0, Math.min(100, ((m - d0) / (d1 - d0)) * 100)).toFixed(2)}%`;
  const s0 = toMinutes(shiftStart) ?? 480;
  const s1 = toMinutes(shiftEnd) ?? 1020;
  const cin = toMinutes(checkIn);
  const cout = toMinutes(checkOut);
  const nowM = toMinutes(now);
  const end = cout ?? nowM ?? cin;

  const label = cin == null
    ? 'No punches'
    : `In ${formatTime(cin)}, ${cout != null ? `out ${formatTime(cout)}` : 'still in'}`;

  const bar = (
    <div className={`v2-tl v2-tone-${tone}`} role="img" aria-label={label} title={label}>
      <div className="v2-tl-track" />
      <div className="v2-tl-shift" style={{ left: pct(s0), right: `calc(100% - ${pct(s1)})` }} />
      {cin != null && end != null && (
        <div
          className={`v2-tl-span${cout == null ? ' is-open' : ''}`}
          style={{ left: pct(cin), width: `calc(${pct(end)} - ${pct(cin)})` }}
        />
      )}
      {nowM != null && <div className="v2-tl-now" style={{ left: pct(nowM) }} />}
    </div>
  );

  if (!showScale) return bar;
  return (
    <div>
      {bar}
      <div className="v2-tl-scale">
        <span>{formatTime(d0)}</span>
        <span>{formatTime(Math.round((d0 + d1) / 2))}</span>
        <span>{formatTime(d1)}</span>
      </div>
    </div>
  );
}
