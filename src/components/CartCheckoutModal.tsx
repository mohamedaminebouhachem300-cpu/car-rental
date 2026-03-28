import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, ShieldCheck, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Car, CartItem } from '../types';
import { formatCurrency } from '../lib/utils';
import { auth } from '../firebase';
import { dbService } from '../services/db';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { SecurityLogger } from '../services/security';
import { calculateBookingDetails, checkBookingConflicts } from '../lib/bookingService';

interface CartCheckoutModalProps {
  cartItems: (CartItem & { car?: Car })[];
  cartDates: Record<string, { start: string; end: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CartCheckoutModal({ cartItems, cartDates, onClose, onSuccess }: CartCheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(true);
  const [success, setSuccess] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const [bookingDetailsMap, setBookingDetailsMap] = useState<Record<string, { days: number, totalPrice: number }>>({});
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvc: ''
  });
  const navigate = useNavigate();

  const validItems = cartItems.filter(item => item.car);
  const itemsKey = JSON.stringify(validItems.map(i => i.id));
  const datesKey = JSON.stringify(cartDates);

  // Securely calculate prices on mount
  useEffect(() => {
    const fetchDetails = async () => {
      setCalculating(true);
      try {
        let sum = 0;
        const map: Record<string, { days: number, totalPrice: number }> = {};
        for (const item of validItems) {
          const dates = cartDates[item.id] || {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          };
          const details = await calculateBookingDetails(item.car_id, dates.start, dates.end);
          map[item.id] = { days: details.days, totalPrice: details.totalPrice };
          sum += details.totalPrice;
        }
        setBookingDetailsMap(map);
        setTotalPrice(sum);
      } catch (error) {
        toast.error("Failed to calculate prices securely.");
      } finally {
        setCalculating(false);
      }
    };
    fetchDetails();
  }, [itemsKey, datesKey]);

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
      // 1. Check conflicts for all items first
      for (const item of validItems) {
        const dates = cartDates[item.id] || {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        };
        const hasConflict = await checkBookingConflicts(item.car_id, dates.start, dates.end);
        if (hasConflict) {
          toast.error(`Conflict for ${item.car?.model}. Please adjust dates.`);
          setLoading(false);
          return;
        }
      }

      // 2. Process all bookings
      for (const item of validItems) {
        const dates = cartDates[item.id] || {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        };
        const details = bookingDetailsMap[item.id];

        const bookingId = crypto.randomUUID();
        const booking: any = {
          id: bookingId,
          car_id: item.car_id,
          user_id: user.uid,
          start_date: Timestamp.fromDate(new Date(dates.start)),
          end_date: Timestamp.fromDate(new Date(dates.end)),
          days: details.days,
          total_price: details.totalPrice,
          status: 'confirmed',
          created_at: serverTimestamp()
        };

        await dbService.setDocument('bookings', bookingId, booking);
        await dbService.deleteDocument('cart', item.id);
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
              {calculating ? (
                <Loader2 className="animate-spin text-electric-blue" size={20} />
              ) : (
                <span className="text-2xl font-bold text-electric-blue">{formatCurrency(totalPrice)}</span>
              )}
            </div>

            <div className="space-y-4">
              <div className="glass p-4 rounded-xl border-emerald/20 flex items-center gap-3">
                <ShieldCheck className="text-emerald" size={24} />
                <span className="text-sm font-medium">Secure Payment Simulation</span>
              </div>

              <div className="space-y-4">
                <input 
                  type="text" 
                  aria-label="Card Number"
                  placeholder="Card Number" 
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                  value={paymentData.cardNumber}
                  onChange={(e) => handleNumericChange('cardNumber', e.target.value, 19)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    aria-label="Expiry Date"
                    placeholder="MM/YY" 
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                    value={paymentData.expiryDate}
                    onChange={handleExpiryChange}
                  />
                  <input 
                    type="text" 
                    aria-label="CVC"
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
              disabled={loading || calculating}
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
