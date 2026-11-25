import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost';
  /** Highlighted "on" state, e.g. a toggled Filters button. */
  active?: boolean;
  icon?: ReactNode;
  /** Small count shown after the label. */
  badge?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', active, icon, badge, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('v2-btn', variant !== 'default' && `v2-btn--${variant}`, active && 'v2-btn--on', className)}
      {...rest}
    >
      {icon}
      {children}
      {badge != null && badge !== 0 && <span className="v2-n">{badge}</span>}
    </button>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Accessible name (also shown as a tooltip). */
  label: string;
  /** Small status dot in the corner (pass a color, or true for green). */
  dot?: string | boolean;
  /** Red count bubble, e.g. unread notifications. */
  count?: number;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, dot, count, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn('v2-icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
      {dot && <span className="v2-dot" style={typeof dot === 'string' ? { background: dot } : undefined} />}
      {!!count && <span className="v2-badge-n">{count > 99 ? '99+' : count}</span>}
    </button>
  );
});
