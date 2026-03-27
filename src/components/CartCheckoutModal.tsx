import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, ShieldCheck, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Car, CartItem, Booking } from '../types';
import { formatCurrency } from '../lib/utils';
import { auth } from '../firebase';
import { dbService } from '../services/db';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { SecurityLogger } from '../services/security';

interface CartCheckoutModalProps {
  cartItems: (CartItem & { car?: Car })[];
  cartDates: Record<string, { start: string; end: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CartCheckoutModal({ cartItems, cartDates, onClose, onSuccess }: CartCheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvc: ''
  });
  const navigate = useNavigate();

  const validItems = cartItems.filter(item => item.car);

  const calculateItemPrice = (item: CartItem & { car?: Car }) => {
    if (!item.car) return 0;
    const dates = cartDates[item.id];
    if (!dates) return item.car.price_per_day * 3; // default 3 days
    const days = differenceInDays(new Date(dates.end), new Date(dates.start));
    return (days > 0 ? days : 1) * item.car.price_per_day;
  };

  const totalPrice = validItems.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  const validatePayment = () => {
    const { cardNumber, expiryDate, cvc } = paymentData;
    
    const cardRegex = /^\d{13,19}$/;
    if (!cardRegex.test(cardNumber.replace(/\s/g, ''))) {
      toast.error('Please enter a valid card number (13-19 digits).');
      return false;
    }

    const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (typeof expiryDate !== 'string' || !expiryRegex.test(expiryDate)) {
      toast.error('Please enter a valid expiry date (MM/YY).');
      return false;
    }

    const [month, year] = expiryDate.split('/').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      toast.error('The card has already expired.');
      return false;
    }

    const cvcRegex = /^\d{3}$/;
    if (!cvcRegex.test(cvc)) {
      toast.error('Please enter a valid 3-digit CVC code.');
      return false;
    }

    return true;
  };

  const checkConflicts = async () => {
    const user = auth.currentUser;
    if (!user) return true;

    for (const item of validItems) {
      const dates = cartDates[item.id];
      if (!dates) continue;

      const existingBookings = await dbService.getCollection<Booking>('bookings', {
        user_id: user.uid,
        car_id: item.car_id
      });

      const start = new Date(dates.start).getTime();
      const end = new Date(dates.end).getTime();

      const conflict = existingBookings.find(b => {
        if (b.status === 'cancelled') return false;
        
        const getTime = (dateObj: any) => {
          if (!dateObj) return 0;
          if (typeof dateObj === 'string') return new Date(dateObj).getTime();
          if (dateObj instanceof Date) return dateObj.getTime();
          if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
          if (dateObj.seconds) return dateObj.seconds * 1000;
          return new Date(dateObj).getTime();
        };

        const bStart = getTime(b.start_date);
        const bEnd = getTime(b.end_date);

        return (start <= bEnd) && (end >= bStart);
      });

      if (conflict) {
        toast.error(`Conflict for ${item.car?.model}. Please adjust dates.`);
        return true;
      }
    }
    return false;
  };

  const handleCheckout = async () => {
    if (!validatePayment()) return;

    const user = auth.currentUser;
    if (!user) {
      toast.error('Please sign in to book vehicles.');
      navigate('/auth');
      return;
    }

    if (!user.emailVerified) {
      toast.error('Please verify your email address before booking.');
      SecurityLogger.log('UNVERIFIED_BOOKING_ATTEMPT', { userId: user.uid });
      return;
    }

    setLoading(true);
    try {
      const hasConflict = await checkConflicts();
      if (hasConflict) {
        setLoading(false);
        return;
      }

      // Process all bookings
      for (const item of validItems) {
        const dates = cartDates[item.id];
        if (!dates) continue;

        const bookingId = crypto.randomUUID();
        const booking: any = {
          id: bookingId,
          car_id: item.car_id,
          user_id: user.uid,
          start_date: Timestamp.fromDate(new Date(dates.start)),
          end_date: Timestamp.fromDate(new Date(dates.end)),
          total_price: calculateItemPrice(item),
          status: 'confirmed',
          created_at: serverTimestamp()
        };

        await dbService.setDocument('bookings', bookingId, booking);
        console.log('Deleting cart item:', item.id);
        await dbService.deleteDocument('cart', item.id);
        console.log('Deleted cart item:', item.id);
      }

      setSuccess(true);
      toast.success('All bookings confirmed! Check your email for details.');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      SecurityLogger.log('CART_CHECKOUT_FAILURE', { userId: user.uid, error: error.message });
      toast.error('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    setPaymentData({ ...paymentData, expiryDate: value });
  };

  const handleNumericChange = (field: 'cardNumber' | 'cvc', value: string, limit: number) => {
    const cleaned = value.replace(/\D/g, '').slice(0, limit);
    setPaymentData({ ...paymentData, [field]: cleaned });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative glass w-full max-w-md rounded-3xl overflow-hidden p-8"
        >
          <AnimatePresence>
            {success && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-charcoal flex flex-col items-center justify-center text-center p-8"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="w-20 h-20 bg-emerald/20 rounded-full flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="text-emerald" size={40} />
                </motion.div>
                
                <h3 className="text-3xl font-bold tracking-tighter mb-2">CHECKOUT COMPLETE</h3>
                <p className="text-white/60 mb-8">Your premium journeys are ready to begin.</p>
                
                <button 
                  onClick={() => {
                    onClose();
                    navigate('/profile');
                  }}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                >
                  VIEW MY BOOKINGS <ArrowRight size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors z-[60]"
          >
            <X size={24} />
          </button>

          <div className="space-y-6">
            <h4 className="text-xl font-bold tracking-tighter mb-6 flex items-center gap-2">
              <CreditCard className="text-electric-blue" size={20} />
              CHECKOUT ({validItems.length} ITEMS)
            </h4>

            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <span className="text-white/60">Total Amount</span>
              <span className="text-2xl font-bold text-electric-blue">{formatCurrency(totalPrice)}</span>
            </div>

            <div className="space-y-4">
              <div className="glass p-4 rounded-xl border-emerald/20 flex items-center gap-3">
                <ShieldCheck className="text-emerald" size={24} />
                <span className="text-sm font-medium">Secure Payment Simulation</span>
              </div>

              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Card Number" 
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                  value={paymentData.cardNumber}
                  onChange={(e) => handleNumericChange('cardNumber', e.target.value, 19)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="MM/YY" 
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                    value={paymentData.expiryDate}
                    onChange={handleExpiryChange}
                  />
                  <input 
                    type="text" 
                    placeholder="CVC" 
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                    value={paymentData.cvc}
                    onChange={(e) => handleNumericChange('cvc', e.target.value, 3)}
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleCheckout}
              disabled={loading}
              className="btn-primary w-full py-4 mt-8 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : `PAY ${formatCurrency(totalPrice)}`}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
