'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { Icon } from './icons';

export type ToolItem = {
  key: string;
  label: string;
  /** Keep your existing icon here; its color is set with `color`. */
  icon: ReactNode;
  color?: string;
  onClick?: () => void;
  /** Small green dot (e.g. language synced). */
  dot?: boolean;
};

export type ShellUser = { name: string; role?: string; initials?: string; avatarUrl?: string | null };

export type TopbarProps = {
  onMenu: () => void;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  /** Usually <CheckInPanel />. */
  checkIn?: ReactNode;
  showClock?: boolean;
  tools?: ToolItem[];
  notifications?: { count?: number; onClick?: () => void };
  user: ShellUser;
  /** Contents of the account menu (links, sign out…). */
  userMenu?: ReactNode;
};

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="v2-tb-clock" aria-live="off">
      <b>{now ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '\u00a0'}</b>
      <span>{now ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '\u00a0'}</span>
    </div>
  );
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

export function Topbar({
  onMenu, searchPlaceholder = 'Search HRMS', onSearch, checkIn, showClock = true,
  tools = [], notifications, user, userMenu,
}: TopbarProps) {
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { open: moreOpen, setOpen: setMoreOpen, ref: moreRef } = usePopover();
  const { open: meOpen, setOpen: setMeOpen, ref: meRef } = usePopover();

  // Ctrl + / focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setSearching(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className={cn('v2-tb', searching && 'is-searching')}>
      <button type="button" className="v2-icon-btn v2-tb-menu" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" size={20} />
      </button>

      <form className="v2-tb-search" role="search" onSubmit={(e) => { e.preventDefault(); onSearch?.(q); }}>
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => setSearching(false)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
        <kbd className="v2-kbd">Ctrl /</kbd>
      </form>

      <div className="v2-spacer" />

      <button
        type="button"
        className="v2-icon-btn v2-tb-search-btn"
        aria-label="Search"
        onClick={() => { setSearching(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <Icon name="search" size={19} />
      </button>

      {checkIn}
      {showClock && <Clock />}

      {tools.length > 0 && (
        <div className="v2-tools">
          {tools.map((t) => (
            <button key={t.key} type="button" className="v2-icon-btn" style={t.color ? { color: t.color } : undefined} onClick={t.onClick} aria-label={t.label} title={t.label}>
              {t.icon}
              {t.dot && <span className="v2-dot" />}
            </button>
          ))}
        </div>
      )}

      {tools.length > 0 && (
        <div className="v2-pop-wrap v2-more" ref={moreRef}>
          <button type="button" className="v2-icon-btn" aria-label="More tools" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
            <Icon name="more" size={20} />
          </button>
          {moreOpen && (
            <div className="v2-pop" role="menu">
              {tools.map((t) => (
                <button key={t.key} type="button" role="menuitem" className="v2-pop-item" style={t.color ? { color: t.color } : undefined} onClick={() => { t.onClick?.(); setMoreOpen(false); }}>
                  {t.icon}<span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button type="button" className="v2-icon-btn" style={{ color: '#E8891C' }} onClick={notifications?.onClick} aria-label={`Notifications${notifications?.count ? `, ${notifications.count} new` : ''}`}>
        <Icon name="bell" size={20} />
        {!!notifications?.count && <span className="v2-badge-n">{notifications.count > 99 ? '99+' : notifications.count}</span>}
      </button>

      <div className="v2-pop-wrap" ref={meRef}>
        <button type="button" className="v2-me" aria-label="Your account" aria-expanded={meOpen} onClick={() => setMeOpen((o) => !o)}>
          <span className="v2-me-ava">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.initials ?? initialsOf(user.name))}</span>
          <span className="v2-me-t"><b>{user.name}</b>{user.role && <small>{user.role}</small>}</span>
          <Icon name="down" size={15} />
        </button>
        {meOpen && userMenu && (
          <div className="v2-pop" role="menu" onClick={() => setMeOpen(false)}>
            <div className="v2-pop-head"><b>{user.name}</b>{user.role && <small>{user.role}</small>}</div>
            {userMenu}
          </div>
        )}
      </div>
    </header>
  );
}
