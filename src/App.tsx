import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { seedCars } from './services/seed';

import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Fleet from './components/Fleet';
import Auth from './components/Auth';
import Confirmation from './components/Confirmation';
import Profile from './components/Profile';
import Favorites from './components/Favorites';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const runSeed = async () => {
      try {
        if (user && user.email === 'mohamedaminebouhachem300@gmail.com') {
          await seedCars();
        }
      } catch (error) {
        console.error('Seeding failed:', error);
      }
    };
    runSeed();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-electric-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-charcoal text-white selection:bg-electric-blue selection:text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/auth" element={user ? <Navigate to="/fleet" /> : <Auth />} />
          <Route path="/confirmation/:bookingId" element={<Confirmation />} />
          <Route path="/profile" element={user ? <Profile /> : <Navigate to="/auth" />} />
        </Routes>
        <Toaster position="top-center" theme="dark" richColors />
      </div>
    </Router>
  );
}
