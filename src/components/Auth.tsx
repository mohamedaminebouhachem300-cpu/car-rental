import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { dbService } from '../services/db';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Lock, Phone, ArrowRight, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { authSchema, RateLimiter, SecurityLogger } from '../services/security';
import { serverTimestamp } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phoneNumber: ''
  });

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        // Check if user profile exists, if not create it
        const existingProfile = await dbService.getDocument('users', result.user.uid);
        if (!existingProfile) {
          await dbService.setDocument('users', result.user.uid, {
            id: result.user.uid,
            email: result.user.email || '',
            full_name: result.user.displayName || '',
            phone_number: result.user.phoneNumber || '',
            role: 'user',
            created_at: serverTimestamp()
          });
        }
      }
      navigate('/fleet');
    } catch (error: any) {
      toast.error(error.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      toast.error('Please enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, formData.email);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate Limiting: 5 attempts per minute
    if (!RateLimiter.check('auth_attempt', 5, 60000)) {
      toast.error('Too many attempts. Please wait a minute.');
      return;
    }

    // Input Validation
    const validation = authSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        toast.success('Welcome back to LuxeDrive!');
      } else {
        const result = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        if (result.user) {
          await updateProfile(result.user, {
            displayName: formData.fullName
          });

          // Send verification email
          await sendEmailVerification(result.user);
          toast.info('Verification email sent! Please verify your account.');

          // Save user profile to Firestore 'users' collection
          await dbService.setDocument('users', result.user.uid, {
            id: result.user.uid,
            email: result.user.email || '',
            full_name: formData.fullName,
            phone_number: formData.phoneNumber,
            role: 'user',
            created_at: serverTimestamp()
          });
        }

        toast.success('Account created successfully!');
      }
      navigate('/fleet');
    } catch (error: any) {
      SecurityLogger.log('AUTH_FAILURE', { email: formData.email, error: error.message });
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-24">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass w-full max-w-md p-8 rounded-2xl"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tighter mb-2 uppercase">
            {isLogin ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
          </h2>
          <p className="text-white/60">
            {isLogin ? 'Sign in to access your premium fleet.' : 'Join the elite circle of LuxeDrive members.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input 
                type="text" 
                placeholder="Full Name" 
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-electric-blue transition-colors"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input 
              type="email" 
              placeholder="Email Address" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-electric-blue transition-colors"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {!isLogin && (
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input 
                type="tel" 
                placeholder="Phone Number" 
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-electric-blue transition-colors"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Secure Password" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-12 focus:outline-none focus:border-electric-blue transition-colors"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {isLogin && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-white/40 hover:text-electric-blue transition-colors font-medium"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
          >
            {loading ? 'PROCESSING...' : (isLogin ? 'SIGN IN' : 'REGISTER')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#151619] px-2 text-white/40">Or continue with</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full glass py-4 rounded-lg flex items-center justify-center gap-3 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="font-semibold">Google</span>
        </button>

        <div className="mt-8 text-center text-sm text-white/60">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-electric-blue font-semibold hover:underline"
          >
            {isLogin ? 'Register Now' : 'Sign In'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
