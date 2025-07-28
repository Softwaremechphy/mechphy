import Link from "next/link";
import "../styles/combat-selection.css"; 

export default function terrain() {
  return (
    <div>
      {/* Navbar */}
      <div className="navbar">
        <ul>
         
          <li>
            <Link href="/resource-allocation">Resource Allocation</Link>
          </li>
          <li>
            <Link href="/zmapoverlay">Map Overlay</Link>
          </li>
          <li>
            <Link href="/rtm">Real-Time Monitoring</Link>
          </li>
          <li>
            <Link href="/aar">View Previous Exercise</Link>
          </li>
          <li>
            <Link href="/settings">Settings</Link>
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
