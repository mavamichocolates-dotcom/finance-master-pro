import { User } from '../types';
import { db } from './db';

const KEY_SESSION = 'auth_session';

// CREDENCIAIS MESTRAS UNIVERSAIS
// Use isso para acessar o sistema se o banco de dados estiver vazio ou inacessível.
const UNIVERSAL_MASTER_CREDENTIALS = {
  email: 'admin',
  password: 'master_unlock_2024'
};

class AuthService {
  async login(email: string, password: string): Promise<User | null> {
    
    // 1. CHECK MASTER CREDENTIALS (Bypass DB)
    if (email === UNIVERSAL_MASTER_CREDENTIALS.email && password === UNIVERSAL_MASTER_CREDENTIALS.password) {
      const masterUser: User = {
        id: 'master-override',
        name: 'Master Admin',
        email: 'admin@master.system',
        role: 'ADMIN',
        allowedUnits: [], // Admin has access to all anyway
        active: true,
        createdAt: new Date().toISOString()
      };
      this.setSession(masterUser);
      return masterUser;
    }

    // 2. CHECK DATABASE
    const user = await db.findUserByEmail(email);
    
    // In a real production app, use Supabase Auth or bcrypt here.
    // For this custom implementation requested:
    if (user && user.active && user.passwordHash === password) {
      this.setSession(user);
      return user;
    }
    return null;
  }

  private setSession(user: User) {
    const sessionUser = { ...user };
    if (sessionUser.passwordHash) delete sessionUser.passwordHash;
    localStorage.setItem(KEY_SESSION, JSON.stringify(sessionUser));
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