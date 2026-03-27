import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { Car, CartItem } from '../types';
import CarCard from './CarCard';
import BookingModal from './BookingModal';
import CarDetailModal from './CarDetailModal';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Loader2, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { auth } from '../firebase';
import { serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

type SortOption = 'price-asc' | 'price-desc' | 'rating-desc';

export default function Fleet() {
  const [cars, setCars] = useState<Car[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCarForDetail, setSelectedCarForDetail] = useState<Car | null>(null);
  const [selectedCarForBooking, setSelectedCarForBooking] = useState<Car | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const sort = (searchParams.get('sort') as SortOption) || 'price-asc';

  useEffect(() => {
    const unsubscribeCars = dbService.subscribeToCollection<Car>('cars', (data) => {
      setCars(data);
      setLoading(false);
    });
    
    let unsubscribeCart = () => {};
    if (auth.currentUser) {
      unsubscribeCart = dbService.subscribeToCollection<CartItem>('cart', (data) => {
        setCartItems(data);
      }, { user_id: auth.currentUser.uid });
    }

    return () => {
      unsubscribeCars();
      unsubscribeCart();
    };
  }, []);

  const filteredAndSortedCars = useMemo(() => {
    let result = cars.filter(car => 
      car.model.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      if (sort === 'price-asc') return a.price_per_day - b.price_per_day;
      if (sort === 'price-desc') return b.price_per_day - a.price_per_day;
      if (sort === 'rating-desc') return (b.average_rating || 0) - (a.average_rating || 0);
      return 0;
    });

    return result;
  }, [cars, search, sort]);

  const handleRent = (car: Car) => {
    handleAddToCart(car);
  };

  const handleAddToCart = async (car: Car) => {
    console.log('Adding car to cart:', car);
    if (!auth.currentUser) {
      toast.error('Please sign in to add to cart');
      return;
    }

    if (cartItems.some(item => item.car_id === car.id)) {
      toast.error('This model already exists in your cart. Please proceed to payment or choose another model.');
      return;
    }

    try {
      const cartItem: CartItem = {
        id: `${auth.currentUser.uid}_${car.id}`,
        user_id: auth.currentUser.uid,
        car_id: car.id,
        created_at: serverTimestamp()
      };
      console.log('Cart item to add:', cartItem);
      await dbService.setDocument('cart', cartItem.id, cartItem);
      toast.success('Added to cart');
      setSelectedCarForDetail(null);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add to cart');
    }
  };

  const updateSearch = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set('search', val);
    else newParams.delete('search');
    setSearchParams(newParams, { replace: true });
  };

  const updateSort = (val: SortOption) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', val);
    setSearchParams(newParams, { replace: true });
  };

  return (
    <div className="min-h-screen pt-32 pb-24 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-bold tracking-tighter mb-2">OUR FLEET</h2>
          <p className="text-white/60">Discover the perfect vehicle for your next journey.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
            <input 
              type="text" 
              placeholder="Search models..." 
              className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-electric-blue transition-colors"
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
            />
          </div>
          
          <div className="relative w-full sm:w-48 group">
            <select 
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-10 focus:outline-none focus:border-electric-blue transition-colors cursor-pointer text-sm font-medium"
              value={sort}
              onChange={(e) => updateSort(e.target.value as SortOption)}
            >
              <option value="price-asc" className="bg-charcoal">Price: Low to High</option>
              <option value="price-desc" className="bg-charcoal">Price: High to Low</option>
              <option value="rating-desc" className="bg-charcoal">Top Rated</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-electric-blue" size={48} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredAndSortedCars.map((car, index) => (
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
      
      {filteredAndSortedCars.length === 0 && !loading && (
        <div className="text-center py-24 glass rounded-3xl border-dashed border-white/10">
          <Search className="mx-auto text-white/10 mb-6" size={64} />
          <h3 className="text-2xl font-bold mb-4">NO VEHICLES FOUND</h3>
          <p className="text-white/40 text-lg mb-8 max-w-md mx-auto">
            We couldn't find any vehicles matching your current search or filter criteria.
          </p>
          <button 
            onClick={() => {
              setSearchParams({}, { replace: true });
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            EXPLORE ALL CARS
          </button>
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
      </AnimatePresence>

      <AnimatePresence>
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
