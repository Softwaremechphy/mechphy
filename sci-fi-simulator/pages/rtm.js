import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
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
  const [sessionId, setSessionId] = useState(null);
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch all sessions to get the latest session ID
    const fetchSessions = async () => {
      try {
        const response = await fetch("/api/sessions/all_sessions", {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const sessions = await response.json();
          // Assuming sessions is an array and sorted by creation date or ID
          const latestSession = sessions.reduce((latest, current) => 
            new Date(latest.created_at) > new Date(current.created_at) ? latest : current
          );
          setSessionId(latestSession.session_id);
        } else {
          console.error("Failed to fetch sessions");
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }
    };

    fetchSessions();

    // Connect to WebSocket for soldier data (for map and other components)
    const ws = new WebSocket(WS_CONFIG.getSoldierWsUrl());

    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);

        setSoldiers((prev) => {
          const filtered = prev.filter((s) => s.soldier_id !== data.soldier_id);
          return [
            ...filtered,
            { ...data, lastUpdate: new Date().toISOString() },
          ];
        });
      } catch (error) {
        console.error("Error parsing soldier data:", error);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSelectSoldier = (soldierId) => {
    setSelectedSoldierId((prevId) => (prevId === soldierId ? null : soldierId));
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      console.error("No session ID available");
      return;
    }
    try {
      const response = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        console.log("Session ended successfully");
        // Navigate to index page after successful session end
        router.push('/adddetails');
      } else {
        console.error("Failed to end session, status:", response.status);
        // You might still want to navigate even if the API call fails
        // router.push('/');
      }
    } catch (error) {
      console.error("Error ending session:", error);
      // You might still want to navigate even if there's an error
      // router.push('/');
    }
  };

  return (
    <div className={styles.simulationPage}>
      <button 
        className={styles.endSessionButton} 
        onClick={handleEndSession}
      >
        End Session
      </button>

      <div className={styles.container}>
        <div className={styles.leftContainer}>
          {/* Sidebar now handles its own data fetching */}
          <Sidebar
            selectedSoldierId={selectedSoldierId}
            onSelectSoldier={handleSelectSoldier}
          />
        </div>

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