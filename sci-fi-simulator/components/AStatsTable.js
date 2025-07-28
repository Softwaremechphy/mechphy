import { useEffect, useState } from "react";
import { WS_CONFIG } from "../config";

const StatsTable = ({ statsData = [], currentTime = 0, isReplayMode = false }) => {
  const [stats, setStats] = useState({ team_red: {}, team_blue: {} });

  useEffect(() => {
    if (isReplayMode) {
      // In replay mode, calculate stats up to current time
      const currentStats = calculateStatsAtTime(statsData, currentTime);
      setStats(currentStats);
    } else {
      // Real-time mode (original functionality)
      const ws = new WebSocket(WS_CONFIG.getStatsWsUrl());
      
      ws.onopen = () => {
        console.log("🔗 Stats WebSocket connected");
      };
      
      ws.onclose = () => {
        console.log("📤 Stats WebSocket disconnected");
      };
      
      ws.onerror = (error) => {
        console.error("❌ Stats WebSocket error:", error);
      };
      
      ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          
          console.log("📊 Stats Data Received:", data);
          
          if (data.team_red && data.team_blue) {
            setStats(data);
            console.log("✅ Stats Updated:");
            console.log(`   🔴 Red Team  - Kills: ${data.team_red.total_killed || 0}, Bullets: ${data.team_red.bullets_fired || 0}`);
            console.log(`   🔵 Blue Team - Kills: ${data.team_blue.total_killed || 0}, Bullets: ${data.team_blue.bullets_fired || 0}`);
          } else {
            console.log("⚠️ Received non-stats message:", data);
          }
        } catch (error) {
          console.error("❌ Error parsing stats data:", error);
        }
      };
      
      return () => ws.close();
    }
  }, [isReplayMode, statsData, currentTime]);

  const calculateStatsAtTime = (statsHistory, targetTime) => {
    const result = { 
      team_red: { total_killed: 0, bullets_fired: 0 }, 
      team_blue: { total_killed: 0, bullets_fired: 0 } 
    };

    statsHistory.forEach(statEvent => {
      if (statEvent.timestamp <= targetTime) {
        // Accumulate stats up to the target time
        if (statEvent.team === 'team_red') {
          result.team_red.total_killed += statEvent.kills || 0;
          result.team_red.bullets_fired += statEvent.bullets || 0;
        } else if (statEvent.team === 'team_blue') {
          result.team_blue.total_killed += statEvent.kills || 0;
          result.team_blue.bullets_fired += statEvent.bullets || 0;
        }
      }
    });

    return result;
  };

  const getStat = (team, stat) => {
    return stats[team]?.[stat] || 0;
  };

  const formatTime = (timeInMs) => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const redKills = getStat('team_red', 'total_killed');
  const blueKills = getStat('team_blue', 'total_killed');
  const redBullets = getStat('team_red', 'bullets_fired');
  const blueBullets = getStat('team_blue', 'bullets_fired');

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.title}>Statistical Summary</h2>
      {isReplayMode && (
        <div style={styles.timeInfo}>
          Stats at {formatTime(currentTime)}
        </div>
      )}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>Team</th>
              <th style={styles.headerCell}>Kills</th>
              <th style={styles.headerCell}>Bullets Fired</th>
              <th style={styles.headerCell}>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            <tr style={styles.dataRow}>
              <td style={{...styles.dataCell, ...styles.teamCell}}>
                <div style={styles.teamName}>
                  <div style={{...styles.teamIndicator, backgroundColor: '#e84118'}} />
                  Red Team
                </div>
              </td>
              <td style={{
                ...styles.dataCell,
                ...styles.killCell,
                color: redKills > 0 ? '#ff6666' : '#888'
              }}>
                {redKills}
              </td>
              <td style={{
                ...styles.dataCell,
                color: redBullets > 0 ? '#66ff66' : '#888'
              }}>
                {redBullets}
              </td>
              <td style={{
                ...styles.dataCell,
                color: redBullets > 0 ? '#ffaa00' : '#888'
              }}>
                {redBullets > 0 ? ((redKills / redBullets) * 100).toFixed(1) + '%' : '0%'}
              </td>
            </tr>
            <tr style={styles.dataRow}>
              <td style={{...styles.dataCell, ...styles.teamCell}}>
                <div style={styles.teamName}>
                  <div style={{...styles.teamIndicator, backgroundColor: '#00a8ff'}} />
                  Blue Team
                </div>
              </td>
              <td style={{
                ...styles.dataCell,
                ...styles.killCell,
                color: blueKills > 0 ? '#ff6666' : '#888'
              }}>
                {blueKills}
              </td>
              <td style={{
                ...styles.dataCell,
                color: blueBullets > 0 ? '#66ff66' : '#888'
              }}>
                {blueBullets}
              </td>
              <td style={{
                ...styles.dataCell,
                color: blueBullets > 0 ? '#ffaa00' : '#888'
              }}>
                {blueBullets > 0 ? ((blueKills / blueBullets) * 100).toFixed(1) + '%' : '0%'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
    </div>
  );
};

const styles = {
  wrapper: {
    background: "linear-gradient(135deg, rgba(68, 136, 255, 0.08) 0%, rgba(34, 102, 255, 0.08) 100%)",
    border: "2px solid #4488ff",
    borderRadius: "10px",
    padding: "15px",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 0 25px rgba(68, 136, 255, 0.3)",
    fontFamily: "'Orbitron', monospace",
    position: "relative",
    overflow: "hidden",
  },
  
  title: {
    textAlign: "center",
    fontSize: "18px",
    fontWeight: "bold",
    margin: "0 0 10px 0",
    color: "#4488ff",
    letterSpacing: "2px",
    textShadow: "0 0 10px rgba(68, 136, 255, 0.8)",
  },
  
  timeInfo: {
    textAlign: "center",
    fontSize: "12px",
    color: "#66fcf1",
    marginBottom: "15px",
    padding: "5px 10px",
    backgroundColor: "rgba(68, 136, 255, 0.1)",
    border: "1px solid rgba(68, 136, 255, 0.3)",
    borderRadius: "6px",
  },
  
  tableWrapper: {
    flex: 1,
    overflowY: "auto",
    border: "1px solid rgba(68, 136, 255, 0.3)",
    borderRadius: "8px",
    backgroundColor: "rgba(0, 20, 40, 0.3)",
  },
  
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  
  headerRow: {
    backgroundColor: "#4488ff",
    color: "#ffffff",
  },
  
  headerCell: {
    padding: "12px 10px",
    fontWeight: "bold",
    textAlign: "center",
    borderBottom: "2px solid #1e272e",
  },
  
  dataRow: {
    transition: "background-color 0.2s ease",
  },
  
  dataCell: {
    padding: "10px",
    textAlign: "center",
    borderBottom: "1px solid rgba(255, 165, 2, 0.2)",
    color: "#dcdde1",
  },
  
  teamCell: {
    textAlign: "left",
  },
  
  teamName: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  
  teamIndicator: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    border: "1px solid #fff",
  },
  
  killCell: {
    fontWeight: "bold",
    fontSize: "16px",
  },
  
  replayInfo: {
    marginTop: "15px",
    padding: "10px",
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    border: "1px solid rgba(0, 255, 255, 0.3)",
    borderRadius: "8px",
  },
  
  summaryStats: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    fontSize: "12px",
    color: "#66fcf1",
    textAlign: "center",
  }
};

export default StatsTable;