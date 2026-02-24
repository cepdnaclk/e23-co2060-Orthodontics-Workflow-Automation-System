import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Card } from '../components/UI';
import { Lock, Mail } from 'lucide-react';
import { useNavigate, Navigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const bgImage = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=2000";

  const ToothLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path 
        d="M50 15C35 15 25 25 25 40C25 55 35 65 35 85C40 85 45 80 50 80C55 80 60 85 65 85C65 65 75 55 75 40C75 25 65 15 50 15Z" 
        fill="currentColor" 
      />
      <path 
        d="M42 28C40 28 38 30 38 32C38 34 40 36 42 36C44 36 46 34 46 32C46 30 44 28 42 28Z" 
        fill="white" 
        fillOpacity="0.4"
      />
      <path 
        d="M50 20C40 20 32 28 32 40" 
        stroke="white" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeOpacity="0.2"
      />
    </svg>
  );

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Layer with Blur */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback 
          src={bgImage} 
          alt="Modern Dental Hospital" 
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-slate-900/40" />
      </div>

      {/* Centered Login Portal Card */}
      <Card className="relative z-10 w-full max-w-md p-8 shadow-2xl bg-white/95 backdrop-blur-sm border-t-4 border-t-blue-600 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          {/* Tooth Logo - Centered in Card */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl transform hover:rotate-3 transition-transform duration-300">
              <ToothLogo className="w-14 h-14" />
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">OrthoFlow</h1>
          <p className="text-gray-500 mt-2 font-medium">University Dental Hospital Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Clinical Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <Input
                type="email"
                placeholder="doctor@hospital.edu"
                className="pl-10 h-12 border-gray-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Password</label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <Input
                type="password"
                placeholder="••••••••"
                className="pl-10 h-12 border-gray-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-100 text-xs text-red-600 font-bold">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700" disabled={isLoading || authLoading}>
            {isLoading || authLoading ? 'Signing In...' : 'Sign In to Portal'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-2">
            Authorized Personnel Only
          </p>
          <p className="text-[10px] text-gray-400 leading-relaxed max-w-[280px] mx-auto">
            Secure clinical gateway. By logging in, you agree to HIPAA compliance protocols.
          </p>
        </div>
      </Card>
    </div>
  );
}
