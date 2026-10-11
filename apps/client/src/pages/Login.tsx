import React, { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Server, Lock, User as UserIcon, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export function Login() {
  const { user, login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to callbackUrl immediately
  useEffect(() => {
    if (user) {
      navigate(callbackUrl, { replace: true });
    }
  }, [user, callbackUrl, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate(callbackUrl, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-[#070a13] select-none">
      {/* Background glowing gradients & tech mesh */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-[120px] -top-32 -left-32 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-[120px] -bottom-32 -right-32 pointer-events-none" />

      {/* Cyber ambient grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="glass-card max-w-md w-full p-6 sm:p-10 shadow-2xl relative z-10 border border-slate-200/90 dark:border-white/10 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl">
        {/* Header with Glowing Icon */}
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-glow-indigo">
              <Activity size={32} />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1">
            Kea DHCP Server
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
            Sign in to access Web Management Console
          </p>

          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
            <ShieldCheck size={14} />
            <span>Secure Administrative Portal</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="relative">
              <input
                type="text"
                className="input-text pl-10 text-sm"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
              <UserIcon
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="relative">
              <input
                type="password"
                className="input-text pl-10 text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Lock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 text-sm font-bold mt-2 shadow-glow-indigo"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In as Administrator'}
            <ArrowRight size={17} />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-white/[0.08] text-center text-[11px] text-slate-400 dark:text-slate-500">
          Kea DHCP Web Console • Production Session Protected
        </div>
      </div>
    </div>
  );
}

export default Login;
