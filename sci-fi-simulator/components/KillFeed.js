import { useEffect, useState } from "react";
import { WS_CONFIG } from "../config";

const KillFeed = () => {
  const [feed, setFeed] = useState([]); // Feed entries
  const [multiKillCounts, setMultiKillCounts] = useState({}); // Multi-kill counts for each attacker
  const lastKillTime = {}; // Track last kill times for each attacker

  useEffect(() => {
    const ws = new WebSocket(WS_CONFIG.getKillFeedWsUrl());

    ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      const formatted = {
        text: `${data.attacker_call_sign} Kill ${data.victim_call_sign}`,
        distance: (data["distance_to_victim (in meters)"] / 1000).toFixed(2), // Convert distance to km
        attackerId: data.attacker_id,
        attackerCallSign: data.attacker_call_sign,
        timestamp: Date.parse(data.timestamp),
        id: `${data.attacker_id}-${data.timestamp}`, // Unique identifier
      };

      // Multi-Kill Logic
      const attackerId = data.attacker_id;
      if (lastKillTime[attackerId]) {
        const timeDifference = formatted.timestamp - lastKillTime[attackerId];
        if (timeDifference <= 5000) {
          setMultiKillCounts((prev) => ({
            ...prev,
            [attackerId]: (prev[attackerId] || 0) + 1, // Increment multi-kill count
          }));
        }
      }
      lastKillTime[attackerId] = formatted.timestamp;

      // Add the new entry to the feed
      setFeed((prev) => {
        const updatedFeed = [formatted, ...prev];
        return updatedFeed.slice(0, 10); // Keep only the latest 10 entries
      });
    };

    return () => ws.close();
  }, []);

  return (
    <div className="popup-message-wrapper" style={{ maxHeight: "200px", overflowY: "auto" }}>
      <h2 className="killFeedTitle">Kill Feed</h2>
      {feed.map((entry) => (
        <div key={entry.id} className="kill-entry">
          <p>
            <strong>{entry.attackerCallSign}</strong> Kill <strong>{entry.text.split(" ")[2]}</strong>{" "}
            from {entry.distance} km
          </p>
        </div>
      ))}
    </div>
  );
};

export default KillFeed;