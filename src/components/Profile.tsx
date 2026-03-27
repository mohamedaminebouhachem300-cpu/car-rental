import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser, verifyBeforeUpdateEmail, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { dbService } from '../services/db';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { Booking, Car, User, CartItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import { format, addDays, differenceInDays } from 'date-fns';
import { Calendar, Car as CarIcon, Loader2, ArrowRight, XCircle, RefreshCw, Settings, User as UserIcon, Save, Edit3, ShieldCheck, ChevronDown, Globe, Mail, Lock, AlertCircle, ShoppingCart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import BookingModal from './BookingModal';
import CartCheckoutModal from './CartCheckoutModal';
import { profileSchema, SecurityLogger } from '../services/security';

const COUNTRIES = [
  { name: 'Tunisia', code: '+216', flag: '🇹🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'Italy', code: '+39', flag: '🇮🇹' },
  { name: 'Spain', code: '+34', flag: '🇪🇸' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'Morocco', code: '+212', flag: '🇲🇦' },
  { name: 'Algeria', code: '+213', flag: '🇩🇿' },
  { name: 'Egypt', code: '+20', flag: '🇪🇬' },
];

type Tab = 'settings' | 'cart';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('cart');
  const [isEditing, setIsEditing] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<'email' | 'profile' | null>(null);
  
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone_number: '',
    email: ''
  });
  const [saving, setSaving] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  
  const [selectedCarForBooking, setSelectedCarForBooking] = useState<Car | null>(null);
  const [initialDates, setInitialDates] = useState<{ start: string | Timestamp; end: string | Timestamp } | undefined>();
  const [cartDates, setCartDates] = useState<Record<string, { start: string, end: string }>>({});

  const [cartItems, setCartItems] = useState<(CartItem & { car?: Car })[]>([]);
  const [showCartCheckout, setShowCartCheckout] = useState(false);

  const cartTotalPrice = cartItems.reduce((sum, item) => {
    if (!item.car) return sum;
    const dates = cartDates[item.id];
    const days = dates ? differenceInDays(new Date(dates.end), new Date(dates.start)) : 3;
    return sum + (days > 0 ? days : 1) * item.car.price_per_day;
  }, 0);

  const fetchProfile = async (userId: string) => {
    const data = await dbService.getDocument<User>('users', userId);
    if (data) {
      setProfile(data);
      setEditForm({
        full_name: data.full_name || '',
        phone_number: data.phone_number || '',
        email: data.email || ''
      });

      // Try to match country from phone number
      if (data.phone_number) {
        const matchedCountry = COUNTRIES.find(c => data.phone_number?.startsWith(c.code));
        if (matchedCountry) setSelectedCountry(matchedCountry);
      }
    }
    setLoading(false);
  };

  const fetchCart = async (userId: string) => {
    const unsubscribe = dbService.subscribeToCollection<CartItem>(
      'cart',
      async (items) => {
        console.log('Fetched cart items:', items);
        const allCars = await dbService.getCollection<Car>('cars');
        const enrichedItems = items.map(item => {
          const car = allCars.find(c => c.id === item.car_id);
          return { ...item, car: car || undefined };
        });
        setCartItems(enrichedItems);
      },
      { user_id: userId }
    );
    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchProfile(user.uid);
    const unsubscribeCart = fetchCart(user.uid);
    
    return () => {
      unsubscribeCart.then(unsub => unsub());
    };
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    // If email is changing, we need re-authentication
    if (editForm.email !== profile.email) {
      setPendingAction('profile');
      setShowReauthModal(true);
      return;
    }

    await executeProfileUpdate();
  };

  const executeProfileUpdate = async () => {
    if (!user) return;
    
    // Input Validation
    const validation = profileSchema.safeParse(editForm);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      // Update Firestore
      await dbService.updateDocument('users', user.uid, {
        full_name: editForm.full_name,
        phone_number: editForm.phone_number,
        updated_at: serverTimestamp()
      });

      setProfile(prev => prev ? { ...prev, ...editForm } : null);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      SecurityLogger.log('PROFILE_UPDATE_FAILURE', { userId: user.uid, error: error.message });
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleReauthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentPassword) return;

    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      if (pendingAction === 'profile') {
        // If email changed, send verification
        if (editForm.email !== profile?.email) {
          await verifyBeforeUpdateEmail(user, editForm.email);
          toast.info('A confirmation link has been sent to your current email address. Please confirm it to proceed with the change.');
        }
        await executeProfileUpdate();
      } else if (pendingAction === 'email') {
        // This was for a standalone email change if needed
      }

      setShowReauthModal(false);
      setCurrentPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Re-authentication failed. Please check your password.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send password reset email');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter mb-2 uppercase">MY ACCOUNT</h2>
          <p className="text-white/60">Manage your profile and premium rentals.</p>
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setActiveTab('cart')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'cart' ? 'bg-electric-blue text-white' : 'text-white/40 hover:text-white'}`}
          >
            <ShoppingCart size={16} /> CART
            {cartItems.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">
                {cartItems.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'settings' ? 'bg-electric-blue text-white' : 'text-white/40 hover:text-white'}`}
          >
            <Settings size={16} /> SETTINGS
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'cart' ? (
          <motion.div 
            key="cart"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {cartItems.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center">
                <ShoppingCart className="mx-auto text-white/20 mb-6" size={64} />
                <h3 className="text-2xl font-bold mb-4">YOUR CART IS EMPTY</h3>
                <p className="text-white/60 mb-8">Browse our fleet to add vehicles to your cart.</p>
                <Link to="/fleet" className="btn-primary inline-flex items-center gap-2">
                  EXPLORE FLEET <ArrowRight size={20} />
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {cartItems.map((item, index) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-center border border-white/5 hover:border-electric-blue/30 transition-colors"
                  >
                    <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden shrink-0 relative">
                      {item.car ? (
                        <img src={item.car.image} alt={item.car.model} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                          <CarIcon className="text-white/20" size={32} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-electric-blue text-[10px] font-bold tracking-[0.2em] uppercase mb-1">
                        <span>IN CART</span>
                      </div>
                      <h3 className="text-2xl font-bold tracking-tighter mb-2 truncate">
                        {item.car?.model || 'Unknown Vehicle'}
                      </h3>
                      <p className="text-white/40 text-sm line-clamp-2 mb-4">
                        {item.car?.description || 'Vehicle details unavailable'}
                      </p>
                      <div className="flex items-center gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-white/40 uppercase mb-1">PRICE PER DAY</h4>
                          <p className="text-xl font-bold text-electric-blue">
                            {item.car ? formatCurrency(item.car.price_per_day) : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-white/40 uppercase font-bold mb-1 block">Pick-up</label>
                          <input 
                            type="date" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-electric-blue"
                            value={cartDates[item.id]?.start || format(new Date(), 'yyyy-MM-dd')}
                            onChange={(e) => setCartDates(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], start: e.target.value, end: prev[item.id]?.end || format(addDays(new Date(), 3), 'yyyy-MM-dd') }
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 uppercase font-bold mb-1 block">Return</label>
                          <input 
                            type="date" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-electric-blue"
                            value={cartDates[item.id]?.end || format(addDays(new Date(), 3), 'yyyy-MM-dd')}
                            onChange={(e) => setCartDates(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], start: prev[item.id]?.start || format(new Date(), 'yyyy-MM-dd'), end: e.target.value }
                            }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                      <button 
                        onClick={async () => {
                          try {
                            await dbService.deleteDocument('cart', item.id);
                            toast.success('Removed from cart');
                          } catch (error) {
                            toast.error('Failed to remove from cart');
                          }
                        }}
                        className="text-xs text-rose-500/60 hover:text-rose-500 transition-colors flex items-center gap-1 font-bold uppercase tracking-tighter"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </motion.div>
                ))}
                
                <div className="mt-8 glass p-6 rounded-2xl border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-white/40 uppercase mb-1">CART TOTAL</h4>
                    <p className="text-3xl font-bold text-electric-blue">{formatCurrency(cartTotalPrice)}</p>
                  </div>
                  <button 
                    onClick={() => setShowCartCheckout(true)}
                    className="btn-primary py-4 px-8 text-sm font-bold tracking-[0.2em] uppercase w-full md:w-auto"
                  >
                    PROCEED TO CHECKOUT
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl"
          >
            <div className="glass rounded-3xl p-8 border-white/5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-electric-blue/10 flex items-center justify-center">
                    <UserIcon className="text-electric-blue" size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tighter">{profile?.full_name || 'User'}</h3>
                    <p className="text-white/40 text-sm">{profile?.email}</p>
                  </div>
                </div>
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-electric-blue hover:text-white transition-colors"
                  >
                    <Edit3 size={14} /> EDIT PROFILE
                  </button>
                )}
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="text-xs text-white/40 uppercase font-bold mb-2 block">Full Name</label>
                      <input 
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="text-xs text-white/40 uppercase font-bold mb-2 block">Email Address</label>
                      <div className="relative">
                        <input 
                          type="email" 
                          className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 pl-10 focus:outline-none focus:border-electric-blue"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          required
                        />
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                      </div>
                      <p className="text-[10px] text-white/40 mt-1 italic">Changing email requires confirmation via your current address.</p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs text-white/40 uppercase font-bold mb-2 block">Phone Number</label>
                      <div className="flex gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowCountrySelector(!showCountrySelector)}
                            className="h-full bg-white/5 border border-white/10 rounded-lg px-3 flex items-center gap-2 hover:bg-white/10 transition-colors min-w-[100px]"
                          >
                            <span className="text-lg">{selectedCountry.flag}</span>
                            <span className="text-sm font-bold">{selectedCountry.code}</span>
                            <ChevronDown size={14} className="text-white/40" />
                          </button>

                          <AnimatePresence>
                            {showCountrySelector && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-full left-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto"
                              >
                                {COUNTRIES.map((country) => (
                                  <button
                                    key={country.name + country.code}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(country);
                                      setShowCountrySelector(false);
                                      // If phone number doesn't start with the new code, update it
                                      const currentNumber = editForm.phone_number;
                                      const numberWithoutCode = COUNTRIES.reduce((acc, c) => {
                                        if (acc.startsWith(c.code)) return acc.slice(c.code.length).trim();
                                        return acc;
                                      }, currentNumber);
                                      setEditForm({ ...editForm, phone_number: `${country.code} ${numberWithoutCode}` });
                                    }}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                                  >
                                    <span className="text-xl">{country.flag}</span>
                                    <div className="flex-1">
                                      <p className="text-sm font-bold">{country.name}</p>
                                      <p className="text-xs text-white/40">{country.code}</p>
                                    </div>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <input 
                          type="tel" 
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                          value={editForm.phone_number}
                          onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                          placeholder="92 749 686"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="submit"
                      disabled={saving}
                      className="btn-primary flex-1 py-4 flex items-center justify-center gap-2"
                    >
                      {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> SAVE CHANGES</>}
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditForm({
                          full_name: profile?.full_name || '',
                          phone_number: profile?.phone_number || '',
                          email: profile?.email || ''
                        });
                      }}
                      className="glass px-8 py-4 rounded-xl hover:bg-white/10 transition-colors font-bold text-xs uppercase tracking-widest"
                    >
                      CANCEL
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                    <div>
                      <h4 className="text-xs font-bold text-white/40 uppercase mb-2">FULL NAME</h4>
                      <p className="text-lg font-medium truncate">{profile?.full_name || 'Not set'}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white/40 uppercase mb-2">PHONE NUMBER</h4>
                      <p className="text-lg font-medium">{profile?.phone_number || 'Not set'}</p>
                    </div>
                    <div className="md:col-span-1 min-w-0">
                      <h4 className="text-xs font-bold text-white/40 uppercase mb-2">EMAIL ADDRESS</h4>
                      <p className="text-lg font-medium break-all">{profile?.email}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white/40 uppercase mb-2">ACCOUNT TYPE</h4>
                      <p className="text-lg font-medium capitalize">{profile?.role || 'User'}</p>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5">
                    <h4 className="text-xs font-bold text-white/40 uppercase mb-4">SECURITY</h4>
                    <button 
                      onClick={handlePasswordReset}
                      className="flex items-center gap-3 text-sm font-bold text-white/60 hover:text-white transition-colors glass p-4 rounded-xl w-full md:w-auto"
                    >
                      <Lock size={18} className="text-electric-blue" />
                      CHANGE PASSWORD
                    </button>
                    <p className="text-[10px] text-white/40 mt-2 italic">A reset link will be sent to your email address.</p>
                  </div>
                  
                  <div className="pt-8 border-t border-white/5">
                    <div className="p-4 rounded-xl bg-emerald/5 border border-emerald/10 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-emerald/20 flex items-center justify-center">
                        <ShieldCheck className="text-emerald" size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald">Verified Account</h4>
                        <p className="text-xs text-white/40">Your account is fully verified and secure.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Re-authentication Modal */}
      <AnimatePresence>
        {showReauthModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReauthModal(false)}
              className="absolute inset-0 bg-charcoal/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative glass w-full max-w-md rounded-3xl p-8 border-white/10"
            >
              <div className="flex items-center gap-3 mb-6 text-rose-500">
                <AlertCircle size={24} />
                <h3 className="text-xl font-bold tracking-tighter">SENSITIVE ACTION</h3>
              </div>
              <p className="text-white/60 text-sm mb-6">
                For security reasons, please enter your current password to confirm these changes.
              </p>
              <form onSubmit={handleReauthenticate} className="space-y-6">
                <div>
                  <label className="text-xs text-white/40 uppercase font-bold mb-2 block">Current Password</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 pl-10 focus:outline-none focus:border-electric-blue"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1 py-4 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : 'CONFIRM & SAVE'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowReauthModal(false);
                      setCurrentPassword('');
                    }}
                    className="glass px-6 py-4 rounded-xl hover:bg-white/10 transition-colors font-bold text-xs uppercase tracking-widest"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedCarForBooking && (
        <BookingModal 
          car={selectedCarForBooking} 
          initialDates={initialDates}
          onClose={() => setSelectedCarForBooking(null)} 
          onSuccess={() => {
            const cartItem = cartItems.find(item => item.car_id === selectedCarForBooking.id);
            if (cartItem) {
              dbService.deleteDocument('cart', cartItem.id).catch(console.error);
            }
            setSelectedCarForBooking(null);
          }}
        />
      )}

      {showCartCheckout && (
        <CartCheckoutModal
          cartItems={cartItems}
          cartDates={cartDates}
          onClose={() => setShowCartCheckout(false)}
          onSuccess={() => {
            setShowCartCheckout(false);
            setCartDates({});
            setCartItems([]);
            setActiveTab('bookings');
          }}
        />
      )}
    </div>
  );
}
