import React, { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'soltrivia_gate_unlocked';

const gatePassword = typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_GATE_PASSWORD as string);
const isGateEnabled = Boolean(gatePassword && gatePassword.trim().length > 0);

export function isGateUnlocked(): boolean {
  if (!isGateEnabled) return true;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGateUnlocked(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch (_) {}
}

export function requireGate(): boolean {
  return isGateEnabled;
}

interface PasswordGateProps {
  children: React.ReactNode;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checkDone, setCheckDone] = useState(false);

  useEffect(() => {
    setCheckDone(true);
    setUnlocked(isGateUnlocked());
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const trimmed = gatePassword?.trim() ?? '';
      if (trimmed && password.trim() === trimmed) {
        setGateUnlocked();
        setUnlocked(true);
      } else {
        setError('Incorrect password.');
      }
    },
    [password]
  );

  if (!checkDone) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#14F195] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isGateEnabled || unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/40 p-8 shadow-xl">
        <h1 className="text-xl font-black uppercase tracking-tight text-center mb-2">SOL Trivia</h1>
        <p className="text-zinc-400 text-sm text-center mb-6">Enter the platform password to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
            autoComplete="current-password"
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#14F195]/50 focus:border-[#14F195]"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-[#14F195] text-black font-bold uppercase tracking-wider hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#14F195] focus:ring-offset-2 focus:ring-offset-[#050505]"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordGate;
