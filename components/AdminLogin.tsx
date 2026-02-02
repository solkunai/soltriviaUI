import React, { useState } from 'react';

interface AdminLoginProps {
  onLogin: (username: string, password: string) => boolean;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Small delay to prevent brute force
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = onLogin(username, password);
    
    if (!success) {
      setError('Invalid credentials');
      setPassword('');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
      <div className="w-full max-w-md bg-[#0D0D0D] border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-[1000] italic uppercase tracking-tighter text-white mb-2">
            ADMIN <span className="text-[#14F195]">DASHBOARD</span>
          </h1>
          <div className="h-0.5 w-16 bg-[#14F195] opacity-30 mx-auto"></div>
          <p className="text-zinc-400 text-sm mt-4 font-black uppercase tracking-wider">
            Secure Access Only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-zinc-300 text-xs font-black uppercase tracking-wider mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#14F195]/50 transition-all"
              placeholder="Enter username"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-zinc-300 text-xs font-black uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-[#14F195]/50 transition-all"
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-xs font-black uppercase text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#14F195] hover:bg-[#14F195]/90 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-[1000] text-lg italic uppercase tracking-tighter shadow-[0_0_30px_rgba(20,241,149,0.4)] active:scale-95 transition-all rounded-lg disabled:cursor-not-allowed"
          >
            {loading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </form>

        <p className="text-[8px] text-zinc-600 text-center font-black uppercase tracking-[0.2em] mt-6 italic">
          Authorized Personnel Only
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
