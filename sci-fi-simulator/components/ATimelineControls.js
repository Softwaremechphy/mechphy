import React from 'react';

const TimelineControls = ({
  currentTime,
  totalDuration,
  isPlaying,
  playbackSpeed,
  onTimelineChange,
  onPlayPause,
  onRewind,
  onFastForward,
  onSpeedChange,
  onRestart,
  onSkipToEnd
}) => {
  
  const formatTime = (timeInMs) => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * totalDuration;
    onTimelineChange(Math.max(0, Math.min(totalDuration, newTime)));
  };

  const speedOptions = [0.25, 0.5, 1, 1.5, 2, 4];

  return (
    <div style={styles.container}>
      {/* Timeline Row with Time Labels */}
      <div style={styles.timelineRow}>
        <span style={styles.timeDisplay}>{formatTime(currentTime)}</span>
        
        <div 
          style={styles.timeline}
          onClick={handleTimelineClick}
        >
          <div 
            style={{
              ...styles.timelineProgress,
              width: totalDuration > 0 ? `${(currentTime / totalDuration) * 100}%` : '0%'
            }}
          />
          <div 
            style={{
              ...styles.timelineThumb,
              left: totalDuration > 0 ? `${(currentTime / totalDuration) * 100}%` : '0%'
            }}
          />
        </div>
        
        <span style={styles.timeDisplay}>{formatTime(totalDuration)}</span>
      </div>

      {/* Control Buttons Row - Centered below timeline */}
      <div style={styles.controlsRow}>
        <div style={styles.mainControls}>
          {/* Restart Button */}
          <button 
            style={styles.controlButton}
            onClick={onRestart}
            title="Restart"
          >
            ⏮
          </button>

          {/* Rewind Button */}
          <button 
            style={styles.controlButton}
            onClick={onRewind}
            title="Rewind 10s"
          >
            ⏪
          </button>

          {/* Play/Pause Button */}
          <button 
            style={{...styles.controlButton, ...styles.playButton}}
            onClick={onPlayPause}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Fast Forward Button */}
          <button 
            style={styles.controlButton}
            onClick={onFastForward}
            title="Fast Forward 10s"
          >
            ⏩
          </button>

          {/* Skip to End Button */}
          <button 
            style={styles.controlButton}
            onClick={onSkipToEnd}
            title="Skip to End"
          >
            ⏭
          </button>

          {/* Speed Control - Inline with buttons */}
          <div style={styles.speedContainer}>
            <span style={styles.speedLabel}>Speed:</span>
            <select 
              value={playbackSpeed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              style={styles.speedSelect}
            >
              {speedOptions.map(speed => (
                <option key={speed} value={speed}>
                  {speed === 1 ? '1x' : `${speed}x`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    padding: '15px 10px',
    fontFamily: "'Orbitron', monospace",
    boxShadow: 'none',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px', // Reduced gap between timeline and controls
    width: '100%',
    position: 'relative',
  },
  
  timelineRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    flex: '0 0 auto',
    marginBottom: '5px', // Small margin to create proper spacing
  },
  
  timeDisplay: {
    color: '#00ffff',
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '55px',
    textAlign: 'center',
    flexShrink: 0,
    textShadow: '0 0 8px rgba(0, 255, 255, 0.6)',
  },
  
  timeline: {
    flex: 1,
    height: '12px',
    background: 'linear-gradient(90deg, rgba(0, 255, 255, 0.2) 0%, rgba(102, 252, 241, 0.2) 100%)',
    borderRadius: '6px',
    position: 'relative',
    cursor: 'pointer',
    border: '1px solid rgba(0, 255, 255, 0.4)',
    boxShadow: '0 0 10px rgba(0, 255, 255, 0.2)',
    transition: 'all 0.3s ease',
  },
  
  timelineProgress: {
    height: '100%',
    background: 'linear-gradient(90deg, #00ffff 0%, #66fcf1 50%, #00ffff 100%)',
    borderRadius: '6px',
    transition: 'width 0.15s ease',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)',
  },
  
  timelineThumb: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '20px',
    height: '20px',
    background: 'radial-gradient(circle, #ffffff 0%, #00ffff 60%, #0099cc 100%)',
    borderRadius: '50%',
    border: '2px solid #ffffff',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.8)',
    transition: 'left 0.15s ease',
    cursor: 'grab',
  },
  
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', // Center the controls
    width: '100%',
    flex: '0 0 auto',
    position: 'relative',
    marginTop: '8px', // Space between timeline and controls
  },
  
  mainControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px', // Increased gap between buttons for better spacing
    flex: '0 0 auto',
  },
  
  controlButton: {
    background: 'linear-gradient(135deg, #00ffff 0%, #66fcf1 100%)',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    color: '#001122',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)',
    flexShrink: 0,
  },
  
  playButton: {
    width: '44px',
    height: '44px',
    fontSize: '16px',
    background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
    boxShadow: '0 0 15px rgba(76, 175, 80, 0.4)',
  },
  
  speedContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: '20px', // Space from the control buttons
    flexShrink: 0,
  },
  
  speedLabel: {
    color: '#00ffff',
    fontSize: '12px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  
  speedSelect: {
    background: 'rgba(0, 255, 255, 0.1)',
    border: '1px solid #00ffff',
    borderRadius: '6px',
    padding: '4px 8px',
    color: 'red',
    fontSize: '12px',
    fontFamily: "'Orbitron', monospace",
    outline: 'none',
    cursor: 'pointer',
    minWidth: '50px',
  }
};

// Add hover effects with enhanced timeline interaction
const hoverStyles = `
  .control-button:hover {
    transform: scale(1.1);
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.6);
  }
  
  .play-button:hover {
    box-shadow: 0 0 25px rgba(76, 175, 80, 0.7);
  }
  
  .speed-select:hover {
    border-color: #66fcf1;
    box-shadow: 0 0 10px rgba(102, 252, 241, 0.3);
  }
  
  .timeline:hover {
    border-color: #00ffff;
    box-shadow: 0 0 15px rgba(0, 255, 255, 0.4);
    transform: scaleY(1.1);
  }
  
  .timeline:hover .timeline-thumb {
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow: 0 0 20px rgba(0, 255, 255, 1);
  }
  
  .timeline:active .timeline-thumb {
    cursor: grabbing;
  }
`;

// Inject hover styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = hoverStyles;
  document.head.appendChild(styleSheet);
}

export default TimelineControls;