import React, { useState, useMemo, useRef, useEffect } from "react";

/**
 * @param {Array} soldiers 
 * @param {string|null} selectedSoldierId 
 * @param {Function} onSelectSoldier 
 */
export default function Sidebar({
  soldiers,
  selectedSoldierId,
  onSelectSoldier,
}) {
  
  const [expandedTeams, setExpandedTeams] = useState({
    team_red: true,  // Default expanded
    team_blue: true  // Default expanded
  });

  // Use stable sorting to prevent flickering
  const groupedAndSorted = useMemo(() => {
    const groupMap = {};
    
    // Group soldiers by team
    soldiers.forEach((s) => {
      const teamName = s.team || "team_red"; // fallback if missing
      if (!groupMap[teamName]) groupMap[teamName] = [];
      groupMap[teamName].push(s);
    });

    // Sort each team's soldiers ONCE and keep stable order
    Object.keys(groupMap).forEach(teamName => {
      groupMap[teamName].sort((a, b) => {
        const idA = parseInt(a.soldier_id) || 0;
        const idB = parseInt(b.soldier_id) || 0;
        return idA - idB;
      });
    });

    return groupMap;
  }, [soldiers.length]); // Only re-sort when soldier count changes, not on every update

  // Update soldier data without re-sorting
  const updatedGrouped = useMemo(() => {
    const updated = {};
    
    Object.keys(groupedAndSorted).forEach(teamName => {
      updated[teamName] = groupedAndSorted[teamName].map(soldier => {
        // Find the latest data for this soldier
        const latestData = soldiers.find(s => s.soldier_id === soldier.soldier_id);
        return latestData || soldier;
      });
    });
    
    return updated;
  }, [soldiers, groupedAndSorted]);

  // Toggle expand/collapse for a team
  const toggleTeam = (teamName) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamName]: !prev[teamName],
    }));
  };

  return (
    <aside style={styles.container}>
      <h2 style={styles.header}>TEAM </h2>

      {Object.keys(updatedGrouped).map((teamName) => {
        const isExpanded = expandedTeams[teamName] !== false; // Default to expanded
        const teamSoldiers = updatedGrouped[teamName];
        
        // Team color styling
        const teamColor = teamName === 'team_red' ? '#ff4444' : '#4488ff';

        return (
          <div key={teamName} style={styles.teamSection}>
            <div
              style={{
                ...styles.teamHeader,
                borderLeft: `4px solid ${teamColor}`
              }}
              onClick={() => toggleTeam(teamName)}
            >
              <span style={{ color: teamColor }}>
                {teamName.replace('team_', '').toUpperCase()}
              </span>
              <span style={styles.teamCount}>
                {isExpanded ? "▼" : "▶"} {teamSoldiers.length}
              </span>
            </div>
            
            {/* If expanded, show all soldiers under this team */}
            {isExpanded && (
              <div style={styles.soldierList}>
                {teamSoldiers.map((soldier) => (
                  <SoldierRow
                    key={soldier.soldier_id}
                    soldier={soldier}
                    teamColor={teamColor}
                    isSelected={soldier.soldier_id === selectedSoldierId}
                    onSelectSoldier={onSelectSoldier}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

// Memoized soldier row to prevent unnecessary re-renders
const SoldierRow = React.memo(({ soldier, teamColor, isSelected, onSelectSoldier }) => {
  const { soldier_id, hit_status, call_sign } = soldier;
  const statusColor = hit_status ? "#ff3333" : "#33ff33";
  const statusText = hit_status ? "KIll" : "ACTIVE";

  const handleClick = () => {
    onSelectSoldier(soldier_id);
  };

  return (
    <div
      style={{
        ...styles.soldierRow,
        backgroundColor: isSelected ? "#333" : "transparent",
        borderColor: isSelected ? teamColor : "transparent",
        borderLeft: `3px solid ${teamColor}`,
      }}
      onClick={handleClick}
    >
      <div style={styles.soldierLeft}>
        <span style={{ color: statusColor, marginRight: "0.5rem", fontSize: '1.2rem' }}>●</span>
        <div style={styles.soldierInfo}>
          <span style={styles.soldierId}>{soldier_id}</span>
          <span style={styles.callSign}>{call_sign || `Soldier ${soldier_id}`}</span>
        </div>
      </div>
      <div style={styles.soldierRight}>
        <span style={{ 
          color: statusColor, 
          fontSize: '0.8rem',
          fontWeight: 'bold',
          padding: '2px 6px',
          backgroundColor: hit_status ? '#ff333320' : '#33ff3320',
          borderRadius: '3px'
        }}>
          {statusText}
        </span>
      </div>
    </div>
  );
});

const styles = {
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0a0a0a",
    color: "#fff",
    padding: "1rem",
    fontFamily: "'Orbitron', sans-serif",
    border: "3px double #00ffff",
    borderRadius: "8px",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  header: {
    textAlign: "center",
    margin: 0,
    marginBottom: "1.5rem",
    fontSize: "1.4rem",
    letterSpacing: "2px",
    color: "#00ffff",
    textShadow: "0 0 10px #00ffff",
  },
  teamSection: {
    marginBottom: "1rem",
    border: "1px solid #333",
    borderRadius: "6px",
    overflow: "hidden",
    backgroundColor: "#111",
  },
  teamHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    padding: "0.8rem 1rem",
    backgroundColor: "#1a1a1a",
    borderBottom: "1px solid #333",
    transition: "background-color 0.2s ease",
    fontWeight: "bold",
    fontSize: "1.1rem",
  },
  teamCount: {
    color: "#aaa",
    fontSize: "0.9rem",
  },
  soldierList: {
    padding: "0.5rem 0",
  },
  soldierRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    padding: "0.6rem 1rem",
    margin: "0.1rem 0",
    border: "1px solid transparent",
    borderRadius: "4px",
    transition: "all 0.2s ease",
    backgroundColor: "#0f0f0f",
  },
  soldierLeft: {
    display: "flex",
    alignItems: "center",
    flex: 1,
  },
  soldierInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  soldierId: {
    fontSize: "1rem",
    fontWeight: "bold",
    marginBottom: "0.1rem",
  },
  callSign: {
    fontSize: "0.75rem",
    color: "#bbb",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  soldierRight: {
    fontSize: "0.9rem",
  },
};

// Component is already exported as default at the top