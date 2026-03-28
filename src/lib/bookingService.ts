import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Booking, Car } from '../types';
import { differenceInDays } from 'date-fns';

export const getTime = (dateObj: any): number => {
  if (!dateObj) return 0;
  if (typeof dateObj === 'string') return new Date(dateObj).getTime();
  if (dateObj instanceof Date) return dateObj.getTime();
  if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
  if (dateObj.seconds) return dateObj.seconds * 1000;
  return new Date(dateObj).getTime();
};

export const checkBookingConflicts = async (carId: string, startDate: string | Date, endDate: string | Date): Promise<boolean> => {
  const colRef = collection(db, 'bookings');
  const q = query(colRef, where('car_id', '==', carId));
  const querySnapshot = await getDocs(q);
  const existingBookings = querySnapshot.docs.map(doc => ({ ...doc.data() } as Booking));

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  const conflict = existingBookings.find(b => {
    if (b.status === 'cancelled') return false;
    
    const bStart = getTime(b.start_date);
    const bEnd = getTime(b.end_date);

    // Overlap logic: (StartA < EndB) and (EndA > StartB)
    // This allows back-to-back bookings (e.g., User A returns at 10 AM, User B picks up at 10 AM)
    return (start < bEnd) && (end > bStart);
  });

  return !!conflict;
};

export const calculateBookingDetails = async (carId: string, startDate: string | Date, endDate: string | Date) => {
  // Fetch the car directly from the database to ensure the price hasn't been tampered with on the client
  const carDoc = await getDoc(doc(db, 'cars', carId));
  if (!carDoc.exists()) throw new Error('Car not found');
  
  const car = carDoc.data() as Car;
  const daysDiff = differenceInDays(new Date(endDate), new Date(startDate));
  const days = daysDiff > 0 ? daysDiff : 1;
  const totalPrice = days * car.price_per_day;

  return { days, totalPrice, car };
};
