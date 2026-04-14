import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: BASE });

export const getSquads = () => api.get('/squads').then(r => r.data);
export const getSeats = () => api.get('/seats').then(r => r.data);
export const getMembers = (squad_id) => api.get('/members', { params: { squad_id } }).then(r => r.data);
export const getHolidays = () => api.get('/holidays').then(r => r.data);
export const getWeekAllocation = (week_start) => api.get('/week-allocation', { params: { week_start } }).then(r => r.data);
export const getMemberSchedule = (member_id, week_start) => api.get('/member-schedule', { params: { member_id, week_start } }).then(r => r.data);
export const getStats = (week_start) => api.get('/stats', { params: { week_start } }).then(r => r.data);
export const bookSeat = (payload) => api.post('/book-seat', payload).then(r => r.data);
export const releaseSeat = (payload) => api.post('/release-seat', payload).then(r => r.data);
export const markVacation = (payload) => api.post('/vacation', payload).then(r => r.data);
export const removeVacation = (member_id, date) => api.delete('/vacation', { params: { member_id, date } }).then(r => r.data);
export const blockSeat = (payload) => api.post('/block-seat', payload).then(r => r.data);
export const unblockSeat = (member_id, seat_id, date) => api.delete('/block-seat', { params: { member_id, seat_id, date } }).then(r => r.data);
export const resetData = () => api.get('/reset').then(r => r.data);
