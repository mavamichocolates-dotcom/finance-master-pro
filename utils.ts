export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

export const getMonthName = (dateString: string): string => {
   if (!dateString) return '-';
   const date = new Date(dateString);
   // Fix timezone offset issue for simple date strings
   const userTimezoneOffset = date.getTimezoneOffset() * 60000;
   const adjustedDate = new Date(date.getTime() + userTimezoneOffset);
   
   return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(adjustedDate);
};

export const generateId = (): string => {
  // Use crypto.randomUUID if available (Modern & Secure)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments (High entropy)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};