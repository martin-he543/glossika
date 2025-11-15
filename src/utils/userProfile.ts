import { UserProfile } from '../types';
import { auth } from './auth';

const USER_PROFILES_STORAGE_KEY = 'glossika_user_profiles';

function loadProfiles(): UserProfile[] {
  try {
    const data = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load user profiles:', error);
    return [];
  }
}

function saveProfiles(profiles: UserProfile[]): void {
  try {
    localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (error) {
    console.error('Failed to save user profiles:', error);
  }
}

function fixDuplicateUsernames(): void {
  const profiles = loadProfiles();
  const usernameMap = new Map<string, string[]>(); // username -> userIds
  
  // Group profiles by username (case-insensitive)
  profiles.forEach(profile => {
    const lowerUsername = profile.username.toLowerCase();
    if (!usernameMap.has(lowerUsername)) {
      usernameMap.set(lowerUsername, []);
    }
    usernameMap.get(lowerUsername)!.push(profile.userId);
  });
  
  // Fix duplicates by appending numbers
  let hasChanges = false;
  usernameMap.forEach((userIds, lowerUsername) => {
    if (userIds.length > 1) {
      // Multiple users with same username - fix them
      const baseUsername = profiles.find(p => p.userId === userIds[0])?.username || lowerUsername;
      userIds.slice(1).forEach((userId, index) => {
        const profile = profiles.find(p => p.userId === userId);
        if (profile) {
          const newUsername = `${baseUsername}${index + 1}`;
          // Make sure the new username doesn't conflict
          let finalUsername = newUsername;
          let counter = index + 2;
          while (profiles.some(p => p.userId !== userId && p.username.toLowerCase() === finalUsername.toLowerCase())) {
            finalUsername = `${baseUsername}${counter}`;
            counter++;
          }
          profile.username = finalUsername;
          profile.updatedAt = Date.now();
          hasChanges = true;
        }
      });
    }
  });
  
  if (hasChanges) {
    saveProfiles(profiles);
  }
}

function getOrCreateProfile(userId: string, email: string): UserProfile {
  // Fix any existing duplicates first
  fixDuplicateUsernames();
  
  const profiles = loadProfiles();
  let profile = profiles.find(p => p.userId === userId);

  if (!profile) {
    // Generate username from email, ensuring uniqueness
    let baseUsername = email.split('@')[0];
    let username = baseUsername;
    let counter = 1;
    
    // Check if username exists and append number if needed
    while (profiles.some(p => p.username.toLowerCase() === username.toLowerCase())) {
      username = `${baseUsername}${counter}`;
      counter++;
    }
    
    profile = {
      userId,
      username,
      email,
      isPublic: false,
      followers: [],
      following: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    profiles.push(profile);
    saveProfiles(profiles);
  }

  return profile;
}

// Generate avatar from username/email
function generateAvatar(username: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
  ];
  const color = colors[username.charCodeAt(0) % colors.length];
  const initial = username.charAt(0).toUpperCase();
  
  // Return SVG as data URL
  const svg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="${color}"/>
      <text x="16" y="21" font-family="Arial" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export const userProfile = {
  getProfile(userId: string): UserProfile | null {
    const profiles = loadProfiles();
    return profiles.find(p => p.userId === userId) || null;
  },

  getCurrentProfile(): UserProfile | null {
    const user = auth.getCurrentUser();
    if (!user) return null;
    // Fix duplicates before returning profile
    fixDuplicateUsernames();
    return getOrCreateProfile(user.id, user.email);
  },

  isUsernameAvailable(username: string, excludeUserId?: string): boolean {
    const profiles = loadProfiles();
    const lowerUsername = username.toLowerCase().trim();
    return !profiles.some(p => 
      p.username.toLowerCase().trim() === lowerUsername && 
      p.userId !== excludeUserId
    );
  },

  updateProfile(userId: string, updates: Partial<UserProfile>): boolean {
    const profiles = loadProfiles();
    const index = profiles.findIndex(p => p.userId === userId);
    
    // Check username uniqueness if username is being updated
    if (updates.username) {
      const trimmedUsername = updates.username.trim();
      if (!this.isUsernameAvailable(trimmedUsername, userId)) {
        return false; // Username already taken
      }
    }
    
    if (index !== -1) {
      profiles[index] = {
        ...profiles[index],
        ...updates,
        updatedAt: Date.now(),
      };
      saveProfiles(profiles);
      return true;
    } else {
      // Create new profile if it doesn't exist
      const user = auth.getCurrentUser();
      if (user && user.id === userId) {
        const newProfile = getOrCreateProfile(userId, user.email);
        const updatedProfile = {
          ...newProfile,
          ...updates,
          updatedAt: Date.now(),
        };
        profiles.push(updatedProfile);
        saveProfiles(profiles);
        return true;
      }
    }
    return false;
  },

  getAvatarUrl(profile: UserProfile | null): string {
    if (!profile) return '';
    if (profile.avatar) return profile.avatar;
    return generateAvatar(profile.username);
  },

  followUser(followerId: string, followingId: string): void {
    if (followerId === followingId) return;
    
    const profiles = loadProfiles();
    const followerProfile = profiles.find(p => p.userId === followerId);
    const followingProfile = profiles.find(p => p.userId === followingId);
    
    if (followerProfile && followingProfile) {
      if (!followerProfile.following.includes(followingId)) {
        followerProfile.following.push(followingId);
      }
      if (!followingProfile.followers.includes(followerId)) {
        followingProfile.followers.push(followerId);
      }
      saveProfiles(profiles);
    }
  },

  unfollowUser(followerId: string, followingId: string): void {
    const profiles = loadProfiles();
    const followerProfile = profiles.find(p => p.userId === followerId);
    const followingProfile = profiles.find(p => p.userId === followingId);
    
    if (followerProfile && followingProfile) {
      followerProfile.following = followerProfile.following.filter(id => id !== followingId);
      followingProfile.followers = followingProfile.followers.filter(id => id !== followerId);
      saveProfiles(profiles);
    }
  },

  searchUsers(query: string, limit: number = 20): UserProfile[] {
    const profiles = loadProfiles();
    const lowerQuery = query.toLowerCase();
    
    return profiles
      .filter(p => 
        p.username.toLowerCase().includes(lowerQuery) ||
        p.email.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limit);
  },
};

