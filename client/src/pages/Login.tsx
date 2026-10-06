import React, { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Server, Lock, User as UserIcon, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50 dark:bg-[#070a13]">
      {/* Background glowing orbs */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-[100px] -top-20 -left-20 pointer-events-none" />
      <div className="absolute w-[450px] h-[450px] rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 blur-[100px] -bottom-20 -right-20 pointer-events-none" />

      <div className="glass-card max-w-md w-full p-6 sm:p-10 shadow-xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 inline-flex items-center justify-center text-white shadow-glow-indigo mb-4">
            <Server size={28} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-1.5">
            Kea DHCP Server
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Sign in to access Web Management Console
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="relative">
              <input
                type="text"
                className="input-text pl-10"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <UserIcon
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="relative">
              <input
                type="password"
                className="input-text pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full py-3 text-sm font-semibold mt-2"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In as Administrator'}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
