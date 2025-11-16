import { getCourseStreak, getLast5DaysActivity } from '../utils/activityTracking';

interface StreakDisplayProps {
  courseId: string;
  compact?: boolean; // For use in course cards (smaller size)
}

export default function StreakDisplay({ courseId, compact = false }: StreakDisplayProps) {
  // Always calculate streak to ensure accuracy
  const streak = getCourseStreak(courseId);
  const last5Days = getLast5DaysActivity(courseId);
  
  // Get day labels for last 5 days (M T W T F)
  const today = new Date();
  const dayLabels: string[] = [];
  for (let i = 4; i >= 0; i--) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dayIndex = checkDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dayLabels.push(labels[dayIndex]);
  }
  
  const streakDays = streak?.currentStreak || 0;
  
  if (compact) {
    // Compact display for course cards - using table for alignment
    return (
      <div style={{ 
        display: 'inline-flex',
        flexDirection: 'column',
        fontSize: '10px',
        color: '#656d76'
      }}>
        <table style={{ borderCollapse: 'collapse', borderSpacing: 0, margin: 0, padding: 0 }}>
          <tbody>
            {/* Day labels row */}
            <tr>
              {dayLabels.map((label, index) => (
                <td key={index} style={{ 
                  textAlign: 'center',
                  padding: '0 2px',
                  fontSize: '9px',
                  verticalAlign: 'bottom'
                }}>
                  {label}
                </td>
              ))}
            </tr>
            {/* Activity indicators row with streak count */}
            <tr>
              {last5Days.map((hasActivity, index) => (
                <td key={index} style={{ 
                  textAlign: 'center',
                  padding: '0 2px',
                  verticalAlign: 'top'
                }}>
                  <span style={{ fontSize: '10px' }}>
                    {hasActivity ? '🔥' : '⚪'}
                  </span>
                </td>
              ))}
              <td style={{ 
                textAlign: 'center',
                padding: '0 2px',
                verticalAlign: 'top'
              }}>
                <span style={{ 
                  fontSize: '9px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#da3633',
                  color: '#ffffff',
                  fontWeight: 600
                }}>
                  {streakDays}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  
  // Full display - using table for alignment
  return (
    <div style={{ 
      display: 'inline-flex',
      flexDirection: 'column',
      fontSize: '14px'
    }}>
      <table style={{ borderCollapse: 'collapse', borderSpacing: 0, margin: 0, padding: 0 }}>
        <tbody>
          {/* Day labels row */}
          <tr>
            {dayLabels.map((label, index) => (
              <td key={index} style={{ 
                textAlign: 'center',
                padding: '0 8px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#656d76',
                verticalAlign: 'bottom'
              }}>
                {label}
              </td>
            ))}
          </tr>
          {/* Activity indicators row with streak count */}
          <tr>
            {last5Days.map((hasActivity, index) => (
              <td key={index} style={{ 
                textAlign: 'center',
                padding: '0 8px',
                verticalAlign: 'top'
              }}>
                <span style={{ fontSize: '20px' }}>
                  {hasActivity ? '🔥' : '⚪'}
                </span>
              </td>
            ))}
            <td style={{ 
              textAlign: 'center',
              padding: '0 8px',
              verticalAlign: 'top'
            }}>
              <span style={{ 
                fontSize: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#da3633',
                color: '#ffffff',
                fontWeight: 600
              }}>
                {streakDays}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

