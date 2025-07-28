// pages/replay.js
import dynamic from "next/dynamic";
import { useState } from "react";
import styles from "../styles/replay.module.css"; // Create this CSS module
import ReplaySidebar from "../components/ReplaySidebar";
import ReplayKillFeed from "../components/ReplayKillFeed";
import ReplayStatsTable from "../components/ReplayStatsTable";

// Dynamically import ReplayMapSection to avoid SSR issues
const ReplayMapSection = dynamic(() => import("../components/ReplayMapSection"), {
  ssr: false,
});

export default function ReplayPage() {
  // State for time frame selection
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // State for historical data and replay controls
  const [historicalData, setHistoricalData] = useState([]);
  const [currentTime, setCurrentTime] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);
  const [loader, setLoader] = useState("");

  // Fetch historical data based on selected time frame
  const handleLoadReplay = async () => {
    if (!startTime || !endTime) {
      setLoader("Please select start and end time");
      return;
    }
    const startTimestamp = new Date(startTime).getTime();
    const endTimestamp = new Date(endTime).getTime();
    if (startTimestamp >= endTimestamp) {
      setLoader("Start time must be before end time");
      return;
    }
    setLoader("Loading historical data…");
    try {
      const response = await fetch(`/api/historical?start=${startTimestamp}&end=${endTimestamp}`);
      const data = await response.json();
      setHistoricalData(data);
      setCurrentTime(startTimestamp); // Start replay from the beginning
      setLoader("");
    } catch (error) {
      console.error("Error fetching historical data:", error);
      setLoader(`Error: ${error.message}`);
    }
  };

  return (
    <div className={styles.replayPage}>
      <a href="/" className={styles.endSessionButton}>
        End Session
      </a>

      {/* Time frame selection UI */}
      <div className={styles.timeFrameSelection}>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
        <button onClick={handleLoadReplay}>Load Replay</button>
        {loader && <span>{loader}</span>}
      </div>

      {/* Render components only after data is loaded */}
      {historicalData.length > 0 && (
        <div className={styles.container}>
          {/* Left Container: Sidebar */}
          <div className={styles.leftContainer}>
            <ReplaySidebar
              historicalData={historicalData}
              currentTime={currentTime}
              selectedSoldierId={selectedSoldierId}
              onSelectSoldier={setSelectedSoldierId}
            />
          </div>

          {/* Right Container: Map and Bottom Section */}
          <div className={styles.rightContainer}>
            <div className={styles.mapContainer}>
              <ReplayMapSection
                historicalData={historicalData}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                speed={speed}
                setSpeed={setSpeed}
                selectedSoldierId={selectedSoldierId}
              />
            </div>
            <div className={styles.bottomSection}>
              <div className={styles.killFeed}>
                <ReplayKillFeed historicalData={historicalData} currentTime={currentTime} />
              </div>
              <div className={styles.statsTable}>
                <ReplayStatsTable historicalData={historicalData} currentTime={currentTime} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}