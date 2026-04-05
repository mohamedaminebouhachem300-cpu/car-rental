import { useEffect, useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Booking, Car } from '../types';
import { motion } from 'motion/react';
import { CheckCircle, Calendar, MapPin, Mail, ArrowLeft, Loader2, XCircle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Confirmation() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);

  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const fetchCar = async (carId: string) => {
    try {
      const c = await dbService.getDocument<Car>('cars', carId);
      setCar(c);
    } catch (error) {
      console.error('Error fetching car details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId) return;

    const unsubscribe = dbService.subscribeToDocument<Booking>('bookings', bookingId, (b) => {
      if (b) {
        setBooking(b);
        if (!car || car.id !== b.car_id) {
          fetchCar(b.car_id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [bookingId, car?.id]);

  const handleCancel = async () => {
    if (!booking) return;

    const originalStatus = booking.status;
    
    // Optimistic UI update
    setBooking(null);
    setShowConfirmCancel(false);

    try {
      await dbService.deleteDocument('bookings', booking.id);
      toast.success('Reservation cancelled successfully');
      navigate('/profile');
    } catch (error) {
      // Revert if failed
      setBooking(booking);
      toast.error('Failed to cancel reservation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  if (!booking || !car) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-4xl font-bold tracking-tighter mb-4">BOOKING NOT FOUND</h2>
        <p className="text-white/60 mb-8">We couldn't find the booking details you're looking for.</p>
        <Link to="/fleet" className="btn-primary flex items-center gap-2">
          <ArrowLeft size={20} /> BACK TO FLEET
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-6 max-w-4xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-8 md:p-12 text-center"
      >
        <div className="flex justify-center mb-8">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
            booking.status === 'cancelled' ? 'bg-rose-500/20' : 'bg-emerald/20'
          }`}>
            {booking.status === 'cancelled' ? (
              <XCircle className="text-rose-500" size={48} />
            ) : (
              <CheckCircle className="text-emerald" size={48} />
            )}
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4 uppercase">
          {booking.status === 'cancelled' ? 'RESERVATION CANCELLED' : 'RESERVATION CONFIRMED'}
        </h2>
        <p className="text-white/60 text-lg mb-12 max-w-2xl mx-auto">
          {booking.status === 'cancelled' 
            ? `Your reservation for the ${car.model} has been successfully cancelled.`
            : `Your premium journey with the ${car.model} is ready. A confirmation email has been sent to your registered address.`
          }
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
          <div className="glass p-6 rounded-2xl border-white/5">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar size={14} className="text-electric-blue" /> RENTAL DETAILS
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-white/60">Pick-up</span>
                <span className="font-medium">
                  {format(
                    booking.start_date?.toDate 
                      ? booking.start_date.toDate() 
                      : (booking.start_date?.seconds ? new Date(booking.start_date.seconds * 1000) : new Date(booking.start_date)), 
                    'PPP'
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Return</span>
                <span className="font-medium">
                  {format(
                    booking.end_date?.toDate 
                      ? booking.end_date.toDate() 
                      : (booking.end_date?.seconds ? new Date(booking.end_date.seconds * 1000) : new Date(booking.end_date)), 
                    'PPP'
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-4 border-t border-white/10">
                <span className="text-white/60">Total Paid</span>
                <span className="text-xl font-bold text-electric-blue">{formatCurrency(booking.total_price)}</span>
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-2xl border-white/5">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MapPin size={14} className="text-emerald" /> PICK-UP LOCATION
            </h4>
            <div className="space-y-4">
              <p className="font-bold text-lg">LuxeDrive Premium Hub</p>
              <p className="text-white/60 text-sm">123 Elite Avenue, Suite 400<br />Metropolis, NY 10001</p>
              <div className="flex items-center gap-2 text-sm text-emerald font-medium pt-4">
                <Mail size={16} />
                <span>Check your inbox for pick-up instructions.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-wrap items-center justify-center gap-4">
          <Link to="/fleet" className="btn-primary w-full md:w-auto px-8 py-4 text-xs font-bold uppercase tracking-widest">
            EXPLORE MORE
          </Link>
          <Link to="/profile" className="glass w-full md:w-auto px-8 py-4 rounded-lg hover:bg-white/10 transition-colors text-xs font-bold uppercase tracking-widest">
            VIEW MY BOOKINGS
          </Link>
          {booking.status !== 'cancelled' && (
            <button 
              onClick={() => setShowConfirmCancel(true)}
              className="px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs text-rose-500 border border-rose-500/20 hover:bg-rose-500/10 transition-all w-full sm:w-auto flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <XCircle size={16} /> CANCEL BOOKING
            </button>
          )}
        </div>
      </motion.div>

      {/* Cancellation Confirmation Modal */}
      {showConfirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmCancel(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-charcoal border border-white/10 rounded-2xl p-8 w-full max-w-md text-center shadow-2xl"
          >
            <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="text-rose-500" size={32} />
            </div>
            <h3 className="text-2xl font-bold tracking-tighter mb-2">Cancel Reservation?</h3>
            <p className="text-white/60 mb-8">
              Are you sure you want to cancel your reservation for the {car.model}? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setShowConfirmCancel(false)}
                className="flex-1 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Keep Booking
              </button>
              <button 
                onClick={handleCancel}
                className="flex-1 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs bg-rose-500 text-white hover:bg-rose-600 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
