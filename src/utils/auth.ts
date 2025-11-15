// Simple authentication utilities using localStorage
// In a production app, this would use a backend API

export interface AuthUser {
  id: string;
  email: string;
  createdAt: number;
}

const AUTH_STORAGE_KEY = 'glossika_auth';
const USERS_STORAGE_KEY = 'glossika_users';

// Simple password hashing (in production, use proper hashing like bcrypt)
function hashPassword(password: string): string {
  // This is a simple hash for demo purposes
  // In production, use a proper hashing library
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

export const auth = {
  // Register a new user
  register(email: string, password: string): { success: boolean; error?: string; user?: AuthUser } {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format' };
    }

    try {
      const users: StoredUser[] = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      
      // Check if user already exists
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, error: 'Email already registered' };
      }

      const newUser: StoredUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        createdAt: Date.now(),
      };

      users.push(newUser);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

      const authUser: AuthUser = {
        id: newUser.id,
        email: newUser.email,
        createdAt: newUser.createdAt,
      };

      // Auto-login after registration
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));

      return { success: true, user: authUser };
    } catch (error) {
      return { success: false, error: 'Failed to register user' };
    }
  },

  // Login
  login(email: string, password: string): { success: boolean; error?: string; user?: AuthUser } {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    try {
      const users: StoredUser[] = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      const passwordHash = hashPassword(password);
      
      const user = users.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === passwordHash
      );

      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));

      return { success: true, user: authUser };
    } catch (error) {
      return { success: false, error: 'Failed to login' };
    }
  },

  // Logout
  logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  // Get current user
  getCurrentUser(): AuthUser | null {
    try {
      const data = localStorage.getItem(AUTH_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to get current user:', error);
    }
    return null;
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  },
};

