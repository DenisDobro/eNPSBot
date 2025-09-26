import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeMode, ThemePreference } from '../hooks/useThemePreference';
import { MoonIcon, SunIcon } from './icons';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Как в системе' },
];

interface ThemeToggleProps {
  theme: ThemeMode;
  preference: ThemePreference;
  onPreferenceChange: (value: ThemePreference) => void;
  align?: 'left' | 'right';
}

export default function ThemeToggle({
  theme,
  preference,
  onPreferenceChange,
  align = 'right',
}: ThemeToggleProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const themeLabel = useMemo(() => {
    if (preference === 'system') {
      return theme === 'dark' ? 'Как в системе · Тёмная' : 'Как в системе · Светлая';
    }

    return preference === 'dark' ? 'Тёмная' : 'Светлая';
  }, [preference, theme]);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const close = useCallback(
    (focusButton: boolean) => {
      setOpen(false);
      if (focusButton) {
        buttonRef.current?.focus({ preventScroll: true });
      }
    },
    [],
  );

  const handleSelect = useCallback(
    (value: ThemePreference) => {
      onPreferenceChange(value);
      close(true);
    },
    [close, onPreferenceChange],
  );

  const handleDocumentPointerDown = useCallback(
    (event: PointerEvent) => {
      if (!open) {
        return;
      }

      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      close(false);
    },
    [close, open],
  );

  const handleDocumentKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    },
    [close, open],
  );

  const handleDocumentFocus = useCallback(
    (event: FocusEvent) => {
      if (!open) {
        return;
      }

      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      close(false);
    },
    [close, open],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeyDown);
    document.addEventListener('focusin', handleDocumentFocus);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeyDown);
      document.removeEventListener('focusin', handleDocumentFocus);
    };
  }, [handleDocumentFocus, handleDocumentKeyDown, handleDocumentPointerDown, open]);

  const themeButtonLabel = useMemo(() => `Сменить тему. Сейчас: ${themeLabel}`, [themeLabel]);

  return (
    <div className={`theme-toggle${open ? ' theme-toggle--open' : ''}`}>
      <button
        type="button"
        className="theme-toggle__button icon-button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        ref={buttonRef}
        aria-label={themeButtonLabel}
        title={themeButtonLabel}
      >
        <span className="icon-button__glyph" aria-hidden="true">{theme === 'dark' ? <MoonIcon /> : <SunIcon />}</span>
      </button>
      {open && (
        <div
          className="theme-toggle__menu"
          role="listbox"
          ref={menuRef}
          style={align === 'left' ? { left: 0 } : { right: 0 }}
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={preference === option.value}
              className={
                preference === option.value
                  ? 'theme-toggle__option theme-toggle__option--active'
                  : 'theme-toggle__option'
              }
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
