import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { dbService } from '../services/db';
import { Car, Favorite, CartItem } from '../types';
import CarCard from './CarCard';
import BookingModal from './BookingModal';
import CarDetailModal from './CarDetailModal';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

export default function Favorites() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [selectedCarForDetail, setSelectedCarForDetail] = useState<Car | null>(null);
  const [selectedCarForBooking, setSelectedCarForBooking] = useState<Car | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubscribeCars: () => void;

    const fetchFavorites = async () => {
      try {
        // Subscribe to favorites for the current user
        const unsubscribeFavs = dbService.subscribeToCollection<Favorite>(
          'favorites',
          async (userFavorites) => {
            if (userFavorites.length === 0) {
              setCars([]);
              setLoading(false);
              return;
            }

            // Fetch all cars to match with favorites
            // We subscribe to all cars so we get real-time updates for them too
            unsubscribeCars = dbService.subscribeToCollection<Car>(
              'cars',
              (allCars) => {
                const favoriteCarIds = new Set(userFavorites.map(fav => fav.car_id));
                const favoriteCars = allCars.filter(car => favoriteCarIds.has(car.id));
                setCars(favoriteCars);
                setLoading(false);
              }
            );
          },
          { user_id: user.uid }
        );

        return () => {
          unsubscribeFavs();
          if (unsubscribeCars) {
            unsubscribeCars();
          }
        };
      } catch (error) {
        console.error("Error fetching favorites:", error);
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

  const handleRent = (car: Car) => {
    handleAddToCart(car);
  };

  const handleAddToCart = async (car: Car) => {
    if (!auth.currentUser) {
      toast.error('Please sign in to add to cart');
      return;
    }
    try {
      const cartItem: CartItem = {
        id: `${auth.currentUser.uid}_${car.id}`,
        user_id: auth.currentUser.uid,
        car_id: car.id,
        created_at: serverTimestamp()
      };
      await dbService.setDocument('cart', cartItem.id, cartItem);
      toast.success('Added to cart');
      setSelectedCarForDetail(null);
    } catch (error) {
      toast.error('Failed to add to cart');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 pb-24 flex items-center justify-center">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-6 max-w-7xl mx-auto text-center flex flex-col items-center justify-center">
        <Heart className="text-white/20 mb-6" size={64} />
        <h2 className="text-4xl font-bold tracking-tighter mb-4">SIGN IN REQUIRED</h2>
        <p className="text-white/60 mb-8 max-w-md mx-auto">Please sign in to view your curated collection of favorite vehicles.</p>
        <Link to="/auth" className="btn-primary inline-flex items-center gap-2">
          SIGN IN <ArrowRight size={20} />
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-6 max-w-7xl mx-auto">
      <div className="mb-12">
        <h2 className="text-4xl font-bold tracking-tighter mb-2 uppercase flex items-center gap-3">
          <Heart className="text-rose-500 fill-rose-500" size={32} /> MY FAVORITES
        </h2>
        <p className="text-white/60">Your curated collection of premium vehicles.</p>
      </div>

      {cars.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <Heart className="text-white/20 mb-6" size={64} />
          <h3 className="text-2xl font-bold mb-4">NO FAVORITES YET</h3>
          <p className="text-white/60 mb-8 max-w-md mx-auto">Explore our fleet and save your favorite vehicles here for quick access.</p>
          <Link to="/fleet" className="btn-primary inline-flex items-center gap-2">
            EXPLORE FLEET <ArrowRight size={20} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {cars.map((car, index) => (
            <motion.div
              key={car.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <CarCard 
                car={car} 
                onClick={setSelectedCarForDetail}
                onRent={handleRent}
              />
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedCarForDetail && (
          <CarDetailModal
            car={selectedCarForDetail}
            onClose={() => setSelectedCarForDetail(null)}
            onAddToCart={handleAddToCart}
          />
        )}
        {selectedCarForBooking && (
          <BookingModal
            car={selectedCarForBooking}
            onClose={() => setSelectedCarForBooking(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
