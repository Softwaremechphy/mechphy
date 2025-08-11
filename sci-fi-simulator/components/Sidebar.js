import React, { useState, useEffect, useMemo } from "react";

export default function Sidebar({ selectedSoldierId, onSelectSoldier }) {
  const [soldiers, setSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTeams, setExpandedTeams] = useState({
    team_red: true,
    team_blue: true
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all sessions
        const sessionsResponse = await fetch('/api/sessions/all_sessions');
        if (!sessionsResponse.ok) {
          throw new Error(`Failed to fetch sessions: ${sessionsResponse.status}`);
        }
        
        const sessionsData = await sessionsResponse.json();
        
        if (!sessionsData || sessionsData.length === 0) {
          throw new Error('No sessions found');
        }

        // Get the latest session
        const latestSession = sessionsData[sessionsData.length - 1];
        
        // Get team squad soldiers
        const teamResponse = await fetch(`/api/sessions/${latestSession.session_id}/team_squad_soldiers`);
        if (!teamResponse.ok) {
          throw new Error(`Failed to fetch team data: ${teamResponse.status}`);
        }
        
        const teamData = await teamResponse.json();
        
        // Transform the data structure
        const soldiersArray = [];
        
        // Process each team
        Object.keys(teamData).forEach(teamName => {
          const teamSquads = teamData[teamName];
          
          if (teamSquads && typeof teamSquads === 'object') {
            // Process each squad in the team
            Object.keys(teamSquads).forEach(squadName => {
              const squadSoldiers = teamSquads[squadName];
              
              if (Array.isArray(squadSoldiers)) {
                squadSoldiers.forEach(soldier => {
                  soldiersArray.push({
                    soldier_id: soldier.soldier_id,
                    call_sign: soldier.call_sign,
                    team: teamName,
                    squad: squadName,
                    hit_status: false, // Default to alive
                    session_soldier_id: soldier.session_soldier_id
                  });
                });
              }
            });
          }
        });
        
        setSoldiers(soldiersArray);

      } catch (err) {
        setError(err.message);
        console.error('Sidebar fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Group soldiers by team
  const groupedSoldiers = useMemo(() => {
    const groups = {};
    
    soldiers.forEach(soldier => {
      const teamName = soldier.team || 'team_red';
      if (!groups[teamName]) {
        groups[teamName] = [];
      }
      groups[teamName].push(soldier);
    });

    // Sort soldiers within each team
    Object.keys(groups).forEach(teamName => {
      groups[teamName].sort((a, b) => {
        const idA = parseInt(a.soldier_id) || 0;
        const idB = parseInt(b.soldier_id) || 0;
        return idA - idB;
      });
    });

    return groups;
  }, [soldiers]);

  const toggleTeam = (teamName) => {
    setExpandedTeams(prev => ({
      ...prev,
      [teamName]: !prev[teamName]
    }));
  };

  if (loading) {
    return (
      <aside style={styles.container}>
        <h2 style={styles.header}>TEAM</h2>
        <div style={styles.messageContainer}>
          <div style={styles.loadingText}>Loading...</div>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside style={styles.container}>
        <h2 style={styles.header}>TEAM</h2>
        <div style={styles.messageContainer}>
          <div style={styles.errorText}>Error: {error}</div>
          <button 
            onClick={() => window.location.reload()} 
            style={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </aside>
    );
  }

  if (soldiers.length === 0) {
    return (
      <aside style={styles.container}>
        <h2 style={styles.header}>TEAM</h2>
        <div style={styles.messageContainer}>
          <div style={styles.emptyText}>No soldiers found</div>
        </div>
      </aside>
    );
  }

  return (
    <aside style={styles.container}>
      <h2 style={styles.header}>TEAM</h2>

      {Object.keys(groupedSoldiers).map(teamName => {
        const isExpanded = expandedTeams[teamName] !== false;
        const teamSoldiers = groupedSoldiers[teamName];
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
            
            {isExpanded && (
              <div style={styles.soldierList}>
                {teamSoldiers.map(soldier => (
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

const SoldierRow = React.memo(({ soldier, teamColor, isSelected, onSelectSoldier }) => {
  const { soldier_id, hit_status, call_sign } = soldier;
  const statusColor = hit_status ? "#ff3333" : "#33ff33";
  const statusText = hit_status ? "KILL" : "ACTIVE";

  return (
    <div
      style={{
        ...styles.soldierRow,
        backgroundColor: isSelected ? "#333" : "transparent",
        borderColor: isSelected ? teamColor : "transparent",
        borderLeft: `3px solid ${teamColor}`,
      }}
      onClick={() => onSelectSoldier(soldier_id)}
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
  messageContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
    gap: "1rem",
  },
  loadingText: {
    color: "#00ffff",
    fontSize: "1.1rem",
  },
  errorText: {
    color: "#ff4444",
    fontSize: "1rem",
    textAlign: "center",
  },
  emptyText: {
    color: "#888",
    fontSize: "1rem",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#ff4444",
    color: "#fff",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
};