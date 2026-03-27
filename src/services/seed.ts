import { dbService } from './db';
import { Car } from '../types';

const INITIAL_CARS: Car[] = [
  {
    id: 'car-1',
    model: 'Porsche 911 Carrera',
    description: 'Automatic, 2 seats, AC, 0-60 in 3.8s',
    detailed_description: 'The Porsche 911 Carrera is the quintessential sports car. With its iconic silhouette and legendary rear-engine layout, it offers an unmatched driving experience. This model features a twin-turbocharged flat-six engine, delivering exhilarating performance and precision handling that sets the standard for all others.',
    price_per_day: 450,
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=1000',
    available: true,
    average_rating: 0,
    total_reviews: 0
  },
  {
    id: 'car-2',
    model: 'Mercedes-Benz G-Class',
    description: 'Automatic, 5 seats, AC, 4x4 Luxury',
    detailed_description: 'The Mercedes-Benz G-Class, or G-Wagon, is a luxury off-road icon. Combining rugged capability with opulent interiors, it is as comfortable on city streets as it is on challenging terrain. This vehicle features advanced all-wheel drive, a powerful V8 engine, and the latest in safety and entertainment technology.',
    price_per_day: 600,
    image: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?auto=format&fit=crop&q=80&w=1000',
    available: true,
    average_rating: 0,
    total_reviews: 0
  },
  {
    id: 'car-3',
    model: 'Tesla Model S Plaid',
    description: 'Electric, 5 seats, AC, Full Autopilot',
    detailed_description: 'The Tesla Model S Plaid is the quickest accelerating car in production today. With over 1,000 horsepower and a tri-motor all-wheel drive system, it redefines what is possible for electric vehicles. It also features a futuristic interior with a yoke steering wheel and a massive cinematic display.',
    price_per_day: 350,
    image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&q=80&w=1000',
    available: true,
    average_rating: 0,
    total_reviews: 0
  },
  {
    id: 'car-4',
    model: 'Audi R8 Spyder',
    description: 'Automatic, 2 seats, AC, V10 Performance',
    detailed_description: 'The Audi R8 Spyder is a masterpiece of engineering and design. Its naturally aspirated V10 engine produces a spine-tingling sound, while its open-top design allows you to fully immerse yourself in the driving experience. It features Audi\'s legendary Quattro all-wheel drive for exceptional grip.',
    price_per_day: 550,
    image: 'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?auto=format&fit=crop&q=80&w=1000',
    available: true,
    average_rating: 0,
    total_reviews: 0
  },
  {
    id: 'car-5',
    model: 'BMW M8 Competition',
    description: 'Automatic, 4 seats, AC, Luxury Sport',
    detailed_description: 'The BMW M8 Competition is the pinnacle of BMW M performance. This luxury coupe combines extreme power with refined elegance. Its twin-turbo V8 engine and M-tuned suspension provide incredible speed and agility, while the interior offers the highest level of craftsmanship and comfort.',
    price_per_day: 400,
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=1000',
    available: true,
    average_rating: 0,
    total_reviews: 0
  },
  {
    id: 'car-6',
    model: 'Range Rover Autobiography',
    description: 'Automatic, 5 seats, AC, Ultimate Comfort',
    detailed_description: 'The Range Rover Autobiography is the ultimate expression of luxury SUV capability. It offers a serene and sophisticated environment, with premium materials and advanced features throughout. Whether you\'re being chauffeured or driving yourself, it provides an unparalleled sense of occasion and comfort.',
    price_per_day: 500,
    image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=1000',
    available: true,
    average_rating: 0,
    total_reviews: 0
  }
];

export async function seedCars() {
  console.log('CHECKING FLEET DATA...');
  
  for (const car of INITIAL_CARS) {
    // Always update/set to ensure data integrity (prices, images, etc.)
    await dbService.setDocument('cars', car.id, car);
  }
  
  console.log('FLEET DATA SYNCHRONIZED.');
}
