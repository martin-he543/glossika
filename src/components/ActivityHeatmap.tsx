import { useMemo } from 'react';
import { getActivityHeatmap } from '../utils/activityTracking';
import './ActivityHeatmap.css';

interface ActivityHeatmapProps {
  courseId?: string | null;
  days?: number; // Number of days to show (default 365)
}

export default function ActivityHeatmap({ days = 365 }: ActivityHeatmapProps) {
  // Always show universal activity (ignore courseId)
  const heatmap = useMemo(() => getActivityHeatmap(null), []);
  
  const { cells, maxCount } = useMemo(() => {
    const today = new Date();
    const cells: { date: Date; count: number; dateStr: string }[] = [];
    let maxCount = 0;
    
    // Generate cells for the last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = heatmap.get(dateStr) || 0;
      maxCount = Math.max(maxCount, count);
      cells.push({ date, count, dateStr });
    }
    
    return { cells, maxCount };
  }, [heatmap, days]);
  
  const getIntensity = (count: number): number => {
    if (count === 0) return 0;
    if (maxCount === 0) return 0;
    // 4 intensity levels
    const ratio = count / maxCount;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  };
  
  const getTooltip = (cell: { date: Date; count: number; dateStr: string }): string => {
    const dateStr = cell.date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    if (cell.count === 0) {
      return `${dateStr}\nNo activity`;
    }
    return `${dateStr}\n${cell.count} ${cell.count === 1 ? 'item' : 'items'} studied`;
  };
  
  // Group by weeks
  const weeks: { date: Date; count: number; dateStr: string }[][] = [];
  let currentWeek: { date: Date; count: number; dateStr: string }[] = [];
  
  cells.forEach((cell, index) => {
    if (index % 7 === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(cell);
  });
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }
  
  return (
    <div className="activity-heatmap">
      <div className="heatmap-header">
        <div className="heatmap-title">Study Activity</div>
        <div className="heatmap-legend">
          <span className="legend-label">Less</span>
          <div className="legend-cells">
            <div className="legend-cell intensity-0"></div>
            <div className="legend-cell intensity-1"></div>
            <div className="legend-cell intensity-2"></div>
            <div className="legend-cell intensity-3"></div>
            <div className="legend-cell intensity-4"></div>
          </div>
          <span className="legend-label">More</span>
        </div>
      </div>
      <div className="heatmap-content">
        <div className="heatmap-weeks">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="heatmap-week">
              {week.map((cell, dayIndex) => {
                const intensity = getIntensity(cell.count);
                return (
                  <div
                    key={`${cell.dateStr}-${dayIndex}`}
                    className={`heatmap-cell intensity-${intensity}`}
                    title={getTooltip(cell)}
                    data-date={cell.dateStr}
                    data-count={cell.count}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

