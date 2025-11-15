import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userProfile } from '../utils/userProfile';
import { auth } from '../utils/auth';
import { UserProfile } from '../types';

export default function UserSettings() {
  const navigate = useNavigate();
  const currentUser = auth.getCurrentUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    const userProfileData = userProfile.getCurrentProfile();
    if (userProfileData) {
      setProfile(userProfileData);
      setUsername(userProfileData.username);
      setEmail(userProfileData.email);
      setIsPublic(userProfileData.isPublic);
    }
  }, [currentUser, navigate]);

  const handleSave = async () => {
    if (!currentUser || !profile) return;

    if (!username.trim()) {
      setMessage({ type: 'error', text: 'Username is required' });
      return;
    }

    // Check username uniqueness
    if (!userProfile.isUsernameAvailable(username.trim(), currentUser.id)) {
      setMessage({ type: 'error', text: 'Username is already taken. Please choose a different username.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Convert avatar file to base64 if provided
      let avatarBase64: string | undefined = undefined;
      if (avatarFile) {
        avatarBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(avatarFile);
        });
      }

      const success = userProfile.updateProfile(currentUser.id, {
        username: username.trim(),
        email: email.trim(),
        isPublic,
        avatar: avatarBase64 ? `data:${avatarFile!.type};base64,${avatarBase64}` : profile.avatar,
      });

      if (success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        
        // Update local state
        const updatedProfile = userProfile.getCurrentProfile();
        if (updatedProfile) {
          setProfile(updatedProfile);
          setAvatarPreview(null);
          setAvatarFile(null);
          
          // Dispatch event to notify other components of avatar change
          window.dispatchEvent(new Event('avatarUpdated'));
        }
      } else {
        setMessage({ type: 'error', text: 'Username is already taken. Please choose a different username.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser || !profile) {
    return <div className="loading">Loading...</div>;
  }

  const avatarUrl = userProfile.getAvatarUrl(profile);

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">User Settings</h1>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        {message && (
          <div
            className={`${message.type === 'success' ? 'success' : 'error'}`}
            style={{
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              backgroundColor: message.type === 'success' ? '#dafbe1' : '#ffebe9',
              color: message.type === 'success' ? '#1a7f37' : '#cf222e',
              border: `1px solid ${message.type === 'success' ? '#2da44e' : '#da3633'}`,
            }}
          >
            {message.text}
          </div>
        )}

        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <label style={{ cursor: 'pointer', display: 'inline-block' }}>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Validate file size (max 2MB)
                  if (file.size > 2 * 1024 * 1024) {
                    setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
                    return;
                  }
                  
                  // Validate file type
                  if (!file.type.startsWith('image/')) {
                    setMessage({ type: 'error', text: 'Please select an image file' });
                    return;
                  }
                  
                  setAvatarFile(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setAvatarPreview(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <img
              src={avatarPreview || avatarUrl}
              alt={username}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '2px solid #d0d7de',
                cursor: 'pointer',
                objectFit: 'cover',
              }}
            />
            <div style={{ fontSize: '12px', color: '#656d76', marginTop: '8px' }}>
              Click to change avatar
            </div>
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
          />
          <div style={{ fontSize: '12px', color: '#656d76', marginTop: '4px' }}>
            This username will be displayed on the leaderboard instead of your email.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f6f8fa', 
            borderRadius: '6px',
            border: '1px solid #d0d7de',
            marginBottom: '16px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Enable Public Profile</span>
            </label>
            <div style={{ fontSize: '14px', color: '#656d76', marginLeft: '24px' }}>
              {isPublic ? (
                <div>
                  <div style={{ color: '#1a7f37', marginBottom: '4px' }}>✓ Your profile is public</div>
                  <div>Other users can:</div>
                  <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                    <li>Search and find your profile</li>
                    <li>View your courses and progress</li>
                    <li>Follow you</li>
                    <li>See your followers and following lists</li>
                  </ul>
                </div>
              ) : (
                <div>
                  <div style={{ color: '#856404', marginBottom: '4px' }}>🔒 Your profile is private</div>
                  <div>Your profile is only visible to you. Enable public profile to allow others to find and follow you.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Followers</label>
          <div style={{ padding: '12px', backgroundColor: '#f6f8fa', borderRadius: '6px' }}>
            {profile.followers.length} {profile.followers.length === 1 ? 'follower' : 'followers'}
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

