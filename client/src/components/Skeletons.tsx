import React from 'react';

// Dashboard Skeleton Shimmer
export function DashboardSkeleton() {
  return (
    <div className="page-wrapper space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton-bar w-64 h-7" />
          <div className="skeleton-bar w-96 h-4" />
        </div>
      </div>

      {/* Dual Service Status Banner Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card p-5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-white/10 animate-pulse shrink-0" />
              <div className="space-y-2">
                <div className="skeleton-bar w-36 h-4" />
                <div className="skeleton-bar w-48 h-3" />
              </div>
            </div>
            <div className="skeleton-bar w-20 h-8 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-5 border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton-bar w-24 h-3" />
              <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-white/10 animate-pulse" />
            </div>
            <div className="skeleton-bar w-20 h-8" />
            <div className="skeleton-bar w-full h-2 rounded-full" />
          </div>
        ))}
      </div>

      {/* Activity Table Skeleton */}
      <div className="glass-card p-5 border border-slate-200/80 dark:border-white/10 space-y-4">
        <div className="skeleton-bar w-44 h-5" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-bar w-full h-4" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Form Skeleton Shimmer (ScopeForm & StaticIPForm)
export function FormSkeleton() {
  return (
    <div className="page-wrapper max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header Skeleton */}
      <div className="space-y-2 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div className="skeleton-bar w-56 h-7" />
        <div className="skeleton-bar w-80 h-4" />
      </div>

      {/* Form Fields Skeleton */}
      <div className="glass-card p-6 border border-slate-200/80 dark:border-white/10 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="skeleton-bar w-24 h-3" />
            <div className="skeleton-bar w-full h-10 rounded-lg" />
          </div>
          <div className="space-y-2">
            <div className="skeleton-bar w-28 h-3" />
            <div className="skeleton-bar w-full h-10 rounded-lg" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="skeleton-bar w-32 h-3" />
          <div className="skeleton-bar w-full h-10 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="skeleton-bar w-28 h-3" />
            <div className="skeleton-bar w-full h-10 rounded-lg" />
          </div>
          <div className="space-y-2">
            <div className="skeleton-bar w-28 h-3" />
            <div className="skeleton-bar w-full h-10 rounded-lg" />
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80 dark:border-white/10">
          <div className="skeleton-bar w-24 h-9 rounded-lg" />
          <div className="skeleton-bar w-32 h-9 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Settings Skeleton Shimmer
export function SettingsSkeleton() {
  return (
    <div className="page-wrapper space-y-6 animate-fadeIn">
      <div className="space-y-2">
        <div className="skeleton-bar w-72 h-7" />
        <div className="skeleton-bar w-96 h-4" />
      </div>

      <div className="glass-card p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
        <div className="skeleton-bar w-40 h-5" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="skeleton-bar w-full h-24 rounded-xl" />
          <div className="skeleton-bar w-full h-24 rounded-xl" />
        </div>
      </div>

      <div className="glass-card p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
        <div className="skeleton-bar w-48 h-5" />
        <div className="space-y-3">
          <div className="skeleton-bar w-full h-10 rounded-lg" />
          <div className="skeleton-bar w-full h-10 rounded-lg" />
          <div className="skeleton-bar w-full h-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
