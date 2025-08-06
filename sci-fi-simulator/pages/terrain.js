import Link from "next/link";
import "../styles/combat-selection.css"; 

export default function terrain() {
  return (
    <div>
      {/* Navbar */}
      <div className="navbar">
        <ul>
         
          <li>
                    <a href="/resource-allocation">Resource Allocation</a>
          </li>
          <li>
            <a href="/zmapoverlay">Map Overlay</a>
          </li>
          <li>
            <a href="/simulation">Real-Time Monitoring</a>
          </li>
          <li>
            < a href="/aar">View Previous Exercise</a>
          </li>
          <li>
            <a href="/settings">Settings</a>
          </li>
        </ul>
      </div>

      {/* Combat Selection Section */}
      <div className="combat-selection">
        <h2>Select Terrain Type</h2>
        <div className="combat-grid">
          <div
            className="combat-card"
            onClick={() => (window.location.href = "/select-map")}
          >
            Urban
          </div>
          <div
            className="combat-card"
            onClick={() => (window.location.href = "/select-map")}
          >
            Mountain
          </div>
          <div
            className="combat-card"
            onClick={() => (window.location.href = "/select-map")}
          >
            Jungle
          </div>
          <div
            className="combat-card"
            onClick={() => (window.location.href = "/select-map")}
          >
            Desert
          </div>
          <div
            className="combat-card"
            onClick={() => (window.location.href = "/select-map")}
          >
            Coastal
          </div>
        </div>
      </div>
    </div>
  );
}
