import { useState } from "react";
import "../styles/select-map.css"; // Import page-specific styles

export default function SelectMapPage() {
  const [selectedMap, setSelectedMap] = useState("Previous Map Template ");
  const [uploadedFileName, setUploadedFileName] = useState("No map selected");
  const [popupVisible, setPopupVisible] = useState(false);

  const toggleDropdown = () => {
    const dropdown = document.querySelector(".map-dropdown ul");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  };

  const handleMapSelection = (mapName) => {
    setSelectedMap(mapName);
    const dropdown = document.querySelector(".map-dropdown ul");
    dropdown.style.display = "none";
  };

  const handleFileUpload = (event) => {
    const fileName = event.target.files[0] ? event.target.files[0].name : "No map selected";
    setUploadedFileName(fileName);
  };

  const showPopup = () => {
    setPopupVisible(true);
    setTimeout(() => setPopupVisible(false), 3000);
  };

  return (
    <div className="map-selection-container">
      <h1>Select Exercise Area</h1>

      <div className="map-options">
        {/* Previous Map Options */}
        <div className="map-dropdown" onClick={toggleDropdown}>
          <span className="map-name">{selectedMap}</span>
          <span className="map-arrow">▼</span>
          <ul>
            {["Map 1", "Map 2", "Map 3", "Map 4"].map((map) => (
              <li key={map} onClick={() => handleMapSelection(map)}>
                {map}
              </li>
            ))}
          </ul>
        </div>

        {/* New Map Upload */}
        <div className="new-map">
          <label htmlFor="new-map-upload">Create New Template</label>
          <input type="file" id="new-map-upload" onChange={handleFileUpload} />
          <p className="new-map-upload-text">{uploadedFileName}</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="button-container">
        <button className="button" onClick={showPopup}>
          Update
        </button>
        <button className="button" onClick={() => (window.location.href = "/resource-allocation")}>
          Next
        </button>
      </div>

      {/* Success Popup */}
      {popupVisible && <div className="popup">Map Updated Successfully!</div>}
    </div>
  );
}
