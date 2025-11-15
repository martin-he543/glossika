import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppState } from './types';
import { storage } from './storage';
import { auth, AuthUser } from './utils/auth';
import Dashboard from './components/Dashboard';
import CourseDetail from './components/CourseDetail';
import CourseRepository from './components/CourseRepository';
import ClozePractice from './components/ClozePractice';
import Glyphy from './components/Glyphy';
import Glossary from './components/Glossary';
import Leaderboard from './components/Leaderboard';
import Auth from './components/Auth';
import './App.css';

function Navigation({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const currentUser = auth.getCurrentUser();
  
  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-left">
          <Link to="/" className="nav-logo">Glossika</Link>
        </div>
        <div className="nav-right">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Courses</Link>
          <Link to="/repository" className={location.pathname === '/repository' ? 'active' : ''}>Repository</Link>
          <Link to="/clozepractice" className={location.pathname === '/clozepractice' ? 'active' : ''}>ClozePractice</Link>
          <Link to="/glyphy" className={location.pathname === '/glyphy' ? 'active' : ''}>Glyphy</Link>
          <Link to="/glossary" className={location.pathname === '/glossary' ? 'active' : ''}>Glossary</Link>
          <Link to="/leaderboard" className={location.pathname === '/leaderboard' ? 'active' : ''}>Leaderboard</Link>
          {currentUser && (
            <>
              <span style={{ color: '#656d76', margin: '0 8px' }}>{currentUser.email}</span>
              <button className="btn" onClick={onLogout} style={{ marginLeft: '8px' }}>
                Sign Out
              </button>
            </>
          )}
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
            <Route path="/repository" element={<CourseRepository appState={appState} updateState={updateState} />} />
            <Route path="/clozepractice" element={<ClozePractice appState={appState} updateState={updateState} />} />
            <Route path="/glyphy" element={<Glyphy appState={appState} updateState={updateState} />} />
            <Route path="/glossary" element={<Glossary appState={appState} updateState={updateState} />} />
            <Route path="/leaderboard" element={<Leaderboard appState={appState} />} />
            <Route path="/leaderboard/course/:courseId" element={<Leaderboard appState={appState} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

