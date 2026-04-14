import axios from 'axios';

const API_URL = 'http://127.0.0.1:8001';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('seatflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('seatflow_token');
      window.dispatchEvent(new Event('auth-error'));
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (data) => api.post('/login', data);
export const getMe = () => api.get('/me');

// Base
export const getHolidays = () => api.get('/holidays');
export const getSquads = () => api.get('/squads');
export const getSeats = () => api.get('/seats');
export const getMembers = (squadId) => api.get('/members' + (squadId ? `?squad_id=${squadId}` : ''));

// Bookings
export const getWeekAllocation = (weekStart) => api.get(`/week-allocation?week_start=${weekStart}`);
export const getMemberSchedule = (memberId, weekStart) => api.get(`/member-schedule?member_id=${memberId}&week_start=${weekStart}`);
export const bookSeat = (data) => api.post('/book-seat', data);
export const bookRecurring = (data) => api.post('/book-recurring', data);
export const modifyBooking = (data) => api.post('/modify-booking', data);
export const releaseSeat = (data) => api.post('/release-seat', data);

// Check-in
export const checkIn = (data) => api.post('/checkin', data);
export const checkOut = (data) => api.post('/checkout', data);
export const getCheckinStatus = (memberId, date) => api.get(`/checkin-status?member_id=${memberId}&date=${date}`);
export const getBookingHistory = (memberId) => api.get(`/booking-history?member_id=${memberId}`);

// Vacation & Blocks
export const markVacation = (data) => api.post('/vacation', data);
export const removeVacation = (memberId, date) => api.delete(`/vacation?member_id=${memberId}&date=${date}`);
export const blockSeat = (data) => api.post('/block-seat', data);
export const unblockSeat = (memberId, seatId, date) => api.delete(`/block-seat?member_id=${memberId}&seat_id=${seatId}&date=${date}`);

// Notifications
export const getNotifications = (memberId) => api.get(`/notifications?member_id=${memberId}`);
export const markNotificationsRead = (memberId) => api.put(`/notifications/read?member_id=${memberId}`);

// Stats
export const getStats = (weekStart) => api.get(`/stats?week_start=${weekStart}`);

// Admin
export const getAdminStats = () => api.get('/admin/stats');
export const adminAddSeat = (data) => api.post('/admin/seat', data);
export const adminUpdateSeat = (seatId, data) => api.put(`/admin/seat/${seatId}`, data);
export const adminRemoveSeat = (seatId) => api.delete(`/admin/seat/${seatId}`);

export const resetData = () => api.get('/reset');
