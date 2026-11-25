'use client';

import { Icon } from './icons';

export type PunchStatus = 'ready' | 'in' | 'done';

/** Check-in / check-out block for the top bar. Wire onCheckIn/onCheckOut to your attendance API. */
export function CheckInPanel({ status, time, onCheckIn, onCheckOut, busy }: {
  status: PunchStatus;
  /** Check-in time when status is "in", check-out time when "done". */
  time?: string;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  busy?: boolean;
}) {
  const title = status === 'ready' ? 'Ready to start' : status === 'in' ? 'Checked in' : 'Day complete';
  const sub = status === 'ready' ? 'No check-in yet' : status === 'in' ? `Since ${time ?? ''}` : `Checked out${time ? ` at ${time}` : ''}`;

  return (
    <div className="v2-punch" data-state={status}>
      <div className="v2-punch-state">
        <b><i className="v2-pdot" />{title}</b>
        <small>{sub}</small>
      </div>
      <button type="button" className="v2-pbtn v2-pbtn--in" disabled={status !== 'ready' || busy} onClick={onCheckIn}>
        <Icon name="login" size={16} /><span className="v2-pt">Check in</span>
      </button>
      <button type="button" className="v2-pbtn v2-pbtn--out" disabled={status !== 'in' || busy} onClick={onCheckOut}>
        <Icon name="logout" size={16} /><span className="v2-pt">Check out</span>
      </button>
    </div>
  );
}
