import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await axios.post('http://localhost:8000/api/auth/login', formData);
      login(res.data.access_token, res.data.role);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-zinc-800">
      <div className="w-full max-w-sm space-y-12">
        <div className="text-center space-y-4">
          <div className="text-3xl font-black uppercase tracking-[0.5em] text-white">
            AMAFah
          </div>
          <div className="text-[9px] font-bold uppercase tracking-[0.6em] text-zinc-500">
            Enterprise Warehouse Management
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Identity</label>
              <input
                type="email"
                placeholder="EMAIL ADDRESS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-stark w-full py-3"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Credential</label>
              <input
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-stark w-full py-3"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-400 text-center bg-red-500/5 py-2 border border-red-500/10 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-4 text-[11px] font-black uppercase tracking-[0.3em]"
          >
            {isLoading ? 'Authenticating...' : 'Access Terminal'}
          </button>
        </form>

        <div className="text-center">
          <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">
            Secure Enterprise Gateway • Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
}
