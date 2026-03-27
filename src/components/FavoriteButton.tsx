import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { auth } from '../firebase';
import { dbService } from '../services/db';
import { Favorite } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface FavoriteButtonProps {
  carId: string;
  className?: string;
}

export default function FavoriteButton({ carId, className = "" }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const docId = `${user.uid}_${carId}`;
    const checkFavorite = async () => {
      const fav = await dbService.getDocument<Favorite>('favorites', docId);
      setIsFavorite(!!fav);
      setLoading(false);
    };

    checkFavorite();
  }, [user, carId]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please sign in to favorite vehicles.');
      return;
    }

    const docId = `${user.uid}_${carId}`;
    try {
      if (isFavorite) {
        await dbService.deleteDocument('favorites', docId);
        setIsFavorite(false);
        toast.success('Removed from favorites');
      } else {
        const favorite: Favorite = {
          id: docId,
          user_id: user.uid,
          car_id: carId
        };
        await dbService.setDocument('favorites', docId, favorite);
        setIsFavorite(true);
        toast.success('Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    }
  };

  if (loading) return null;

  return (
    <button 
      onClick={toggleFavorite}
      className={`glass p-2 rounded-full hover:bg-white/10 transition-all group ${className}`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isFavorite ? 'fav' : 'not-fav'}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Heart 
            size={20} 
            className={`transition-colors ${isFavorite ? 'text-rose-500 fill-rose-500' : 'text-white/40 group-hover:text-white'}`} 
          />
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
