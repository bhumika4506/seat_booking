import { format, startOfWeek, addDays } from 'date-fns';

export const getMonday = (d) => startOfWeek(d, { weekStartsOn: 1 });
export const getWeekDates = (mondayDate) => Array.from({ length: 5 }, (_, i) => addDays(mondayDate, i));
export const formatDate = (d) => format(d, 'yyyy-MM-dd');
export const formatDisplay = (d) => format(new Date(d + 'T00:00:00'), 'MMM d');
export const dayName = (d) => format(new Date(d + 'T00:00:00'), 'EEE');
export const fullDayName = (d) => format(new Date(d + 'T00:00:00'), 'EEEE');
export const getCurrentWeekStart = () => formatDate(getMonday(new Date()));

export const SQUAD_COLORS = [
  '#2563ff', '#7c3aed', '#0d9488', '#ea580c', '#16a34a',
  '#d97706', '#dc2626', '#0891b2', '#65a30d', '#be185d'
];

export const getSquadColor = (squadId) => {
  if (!squadId) return '#888';
  const num = parseInt(squadId.replace('squad_', '')) - 1;
  return SQUAD_COLORS[num] || '#888';
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};
