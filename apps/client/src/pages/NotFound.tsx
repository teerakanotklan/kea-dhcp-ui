import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="page-wrapper min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full text-center p-8 sm:p-12 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Badge & Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-glow-indigo">
              <FileQuestion size={42} strokeWidth={1.75} />
            </div>
            <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-rose-500 text-white shadow-sm">
              404
            </span>
          </div>

          {/* Heading & Subtitle */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-8 leading-relaxed">
            The page you are looking for doesn't exist, was removed, or the link may be broken.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => navigate(-1)}
              className="btn btn-secondary w-full sm:w-auto min-w-[130px]"
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary w-full sm:w-auto min-w-[130px]"
            >
              <Home size={16} />
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
