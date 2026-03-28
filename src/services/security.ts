import { z } from 'zod';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Input Validation Schemas
export const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional().or(z.literal('')),
  phoneNumber: z.string().regex(/^\+?[0-9\s-]{7,15}$/, 'Invalid phone number').optional().or(z.literal('')),
});

export const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  phone_number: z.string().regex(/^\+?[0-9\s-]{7,15}$/, 'Invalid phone number').optional(),
});

export const bookingSchema = z.object({
  car_id: z.string(),
  start_date: z.date(),
  end_date: z.date(),
  total_price: z.number().positive(),
});

export const reviewSchema = z.object({
  car_id: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10, 'Comment must be at least 10 characters').max(1000),
});

// Security Logger
export const SecurityLogger = {
  async log(event: string, details: any = {}) {
    try {
      const logData = {
        event,
        details,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };
      
      console.warn(`[SECURITY EVENT] ${event}:`, details);
      
      // Log to Firestore for admin review
      await addDoc(collection(db, 'security_logs'), logData);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
};

// Simple Rate Limiter (Client-side)
const rateLimits = new Map<string, { count: number, lastReset: number }>();

export const RateLimiter = {
  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const current = rateLimits.get(key) || { count: 0, lastReset: now };
    
    if (now - current.lastReset > windowMs) {
      current.count = 1;
      current.lastReset = now;
    } else {
      current.count++;
    }
    
    rateLimits.set(key, current);
    
    if (current.count > limit) {
      SecurityLogger.log('RATE_LIMIT_EXCEEDED', { key, limit, windowMs });
      return false;
    }
    
    return true;
  }
};
