import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userProfile } from '../utils/userProfile';
import { auth } from '../utils/auth';
import './UserAvatar.css';

interface UserAvatarProps {
  onLogout: () => void;
}

export default function UserAvatar({ onLogout }: UserAvatarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const currentUser = auth.getCurrentUser();
  const profile = currentUser ? userProfile.getCurrentProfile() : null;
  const avatarUrl = userProfile.getAvatarUrl(profile);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  if (!currentUser || !profile) {
    return null;
  }

  const handleSettings = () => {
    setShowDropdown(false);
    navigate('/settings');
  };

  const handleProfile = () => {
    setShowDropdown(false);
    navigate('/profile');
  };

  const handleLeaderboard = () => {
    setShowDropdown(false);
    navigate('/leaderboard');
  };

  const handleSignOut = () => {
    setShowDropdown(false);
    onLogout();
  };

  return (
    <div className="user-avatar-container" ref={dropdownRef}>
      <button
        className="user-avatar-button"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="User menu"
      >
        <img
          src={avatarUrl}
          alt={profile.username}
          className="user-avatar-image"
        />
      </button>

      {showDropdown && (
        <div className="user-avatar-dropdown">
          <div className="user-avatar-dropdown-header">
            <img
              src={avatarUrl}
              alt={profile.username}
              className="user-avatar-dropdown-image"
            />
            <div>
              <div className="user-avatar-dropdown-username">{profile.username}</div>
              <div className="user-avatar-dropdown-email">{profile.email}</div>
            </div>
          </div>
          <div className="user-avatar-dropdown-divider" />
          <button className="user-avatar-dropdown-item" onClick={handleProfile}>
            Profile
          </button>
          <button className="user-avatar-dropdown-item" onClick={handleSettings}>
            Settings
          </button>
          <button className="user-avatar-dropdown-item" onClick={handleLeaderboard}>
            Leaderboard
          </button>
          <div className="user-avatar-dropdown-divider" />
          <button className="user-avatar-dropdown-item" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

