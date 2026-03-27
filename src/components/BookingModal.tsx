import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, CreditCard, ShieldCheck, Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Car, Booking } from '../types';
import { formatCurrency } from '../lib/utils';
import { auth } from '../firebase';
import { dbService } from '../services/db';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { addDays, format, differenceInDays, parseISO } from 'date-fns';
import { bookingSchema, SecurityLogger } from '../services/security';

interface BookingModalProps {
  car: Car;
  onClose: () => void;
  onSuccess?: () => void;
  initialDates?: {
    start: string | Timestamp;
    end: string | Timestamp;
  };
}

export default function BookingModal({ car, onClose, onSuccess, initialDates }: BookingModalProps) {
  const [step, setStep] = useState(initialDates ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    if (initialDates) {
      let date: Date;
      if (typeof initialDates.start === 'string') {
        date = parseISO(initialDates.start);
      } else if (initialDates.start instanceof Date) {
        date = initialDates.start;
      } else if (typeof (initialDates.start as any).toDate === 'function') {
        date = (initialDates.start as any).toDate();
      } else if ((initialDates.start as any).seconds) {
        date = new Date((initialDates.start as any).seconds * 1000);
      } else {
        date = new Date(initialDates.start as any);
      }
      return format(date, 'yyyy-MM-dd');
    }
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    if (initialDates) {
      let date: Date;
      if (typeof initialDates.end === 'string') {
        date = parseISO(initialDates.end);
      } else if (initialDates.end instanceof Date) {
        date = initialDates.end;
      } else if (typeof (initialDates.end as any).toDate === 'function') {
        date = (initialDates.end as any).toDate();
      } else if ((initialDates.end as any).seconds) {
        date = new Date((initialDates.end as any).seconds * 1000);
      } else {
        date = new Date(initialDates.end as any);
      }
      return format(date, 'yyyy-MM-dd');
    }
    return format(addDays(new Date(), 3), 'yyyy-MM-dd');
  });
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvc: ''
  });
  const navigate = useNavigate();

  const days = differenceInDays(new Date(endDate), new Date(startDate));
  const totalPrice = (days > 0 ? days : 1) * car.price_per_day;

  const validateDates = () => {
    if (days <= 0) {
      toast.error('Return date must be at least one day after pick-up date.');
      return false;
    }
    return true;
  };

  const checkBookingConflicts = async () => {
    const user = auth.currentUser;
    if (!user) return false;

    setLoading(true);
    try {
      const existingBookings = await dbService.getCollection<Booking>('bookings', {
        user_id: user.uid,
        car_id: car.id
      });

      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

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

        // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
        return (start <= bEnd) && (end >= bStart);
      });

      if (conflict) {
        const formatConflictDate = (dateObj: any, fmt: string) => {
          if (!dateObj) return '';
          let d: Date;
          if (typeof dateObj === 'string') d = new Date(dateObj);
          else if (dateObj instanceof Date) d = dateObj;
          else if (typeof dateObj.toDate === 'function') d = dateObj.toDate();
          else if (dateObj.seconds) d = new Date(dateObj.seconds * 1000);
          else d = new Date(dateObj);
          return format(d, fmt);
        };
        toast.error(`You already have a booking for this car from ${formatConflictDate(conflict.start_date, 'MMM d')} to ${formatConflictDate(conflict.end_date, 'MMM d, yyyy')}.`);
        setLoading(false);
        return true;
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Error checking conflicts:', error);
      setLoading(false);
      return false;
    }
  };

  const validatePayment = () => {
    const { cardNumber, expiryDate, cvc } = paymentData;
    
    // Basic card number validation (13-19 digits)
    const cardRegex = /^\d{13,19}$/;
    if (!cardRegex.test(cardNumber.replace(/\s/g, ''))) {
      toast.error('Please enter a valid card number (13-19 digits).');
      return false;
    }

    // Expiry date validation (MM/YY)
    const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (typeof expiryDate !== 'string' || !expiryRegex.test(expiryDate)) {
      toast.error('Please enter a valid expiry date (MM/YY).');
      return false;
    }

    // Logical expiry date check
    const [month, year] = expiryDate.split('/').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear() % 100; // Get last two digits
    const currentMonth = now.getMonth() + 1;

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      toast.error('The card has already expired.');
      return false;
    }

    // CVC validation (exactly 3 digits)
    const cvcRegex = /^\d{3}$/;
    if (!cvcRegex.test(cvc)) {
      toast.error('Please enter a valid 3-digit CVC code.');
      return false;
    }

    return true;
  };

  const handleBooking = async () => {
    if (!validatePayment()) return;
    if (!validateDates()) return;

    const hasConflict = await checkBookingConflicts();
    if (hasConflict) return;

    const user = auth.currentUser;
    
    if (!user) {
      toast.error('Please sign in to book a vehicle.');
      navigate('/auth');
      return;
    }

    // Security Check: Email Verification
    if (!user.emailVerified) {
      toast.error('Please verify your email address before booking.');
      SecurityLogger.log('UNVERIFIED_BOOKING_ATTEMPT', { userId: user.uid });
      return;
    }

    // Input Validation
    const validation = bookingSchema.safeParse({
      car_id: car.id,
      start_date: new Date(startDate),
      end_date: new Date(endDate),
      total_price: totalPrice
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const bookingId = crypto.randomUUID();
      const booking: any = {
        id: bookingId,
        car_id: car.id,
        user_id: user.uid,
        start_date: Timestamp.fromDate(new Date(startDate)),
        end_date: Timestamp.fromDate(new Date(endDate)),
        total_price: totalPrice,
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
          className="relative glass w-full max-w-2xl rounded-3xl overflow-hidden"
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
                
                <h3 className="text-3xl font-bold tracking-tighter mb-2">BOOKING CONFIRMED</h3>
                <p className="text-white/60 mb-8">Your premium journey is ready to begin.</p>
                
                <div className="glass w-full max-w-sm rounded-2xl p-6 mb-8 text-left border-white/5">
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Rental Summary</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-white/60">Vehicle</span>
                      <span className="text-sm font-bold">{car.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-white/60">Dates</span>
                      <span className="text-sm font-bold">
                        {format(new Date(startDate), 'MMM d')} - {format(new Date(endDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-white/10">
                      <span className="text-sm text-white/60">Total Paid</span>
                      <span className="text-sm font-bold text-electric-blue">{formatCurrency(totalPrice)}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => navigate(`/confirmation/${confirmedBookingId}`)}
                  className="btn-primary w-full max-w-sm py-4 flex items-center justify-center gap-2"
                >
                  VIEW BOOKING DETAILS <ArrowRight size={18} />
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

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left: Car Info */}
            <div className="p-8 bg-white/5 border-r border-white/10">
              <img 
                src={car.image} 
                alt={car.model} 
                className="w-full h-40 object-cover rounded-xl mb-6"
                referrerPolicy="no-referrer"
              />
              <h3 className="text-2xl font-bold tracking-tighter mb-2">{car.model}</h3>
              <p className="text-white/40 text-sm mb-6">{car.description}</p>
              
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Price per day</span>
                  <span className="font-bold">{formatCurrency(car.price_per_day)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/40">Rental duration</span>
                  <span className="font-bold">{days} Days</span>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-lg font-bold">TOTAL</span>
                  <span className="text-2xl font-bold text-electric-blue">{formatCurrency(totalPrice)}</span>
                </div>
              </div>
            </div>

            {/* Right: Steps */}
            <div className="p-8">
              {step === 1 ? (
                <div className="space-y-6">
                  <h4 className="text-xl font-bold tracking-tighter mb-6 flex items-center gap-2">
                    <Calendar className="text-electric-blue" size={20} />
                    SELECT DATES
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-white/40 uppercase font-bold mb-2 block">Pick-up Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 uppercase font-bold mb-2 block">Return Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:border-electric-blue"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={async () => {
                      if (validateDates()) {
                        const hasConflict = await checkBookingConflicts();
                        if (!hasConflict) {
                          setStep(2);
                        }
                      }
                    }}
                    disabled={loading}
                    className="btn-primary w-full py-4 mt-8 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'CONTINUE TO PAYMENT'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <h4 className="text-xl font-bold tracking-tighter mb-6 flex items-center gap-2">
                    <CreditCard className="text-electric-blue" size={20} />
                    PAYMENT DETAILS
                  </h4>

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

                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={() => setStep(1)}
                      className="glass px-6 py-4 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      BACK
                    </button>
                    <button 
                      onClick={handleBooking}
                      disabled={loading}
                      className="btn-secondary flex-1 py-4 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : 'CONFIRM RENTAL'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
