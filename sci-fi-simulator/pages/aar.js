
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import styles from "../styles/aar.module.css";
import Sidebar from "../components/ASidebar";
import KillFeed from "../components/AKillFeed";
import StatsTable from "../components/AStatsTable";
import TimelineControls from "../components/ATimelineControls";
import { WS_CONFIG } from "../config";

  // ...existing code...



// Dynamically import Leaflet-based MapSection to avoid SSR issues
const MapSection = dynamic(() => import("../components/MapSection"), {
  ssr: false, // IMPORTANT
});

// Generate unique session ID based on timestamp
const generateSessionId = () => {
  const now = new Date();
  const timestamp = now.getTime(); // Unix timestamp in milliseconds
  const randomSuffix = Math.floor(Math.random() * 1000); // Add random 3-digit suffix for extra uniqueness
  return `session_${timestamp}_${randomSuffix}`;
};

function AfterActionReview() {
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);

  // Timeline and playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sessionData, setSessionData] = useState([]);
  const [killFeedData, setKillFeedData] = useState([]);
  const [statsData, setStatsData] = useState([]);

  // Session management state
  const [sessionId, setSessionId] = useState(null);
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState(null);

  // Initialize replay session
  const initializeReplaySession = async () => {
    const newSessionId = "24"; // Using simple session ID as requested
    setSessionId(newSessionId);
    setIsSessionInitializing(true);
    setInitializationError(null);

    // Try different request formats
    const requestFormats = [
      // Format 1: JSON body with session_id
      {
        endpoint: `http://localhost:8000/api/replay/select_session/${newSessionId}`,
        body: JSON.stringify({ session_id: newSessionId })
      },
      // Format 2: JSON body with sessionId
      {
        endpoint: `http://localhost:8000/api/replay/select_session/${newSessionId}`,
        body: JSON.stringify({ sessionId: newSessionId })
      },
      // Format 3: Empty body (original working curl)
      {
        endpoint: `http://localhost:8000/api/replay/select_session/${newSessionId}`,
        body: ''
      },
      // Format 4: Try with IP address and JSON body
      {
        endpoint: `http://192.168.1.17:8000/api/replay/select_session/${newSessionId}`,
        body: JSON.stringify({ session_id: newSessionId })
      }
    ];

    for (const format of requestFormats) {
      try {
        console.log(`Trying endpoint: ${format.endpoint} with body:`, format.body);
        const response = await fetch(format.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
          },
          body: format.body,
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Session initialized successfully:', result);
          setSessionInitialized(true);
          setIsSessionInitializing(false);
          return; // Success, exit the function
        } else {
          const errorData = await response.text();
          console.log(`Failed with ${format.endpoint}: ${response.status} ${response.statusText}`, errorData);
        }
      } catch (error) {
        console.log(`Error with ${format.endpoint}:`, error.message);
      }
    }

    // If we get here, all formats failed
    setInitializationError('Failed to initialize session with all request formats. Please check the API documentation for the correct request format.');
    setIsSessionInitializing(false);
  };



  // Initialize session on component mount
  useEffect(() => {
    initializeReplaySession();
  }, []);

  // WebSocket connections for AAR data - only after session is initialized
  useEffect(() => {
    if (!sessionInitialized || !sessionId) {
      return;
    }

    // Small delay to ensure backend services are ready
    const connectionDelay = setTimeout(() => {
      // Connect to WebSocket using the correct URLs from your config
      const soldierWs = new WebSocket('ws://192.168.1.17:8765/ws');
      const killFeedWs = new WebSocket('ws://192.168.1.17:8766/ws');
      const statsWs = new WebSocket('ws://192.168.1.17:8767/ws');

      // Handle soldier data
      soldierWs.onopen = () => {
        console.log('Soldier WebSocket connected to 192.168.1.17:8765/ws');
        // Send session ID to associate with the replay
        soldierWs.send(JSON.stringify({
          type: 'init',
          sessionId: sessionId
        }));
      };

      soldierWs.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          console.log("Received soldier data", data);
          if (data.type === 'session_data') {
            setSessionData(data.soldiers);
            setTotalDuration(data.duration);
          } else if (data.type === 'frame_data') {
            // Replace all soldiers with the frame
            setSoldiers(data.soldiers);
          } else if (data.type === 'soldier_movement') {
            // Merge/replace soldier in the array, like RTM
            const soldier = {
              soldier_id: data.soldier_id,
              team: data.team,
              call_sign: data.call_sign,
              gps: {
                latitude: data.position?.latitude ?? data.position?.lat ?? null,
                longitude: data.position?.longitude ?? data.position?.lng ?? null,
              },
              ...data // include any other fields
            };
            setSoldiers(prev => {
              // Remove any old soldier record with the same ID
              const filtered = prev.filter(s => s.soldier_id !== soldier.soldier_id);
              // Add or merge the new data
              return [
                ...filtered,
                { ...soldier, lastUpdate: new Date().toISOString() },
              ];
            });
          }
        } catch (error) {
          console.error("Error parsing soldier data:", error);
        }
      };

      soldierWs.onerror = (error) => {
        console.error('Soldier WebSocket error:', error);
      };

      // Handle kill feed data
      killFeedWs.onopen = () => {
        console.log('Kill Feed WebSocket connected to 192.168.1.17:8766/ws');
        killFeedWs.send(JSON.stringify({
          type: 'init',
          sessionId: sessionId
        }));
      };

      killFeedWs.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === 'kill_feed_history') {
            setKillFeedData(data.events);
          }
        } catch (error) {
          console.error("Error parsing kill feed data:", error);
        }
      };

      killFeedWs.onerror = (error) => {
        console.error('Kill Feed WebSocket error:', error);
      };

      // Handle stats data
      statsWs.onopen = () => {
        console.log('Stats WebSocket connected to 192.168.1.17:8767/ws');
        statsWs.send(JSON.stringify({
          type: 'init',
          sessionId: sessionId
        }));
      };

      statsWs.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === 'stats_history') {
            setStatsData(data.stats);
          }
        } catch (error) {
          console.error("Error parsing stats data:", error);
        }
      };

      statsWs.onerror = (error) => {
        console.error('Stats WebSocket error:', error);
      };

      // Cleanup on unmount
      return () => {
        soldierWs.close();
        killFeedWs.close();
        statsWs.close();
      };
    }, 1000); // 1 second delay

    return () => clearTimeout(connectionDelay);
  }, [sessionInitialized, sessionId]);

  // Handle playback control
  useEffect(() => {
    let interval;
    if (isPlaying && currentTime < totalDuration) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + (100 * playbackSpeed); // 100ms intervals
          if (newTime >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          // Update data based on current time
          updateDataAtTime(newTime);
          return newTime;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, totalDuration, playbackSpeed, sessionData]);

  const updateDataAtTime = (time) => {
    // Filter and update soldiers data based on current time
    const currentFrame = sessionData.filter(data =>
      data.timestamp <= time
    );

    if (currentFrame.length > 0) {
      // Get the latest state for each soldier at current time
      const soldierMap = {};
      currentFrame.forEach(frame => {
        frame.soldiers.forEach(soldier => {
          soldierMap[soldier.soldier_id] = soldier;
        });
      });
      setSoldiers(Object.values(soldierMap));
    }
  };

  const handleSelectSoldier = (soldierId) => {
    setSelectedSoldierId((prevId) => (prevId === soldierId ? null : soldierId));
  };

  const handleTimelineChange = (newTime) => {
    setCurrentTime(newTime);
    updateDataAtTime(newTime);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRewind = () => {
    const newTime = Math.max(0, currentTime - 10000); // Go back 10 seconds
    setCurrentTime(newTime);
    updateDataAtTime(newTime);
  };

  const handleFastForward = () => {
    const newTime = Math.min(totalDuration, currentTime + 10000); // Go forward 10 seconds
    setCurrentTime(newTime);
    updateDataAtTime(newTime);
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(false);
    updateDataAtTime(0);
  };

  const handleSkipToEnd = () => {
    setCurrentTime(totalDuration);
    setIsPlaying(false);
    updateDataAtTime(totalDuration);
  };

  const handleRetryInitialization = () => {
    setSessionInitialized(false);
    setInitializationError(null);
    initializeReplaySession();
  };

  // Show loading state during initialization
  if (isSessionInitializing) {
    return (
      <div className={styles.aarPage}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Initializing replay session...</p>
          <p>Session ID: {sessionId}</p>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (initializationError) {
    return (
      <div className={styles.aarPage}>
        <div className={styles.errorContainer}>
          <h2>Failed to Initialize Replay Session</h2>
          <p>Error: {initializationError}</p>
          <p>Session ID: {sessionId}</p>
          <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            Please check your backend configuration and ensure the replay API endpoint is running.
          </p>
          <button onClick={handleRetryInitialization} className={styles.retryButton}>
            Retry Initialization
          </button>
          <a href="/" className={styles.backButton}>
            Back to Menu
          </a>
        </div>
      </div>
    );
  }

  // Show main interface only after successful initialization
  if (!sessionInitialized) {
    return (
      <div className={styles.aarPage}>
        <div className={styles.loadingContainer}>
          <p>Waiting for session initialization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.aarPage}>
      <a href="/" className={styles.endSessionButton}>
        Back to Menu
      </a>

      {/* Session Info Display */}
      <div className={styles.sessionInfo}>
        <span>Session: {sessionId}</span>
      </div>

      <div className={styles.container}>
        {/* SIDEBAR (Left) */}
        <div className={styles.leftContainer}>
          <Sidebar
            soldiers={soldiers}
            selectedSoldierId={selectedSoldierId}
            onSelectSoldier={handleSelectSoldier}
          />
        </div>

        {/* MAP + Timeline + Bottom Section (Right) */}
        <div className={styles.rightContainer}>
          <div className={styles.mapContainer}>
            <MapSection
              soldiers={soldiers}
              selectedSoldierId={selectedSoldierId}
              isReplayMode={true}
            />
          </div>

          {/* Timeline Controls Section */}
          <div className={styles.timelineSection}>
            <TimelineControls
              currentTime={currentTime}
              totalDuration={totalDuration}
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              onTimelineChange={handleTimelineChange}
              onPlayPause={handlePlayPause}
              onRewind={handleRewind}
              onFastForward={handleFastForward}
              onSpeedChange={handleSpeedChange}
              onRestart={handleRestart}
              onSkipToEnd={handleSkipToEnd}
            />
          </div>

          <div className={styles.bottomSection}>
            <div className={styles.killFeed}>
              <KillFeed
                killFeedData={killFeedData}
                currentTime={currentTime}
                isReplayMode={true}
              />
            </div>
            <div className={styles.statsTable}>
              <StatsTable
                statsData={statsData}
                currentTime={currentTime}
                isReplayMode={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AfterActionReview;