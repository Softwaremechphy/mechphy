// components/ReplayKillFeed.js
import { useMemo } from "react";

export default function ReplayKillFeed({ historicalData, currentTime }) {
  const kills = useMemo(() => {
    return historicalData.filter((d) => d.type === "kill" && d.timestamp <= currentTime);
  }, [historicalData, currentTime]);

  return (
    <div>
      <h3>Kill Feed</h3>
      {kills.map((kill, idx) => (
        <div key={idx}>
          {`${new Date(kill.timestamp).toLocaleTimeString()} - ${kill.soldier_id} killed`}
        </div>
      ))}
    </div>
  );
}