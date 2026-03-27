export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role: 'user' | 'admin';
}

export interface Car {
  id: string;
  model: string;
  description: string;
  detailed_description?: string;
  price_per_day: number;
  image: string;
  available: boolean;
  average_rating?: number;
  total_reviews?: number;
  fuel_type?: string;
  engine?: string;
  transmission?: string;
}

export interface Review {
  id: string;
  car_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: any;
}

export interface Booking {
  id: string;
  car_id: string;
  user_id: string;
  start_date: any;
  end_date: any;
  total_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  created_at?: any;
}

export interface Favorite {
  id: string; // userId_carId
  user_id: string;
  car_id: string;
}

export interface CartItem {
  id: string; // userId_carId
  user_id: string;
  car_id: string;
  created_at?: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
