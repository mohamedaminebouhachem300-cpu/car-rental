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
  const fuelFilter = searchParams.get('fuel') || '';
  const transFilter = searchParams.get('trans') || '';
  const seatsFilter = searchParams.get('seats') || '';

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const unsubscribeCars = dbService.subscribeToCollection<Car>('cars', (data) => {
      setCars(data);
      setLoading(false);
    });
    
    return () => unsubscribeCars();
  }, []);

  useEffect(() => {
    let unsubscribeCart = () => {};
    
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        unsubscribeCart = dbService.subscribeToCollection<CartItem>('cart', (data) => {
          setCartItems(data);
        }, { user_id: user.uid });
      } else {
        setCartItems([]);
        unsubscribeCart();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeCart();
    };
  }, []);

  const getSeats = (desc: string) => {
    const match = desc.match(/(\d+)\s*seats/i);
    return match ? match[1] : '5';
  };

  const getTransmission = (car: Car) => {
    if (car.transmission) return car.transmission.toLowerCase();
    const lowerDesc = car.description.toLowerCase();
    return lowerDesc.includes('automatic') || lowerDesc.includes('auto') ? 'automatic' : 'manual';
  };

  const getFuelType = (car: Car) => {
    if (car.fuel_type) return car.fuel_type.toLowerCase();
    const desc = car.description.toLowerCase();
    if (desc.includes('electric') || desc.includes('ev')) return 'electric';
    if (desc.includes('hybrid')) return 'hybrid';
    if (desc.includes('diesel')) return 'diesel';
    return 'petrol';
  };

  const filteredAndSortedCars = useMemo(() => {
    let result = cars.filter(car => 
      car.model.toLowerCase().includes(search.toLowerCase())
    );

    if (fuelFilter) {
      result = result.filter(car => getFuelType(car) === fuelFilter);
    }
    if (transFilter) {
      result = result.filter(car => getTransmission(car) === transFilter);
    }
    if (seatsFilter) {
      result = result.filter(car => getSeats(car.description) === seatsFilter);
    }

    result.sort((a, b) => {
      if (sort === 'price-asc') return a.price_per_day - b.price_per_day;
      if (sort === 'price-desc') return b.price_per_day - a.price_per_day;
      if (sort === 'rating-desc') return (b.average_rating || 0) - (a.average_rating || 0);
      return 0;
    });

    return result;
  }, [cars, search, sort, fuelFilter, transFilter, seatsFilter]);

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

  const updateFilter = (key: string, val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set(key, val);
    else newParams.delete(key);
    setSearchParams(newParams, { replace: true });
  };

  return (
    <div className="min-h-screen pt-32 pb-24 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
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
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${showFilters ? 'bg-electric-blue border-electric-blue text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <div className="relative w-full sm:w-48 group">
            <select 
              aria-label="Sort cars"
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-10 focus:outline-none focus:border-electric-blue transition-colors cursor-pointer text-sm font-medium"
              value={sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
            >
              <option value="price-asc" className="bg-charcoal">Price: Low to High</option>
              <option value="price-desc" className="bg-charcoal">Price: High to Low</option>
              <option value="rating-desc" className="bg-charcoal">Top Rated</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-12"
          >
            <div className="glass p-6 rounded-2xl border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Fuel Type</label>
                <div className="relative">
                  <select 
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-10 focus:outline-none focus:border-electric-blue transition-colors cursor-pointer text-sm font-medium"
                    value={fuelFilter}
                    onChange={(e) => updateFilter('fuel', e.target.value)}
                  >
                    <option value="" className="bg-charcoal">All Types</option>
                    <option value="petrol" className="bg-charcoal">Petrol</option>
                    <option value="diesel" className="bg-charcoal">Diesel</option>
                    <option value="electric" className="bg-charcoal">Electric</option>
                    <option value="hybrid" className="bg-charcoal">Hybrid</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Transmission</label>
                <div className="relative">
                  <select 
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-10 focus:outline-none focus:border-electric-blue transition-colors cursor-pointer text-sm font-medium"
                    value={transFilter}
                    onChange={(e) => updateFilter('trans', e.target.value)}
                  >
                    <option value="" className="bg-charcoal">All Transmissions</option>
                    <option value="automatic" className="bg-charcoal">Automatic</option>
                    <option value="manual" className="bg-charcoal">Manual</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Seats</label>
                <div className="relative">
                  <select 
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg py-3 pl-4 pr-10 focus:outline-none focus:border-electric-blue transition-colors cursor-pointer text-sm font-medium"
                    value={seatsFilter}
                    onChange={(e) => updateFilter('seats', e.target.value)}
                  >
                    <option value="" className="bg-charcoal">Any</option>
                    <option value="2" className="bg-charcoal">2 Seats</option>
                    <option value="4" className="bg-charcoal">4 Seats</option>
                    <option value="5" className="bg-charcoal">5 Seats</option>
                    <option value="7" className="bg-charcoal">7 Seats</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={16} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
