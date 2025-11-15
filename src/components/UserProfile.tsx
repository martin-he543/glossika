import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userProfile } from '../utils/userProfile';
import { auth } from '../utils/auth';
import { storage } from '../storage';
import { UserProfile as UserProfileType } from '../types';
import { AppState } from '../types';

interface UserProfileProps {
  appState: AppState;
}

export default function UserProfile({ appState }: UserProfileProps) {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const currentUser = auth.getCurrentUser();
  const [viewingProfile, setViewingProfile] = useState<UserProfileType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfileType[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (userId) {
      const profile = userProfile.getProfile(userId);
      if (profile) {
        setViewingProfile(profile);
        if (currentUser) {
          const currentProfile = userProfile.getCurrentProfile();
          setIsFollowing(currentProfile?.following.includes(userId) || false);
        }
      }
    } else if (currentUser) {
      const profile = userProfile.getCurrentProfile();
      setViewingProfile(profile);
    }
  }, [userId, currentUser]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = userProfile.searchUsers(searchQuery.trim());
    setSearchResults(results);
  };

  const handleFollow = () => {
    if (!currentUser || !viewingProfile) return;

    // Can't follow private profiles
    if (!viewingProfile.isPublic) {
      return;
    }

    const currentProfile = userProfile.getCurrentProfile();
    if (!currentProfile) return;

    if (isFollowing) {
      userProfile.unfollowUser(currentUser.id, viewingProfile.userId);
    } else {
      userProfile.followUser(currentUser.id, viewingProfile.userId);
    }

    setIsFollowing(!isFollowing);
    
    // Refresh profile
    const updatedProfile = userProfile.getProfile(viewingProfile.userId);
    if (updatedProfile) {
      setViewingProfile(updatedProfile);
    }
  };

  const handleViewUser = (targetUserId: string) => {
    navigate(`/profile/${targetUserId}`);
  };

  if (!currentUser) {
    return <div className="loading">Please log in to view profiles</div>;
  }

  const currentProfile = userProfile.getCurrentProfile();
  const isOwnProfile = !userId || (currentUser && userId === currentUser.id);
  const displayProfile = viewingProfile || currentProfile;

  if (!displayProfile) {
    return <div className="loading">Loading profile...</div>;
  }

  const avatarUrl = userProfile.getAvatarUrl(displayProfile);

  // Get user's courses
  const userCourses = appState.courses.filter(c => 
    c.author === displayProfile.username || 
    (isOwnProfile && currentUser && c.id) // Show own courses
  );
  const userClozeCourses = appState.clozeCourses.filter(c => 
    c.author === displayProfile.username || 
    (isOwnProfile && currentUser && c.id)
  );

  // Get followers' profiles
  const followersProfiles = displayProfile.followers
    .map(id => userProfile.getProfile(id))
    .filter((p): p is UserProfileType => p !== null);

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">
          {isOwnProfile ? 'Your Profile' : `${displayProfile.username}'s Profile`}
        </h1>
        {!isOwnProfile && displayProfile.isPublic && (
          <button
            className={`btn ${isFollowing ? '' : 'btn-primary'}`}
            onClick={handleFollow}
          >
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      {/* Profile Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          <img
            src={avatarUrl}
            alt={displayProfile.username}
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              border: '2px solid #d0d7de',
            }}
          />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>{displayProfile.username}</h2>
            <div style={{ color: '#656d76', marginBottom: '16px' }}>{displayProfile.email}</div>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#656d76' }}>Followers</div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>{displayProfile.followers.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#656d76' }}>Following</div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>{displayProfile.following.length}</div>
              </div>
            </div>
            {displayProfile.isPublic ? (
              <div style={{ padding: '8px 12px', backgroundColor: '#dafbe1', borderRadius: '6px', color: '#1a7f37', fontSize: '14px', display: 'inline-block' }}>
                ✓ Public Profile
              </div>
            ) : (
              <div style={{ padding: '8px 12px', backgroundColor: '#fff3cd', borderRadius: '6px', color: '#856404', fontSize: '14px', display: 'inline-block' }}>
                🔒 Private Profile
              </div>
            )}
            {!displayProfile.isPublic && !isOwnProfile && (
              <div style={{ padding: '12px', backgroundColor: '#ffebe9', borderRadius: '6px', color: '#cf222e', marginTop: '12px', fontSize: '14px' }}>
                This profile is private. Only the owner can view the full profile.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Users */}
      {isOwnProfile && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Search Users</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by username or email..."
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleSearch}>
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#656d76' }}>Results</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map((result) => {
                  const resultAvatarUrl = userProfile.getAvatarUrl(result);
                  return (
                    <div
                      key={result.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        border: '1px solid #d0d7de',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleViewUser(result.userId)}
                    >
                      <img
                        src={resultAvatarUrl}
                        alt={result.username}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{result.username}</div>
                        <div style={{ fontSize: '12px', color: '#656d76' }}>{result.email}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Followers */}
      {(displayProfile.isPublic || isOwnProfile) && followersProfiles.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Followers ({followersProfiles.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {followersProfiles.map((follower) => {
              const followerAvatarUrl = userProfile.getAvatarUrl(follower);
              return (
                <div
                  key={follower.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: '1px solid #d0d7de',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleViewUser(follower.userId)}
                >
                  <img
                    src={followerAvatarUrl}
                    alt={follower.username}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{follower.username}</div>
                    <div style={{ fontSize: '12px', color: '#656d76' }}>{follower.email}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Following */}
      {isOwnProfile && displayProfile.following.length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Following ({displayProfile.following.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayProfile.following.map((followingId) => {
              const followingProfile = userProfile.getProfile(followingId);
              if (!followingProfile) return null;
              const followingAvatarUrl = userProfile.getAvatarUrl(followingProfile);
              return (
                <div
                  key={followingProfile.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: '1px solid #d0d7de',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleViewUser(followingProfile.userId)}
                >
                  <img
                    src={followingAvatarUrl}
                    alt={followingProfile.username}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{followingProfile.username}</div>
                    <div style={{ fontSize: '12px', color: '#656d76' }}>{followingProfile.email}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User's Courses */}
      {(displayProfile.isPublic || isOwnProfile) && (
        <div className="card">
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Courses</h3>
          {userCourses.length === 0 && userClozeCourses.length === 0 ? (
            <div style={{ color: '#656d76', textAlign: 'center', padding: '32px' }}>
              No courses yet.
            </div>
          ) : (
            <div className="grid">
              {userCourses.map((course) => (
                <div key={course.id} className="course-card">
                  <div className="course-card-title">{course.name}</div>
                  <div className="course-card-meta">
                    {course.nativeLanguage} → {course.targetLanguage}
                  </div>
                </div>
              ))}
              {userClozeCourses.map((course) => (
                <div key={course.id} className="course-card">
                  <div className="course-card-title">{course.name}</div>
                  <div className="course-card-meta">
                    {course.nativeLanguage} → {course.targetLanguage}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

