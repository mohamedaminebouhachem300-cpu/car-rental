import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car } from '../types';
import { formatCurrency } from '../lib/utils';
import { X, Users, Gauge, ShieldCheck, Zap, Fuel, Calendar, Star, Heart } from 'lucide-react';
import ReviewSection from './ReviewSection';
import FavoriteButton from './FavoriteButton';

interface CarDetailModalProps {
  car: Car;
  onClose: () => void;
  onAddToCart: (car: Car) => void;
}

const getSeats = (desc: string) => {
  const match = desc.match(/(\d+)\s*seats/i);
  return match ? `${match[1]} SEATS` : '5 SEATS';
};

const getTransmission = (car: Car) => {
  if (car.transmission) return car.transmission.toUpperCase();
  const lowerDesc = car.description.toLowerCase();
  return lowerDesc.includes('automatic') || lowerDesc.includes('auto') ? 'AUTO' : 'MANUAL';
};

const getFuelType = (car: Car) => {
  if (car.fuel_type) return car.fuel_type.toUpperCase();
  const desc = car.description.toLowerCase();
  if (desc.includes('electric') || desc.includes('ev')) return 'ELECTRIC';
  if (desc.includes('hybrid')) return 'HYBRID';
  if (desc.includes('diesel')) return 'DIESEL';
  return 'PETROL';
};

const getEngine = (car: Car) => {
  if (car.engine) return car.engine.toUpperCase();
  const desc = car.description.toLowerCase();
  const match = desc.match(/(\d+\.\d+l?)/i);
  return match ? match[1].toUpperCase() : '2.0L';
};

export default function CarDetailModal({ car, onClose, onAddToCart }: CarDetailModalProps) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl glass rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
            <FavoriteButton carId={car.id} />
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col md:flex-row">
            <div className="md:w-1/2 h-64 md:h-auto relative overflow-hidden">
              <img 
                src={car.image} 
                alt={car.model} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden" />
              
              <div className="absolute bottom-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                <Star className="text-emerald fill-emerald" size={14} />
                <span className="text-xs font-bold tracking-widest uppercase">
                  {car.average_rating?.toFixed(1) || '0.0'}
                </span>
                <span className="text-white/40 text-[10px]">({car.total_reviews || 0})</span>
              </div>
            </div>

            <div className="md:w-1/2 p-8 flex flex-col max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="mb-6">
                <div className="flex items-center gap-2 text-electric-blue text-[10px] font-bold tracking-[0.2em] uppercase mb-2">
                  <Zap size={12} />
                  <span>Premium Selection</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tighter mb-2">{car.model}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-electric-blue">{formatCurrency(car.price_per_day)}</span>
                  <span className="text-white/40 text-xs font-bold uppercase tracking-widest">/ Day</span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-white/60 text-sm leading-relaxed">
                  {car.detailed_description || car.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Users size={18} className="text-electric-blue" />
                    </div>
                    <span className="text-xs font-medium">{getSeats(car.description)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Gauge size={18} className="text-electric-blue" />
                    </div>
                    <span className="text-xs font-medium">{getTransmission(car)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Fuel size={18} className="text-electric-blue" />
                    </div>
                    <span className="text-xs font-medium">{getFuelType(car)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Zap size={18} className="text-electric-blue" />
                    </div>
                    <span className="text-xs font-medium">{getEngine(car)}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => onAddToCart(car)}
                className="btn-primary w-full py-4 text-sm font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-3 group mb-8"
              >
                <span>Add to Cart</span>
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Zap size={18} fill="currentColor" />
                </motion.div>
              </button>

              <ReviewSection car={car} />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
