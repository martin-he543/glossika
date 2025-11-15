import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppState } from '../types';
import { leaderboard } from '../utils/leaderboard';
import { auth } from '../utils/auth';

interface LeaderboardProps {
  appState: AppState;
}

export default function Leaderboard({ appState }: LeaderboardProps) {
  const { courseId } = useParams<{ courseId?: string }>();
  const [entries, setEntries] = useState(leaderboard.getOverallLeaderboard());
  const [currentUserXP, setCurrentUserXP] = useState(0);
  const [currentUserRank, setCurrentUserRank] = useState(-1);
  const course = courseId ? appState.courses.find(c => c.id === courseId) : null;

  const refreshLeaderboard = () => {
    if (courseId) {
      setEntries(leaderboard.getCourseLeaderboard(courseId));
      setCurrentUserXP(leaderboard.getCurrentUserXP(courseId));
      setCurrentUserRank(leaderboard.getCurrentUserRank(courseId));
    } else {
      setEntries(leaderboard.getOverallLeaderboard());
      setCurrentUserXP(leaderboard.getCurrentUserXP());
      setCurrentUserRank(leaderboard.getCurrentUserRank());
    }
  };

  useEffect(() => {
    refreshLeaderboard();
    // Refresh every 5 seconds to show real-time updates
    const interval = setInterval(refreshLeaderboard, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const currentUser = auth.getCurrentUser();

  return (
    <div>
      <div className="card-header">
        <h1 className="card-title">
          {courseId ? `${course?.name || 'Course'} Leaderboard` : 'Overall Leaderboard'}
        </h1>
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#656d76' }}>Your XP</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{currentUserXP}</div>
            </div>
            {currentUserRank > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#656d76' }}>Your Rank</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>#{currentUserRank}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        {entries.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#656d76' }}>
            No leaderboard entries yet. Start learning to earn XP!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #d0d7de' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#656d76' }}>Rank</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#656d76' }}>User</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#656d76' }}>XP</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#656d76' }}>Words</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#656d76' }}>Sentences</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const isCurrentUser = currentUser && entry.userId === currentUser.id;
                  return (
                    <tr
                      key={`${entry.userId}-${entry.courseId || 'overall'}`}
                      style={{
                        borderBottom: '1px solid #d0d7de',
                        backgroundColor: isCurrentUser ? '#f6f8fa' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: isCurrentUser ? 600 : 400 }}>
                        {index + 1}
                        {index === 0 && ' 🥇'}
                        {index === 1 && ' 🥈'}
                        {index === 2 && ' 🥉'}
                      </td>
                      <td style={{ padding: '12px', fontWeight: isCurrentUser ? 600 : 400 }}>
                        {entry.userEmail}
                        {isCurrentUser && <span style={{ marginLeft: '8px', color: '#0969da' }}>(You)</span>}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: isCurrentUser ? 600 : 400 }}>
                        {entry.xp.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#656d76' }}>
                        {entry.wordsLearned.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#656d76' }}>
                        {entry.sentencesLearned.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>How to Earn XP</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={{ padding: '8px 0', borderBottom: '1px solid #d0d7de' }}>
            <strong>+10 XP</strong> for each word learned (when srsLevel goes from 0 to 1+)
          </li>
          <li style={{ padding: '8px 0', borderBottom: '1px solid #d0d7de' }}>
            <strong>+10 XP</strong> for each sentence learned (when masteryLevel goes from 0 to 1+)
          </li>
        </ul>
      </div>
    </div>
  );
}

