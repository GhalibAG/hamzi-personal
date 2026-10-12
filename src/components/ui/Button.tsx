// Button & IconButton (DESIGN-SYSTEM §5). Radius pill, target ≥ 44 px (kecuali ukuran mini di dalam baris).
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '@/lib/cx';

export type ButtonVariant =
  | 'primary' | 'outline-primary' | 'soft' | 'secondary' | 'outline-soft' | 'outline-kuliah' | 'kuliah'
  | 'danger-outline' | 'danger' | 'info' | 'ghost' | 'disabled';
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  'outline-primary': 'border-2 border-primary bg-surface text-primary',
  soft: 'bg-primary-soft text-on-primary-soft',
  secondary: 'border border-line-strong bg-surface text-ink-muted hover:bg-surface-2',
  'outline-soft': 'border border-brand-200 bg-surface text-brand-800 hover:bg-primary-soft',
  'outline-kuliah': 'border border-kuliah-line bg-surface text-kuliah-deep',
  kuliah: 'bg-kuliah-hero text-on-primary hover:bg-kuliah-deep',
  'danger-outline': 'border border-danger-line bg-surface text-danger-fg',
  danger: 'bg-danger-fg text-on-primary',
  info: 'bg-info-fg text-on-primary',
  ghost: 'bg-transparent text-primary hover:bg-primary-soft',
  disabled: 'bg-line-strong text-ink-3',
};
const SIZE: Record<ButtonSize, string> = {
  lg: 'h-14 px-6 text-section font-extrabold',
  md: 'h-11 px-4.5 text-body font-extrabold',
  sm: 'h-10 px-4 text-label font-bold',
  xs: 'h-9 px-3 text-label font-bold',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, icon, className, disabled, children, type = 'button', ...rest }, ref,
) {
  const v = disabled && (variant === 'primary' || variant === 'kuliah') ? 'disabled' : variant;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full transition-colors duration-150',
        VARIANT[v], SIZE[size], block && 'w-full', disabled && v !== 'disabled' && 'opacity-50', className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

/** Tautan bergaya tombol. */
export function ButtonLink({ variant = 'primary', size = 'md', block, className, children, ...rest }: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean }) {
  return (
    <Link
      className={cx('inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full no-underline transition-colors', VARIANT[variant], SIZE[size], block && 'w-full', className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'default' | 'onHeader' | 'plain' | 'soft';
  size?: number;
}

/** Tombol ikon bulat 44 px. `label` wajib (aria-label). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'default', className, children, type = 'button', ...rest }, ref,
) {
  const tone = {
    default: 'border border-line bg-surface text-ink-muted hover:bg-surface-2',
    onHeader: 'bg-white-16 text-on-primary',
    plain: 'bg-transparent text-ink-muted hover:bg-surface-2',
    soft: 'bg-surface-2 text-ink-muted',
  }[variant];
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={cx('relative inline-flex size-11 shrink-0 items-center justify-center rounded-full', tone, className)} {...rest}>
      {children}
    </button>
  );
});
