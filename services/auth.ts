import { User } from '../types';
import { db } from './db';

const KEY_SESSION = 'auth_session';

class AuthService {
  login(email: string, password: string): User | null {
    const user = db.findUserByEmail(email);
    
    // Simple password check simulation
    // In production, use bcryptjs to compare hashes
    if (user && user.active && user.passwordHash === password) {
      const sessionUser = { ...user };
      delete sessionUser.passwordHash; // Don't store pass in session
      localStorage.setItem(KEY_SESSION, JSON.stringify(sessionUser));
      return sessionUser;
    }
    return null;
  }

  logout(): void {
    localStorage.removeItem(KEY_SESSION);
  }

  getCurrentUser(): User | null {
    const data = localStorage.getItem(KEY_SESSION);
    return data ? JSON.parse(data) : null;
  }

  isAdmin(user: User): boolean {
    return user.role === 'ADMIN';
  }

  canAccessUnit(user: User, unit: string): boolean {
    if (user.role === 'ADMIN') return true;
    return user.allowedUnits.includes(unit);
  }
}

export const auth = new AuthService();