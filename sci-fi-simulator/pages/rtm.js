import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import styles from "../styles/rtm.module.css";
import Sidebar from "../components/Sidebar";
import KillFeed from "../components/KillFeed";
import StatsTable from "../components/StatsTable";
import { WS_CONFIG } from "../config";

// Dynamically import Leaflet-based MapSection to avoid SSR issues
const MapSection = dynamic(() => import("../components/MapSection"), {
  ssr: false, // IMPORTANT
});

export default function RealTimeMonitoring() {
  const [soldiers, setSoldiers] = useState([]);
  // Track which soldier is "selected" (clicked in the sidebar)
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);

  useEffect(() => {
    // Connect to WebSocket for soldier data
    const ws = new WebSocket(WS_CONFIG.getSoldierWsUrl());

    // Handle incoming messages
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);

        // Update the soldiers array
        setSoldiers((prev) => {
          // Remove any old soldier record with the same ID
          const filtered = prev.filter((s) => s.soldier_id !== data.soldier_id);

          // Add or merge the new data
          // Optionally add a lastUpdate for "time ago"
          return [
            ...filtered,
            { ...data, lastUpdate: new Date().toISOString() },
          ];
        });
      } catch (error) {
        console.error("Error parsing soldier data:", error);
      }
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  const handleSelectSoldier = (soldierId) => {
    setSelectedSoldierId((prevId) => (prevId === soldierId ? null : soldierId));
  };

  return (
    <div className={styles.simulationPage}>
      <a href="/" className={styles.endSessionButton}>
        End Session
      </a>

      <div className={styles.container}>
        {/* SIDEBAR (Left) */}
        <div className={styles.leftContainer}>
          <Sidebar
            soldiers={soldiers}
            selectedSoldierId={selectedSoldierId}
            onSelectSoldier={handleSelectSoldier}
          />
        </div>

        {/* MAP + Bottom Section (Right) */}
        <div className={styles.rightContainer}>
          <div className={styles.mapContainer}>
            <MapSection
              soldiers={soldiers}
              selectedSoldierId={selectedSoldierId}
            />
          </div>

          <div className={styles.bottomSection}>
            <div className={styles.killFeed}>
              <KillFeed />
            </div>
            <div className={styles.statsTable}>
              <StatsTable />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}