import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, CreditCard, ShieldCheck, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Car } from '../types';
import { formatCurrency } from '../lib/utils';
import { auth } from '../firebase';
import { dbService } from '../services/db';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { SecurityLogger } from '../services/security';
import { calculateBookingDetails, checkBookingConflicts } from '../lib/bookingService';

interface BookingModalProps {
  car: Car;
  initialDates?: { start: string; end: string };
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BookingModal({ car, initialDates, onClose, onSuccess }: BookingModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  
  const [startDate, setStartDate] = useState(initialDates?.start || format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(initialDates?.end || format(addDays(new Date(), 3), 'yyyy-MM-dd'));
  const [bookingDetails, setBookingDetails] = useState({ days: 3, totalPrice: car.price_per_day * 3 });

  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvc: ''
  });
  const navigate = useNavigate();

  // Securely calculate prices when dates change
  useEffect(() => {
    setCalculating(true);
    calculateBookingDetails(car.id, startDate, endDate)
      .then(details => {
        setBookingDetails({ days: details.days, totalPrice: details.totalPrice });
      })
      .catch(() => toast.error("Failed to calculate price securely."))
      .finally(() => setCalculating(false));
  }, [car.id, startDate, endDate]);

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

  const validateDates = () => {
    if (bookingDetails.days <= 0) {
      toast.error('Return date must be at least one day after pick-up date.');
      return false;
    }
    return true;
  };

  const handleBooking = async () => {
    if (!validatePayment()) return;
    if (!validateDates()) return;

    const user = auth.currentUser;
    if (!user) {
      toast.error('Please sign in to book a vehicle.');
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
      const hasConflict = await checkBookingConflicts(car.id, startDate, endDate);
      if (hasConflict) {
        toast.error('These dates are already booked. Please select different dates.');
        setLoading(false);
        return;
      }

      const bookingId = crypto.randomUUID();
      const booking: any = {
        id: bookingId,
        car_id: car.id,
        user_id: user.uid,
        start_date: Timestamp.fromDate(new Date(startDate)),
        end_date: Timestamp.fromDate(new Date(endDate)),
        days: bookingDetails.days,
        total_price: bookingDetails.totalPrice,
        status: 'confirmed',
        created_at: serverTimestamp()
      };

      await dbService.setDocument('bookings', bookingId, booking);
      
      setConfirmedBookingId(bookingId);
      setSuccess(true);
      toast.success('Booking confirmed! Check your email for details.');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      SecurityLogger.log('BOOKING_FAILURE', { userId: user.uid, error: error.message });
      toast.error('Booking failed. Please try again.');
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
          className="relative glass w-full max-w-4xl rounded-3xl overflow-hidden flex flex-col md:flex-row"
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
                  className="w-24 h-24 bg-emerald/20 rounded-full flex items-center justify-center mb-8"
                >
                  <CheckCircle2 className="text-emerald" size={48} />
                </motion.div>
                
                <h3 className="text-4xl font-bold tracking-tighter mb-4">BOOKING CONFIRMED</h3>
                <p className="text-xl text-white/60 mb-12 max-w-md">
                  Your {car.model} is reserved and ready for your journey.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                  <button 
                    onClick={() => {
                      onClose();
                      navigate('/profile');
                    }}
                    className="btn-secondary flex-1 py-4"
                  >
                    RETURN TO FLEET
                  </button>
                  <button 
                    onClick={() => navigate(`/profile`)}
                    className="btn-primary flex-1 py-4 flex items-center justify-center gap-2"
                  >
                    VIEW BOOKING <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors z-[60]"
          >
            <X size={24} />
          </button>

          {/* Left: Car Summary */}
          <div className="w-full md:w-2/5 bg-white/5 p-8 border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
            <div className="mb-8">
              <h3 className="text-2xl font-bold tracking-tighter mb-1">{car.model}</h3>
            </div>
            
            <div className="aspect-[4/3] rounded-xl overflow-hidden mb-8">
              <img 
                src={car.image} 
                alt={car.model}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-auto space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-white/60">Daily Rate</span>
                <span className="font-medium">{formatCurrency(car.price_per_day)}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-white/60">Duration</span>
                <span className="font-medium">{bookingDetails.days} Days</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-medium">Total</span>
                {calculating ? (
                  <Loader2 className="animate-spin text-electric-blue" size={24} />
                ) : (
                  <span className="text-2xl font-bold text-electric-blue">{formatCurrency(bookingDetails.totalPrice)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Steps */}
          <div className="w-full md:w-3/5 p-8">
            {step === 1 ? (
              <div className="space-y-6">
                <h4 className="text-xl font-bold tracking-tighter mb-6 flex items-center gap-2">
                  <Calendar className="text-electric-blue" size={20} />
                  SELECT DATES
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 font-medium">Pick-up Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                      value={startDate}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 font-medium">Return Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    if (validateDates()) setStep(2);
                  }}
                  disabled={calculating}
                  className="btn-primary w-full py-4 mt-8 flex items-center justify-center gap-2"
                >
                  {calculating ? <Loader2 className="animate-spin" size={20} /> : 'CONTINUE TO PAYMENT'} <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-6">
                  <button 
                    onClick={() => setStep(1)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <ArrowRight size={20} className="rotate-180" />
                  </button>
                  <h4 className="text-xl font-bold tracking-tighter flex items-center gap-2">
                    <CreditCard className="text-electric-blue" size={20} />
                    PAYMENT DETAILS
                  </h4>
                </div>

                <div className="glass p-4 rounded-xl border-emerald/20 flex items-center gap-3 mb-6">
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

                <button 
                  onClick={handleBooking}
                  disabled={loading || calculating}
                  className="btn-primary w-full py-4 mt-8 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : `PAY ${formatCurrency(bookingDetails.totalPrice)}`}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
