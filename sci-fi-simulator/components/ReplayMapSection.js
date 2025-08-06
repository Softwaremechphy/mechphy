// components/ReplayMapSection.js
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

export default function ReplayMapSection({
  historicalData,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  speed,
  setSpeed,
  selectedSoldierId,
}) {
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const trailsRef = useRef({});

  // Initialize the map
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("replay-map").setView([38.246639, 21.734573], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
    }
  }, []);

  // Update map based on historical data and current time
  useEffect(() => {
    if (!mapRef.current || !historicalData.length) return;

    const filteredData = historicalData.filter((d) => d.timestamp <= currentTime);
    const soldiers = new Map();

    filteredData.forEach((d) => {
      if (d.gps) {
        if (!soldiers.has(d.soldier_id)) {
          soldiers.set(d.soldier_id, []);
        }
        soldiers.get(d.soldier_id).push([d.gps.lat, d.gps.lon]);
      }
    });

    // Update markers and trails
    soldiers.forEach((positions, soldierId) => {
      const latestPosition = positions[positions.length - 1];
      if (markersRef.current[soldierId]) {
        markersRef.current[soldierId].setLatLng(latestPosition);
      } else {
        markersRef.current[soldierId] = L.marker(latestPosition, {
          opacity: selectedSoldierId && soldierId !== selectedSoldierId ? 0.5 : 1,
        }).addTo(mapRef.current);
      }

      if (trailsRef.current[soldierId]) {
        trailsRef.current[soldierId].setLatLngs(positions);
      } else {
        trailsRef.current[soldierId] = L.polyline(positions, {
          color: soldierId === selectedSoldierId ? "red" : "blue",
          opacity: 0.7,
        }).addTo(mapRef.current);
      }
    });

    // Remove markers/trails for soldiers no longer in data
    Object.keys(markersRef.current).forEach((soldierId) => {
      if (!soldiers.has(soldierId)) {
        mapRef.current.removeLayer(markersRef.current[soldierId]);
        mapRef.current.removeLayer(trailsRef.current[soldierId]);
        delete markersRef.current[soldierId];
        delete trailsRef.current[soldierId];
      }
    });
  }, [historicalData, currentTime, selectedSoldierId]);

  // Playback logic
  useEffect(() => {
    let interval;
    if (isPlaying && historicalData.length) {
      const maxTime = Math.max(...historicalData.map((d) => d.timestamp));
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const newTime = prev + 1000 * speed;
          if (newTime > maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return newTime;
        });
      }, 1000); // Update every second
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, historicalData, setCurrentTime, setIsPlaying]);

  return (
    <div>
      <div id="replay-map" style={{ height: "500px", width: "100%" }} />
      <div style={{ marginTop: "10px" }}>
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(...historicalData.map((d) => d.timestamp)) || 0}
          value={currentTime || 0}
          onChange={(e) => setCurrentTime(Number(e.target.value))}
        />
        <label>Speed:</label>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>
      </div>
    </div>
  );
}