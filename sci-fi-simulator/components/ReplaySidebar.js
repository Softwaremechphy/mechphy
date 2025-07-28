// components/ReplaySidebar.js
import { useMemo } from "react";

export default function ReplaySidebar({
  historicalData,
  currentTime,
  selectedSoldierId,
  onSelectSoldier,
}) {
  const activeSoldiers = useMemo(() => {
    const soldiers = new Set();
    historicalData.forEach((d) => {
      if (d.timestamp <= currentTime) {
        soldiers.add(d.soldier_id);
      }
    });
    return Array.from(soldiers);
  }, [historicalData, currentTime]);

  return (
    <div>
      <h3>Soldiers</h3>
      {activeSoldiers.map((soldierId) => (
        <div
          key={soldierId}
          onClick={() => onSelectSoldier(soldierId)}
          style={{
            padding: "5px",
            background: selectedSoldierId === soldierId ? "#333" : "transparent",
            cursor: "pointer",
          }}
        >
          {soldierId}
        </div>
      ))}
    </div>
  );
}