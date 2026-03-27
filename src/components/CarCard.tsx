import { motion } from 'motion/react';
import { useState } from 'react';
import { Car as CarType } from '../types';
import { formatCurrency } from '../lib/utils';
import { Users, Gauge, ShieldCheck, Info, Star, Fuel, Zap } from 'lucide-react';
import FavoriteButton from './FavoriteButton';

interface CarCardProps {
  car: CarType;
  onClick: (car: CarType) => void;
  onRent: (car: CarType) => void;
}

const getSeats = (desc: string) => {
  const match = desc.match(/(\d+)\s*seats/i);
  return match ? `${match[1]} SEATS` : '5 SEATS';
};

const getTransmission = (car: CarType) => {
  if (car.transmission) return car.transmission.toUpperCase();
  const lowerDesc = car.description.toLowerCase();
  return lowerDesc.includes('automatic') || lowerDesc.includes('auto') ? 'AUTO' : 'MANUAL';
};

const getFuelType = (car: CarType) => {
  if (car.fuel_type) return car.fuel_type.toUpperCase();
  const desc = car.description.toLowerCase();
  if (desc.includes('electric') || desc.includes('ev')) return 'ELECTRIC';
  if (desc.includes('hybrid')) return 'HYBRID';
  if (desc.includes('diesel')) return 'DIESEL';
  return 'PETROL';
};

const getEngine = (car: CarType) => {
  if (car.engine) return car.engine.toUpperCase();
  const desc = car.description.toLowerCase();
  const match = desc.match(/(\d+\.\d+l?)/i);
  return match ? match[1].toUpperCase() : '2.0L';
};

export default function CarCard({ car, onClick, onRent }: CarCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl overflow-hidden group hover:border-electric-blue/30 transition-all duration-300 h-full flex flex-col relative"
    >
      <div 
        className="relative h-48 overflow-hidden bg-white/5 cursor-pointer"
        onClick={() => onClick(car)}
      >
        <img 
          src={car.image} 
          alt={car.model} 
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy="no-referrer"
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/10 border-t-electric-blue rounded-full animate-spin" />
          </div>
        )}
        <div className="absolute top-4 left-4 flex items-center gap-1.5 glass px-2 py-1 rounded-full text-[10px] font-bold text-white/90 border border-white/10">
          <Star className="text-emerald fill-emerald" size={10} />
          <span>{car.average_rating?.toFixed(1) || '0.0'}</span>
          <span className="text-white/40">({car.total_reviews || 0})</span>
        </div>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <FavoriteButton carId={car.id} />
          <div className="glass px-3 py-1 rounded-full text-xs font-bold text-emerald">
            AVAILABLE
          </div>
        </div>
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-electric-blue p-3 rounded-full scale-75 group-hover:scale-100 transition-transform">
            <Info className="text-white" size={24} />
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div 
          className="flex justify-between items-start mb-4 gap-3 cursor-pointer"
          onClick={() => onClick(car)}
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold tracking-tight mb-1 truncate" title={car.model}>{car.model}</h3>
            <p className="text-white/40 text-xs line-clamp-1 mb-2 italic">
              {car.description}
            </p>
            <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-widest font-bold">
              <span>PREMIUM FLEET</span>
              <span className="w-1 h-1 rounded-full bg-electric-blue" />
              <span>VIEW DETAILS</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-electric-blue leading-none">
              {formatCurrency(car.price_per_day)}
            </span>
            <span className="text-white/40 text-[10px] font-bold block mt-1 uppercase tracking-tighter">/ DAY</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-4 mb-6">
          <div className="flex items-center gap-3">
            <Users size={14} className="text-white/40" />
            <span className="text-[9px] text-white/60 uppercase font-bold tracking-widest">{getSeats(car.description)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Gauge size={14} className="text-white/40" />
            <span className="text-[9px] text-white/60 uppercase font-bold tracking-widest">{getTransmission(car)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Fuel size={14} className="text-white/40" />
            <span className="text-[9px] text-white/60 uppercase font-bold tracking-widest">{getFuelType(car)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Zap size={14} className="text-white/40" />
            <span className="text-[9px] text-white/60 uppercase font-bold tracking-widest">{getEngine(car)}</span>
          </div>
        </div>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRent(car);
          }}
          className="btn-primary w-full py-3 text-xs font-bold tracking-[0.2em] uppercase mt-auto"
        >
          RENT NOW
        </button>
      </div>
    </motion.div>
  );
}
