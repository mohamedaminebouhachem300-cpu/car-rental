import { Link } from 'react-router-dom';
import { Car, User as UserIcon, LogOut, Heart, Shield } from 'lucide-react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { User as AppUser } from '../types';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        if (user.email === 'mohamedaminebouhachem300@gmail.com') {
          setIsAdmin(true);
        } else {
          const userDoc = await dbService.getDocument<AppUser>('users', user.uid);
          setIsAdmin(userDoc?.role === 'admin');
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass px-6 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 text-2xl font-bold tracking-tighter">
        <Car className="text-electric-blue" />
        <span>LUXEDRIVE</span>
      </Link>
      
      <div className="flex items-center gap-8">
        <Link to="/fleet" className="text-sm font-medium hover:text-electric-blue transition-colors">FLEET</Link>
        {user ? (
          <div className="flex items-center gap-4">
            <Link to="/favorites" className="flex items-center gap-2 text-sm font-medium hover:text-rose-500 transition-colors">
              <Heart size={18} />
              <span>FAVORITES</span>
            </Link>
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-2 text-sm font-medium hover:text-purple-400 transition-colors">
                <Shield size={18} />
                <span>ADMIN</span>
              </Link>
            )}
            <Link to="/profile" className="flex items-center gap-2 text-sm font-medium hover:text-electric-blue transition-colors">
              <UserIcon size={18} />
              <span>PROFILE</span>
            </Link>
            <button 
              onClick={() => signOut(auth)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <Link to="/auth" className="btn-primary text-sm">SIGN IN</Link>
        )}
      </div>
    </nav>
  );
}
