import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Review, Booking } from '../types';
import { auth, db } from '../firebase';
import { dbService } from '../services/db';
import { serverTimestamp } from 'firebase/firestore';
import { Star, MessageSquare, Send, User, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { reviewSchema, SecurityLogger } from '../services/security';

interface ReviewSectionProps {
  car: Car;
}

export default function ReviewSection({ car }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = dbService.subscribeToCollection<Review>(
      'reviews',
      (data) => {
        const sorted = data.sort((a, b) => {
          const dateA = a.created_at?.toDate ? a.created_at.toDate().getTime() : new Date(a.created_at).getTime();
          const dateB = b.created_at?.toDate ? b.created_at.toDate().getTime() : new Date(b.created_at).getTime();
          return dateB - dateA;
        });
        setReviews(sorted);
        setLoading(false);
      },
      { car_id: car.id }
    );

    checkEligibility();

    return () => unsubscribe();
  }, [car.id]);

  const checkEligibility = async () => {
    if (!auth.currentUser) return;

    try {
      // Check if user has a completed booking for this car
      const bookings = await dbService.getCollection<Booking>('bookings', {
        user_id: auth.currentUser.uid,
        car_id: car.id,
        status: 'completed'
      });

      // Also check if they already reviewed
      const existingReviews = await dbService.getCollection<Review>('reviews', {
        user_id: auth.currentUser.uid,
        car_id: car.id
      });

      setCanReview(bookings.length > 0 && existingReviews.length === 0);
    } catch (error) {
      console.error('Error checking review eligibility:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !comment.trim()) return;

    // Security Check: Email Verification
    if (!auth.currentUser.emailVerified) {
      toast.error('Please verify your email address before submitting a review.');
      SecurityLogger.log('UNVERIFIED_REVIEW_ATTEMPT', { userId: auth.currentUser.uid });
      return;
    }

    // Input Validation
    const validation = reviewSchema.safeParse({
      car_id: car.id,
      rating,
      comment: comment.trim()
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const newReview: any = {
        id: crypto.randomUUID(),
        car_id: car.id,
        user_id: auth.currentUser.uid,
        user_name: auth.currentUser.displayName || 'Anonymous User',
        rating,
        comment: comment.trim(),
        created_at: serverTimestamp()
      };

      await dbService.setDocument('reviews', newReview.id, newReview);
      
      // Update car average rating
      const allReviews = [...reviews, { ...newReview, created_at: new Date().toISOString() }];
      const totalRating = allReviews.reduce((acc, r) => acc + r.rating, 0);
      const avgRating = totalRating / allReviews.length;

      await dbService.updateDocument('cars', car.id, {
        average_rating: avgRating,
        total_reviews: allReviews.length
      });

      setComment('');
      setCanReview(false);
      toast.success('Review submitted successfully!');
    } catch (error: any) {
      SecurityLogger.log('REVIEW_SUBMISSION_FAILURE', { userId: auth.currentUser.uid, error: error.message });
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;

    try {
      await dbService.deleteDocument('reviews', reviewId);
      
      // Update car average rating
      const remainingReviews = reviews.filter(r => r.id !== reviewId);
      const totalRating = remainingReviews.reduce((acc, r) => acc + r.rating, 0);
      const avgRating = remainingReviews.length > 0 ? totalRating / remainingReviews.length : 0;

      await dbService.updateDocument('cars', car.id, {
        average_rating: avgRating,
        total_reviews: remainingReviews.length
      });

      toast.success('Review deleted');
    } catch (error) {
      console.error('Error deleting review:', error);
      toast.error('Failed to delete review');
    }
  };

  return (
    <div className="mt-12 border-t border-white/5 pt-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-electric-blue/10">
            <MessageSquare className="text-electric-blue" size={20} />
          </div>
          <h3 className="text-xl font-bold tracking-tight">User Reviews</h3>
        </div>
        <div className="flex items-center gap-2">
          <Star className="text-emerald fill-emerald" size={16} />
          <span className="text-lg font-bold">
            {car.average_rating?.toFixed(1) || '0.0'}
          </span>
          <span className="text-white/40 text-sm">({car.total_reviews || 0})</span>
        </div>
      </div>

      <AnimatePresence>
        {canReview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass p-6 rounded-2xl mb-8 border-emerald/20"
          >
            <h4 className="text-sm font-bold uppercase tracking-widest text-emerald mb-4">Share Your Experience</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      size={24}
                      className={s <= rating ? 'text-emerald fill-emerald' : 'text-white/20'}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Write your review here..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald transition-colors min-h-[100px]"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 bg-emerald hover:bg-emerald/80 border-emerald/20"
              >
                {submitting ? 'Submitting...' : (
                  <>
                    <Send size={14} />
                    Submit Review
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/10 border-t-electric-blue rounded-full animate-spin" />
          </div>
        ) : reviews.length > 0 ? (
          reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass p-6 rounded-2xl border-white/5"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <User size={20} className="text-white/40" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm">{review.user_name}</h5>
                    <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
                      <Calendar size={10} />
                      {format(
                        review.created_at?.toDate 
                          ? review.created_at.toDate() 
                          : (review.created_at?.seconds ? new Date(review.created_at.seconds * 1000) : new Date(review.created_at)), 
                        'MMM d, yyyy'
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      className={s <= review.rating ? 'text-emerald fill-emerald' : 'text-white/10'}
                    />
                  ))}
                </div>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                {review.comment}
              </p>
              {auth.currentUser?.uid === review.user_id && (
                <button
                  onClick={() => handleDelete(review.id)}
                  className="mt-4 text-[10px] text-red-400/60 hover:text-red-400 flex items-center gap-1 uppercase tracking-widest font-bold transition-colors"
                >
                  <Trash2 size={10} />
                  Delete Review
                </button>
              )}
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12 glass rounded-2xl border-dashed border-white/10">
            <MessageSquare className="mx-auto text-white/10 mb-4" size={32} />
            <p className="text-white/40 text-sm">No reviews yet. Be the first to share your experience!</p>
          </div>
        )}
      </div>
    </div>
  );
}
