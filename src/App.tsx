import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { AppState } from './types';
import { storage } from './storage';
import { auth, AuthUser } from './utils/auth';
import Dashboard from './components/Dashboard';
import CourseDetail from './components/CourseDetail';
import CourseRepository from './components/CourseRepository';
import ClozeCourseDetail from './components/ClozeCourseDetail';
import CharacterCourseDetail from './components/CharacterCourseDetail';
import CharacterCoursePractice from './components/CharacterCoursePractice';
import Glyphy from './components/Glyphy';
import GlyphyNew from './components/GlyphyNew';
import Glossary from './components/Glossary';
import Leaderboard from './components/Leaderboard';
import UserSettings from './components/UserSettings';
import UserProfile from './components/UserProfile';
import Auth from './components/Auth';
import UserAvatar from './components/UserAvatar';
import EditWordCoursePage from './components/EditWordCoursePage';
import EditClozeCoursePage from './components/EditClozeCoursePage';
import EditCharacterCoursePage from './components/EditCharacterCoursePage';
import './App.css';
import './components/UserAvatar.css';

// Wrapper component for ClozeCourseDetail to handle routing
function ClozeCourseDetailWrapper({ appState, updateState }: { appState: AppState; updateState: (updates: Partial<AppState>) => void }) {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const course = appState.clozeCourses.find(c => c.id === courseId);

  useEffect(() => {
    if (!course && courseId) {
      navigate('/');
    }
  }, [course, courseId, navigate]);

  if (!course) {
    return <div className="loading">Course not found</div>;
  }

  return (
    <ClozeCourseDetail
      course={course}
      appState={appState}
      updateState={updateState}
      onBack={() => navigate('/')}
    />
  );
}

function Navigation({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const currentUser = auth.getCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-left">
          <Link to="/" className="nav-logo">Glossika</Link>
        </div>
        <button 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#ffffff',
            padding: '8px',
          }}
        >
          ☰
        </button>
        <div className={`nav-right ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>Courses</Link>
          <Link to="/repository" className={location.pathname === '/repository' ? 'active' : ''} onClick={() => setMobileMenuOpen(false)}>Repository</Link>
          {currentUser && <UserAvatar onLogout={onLogout} />}
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [appState, setAppState] = useState<AppState>(storage.load());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(auth.getCurrentUser());

  useEffect(() => {
    storage.save(appState);
  }, [appState]);

  const updateState = (updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    auth.logout();
    setCurrentUser(null);
  };

  // Show auth screen if not logged in
  if (!currentUser) {
    return (
      <div className="app">
        <Auth onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Navigation onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard appState={appState} updateState={updateState} />} />
            <Route path="/course/:courseId" element={<CourseDetail appState={appState} updateState={updateState} />} />
            <Route path="/course/:courseId/edit" element={<EditWordCoursePage appState={appState} updateState={updateState} />} />
            <Route path="/repository" element={<CourseRepository appState={appState} updateState={updateState} />} />
            <Route path="/cloze-course/:courseId" element={<ClozeCourseDetailWrapper appState={appState} updateState={updateState} />} />
            <Route path="/cloze-course/:courseId/edit" element={<EditClozeCoursePage appState={appState} updateState={updateState} />} />
            <Route path="/character-course/:courseId" element={<CharacterCourseDetail appState={appState} updateState={updateState} />} />
            <Route path="/character-course/:courseId/edit" element={<EditCharacterCoursePage appState={appState} updateState={updateState} />} />
            <Route path="/character-course/:courseId/practice" element={<CharacterCoursePractice appState={appState} updateState={updateState} />} />
            <Route path="/glyphy" element={<Glyphy appState={appState} updateState={updateState} />} />
            <Route path="/glossary" element={<Glossary appState={appState} updateState={updateState} />} />
            <Route path="/leaderboard" element={<Leaderboard appState={appState} />} />
            <Route path="/leaderboard/course/:courseId" element={<Leaderboard appState={appState} />} />
            <Route path="/settings" element={<UserSettings />} />
            <Route path="/profile" element={<UserProfile appState={appState} />} />
            <Route path="/profile/:userId" element={<UserProfile appState={appState} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

