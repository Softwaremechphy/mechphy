// pages/zmapoverlay.js
import dynamic from "next/dynamic";
import styles  from "../styles/zmapoverlay.module.css";   // must be .module.css

// Map component lives in components/Map.js
const MapSection = dynamic(() => import("../components/Mapoverlay"), { ssr: false });

export default function ZMapOverlay() {
  return (
    <div className={styles.simulationPage}>
      <a href="/" className={styles.endSessionButton}>End Session</a>

      <div className={styles.rightContainer}>
        <div className={styles.mapContainer}>
          <MapSection />   {/* upload panel → map */}
        </div>
      </div>
    </div>
  );
}