import { useEffect, useState } from "react";
import styles from "../styles/rtm.smodule.css";
import { WS_CONFIG } from "../config";

const StatsTable = () => {
  const [stats, setStats] = useState({ team_red: {}, team_blue: {} });

  useEffect(() => {
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
        
        // Log received data for debugging
        console.log("📊 Stats Data Received:", data);
        
        // Only update stats if the message has team_red and team_blue
        if (data.team_red && data.team_blue) {
          setStats(data);
          
          // Log the actual values being set
          console.log("✅ Stats Updated:");
          console.log(`   🔴 Red Team  - Kills: ${data.team_red.total_killed || 0}, Bullets: ${data.team_red.bullets_fired || 0}`);
          console.log(`   🔵 Blue Team - Kills: ${data.team_blue.total_killed || 0}, Bullets: ${data.team_blue.bullets_fired || 0}`);
        }
        // Optionally log other messages
        else {
          console.log("⚠️ Received non-stats message:", data);
        }
      } catch (error) {
        console.error("❌ Error parsing stats data:", error);
      }
    };
    
    return () => ws.close();
  }, []);

  // Helper function to safely get stat values
  const getStat = (team, stat) => {
    return stats[team]?.[stat] || 0;
  };

  return (
    <div className="summary-card" id="statsCard">
      <h2>Statistical Summary</h2>
      <div className="stats-table-wrapper">
        <table id="statsTable">
          <thead>
            <tr>
              <th>Team</th>
              <th>Killed</th>
              <th>Fired</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Red Team</td>
              <td style={{ 
                fontWeight: 'bold', 
                color: getStat('team_red', 'total_killed') > 0 ? '#ff6666' : 'inherit' 
              }}>
                {getStat('team_red', 'total_killed')}
              </td>
              <td style={{ 
                fontWeight: 'bold', 
                color: getStat('team_red', 'bullets_fired') > 0 ? '#66ff66' : 'inherit' 
              }}>
                {getStat('team_red', 'bullets_fired')}
              </td>
            </tr>
            <tr>
              <td>Blue Team</td>
              <td style={{ 
                fontWeight: 'bold', 
                color: getStat('team_blue', 'total_killed') > 0 ? '#ff6666' : 'inherit' 
              }}>
                {getStat('team_blue', 'total_killed')}
              </td>
              <td style={{ 
                fontWeight: 'bold', 
                color: getStat('team_blue', 'bullets_fired') > 0 ? '#66ff66' : 'inherit' 
              }}>
                {getStat('team_blue', 'bullets_fired')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StatsTable;