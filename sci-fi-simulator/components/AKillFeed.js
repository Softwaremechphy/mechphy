import { useEffect, useState } from "react";
import { WS_CONFIG } from "../config";

const KillFeed = ({ killFeedData = [], currentTime = 0, isReplayMode = false }) => {
  const [feed, setFeed] = useState([]); // Feed entries
  const [multiKillCounts, setMultiKillCounts] = useState({}); // Multi-kill counts for each attacker
  const lastKillTime = {}; // Track last kill times for each attacker

  useEffect(() => {
    if (isReplayMode) {
      // In replay mode, filter events based on current time
      const currentEvents = killFeedData.filter(event => 
        event.timestamp <= currentTime
      ).slice(-10); // Show last 10 events up to current time
      
      setFeed(currentEvents.map(data => ({
        text: `${data.attacker_call_sign} Kill ${data.victim_call_sign}`,
        distance: (data["distance_to_victim (in meters)"] / 1000).toFixed(2),
        attackerId: data.attacker_id,
        attackerCallSign: data.attacker_call_sign,
        timestamp: Date.parse(data.timestamp),
        id: `${data.attacker_id}-${data.timestamp}`,
      })));
    } else {
      // Real-time mode (original functionality)
      const ws = new WebSocket(WS_CONFIG.getKillFeedWsUrl());

      ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        const formatted = {
          text: `${data.attacker_call_sign} Kill ${data.victim_call_sign}`,
          distance: (data["distance_to_victim (in meters)"] / 1000).toFixed(2),
          attackerId: data.attacker_id,
          attackerCallSign: data.attacker_call_sign,
          timestamp: Date.parse(data.timestamp),
          id: `${data.attacker_id}-${data.timestamp}`,
        };

        // Multi-Kill Logic
        const attackerId = data.attacker_id;
        if (lastKillTime[attackerId]) {
          const timeDifference = formatted.timestamp - lastKillTime[attackerId];
          if (timeDifference <= 5000) {
            setMultiKillCounts((prev) => ({
              ...prev,
              [attackerId]: (prev[attackerId] || 0) + 1,
            }));
          }
        }
        lastKillTime[attackerId] = formatted.timestamp;

        // Add the new entry to the feed
        setFeed((prev) => {
          const updatedFeed = [formatted, ...prev];
          return updatedFeed.slice(0, 10);
        });
      };

      return () => ws.close();
    }
  }, [isReplayMode, killFeedData, currentTime]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    // Always use 24-hour format to avoid hydration mismatch
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div className="kill-feed-wrapper" style={styles.wrapper}>
      <h2 style={styles.title}>Kill Feed</h2>
      <div style={styles.feedContainer}>
        {feed.length === 0 ? (
          <div style={styles.noEvents}>
            {isReplayMode ? "No kills at this time" : "No kills yet"}
          </div>
        ) : (
          feed.map((entry) => (
            <div key={entry.id} style={styles.killEntry}>
              <div style={styles.killInfo}>
                <span style={styles.attacker}>{entry.attackerCallSign}</span>
                <span style={styles.killText}> eliminated </span>
                <span style={styles.victim}>{entry.text.split(" Kill ")[1]}</span>
              </div>
              <div style={styles.killDetails}>
                <span style={styles.distance}>{entry.distance} km</span>
                {isReplayMode && (
                  <span style={styles.timestamp}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {isReplayMode && (
        <div style={styles.replayInfo}>
          <span>Showing events up to {formatTimestamp(currentTime)}</span>
        </div>
      )}
    </div>
  );
};

const styles = {
  wrapper: {
    maxHeight: "100%",
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(135deg, rgba(255, 68, 68, 0.08) 0%, rgba(204, 34, 34, 0.08) 100%)",
    border: "2px solid #ff4444",
    borderRadius: "10px",
    padding: "15px",
    boxShadow: "0 0 25px rgba(255, 68, 68, 0.3)",
    position: "relative",
    overflow: "hidden",
  },
  
  title: {
    color: "#ff4444",
    textAlign: "center",
    margin: "0 0 15px 0",
    fontSize: "18px",
    fontWeight: "bold",
    fontFamily: "'Orbitron', monospace",
    letterSpacing: "2px",
    textShadow: "0 0 10px rgba(255, 68, 68, 0.8)",
  },
  
  feedContainer: {
    flex: 1,
    overflowY: "auto",
    paddingRight: "5px",
  },
  
  noEvents: {
    color: "#888",
    fontStyle: "italic",
    textAlign: "center",
    padding: "20px",
    fontFamily: "'Orbitron', monospace",
  },
  
  killEntry: {
    background: "rgba(255, 68, 68, 0.1)",
    border: "1px solid rgba(255, 68, 68, 0.3)",
    borderRadius: "8px",
    padding: "10px",
    marginBottom: "8px",
    transition: "all 0.3s ease",
    fontFamily: "'Orbitron', monospace",
  },
  
  killInfo: {
    marginBottom: "5px",
    fontSize: "14px",
  },
  
  attacker: {
    color: "#ff6666",
    fontWeight: "bold",
  },
  
  killText: {
    color: "#fff",
  },
  
  victim: {
    color: "#ffaaaa",
    fontWeight: "bold",
  },
  
  killDetails: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px",
  },
  
  distance: {
    color: "#66fcf1",
    backgroundColor: "rgba(102, 252, 241, 0.1)",
    padding: "2px 6px",
    borderRadius: "4px",
    border: "1px solid rgba(102, 252, 241, 0.3)",
  },
  
  timestamp: {
    color: "#888",
    fontSize: "11px",
  },
  
  replayInfo: {
    marginTop: "10px",
    padding: "8px",
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    border: "1px solid rgba(255, 68, 68, 0.3)",
    borderRadius: "6px",
    color: "#ff6666",
    fontSize: "12px",
    textAlign: "center",
    fontFamily: "'Orbitron', monospace",
  }
};

export default KillFeed;