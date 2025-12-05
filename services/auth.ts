import { User } from '../types';
import { db } from './db';

const KEY_SESSION = 'auth_session';

class AuthService {
  async login(email: string, password: string): Promise<User | null> {
    const user = await db.findUserByEmail(email);
    
    // In a real production app, use Supabase Auth or bcrypt here.
    // For this custom implementation requested:
    if (user && user.active && user.passwordHash === password) {
      const sessionUser = { ...user };
      delete sessionUser.passwordHash; 
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