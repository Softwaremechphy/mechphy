import { useEffect, useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useRouter } from "next/router";
import styles from "../styles/synchronization.module.css";

export default function Synchronization() {
  const router = useRouter();
  const { resourceAllocation, activeStatus, setActiveStatus } = useGlobalContext();
  const [webSocketError, setWebSocketError] = useState(null);
  const [activeForceTeam, setActiveForceTeam] = useState(null);
  const [showRealTimeButton, setShowRealTimeButton] = useState(false);
  const isBackendAvailable = false;

  // Initialize all soldiers as unidentified
  useEffect(() => {
    if (resourceAllocation && Object.keys(resourceAllocation).length > 0) {
      // Set initial force and team
      const firstForce = Object.keys(resourceAllocation)[0];
      const firstTeam = Object.keys(resourceAllocation[firstForce])[0];
      setActiveForceTeam(`${firstForce}-${firstTeam}`);

      // Initialize all soldiers with unidentified status (grey)
      const initialStatuses = {};
      Object.entries(resourceAllocation).forEach(([force, teams]) => {
        Object.entries(teams).forEach(([team, data]) => {
          if (data.soldiers && Array.isArray(data.soldiers)) {
            data.soldiers.forEach(soldier => {
              initialStatuses[soldier.soldier_id] = 'unidentified';
            });
          }
        });
      });
      setActiveStatus(initialStatuses);

      // After 5 seconds, randomly set some soldiers to inactive (red)
      const timer1 = setTimeout(() => {
        setActiveStatus(prev => {
          const newStatuses = { ...prev };
          Object.keys(newStatuses).forEach(key => {
            // Set approximately 50% of soldiers to inactive
            if (Math.random() > 0.5) {
              newStatuses[key] = 'inactive';
            }
          });
          return newStatuses;
        });

        // After 10 more seconds, set all to active (green) and show real-time button
        const timer2 = setTimeout(() => {
          setActiveStatus(prev => {
            const allActive = {};
            Object.keys(prev).forEach(key => {
              allActive[key] = 'active';
            });
            return allActive;
          });
          setShowRealTimeButton(true);
        }, 10000);

        return () => clearTimeout(timer2);
      }, 5000);

      return () => clearTimeout(timer1);
    }
  }, [resourceAllocation, setActiveStatus]);

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

  // Calculate total height based on number of soldiers
  const calculatePanelHeight = () => {
    if (currentForce && currentTeam && resourceAllocation[currentForce][currentTeam].soldiers) {
      const numSoldiers = resourceAllocation[currentForce][currentTeam].soldiers.length;
      // Assume each soldier row is 100px tall including margin
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
          <button className={styles.button} onClick={() => router.push('/monitoring')}>
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
                    className={`${styles.statusToggle} ${getStatusColor(activeStatus[soldier.soldier_id])}`}
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