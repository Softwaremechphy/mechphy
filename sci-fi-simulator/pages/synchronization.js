import { useEffect, useState, useRef } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useRouter } from "next/router";
import styles from "../styles/synchronization.module.css";

export default function Synchronization() {
  const router = useRouter();
  const { resourceAllocation, activeStatus, setActiveStatus } = useGlobalContext();
  const [webSocketError, setWebSocketError] = useState(null);
  const [activeForceTeam, setActiveForceTeam] = useState(null);
  const [showRealTimeButton, setShowRealTimeButton] = useState(false);
  const wsRef = useRef(null); // To store WebSocket instance
  const allSoldierIdsRef = useRef(new Set()); // Store all soldier IDs from your base

  // Initialize soldiers and handle API/WebSocket logic
  useEffect(() => {
    if (resourceAllocation && Object.keys(resourceAllocation).length > 0) {
      // Set initial force and team
      const firstForce = Object.keys(resourceAllocation)[0];
      const firstTeam = Object.keys(resourceAllocation[firstForce])[0];
      setActiveForceTeam(`${firstForce}-${firstTeam}`);

      // Initialize all soldiers with inactive status (red)
      const initialStatuses = {};
      const allSoldierIds = new Set(); // To store all unique soldier IDs from your base
      
      Object.entries(resourceAllocation).forEach(([force, teams]) => {
        Object.entries(teams).forEach(([team, data]) => {
          if (data.soldiers && Array.isArray(data.soldiers)) {
            data.soldiers.forEach(soldier => {
              // Store soldier_id as string for consistent comparison
              const soldierIdStr = String(soldier.soldier_id);
              allSoldierIds.add(soldierIdStr);
              initialStatuses[soldierIdStr] = 'inactive';
            });
          }
        });
      });
      
      // Update the ref with all soldier IDs from your base
      allSoldierIdsRef.current = allSoldierIds;
      setActiveStatus(initialStatuses);

      console.log('All soldier IDs in base:', Array.from(allSoldierIds));

      // Hit API immediately on page load
      const startSession = async () => {
        try {
          const response = await fetch('/api/sessions/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) throw new Error('Failed to start session');
          console.log('Session started successfully at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        } catch (error) {
          console.error('Error starting session:', error);
          setWebSocketError(`Error starting session: ${error.message}`);
        }
      };
      startSession();

      // Connect to WebSocket after 3 seconds
      const timer = setTimeout(() => {
        const wsUrl = 'ws://192.168.1.17:8001/ws'; // Use allowed WebSocket URL
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('WebSocket connection established at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket data:', data);
            
            // Check if soldier_id exists in the message
            if (data.soldier_id) {
              // Convert soldier_id to string for consistent comparison
              const incomingSoldierId = String(data.soldier_id).trim();
              console.log('Checking soldier_id:', incomingSoldierId);
              
              // Check if this soldier_id exists in our base
              if (allSoldierIdsRef.current.has(incomingSoldierId)) {
                console.log(`Soldier ${incomingSoldierId} found in base - turning active (green)`);
                setActiveStatus(prev => ({
                  ...prev,
                  [incomingSoldierId]: 'active',
                }));
              } else {
                console.log(`Soldier ${incomingSoldierId} not found in base - ignoring`);
              }
            } else {
              console.log('No soldier_id found in WebSocket message');
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            setWebSocketError('Error parsing WebSocket message');
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setWebSocketError('WebSocket connection failed');
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket connection closed at', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        };
      }, 3000); // 3-second delay

      // Cleanup on unmount
      return () => {
        clearTimeout(timer);
        if (wsRef.current) {
          wsRef.current.close();
        }
      };
    }
  }, [resourceAllocation, setActiveStatus]);

  // Show "Real Time Monitoring" button when all soldiers are active
  useEffect(() => {
    if (activeStatus && Object.keys(activeStatus).length > 0) {
      const allActive = Object.values(activeStatus).every(status => status === 'active');
      setShowRealTimeButton(allActive);
      
      if (allActive) {
        console.log('All soldiers are now active - showing Real Time Monitoring button');
      }
    }
  }, [activeStatus]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return styles.statusActive;
      case 'inactive':
        return styles.statusInactive;
      default:
        return styles.statusUnidentified;
    }
  };

  // Calculate panel height based on number of soldiers
  const calculatePanelHeight = () => {
    if (currentForce && currentTeam && resourceAllocation[currentForce][currentTeam].soldiers) {
      const numSoldiers = resourceAllocation[currentForce][currentTeam].soldiers.length;
      return Math.max(400, numSoldiers * 100); // Minimum height of 400px
    }
    return 400; // Default height
  };

  if (!resourceAllocation || Object.keys(resourceAllocation).length === 0) {
    return (
      <div className={styles.container}>
        <h1>Synchronization</h1>
        <p>No data available. Please complete Resource Allocation first.</p>
      </div>
    );
  }

  // Get current force and team from activeForceTeam
  const [currentForce, currentTeam] = activeForceTeam ? activeForceTeam.split('-') : [null, null];

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        <button className={styles.button} onClick={() => router.push('/zmap-overlay')}>
          MAP OVERLAY
        </button>
        <h2>DATA SYNCHRONIZATION</h2>
        {showRealTimeButton && (
          <button className={styles.button} onClick={() => router.push('/rtm')}>
            REAL TIME MONITORING
          </button>
        )}
        {!showRealTimeButton && <div className={styles.buttonPlaceholder} />}
      </div>

      <div className={styles.tabs}>
        {Object.entries(resourceAllocation).map(([force, teams]) =>
          Object.keys(teams).map((team) => (
            <button
              key={`${force}-${team}`}
              className={`${styles.tab} ${activeForceTeam === `${force}-${team}` ? styles.active : ''}`}
              onClick={() => setActiveForceTeam(`${force}-${team}`)}
            >
              {`${force.toUpperCase()} ${team.toUpperCase()}`}
            </button>
          ))
        )}
      </div>

      {webSocketError && (
        <div className={styles.errorMessage}>
          <p>{webSocketError}</p>
        </div>
      )}

      {currentForce && currentTeam && (
        <div 
          className={styles.panel} 
          style={{ height: `${calculatePanelHeight()}px` }}
        >
          <div className={styles.gridContainer}>
            {resourceAllocation[currentForce][currentTeam].soldiers.map((soldier, idx) => (
              <div key={`${soldier.soldier_id}-${idx}`} className={styles.soldierRow}>
                <div className={styles.soldierName}>
                  {`${currentTeam.toUpperCase()} ${idx + 1}`}
                </div>
                <div className={styles.dropdown}>
                  <input 
                    type="text" 
                    placeholder="Call Sign" 
                    value={soldier.soldier_id} 
                    readOnly 
                  />
                </div>
                <div className={styles.dropdown}>
                  <select defaultValue={soldier.role}>
                    <option value={soldier.role}>{soldier.role.toUpperCase()}</option>
                  </select>
                </div>
                <div className={styles.dropdown}>
                  <select defaultValue={soldier.weapon_id}>
                    <option value={soldier.weapon_id}>{soldier.weapon_id}</option>
                  </select>
                </div>
                <div className={styles.dropdown}>
                  <select defaultValue={soldier.vest_id}>
                    <option value={soldier.vest_id}>{soldier.vest_id}</option>
                  </select>
                </div>
                <div className={styles.statusIndicator}>
                  <span className={styles.statusLabel}>Status:</span>
                  <div 
                    className={`${styles.statusToggle} ${getStatusColor(activeStatus[String(soldier.soldier_id)])}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}