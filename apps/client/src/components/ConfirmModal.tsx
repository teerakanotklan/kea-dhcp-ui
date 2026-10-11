import React, { useEffect, useId, useRef, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, CheckCircle2, X, LucideProps } from 'lucide-react';

export type ModalVariant = 'danger' | 'warning' | 'primary';

interface VariantStyle {
  icon: ComponentType<LucideProps>;
  box: string;
  btn: string;
}

const VARIANTS: Record<ModalVariant, VariantStyle> = {
  danger: {
    icon: Trash2,
    box: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    btn: 'btn-danger',
  },
  warning: {
    icon: AlertTriangle,
    box: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    btn: 'btn-warning',
  },
  primary: {
    icon: CheckCircle2,
    box: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    btn: 'btn-primary',
  },
};

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  loadingText?: string;
  loading?: boolean;
  variant?: ModalVariant;
  danger?: boolean;
  icon?: ComponentType<LucideProps>;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Deletion',
  message = 'Are you sure you want to proceed? This action cannot be undone.',
  confirmText = 'Delete',
  loadingText = 'Processing...',
  loading = false,
  variant,
  danger = true,
  icon,
}: ConfirmModalProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // `danger` prop kept for backward compatibility
  const resolved: ModalVariant = variant || (danger ? 'danger' : 'warning');
  const styles = VARIANTS[resolved] || VARIANTS.danger;
  const Icon = icon || styles.icon;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    // Focus Cancel for destructive actions to avoid accidental confirmation
    const target = resolved === 'danger' ? cancelRef.current : confirmRef.current;
    target?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading, resolved]);

  if (!isOpen) return null;

  // Render the modal using a portal so it sits at the top of the DOM hierarchy
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="glass-card max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${styles.box}`}>
            <Icon size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p id={descId} className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed break-words">
              {message}
            </p>
          </div>

          <button
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80 dark:border-white/10">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary text-xs sm:text-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn text-xs sm:text-sm ${styles.btn}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? loadingText : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
