import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { dbService } from '../services/db';
import { Car, Booking, User } from '../types';
import { motion } from 'motion/react';
import { Car as CarIcon, Calendar, Users, Edit, Trash2, Plus, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'cars' | 'bookings' | 'users'>('cars');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [isAddingCar, setIsAddingCar] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      if (user.email === 'mohamedaminebouhachem300@gmail.com') {
        setIsAdmin(true);
      } else {
        const userDoc = await dbService.getDocument<User>('users', user.uid);
        setIsAdmin(userDoc?.role === 'admin');
      }
      setLoading(false);
    };

    checkAdmin();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubCars = dbService.subscribeToCollection<Car>('cars', setCars);
    const unsubBookings = dbService.subscribeToCollection<Booking>('bookings', setBookings);
    const unsubUsers = dbService.subscribeToCollection<User>('users', setUsers);

    return () => {
      unsubCars();
      unsubBookings();
      unsubUsers();
    };
  }, [isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-electric-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center flex-col">
        <h1 className="text-4xl font-bold mb-4 text-rose-500">Access Denied</h1>
        <p className="text-white/60">You do not have permission to view this page.</p>
      </div>
    );
  }

  const handleSaveCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCar) return;

    try {
      if (isAddingCar) {
        const newCar = { ...editingCar, id: `car-${Date.now()}` };
        await dbService.setDocument('cars', newCar.id, newCar);
        toast.success('Car added successfully');
      } else {
        await dbService.updateDocument('cars', editingCar.id, editingCar);
        toast.success('Car updated successfully');
      }
      setEditingCar(null);
      setIsAddingCar(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save car');
    }
  };

  const handleDeleteCar = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this car?')) return;
    try {
      await dbService.deleteDocument('cars', id);
      toast.success('Car deleted successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete car');
    }
  };

  const handleUpdateBookingStatus = async (id: string, status: Booking['status']) => {
    try {
      await dbService.updateDocument('bookings', id, { status });
      toast.success(`Booking marked as ${status}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update booking status');
    }
  };

  const safeFormatDate = (dateObj: any, formatStr: string) => {
    if (!dateObj) return 'N/A';
    try {
      let d: Date;
      if (typeof dateObj === 'string') d = new Date(dateObj);
      else if (dateObj instanceof Date) d = dateObj;
      else if (typeof dateObj.toDate === 'function') d = dateObj.toDate();
      else if (dateObj.seconds) d = new Date(dateObj.seconds * 1000);
      else d = new Date(dateObj);
      return format(d, formatStr);
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const getBookingDate = (dateObj: any) => {
    if (!dateObj) return new Date(0);
    if (typeof dateObj === 'string') return new Date(dateObj);
    if (dateObj instanceof Date) return dateObj;
    if (typeof dateObj.toDate === 'function') return dateObj.toDate();
    if (dateObj.seconds) return new Date(dateObj.seconds * 1000);
    return new Date(dateObj);
  };

  const totalMonthlyRevenue = bookings.reduce((total, booking) => {
    if (booking.status !== 'cancelled') {
      const bookingDate = getBookingDate(booking.start_date);
      if (bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear) {
        return total + booking.total_price;
      }
    }
    return total;
  }, 0);

  const getCarMonthlyRevenue = (carId: string) => {
    return bookings.reduce((total, booking) => {
      if (booking.car_id === carId && booking.status !== 'cancelled') {
        const bookingDate = getBookingDate(booking.start_date);
        if (bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear) {
          return total + booking.total_price;
        }
      }
      return total;
    }, 0);
  };

  const handleToggleAvailability = async (car: Car) => {
    try {
      await dbService.updateDocument('cars', car.id, { available: !car.available });
      toast.success(`Car marked as ${!car.available ? 'available' : 'unavailable'}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update car availability');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-bold tracking-tighter">Admin Dashboard</h1>
      </div>

      <div className="flex gap-4 mb-8 border-b border-white/10 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('cars')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'cars' ? 'bg-electric-blue text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          <CarIcon size={18} />
          Cars Management
        </button>
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'bookings' ? 'bg-electric-blue text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Calendar size={18} />
          Bookings
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'users' ? 'bg-electric-blue text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Users size={18} />
          Users
        </button>
      </div>

      {activeTab === 'cars' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white/60 text-sm font-medium mb-2">Total Monthly Revenue</h3>
              <p className="text-3xl font-bold text-emerald">${totalMonthlyRevenue.toLocaleString()}</p>
              <p className="text-xs text-white/40 mt-2">For {format(new Date(), 'MMMM yyyy')}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white/60 text-sm font-medium mb-2">Total Fleet Size</h3>
              <p className="text-3xl font-bold">{cars.length}</p>
              <p className="text-xs text-white/40 mt-2">Registered vehicles</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-white/60 text-sm font-medium mb-2">Active Bookings</h3>
              <p className="text-3xl font-bold text-electric-blue">
                {bookings.filter(b => b.status === 'confirmed' || b.status === 'in-progress').length}
              </p>
              <p className="text-xs text-white/40 mt-2">Currently ongoing or upcoming</p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Fleet Management</h2>
            <button
              onClick={() => {
                setEditingCar({
                  id: '',
                  model: '',
                  description: '',
                  price_per_day: 0,
                  image: '',
                  available: true,
                });
                setIsAddingCar(true);
              }}
              className="flex items-center gap-2 bg-electric-blue text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus size={18} />
              Add New Car
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-medium text-white/60">Image</th>
                  <th className="p-4 font-medium text-white/60">Model</th>
                  <th className="p-4 font-medium text-white/60">Price/Day</th>
                  <th className="p-4 font-medium text-white/60">Monthly Rev</th>
                  <th className="p-4 font-medium text-white/60">Status</th>
                  <th className="p-4 font-medium text-white/60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => (
                  <tr key={car.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <img src={car.image} alt={car.model} className="w-16 h-12 object-cover rounded" />
                    </td>
                    <td className="p-4 font-medium">{car.model}</td>
                    <td className="p-4">${car.price_per_day}</td>
                    <td className="p-4 font-medium text-emerald">${getCarMonthlyRevenue(car.id).toLocaleString()}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleAvailability(car)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          car.available ? 'bg-emerald' : 'bg-white/20'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            car.available ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingCar(car);
                            setIsAddingCar(false);
                          }}
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCar(car.id)}
                          className="p-2 bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'bookings' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-medium text-white/60">ID</th>
                  <th className="p-4 font-medium text-white/60">User</th>
                  <th className="p-4 font-medium text-white/60">Car</th>
                  <th className="p-4 font-medium text-white/60">Dates</th>
                  <th className="p-4 font-medium text-white/60">Total</th>
                  <th className="p-4 font-medium text-white/60">Status</th>
                  <th className="p-4 font-medium text-white/60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const user = users.find(u => u.id === booking.user_id);
                  const car = cars.find(c => c.id === booking.car_id);
                  return (
                    <tr key={booking.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-sm font-mono text-white/40">{booking.id.slice(0, 8)}...</td>
                      <td className="p-4">
                        <div className="font-medium">{user?.full_name || 'Unknown User'}</div>
                        <div className="text-xs text-white/40">{user?.email}</div>
                      </td>
                      <td className="p-4">{car?.model || 'Unknown Car'}</td>
                      <td className="p-4 text-sm">
                        {safeFormatDate(booking.start_date, 'MMM d')} - {safeFormatDate(booking.end_date, 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 font-medium">${booking.total_price}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                          booking.status === 'confirmed' ? 'bg-emerald/20 text-emerald' :
                          booking.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                          booking.status === 'completed' ? 'bg-blue-500/20 text-blue-500' :
                          'bg-rose-500/20 text-rose-500'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <select
                          value={booking.status}
                          onChange={(e) => handleUpdateBookingStatus(booking.id, e.target.value as any)}
                          className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-electric-blue"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-medium text-white/60">Name</th>
                  <th className="p-4 font-medium text-white/60">Email</th>
                  <th className="p-4 font-medium text-white/60">Phone</th>
                  <th className="p-4 font-medium text-white/60">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 font-medium">{user.full_name}</td>
                    <td className="p-4 text-white/80">{user.email}</td>
                    <td className="p-4 text-white/60">{user.phone_number || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                        user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-white/80'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Edit/Add Car Modal */}
      {editingCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-charcoal border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{isAddingCar ? 'Add New Car' : 'Edit Car'}</h2>
              <button onClick={() => setEditingCar(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCar} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Model Name</label>
                  <input
                    type="text"
                    required
                    value={editingCar.model}
                    onChange={(e) => setEditingCar({ ...editingCar, model: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Price Per Day ($)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingCar.price_per_day}
                    onChange={(e) => setEditingCar({ ...editingCar, price_per_day: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Image URL</label>
                <input
                  type="url"
                  required
                  value={editingCar.image}
                  onChange={(e) => setEditingCar({ ...editingCar, image: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Short Description</label>
                <input
                  type="text"
                  required
                  value={editingCar.description}
                  onChange={(e) => setEditingCar({ ...editingCar, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Detailed Description</label>
                <textarea
                  rows={4}
                  value={editingCar.detailed_description || ''}
                  onChange={(e) => setEditingCar({ ...editingCar, detailed_description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Fuel Type</label>
                  <input
                    type="text"
                    value={editingCar.fuel_type || ''}
                    onChange={(e) => setEditingCar({ ...editingCar, fuel_type: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Engine</label>
                  <input
                    type="text"
                    value={editingCar.engine || ''}
                    onChange={(e) => setEditingCar({ ...editingCar, engine: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Transmission</label>
                  <input
                    type="text"
                    value={editingCar.transmission || ''}
                    onChange={(e) => setEditingCar({ ...editingCar, transmission: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-electric-blue"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="available"
                  checked={editingCar.available}
                  onChange={(e) => setEditingCar({ ...editingCar, available: e.target.checked })}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-electric-blue focus:ring-electric-blue"
                />
                <label htmlFor="available" className="text-sm font-medium">
                  Available for booking
                </label>
              </div>

              <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingCar(null)}
                  className="px-6 py-2 rounded-lg font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-electric-blue text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  <Save size={18} />
                  Save Car
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
