import React, { useState, useRef, useEffect, ComponentType } from 'react';
import { MoreHorizontal, LucideProps } from 'lucide-react';

export interface ActionDropdownItem {
  label?: string;
  icon?: ComponentType<LucideProps>;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface ActionDropdownProps {
  items?: (ActionDropdownItem | false | null | undefined)[];
  align?: 'right' | 'left';
}

export function ActionDropdown({ items = [], align = 'right' }: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const visibleItems = items.filter(Boolean) as ActionDropdownItem[];

  if (visibleItems.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        className="btn-icon w-8 h-8 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors flex items-center justify-center border border-slate-200/80 dark:border-white/10"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        title="Actions"
      >
        <MoreHorizontal size={16} className="text-slate-600 dark:text-slate-300" />
      </button>

      {open && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 backdrop-blur-md`}
          onClick={(e) => e.stopPropagation()}
        >
          {visibleItems.map((item, index) => {
            if (item.separator) {
              return (
                <div
                  key={`sep-${index}`}
                  className="my-1 border-t border-slate-100 dark:border-white/5"
                />
              );
            }

            const Icon = item.icon;
            return (
              <button
                key={item.label || index}
                type="button"
                disabled={item.disabled}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                  item.danger
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                  setOpen(false);
                  if (item.onClick) item.onClick();
                }}
              >
                {Icon && (
                  <Icon
                    size={14}
                    className={
                      item.danger
                        ? 'text-rose-500 shrink-0'
                        : 'text-slate-400 dark:text-slate-500 shrink-0'
                    }
                  />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
