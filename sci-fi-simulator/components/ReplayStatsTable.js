// components/ReplayStatsTable.js
import { useMemo } from "react";

export default function ReplayStatsTable({ historicalData, currentTime }) {
  const stats = useMemo(() => {
    const filtered = historicalData.filter((d) => d.timestamp <= currentTime);
    const kills = filtered.filter((d) => d.type === "kill").length;
    // Add more stats as needed
    return { kills };
  }, [historicalData, currentTime]);

  return (
    <div>
      <h3>Stats</h3>
      <table>
        <tbody>
          <tr>
            <td>Total Kills</td>
            <td>{stats.kills}</td>
          </tr>
          {/* Add more rows for other stats */}
        </tbody>
      </table>
    </div>
  );
}