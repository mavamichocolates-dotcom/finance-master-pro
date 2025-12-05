import { Transaction, User, UserRole } from '../types';
import { UNITS } from '../constants';

// Keys for LocalStorage
const KEY_USERS = 'db_users';
const KEY_TRANSACTIONS = 'finance_transactions'; // Keep compatibility with existing data
const KEY_STORES = 'finance_units'; // Keep compatibility

// Initial Admin User
const INITIAL_ADMIN: User = {
  id: 'admin-001',
  name: 'Administrador Master',
  email: 'admin',
  role: 'ADMIN',
  allowedUnits: [], // Admin sees all, logic handled in App
  passwordHash: '123', // Simple simulation
  createdAt: new Date().toISOString(),
  active: true,
};

class DBService {
  // --- USERS ---
  getUsers(): User[] {
    const data = localStorage.getItem(KEY_USERS);
    if (!data) {
      // Seed initial admin
      const users = [INITIAL_ADMIN];
      localStorage.setItem(KEY_USERS, JSON.stringify(users));
      return users;
    }
    return JSON.parse(data);
  }

  saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }

  deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }

  findUserByEmail(email: string): User | undefined {
    return this.getUsers().find(u => u.email === email);
  }

  // --- TRANSACTIONS ---
  getTransactions(): Transaction[] {
    const data = localStorage.getItem(KEY_TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  }

  saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(KEY_TRANSACTIONS, JSON.stringify(transactions));
  }

  // --- STORES/UNITS ---
  getUnits(): string[] {
    const data = localStorage.getItem(KEY_STORES);
    return data ? JSON.parse(data) : UNITS;
  }

  saveUnits(units: string[]): void {
    localStorage.setItem(KEY_STORES, JSON.stringify(units));
  }
}

export const db = new DBService();