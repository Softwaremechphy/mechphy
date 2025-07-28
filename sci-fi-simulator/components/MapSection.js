"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

export default function MapSection({ soldiers = [], selectedSoldierId }) {
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const outOfBoundsMarkersRef = useRef({});
  const distanceLinesRef = useRef({});
  const distanceLabelsRef = useRef({});
  const mapInitializedRef = useRef(false);
  const mbTilesLayerRef = useRef(null);
  const mapContainerRef = useRef(null);

  const [trailsData, setTrailsData] = useState({});
  const [colorMap, setColorMap] = useState({});
  const [loader, setLoader] = useState("");
  const [progress, setProgress] = useState(0);
  const [mapBounds, setMapBounds] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [defaultZoomLevel, setDefaultZoomLevel] = useState(15);
  const [showControls, setShowControls] = useState(true);
  const [mapMetadataBounds, setMapMetadataBounds] = useState(null);
  const [outOfBoundsSoldiers, setOutOfBoundsSoldiers] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPathTracking, setShowPathTracking] = useState(true);

const soldierColors = [
    "#00FF00",  // Pure Green
    "#0000FF",  // Pure Blue
    "#FFFF00",  // Pure Yellow
    "#FF00FF",  // Pure Magenta
    "#00FFFF",  // Pure Cyan
    "#FFA500",  // Orange
    "#800080",  // Purple
    "#FFFFFF",  // White
    "#000000"   // Black
];

  function generateColorFromId(id) {
    if (!id || typeof id !== "string") {
      console.warn("Invalid soldier_id, using default color");
      return soldierColors[0]; // Fallback to the first color
    }
    
    // Create a more robust hash function to ensure better distribution
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use absolute value and ensure we get a valid index
    const index = Math.abs(hash) % soldierColors.length;
    return soldierColors[index];
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  function isWithinBounds(lat, lng, bounds) {
    if (!bounds) return true;
    return lat >= bounds.south && lat <= bounds.north && 
           lng >= bounds.west && lng <= bounds.east;
  }

  function parseBounds(boundsString) {
    if (!boundsString) return null;
    const coords = boundsString.split(",").map(Number);
    if (coords.length === 4) {
      return {
        west: coords[0],
        south: coords[1],
        east: coords[2],
        north: coords[3]
      };
    }
    return null;
  }

  const toggleFullscreen = () => {
    const mapContainer = document.querySelector('.map-container');
    
    if (!document.fullscreenElement) {
      mapContainer?.requestFullscreen().then(() => {
        setIsFullscreen(true);
        // Invalidate map size after fullscreen transition
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);
      }).catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        // Invalidate map size after exiting fullscreen
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);
      }).catch((err) => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  const togglePathTracking = () => {
    setShowPathTracking(!showPathTracking);
  };

  // Debug soldiers prop
  useEffect(() => {
    console.log("Soldiers prop:", soldiers);
  }, [soldiers]);

  // Listen for fullscreen changes (e.g., user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Invalidate map size when fullscreen state changes
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    // Delay initialization to ensure DOM is ready
    const timer = setTimeout(() => {
      const container = document.getElementById("mapid");
      if (!container) {
        console.error("Map container not found");
        setLoader("Error: Map container not found");
        return;
      }

      if (
        mapInitializedRef.current ||
        mapRef.current ||
        container._leaflet_id ||
        container.hasChildNodes()
      ) {
        return;
      }

      mapContainerRef.current = container;

      const cssId = "leaflet-css";
      if (!document.getElementById(cssId)) {
        const link = document.createElement("link");
        link.id = cssId;
        link.rel = "stylesheet";
        link.href = "/leaflet.css";
        document.head.appendChild(link);
      }

      setLoader("Initializing map…");

      try {
        mapRef.current = L.map(container, {
          center: [28.5471399, 77.1945754],
          zoom: 15,
          minZoom: 10,
          maxZoom: 21,
          preferCanvas: true,
          zoomControl: true,
          attributionControl: false,
        });

        class MBTilesLayer extends L.TileLayer {
          _db = null;

          loadMBTilesFromArrayBuffer = (buf) => {
            try {
              console.log("Loading MBTiles from buffer, size:", buf.byteLength);
              this._db = new window.SQL.Database(new Uint8Array(buf));
              this._getMetadata();
              setLoader("");
              setProgress(100);
              setMapLoaded(true);
              setShowControls(false);
              this.redraw();
              console.log("MBTiles loaded successfully");
            } catch (error) {
              console.error("Error loading MBTiles:", error);
              setLoader(`Error loading MBTiles: ${error.message}`);
              setProgress(0);
            }
          };

          _getMetadata = () => {
            if (!this._db) return;

            try {
              const metaStmt = this._db.prepare("SELECT name, value FROM metadata");
              const metadata = {};

              while (metaStmt.step()) {
                const row = metaStmt.getAsObject();
                metadata[row.name] = row.value;
              }
              metaStmt.free();

              console.log("MBTiles metadata:", metadata);

              // Parse and store map bounds from metadata
              if (metadata.bounds) {
                const bounds = parseBounds(metadata.bounds);
                setMapMetadataBounds(bounds);
                console.log("Map metadata bounds:", bounds);
              }

              const zoomStmt = this._db.prepare(
                "SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level"
              );
              const zooms = [];
              while (zoomStmt.step()) {
                zooms.push(zoomStmt.getAsObject().zoom_level);
              }
              zoomStmt.free();
              console.log("Available zoom levels:", zooms);

              const minZoom = Math.min(...zooms);
              const maxZoom = Math.max(...zooms);
              console.log(`Adjusting zoom range: ${minZoom} - ${maxZoom}`);

              this.options.minZoom = minZoom;
              this.options.maxZoom = Math.min(maxZoom, 21);

              if (mapRef.current) {
                mapRef.current.setMinZoom(minZoom);
                mapRef.current.setMaxZoom(Math.min(maxZoom, 21));
              }

              if (metadata.bounds) {
                const bounds = metadata.bounds.split(",").map(Number);
                if (bounds.length === 4) {
                  const sw = [bounds[1], bounds[0]];
                  const ne = [bounds[3], bounds[2]];
                  const leafletBounds = L.latLngBounds(sw, ne);
                  setMapBounds(leafletBounds);

                  const idealZoom = mapRef.current.getBoundsZoom(leafletBounds);
                  const clampedZoom = Math.max(minZoom, Math.min(idealZoom, maxZoom - 1));
                  setDefaultZoomLevel(clampedZoom);

                  setTimeout(() => {
                    if (mapRef.current) {
                      mapRef.current.fitBounds(leafletBounds, {
                        maxZoom: clampedZoom,
                        padding: [10, 10],
                      });
                    }
                  }, 100);
                }
              }

              const countStmt = this._db.prepare("SELECT COUNT(*) as count FROM tiles");
              countStmt.step();
              const tileCount = countStmt.getAsObject().count;
              countStmt.free();
              console.log("Total tiles:", tileCount);

              const distStmt = this._db.prepare(
                "SELECT zoom_level, COUNT(*) as count FROM tiles GROUP BY zoom_level ORDER BY zoom_level"
              );
              console.log("Tile distribution:");
              while (distStmt.step()) {
                const row = distStmt.getAsObject();
                console.log(`  Zoom ${row.zoom_level}: ${row.count} tiles`);
              }
              distStmt.free();
            } catch (error) {
              console.error("Error reading metadata:", error);
            }
          };

          loadMBTilesFromPath = (path) => {
            setLoader(`Loading ${path}…`);
            setMapLoaded(false);
            setProgress(0);
            console.log("Loading MBTiles from path:", path);

            fetch(path, { method: "GET" })
              .then(async (response) => {
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const contentLength = response.headers.get("Content-Length");
                const total = contentLength ? parseInt(contentLength, 10) : 0;
                let loaded = 0;

                const reader = response.body.getReader();
                const chunks = [];

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  chunks.push(value);
                  loaded += value.length;

                  if (total > 0) {
                    const percentage = Math.round((loaded / total) * 100);
                    setProgress(percentage);
                    setLoader(`Loading map: ${percentage}%`);
                  } else {
                    setLoader(`Loading map: ${Math.round(loaded / (1024 * 1024))} MB processed`);
                  }
                }

                const buffer = new Uint8Array(loaded);
                let offset = 0;
                for (const chunk of chunks) {
                  buffer.set(chunk, offset);
                  offset += chunk.length;
                }

                console.log("MBTiles file fetched successfully");
                this.loadMBTilesFromArrayBuffer(buffer.buffer);
              })
              .catch((e) => {
                console.error("Error loading MBTiles:", e);
                setLoader(`Error: ${e.message}`);
                setProgress(0);
                setMapLoaded(false);
              });
          };

          createTile(coords, done) {
            const img = document.createElement("img");

            if (!this._db) {
              console.warn("Database not loaded yet");
              img.src =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
              setTimeout(() => done(null, img), 100);
              return img;
            }

            const z = coords.z;
            const x = coords.x;
            const y = Math.pow(2, z) - coords.y - 1;

            try {
              const stmt = this._db.prepare(
                "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?"
              );
              stmt.bind([z, x, y]);

              if (stmt.step()) {
                const data = stmt.getAsObject().tile_data;

                if (data && data.length > 0) {
                  const blob = new Blob([new Uint8Array(data)], {
                    type: "image/png",
                  });
                  const url = URL.createObjectURL(blob);

                  img.onload = () => {
                    URL.revokeObjectURL(url);
                    done(null, img);
                  };
                  img.onerror = () => {
                    URL.revokeObjectURL(url);
                    console.warn(`Tile error for ${z}/${x}/${y}`);
                    img.src =
                      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
                    done(null, img);
                  };
                  img.src = url;
                } else {
                  console.warn(`Empty tile data for ${z}/${x}/${y}`);
                  img.src =
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
                  done(null, img);
                }
              } else {
                if (z <= 12) {
                  console.warn(`Missing tile at zoom ${z}: ${x}/${y} (critical for zoom out)`);
                }
                img.src =
                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
                done(null, img);
              }
              stmt.free();
            } catch (error) {
              console.error(`Error getting tile ${z}/${x}/${y}:`, error);
              img.src =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";
              done(null, img);
            }

            return img;
          }
        }

        mbTilesLayerRef.current = new MBTilesLayer({
          minZoom: 1,
          maxZoom: 21,
          tms: true,
          errorTileUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=",
          bounds: null,
          noWrap: false,
          keepBuffer: 2,
          updateWhenIdle: false,
          updateWhenZooming: true,
        });

        mbTilesLayerRef.current.addTo(mapRef.current);

        setLoader("Please load Map file");
        mapInitializedRef.current = true;

        const script = document.createElement("script");
        script.src = "/sqljs/sql-wasm.js";
        script.onload = () => {
          window
            .initSqlJs({ locateFile: () => "/sqljs/sql-wasm.wasm" })
            .then((SQL) => {
              window.SQL = SQL; // Make SQL available for MBTilesLayer
            })
            .catch((error) => {
              console.error("SQL.js initialization failed:", error);
              setLoader(`SQL.js Error: ${error.message}`);
            });
        };
        script.onerror = () => {
          console.error("Failed to load SQL.js script");
          setLoader("Error: Failed to load SQL.js");
        };
        document.body.appendChild(script);
      } catch (error) {
        console.error("Error creating map:", error);
        setLoader(`Map Error: ${error.message}`);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn("Error removing map:", e);
        }
        mapRef.current = null;
      }

      if (mapContainerRef.current && mapContainerRef.current._leaflet_id) {
        delete mapContainerRef.current._leaflet_id;
      }

      markersRef.current = {};
      outOfBoundsMarkersRef.current = {};
      distanceLinesRef.current = {};
      distanceLabelsRef.current = {};
      mbTilesLayerRef.current = null;
      mapInitializedRef.current = false;
      mapContainerRef.current = null;
      setMapLoaded(false);
      setProgress(0);
    };
  }, []);

  useEffect(() => {
    setColorMap((prev) => {
      const next = { ...prev };
      let added = false;
      soldiers.forEach((soldier) => {
        if (soldier && soldier.soldier_id && typeof soldier.soldier_id === "string") {
          if (!next[soldier.soldier_id]) {
            next[soldier.soldier_id] = generateColorFromId(soldier.soldier_id);
            added = true;
          }
        } else {
          console.warn("Skipping soldier with invalid soldier_id:", soldier);
        }
      });
      return added ? next : prev;
    });
  }, [soldiers]);

  useEffect(() => {
    if (!mapInitializedRef.current) return;
    setTrailsData((prev) => {
      const next = { ...prev };
      let updated = false;
      soldiers.forEach((soldier) => {
        if (
          soldier &&
          soldier.soldier_id &&
          typeof soldier.soldier_id === "string" &&
          soldier.gps &&
          typeof soldier.gps.latitude === "number" &&
          typeof soldier.gps.longitude === "number"
        ) {
          const { soldier_id, gps } = soldier;
          if (!next[soldier_id]) {
            next[soldier_id] = [];
          }
          const lastPoint = next[soldier_id][next[soldier_id].length - 1];
          const newPoint = [gps.latitude, gps.longitude];

          if (
            !lastPoint ||
            lastPoint[0] !== newPoint[0] ||
            lastPoint[1] !== newPoint[1]
          ) {
            next[soldier_id] = [...next[soldier_id], newPoint];
            updated = true;
          }
        } else {
          console.warn("Skipping invalid soldier for trails:", soldier);
        }
      });
      return updated ? next : prev;
    });
  }, [soldiers]);

  // Check which soldiers are out of bounds
  useEffect(() => {
    if (!mapMetadataBounds) {
      setOutOfBoundsSoldiers({});
      return;
    }

    const outOfBounds = {};
    soldiers.forEach((soldier) => {
      if (
        soldier &&
        soldier.soldier_id &&
        typeof soldier.soldier_id === "string" &&
        soldier.gps &&
        typeof soldier.gps.latitude === "number" &&
        typeof soldier.gps.longitude === "number"
      ) {
        const { soldier_id, gps } = soldier;
        if (!isWithinBounds(gps.latitude, gps.longitude, mapMetadataBounds)) {
          outOfBounds[soldier_id] = {
            originalLat: gps.latitude,
            originalLng: gps.longitude,
            soldier: soldier
          };
          console.log(`Soldier ${soldier_id} is out of bounds:`, gps);
        }
      }
    });
    
    setOutOfBoundsSoldiers(outOfBounds);
  }, [soldiers, mapMetadataBounds]);

  useEffect(() => {
    if (!mapInitializedRef.current || !mapRef.current) return;

    // Clear existing out-of-bounds markers
    Object.values(outOfBoundsMarkersRef.current).forEach((marker) => {
      mapRef.current.removeLayer(marker);
    });
    outOfBoundsMarkersRef.current = {};

    // Handle out-of-bounds soldiers
    Object.entries(outOfBoundsSoldiers).forEach(([soldier_id, data]) => {
      const { soldier } = data;
      const base = colorMap[soldier_id] || generateColorFromId(soldier_id);
      const color = soldier.hit_status ? "#ff4444" : base;
      const yaw = soldier.imu?.yaw || 0;

      // Create flickering SVG for out-of-bounds soldiers
      const svg = `
        <svg width="30" height="30">
          <circle cx="15" cy="15" r="12" fill="${color}" opacity="0.8" 
                  stroke="#ff0000" stroke-width="3" stroke-dasharray="2,2">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite"/>
          </circle>
          <circle cx="15" cy="15" r="8" fill="${color}" opacity="0.9"/>
          <line x1="15" y1="15" x2="15" y2="3"
                stroke="#000" stroke-width="2"
                transform="rotate(${yaw},15,15)"/>
          <text x="15" y="25" text-anchor="middle" fill="#ff0000" font-size="8" font-weight="bold">OUT</text>
        </svg>`;

      // Place the marker at the center of the map
      const mapCenter = mapRef.current.getCenter();
      const icon = L.divIcon({
        className: "out-of-bounds-marker",
        html: svg,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([mapCenter.lat, mapCenter.lng], { icon });
      marker.bindPopup(
        `<b>${soldier_id} - OUT OF BOUNDS</b><br/>
         Original Lat: ${data.originalLat}<br/>
         Original Lng: ${data.originalLng}<br/>
         Color: ${base}<br/>
         <span style="color: #ff0000; font-weight: bold;">Location outside map area!</span>`
      );
      marker.addTo(mapRef.current);
      outOfBoundsMarkersRef.current[soldier_id] = marker;
    });

    // Handle in-bounds soldiers
    soldiers.forEach((soldier) => {
      if (
        !soldier ||
        !soldier.soldier_id ||
        typeof soldier.soldier_id !== "string" ||
        !soldier.gps ||
        typeof soldier.gps.latitude !== "number" ||
        typeof soldier.gps.longitude !== "number"
      ) {
        console.warn("Skipping invalid soldier for markers:", soldier);
        return;
      }

      const { soldier_id, gps, hit_status, imu } = soldier;

      // Skip if this soldier is out of bounds
      if (outOfBoundsSoldiers[soldier_id]) {
        // Remove in-bounds marker if it exists
        if (markersRef.current[soldier_id]) {
          mapRef.current.removeLayer(markersRef.current[soldier_id]);
          delete markersRef.current[soldier_id];
        }
        return;
      }

      const base = colorMap[soldier_id] || generateColorFromId(soldier_id);
      const color = hit_status ? "#ff4444" : base;
      const yaw = imu?.yaw || 0;

      const svg = `
        <svg width="20" height="20">
          <circle cx="10" cy="10" r="8" fill="${color}" opacity="0.8"/>
          <line x1="10" y1="10" x2="10" y2="0"
                stroke="#000" stroke-width="2"
                transform="rotate(${yaw},10,10)"/>
        </svg>`;

      if (!markersRef.current[soldier_id]) {
        const icon = L.divIcon({
          className: "custom-marker",
          html: svg,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const m = L.marker([gps.latitude, gps.longitude], { icon });
        m.bindPopup(
          `<b>${soldier_id}</b><br/>Lat: ${gps.latitude}<br/>Lng: ${gps.longitude}<br/>Color: ${base}`
        );
        m.addTo(mapRef.current);
        markersRef.current[soldier_id] = m;
      } else {
        const m = markersRef.current[soldier_id];
        m.setLatLng([gps.latitude, gps.longitude]);
        const icon = L.divIcon({
          className: "custom-marker",
          html: svg,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        m.setIcon(icon);

        m.setPopupContent(
          `<b>${soldier_id}</b><br/>Lat: ${gps.latitude}<br/>Lng: ${gps.longitude}<br/>Color: ${base}`
        );
      }
    });
  }, [soldiers, colorMap, outOfBoundsSoldiers]);

  useEffect(() => {
    if (!mapInitializedRef.current || !mapRef.current) return;

    const map = mapRef.current;

    // Clear existing distance lines and labels
    Object.values(distanceLinesRef.current).forEach((line) => {
      map.removeLayer(line);
    });
    Object.values(distanceLabelsRef.current).forEach((label) => {
      map.removeLayer(label);
    });
    distanceLinesRef.current = {};
    distanceLabelsRef.current = {};

    // Only show distance lines and labels if path tracking is enabled
    if (showPathTracking) {
      const commandCenter = soldiers.find(
        (soldier) =>
          soldier &&
          soldier.soldier_id === "1" &&
          soldier.gps &&
          typeof soldier.gps.latitude === "number" &&
          typeof soldier.gps.longitude === "number"
      );
      if (commandCenter) {
        const commandCenterCoords = [commandCenter.gps.latitude, commandCenter.gps.longitude];

        soldiers.forEach((soldier) => {
          if (
            soldier &&
            soldier.soldier_id &&
            typeof soldier.soldier_id === "string" &&
            soldier.soldier_id !== "1" &&
            soldier.gps &&
            typeof soldier.gps.latitude === "number" &&
            typeof soldier.gps.longitude === "number"
          ) {
            const { soldier_id, gps } = soldier;
            
            // For out-of-bounds soldiers, don't draw distance lines
            if (outOfBoundsSoldiers[soldier_id]) {
              return;
            }

            const soldierCoords = [gps.latitude, gps.longitude];
            const distance = calculateDistance(
              commandCenterCoords[0],
              commandCenterCoords[1],
              soldierCoords[0],
              soldierCoords[1]
            );
            const color = colorMap[soldier_id] || generateColorFromId(soldier_id);

            const line = L.polyline([commandCenterCoords, soldierCoords], {
              color: color,
              weight: 2,
              opacity: 0.5,
              dashArray: "2,4",
            });
            line.addTo(map);
            distanceLinesRef.current[soldier_id] = line;

            const midLat = (commandCenterCoords[0] + soldierCoords[0]) / 2;
            const midLon = (commandCenterCoords[1] + soldierCoords[1]) / 2;

            let distanceText;
            if (distance < 1000) {
              distanceText = `${Math.round(distance)} m`;
            } else {
              distanceText = `${(distance / 1000).toFixed(2)} km`;
            }

            const label = L.divIcon({
              className: "distance-label",
              html: `
                <div style="
                  background: rgba(0, 20, 40, 0.8);
                  color: #66fcf1;
                  font-family: 'Courier New', monospace;
                  font-size: 12px;
                  font-weight: bold;
                  padding: 8px 18px;
                  border: 1px solid #00ffff;
                  border-radius: 4px;
                  white-space: nowrap;
                  text-align: center;
                  min-width: 60px;
                ">
                  ${distanceText}
                </div>
              `,
              iconSize: [60, 24],
              iconAnchor: [30, 12],
            });
            const marker = L.marker([midLat, midLon], { icon: label });
            marker.addTo(map);
            distanceLabelsRef.current[soldier_id] = marker;
          } else {
            console.warn("Skipping invalid soldier for distance lines:", soldier);
          }
        });
      }
    }

    // Clear existing trails
    Object.values(markersRef.current).forEach((m) => {
      if (m.trail) {
        map.removeLayer(m.trail);
        delete m.trail;
      }
    });

    // Only show trails if path tracking is enabled
    if (showPathTracking) {
      if (!selectedSoldierId) {
        Object.entries(trailsData).forEach(([id, coords]) => {
          if (coords.length < 2) return;
          
          // Don't show trails for out-of-bounds soldiers
          if (outOfBoundsSoldiers[id]) return;
          
          const color = colorMap[id] || generateColorFromId(id);
          const pl = L.polyline(coords, {
            color: color,
            weight: 2,
            opacity: 1,
            dashArray: "4,6",
          });
          pl.addTo(map);
          if (markersRef.current[id]) {
            markersRef.current[id].trail = pl;
          }
        });
        Object.values(markersRef.current).forEach((m) => m.setOpacity(1));
        Object.values(outOfBoundsMarkersRef.current).forEach((m) => m.setOpacity(1));
      } else {
        const coords = trailsData[selectedSoldierId] || [];
        if (coords.length > 1 && !outOfBoundsSoldiers[selectedSoldierId]) {
          const color =
            colorMap[selectedSoldierId] || generateColorFromId(selectedSoldierId);
          const pl = L.polyline(coords, {
            color: color,
            weight: 3,
            opacity: 1,
            dashArray: "4,2",
          });
          pl.addTo(map);
          if (markersRef.current[selectedSoldierId]) {
            markersRef.current[selectedSoldierId].trail = pl;
          }
        }
        Object.entries(markersRef.current).forEach(([id, m]) =>
          m.setOpacity(id === selectedSoldierId ? 1 : 0.3)
        );
        Object.entries(outOfBoundsMarkersRef.current).forEach(([id, m]) =>
          m.setOpacity(id === selectedSoldierId ? 1 : 0.3)
        );
        
        const selectedMarker = markersRef.current[selectedSoldierId] || outOfBoundsMarkersRef.current[selectedSoldierId];
        if (selectedMarker) {
          map.setView(selectedMarker.getLatLng(), map.getZoom());
        }
      }
    } else {
      // When path tracking is disabled, show all markers with full opacity
      Object.values(markersRef.current).forEach((m) => m.setOpacity(1));
      Object.values(outOfBoundsMarkersRef.current).forEach((m) => m.setOpacity(1));
    }
  }, [soldiers, trailsData, selectedSoldierId, colorMap, outOfBoundsSoldiers, showPathTracking]);

  const onPath = () => {
    const v = document.getElementById("filepath")?.value;
    if (v && mbTilesLayerRef.current) {
      console.log("Loading MBTiles from path:", v);
      mbTilesLayerRef.current.loadMBTilesFromPath(v);
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f && mbTilesLayerRef.current) {
      console.log("Loading MBTiles from file:", f.name);
      setLoader(`Loading ${f.name}…`);
      setProgress(0);
      const r = new FileReader();
      r.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setProgress(percentage);
          setLoader(`Loading ${f.name}: ${percentage}%`);
        } else {
          setLoader(`Loading ${f.name}: ${Math.round(event.loaded / (1024 * 1024))} MB processed`);
        }
      };
      r.onload = () => mbTilesLayerRef.current.loadMBTilesFromArrayBuffer(r.result);
      r.onerror = () => {
        setLoader(`Error loading ${f.name}`);
        setProgress(0);
      };
      r.readAsArrayBuffer(f);
    }
  };

  const onFitBounds = () => {
    if (mapBounds && mapRef.current) {
      mapRef.current.fitBounds(mapBounds, {
        maxZoom: 18,
        padding: [20, 20],
      });
    }
  };

  const onDebugTiles = () => {
    if (mbTilesLayerRef.current && mbTilesLayerRef.current._db) {
      const db = mbTilesLayerRef.current._db;

      const zoomStmt = db.prepare(
        "SELECT zoom_level, COUNT(*) as count FROM tiles GROUP BY zoom_level ORDER BY zoom_level"
      );
      console.log("=== MBTiles Debug Info ===");
      console.log("Tile distribution by zoom level:");
      while (zoomStmt.step()) {
        const row = zoomStmt.getAsObject();
        console.log(`  Zoom ${row.zoom_level}: ${row.count} tiles`);
      }
      zoomStmt.free();

      const minZoomStmt = db.prepare(
        "SELECT MIN(zoom_level) as min_zoom, MAX(zoom_level) as max_zoom FROM tiles"
      );
      minZoomStmt.step();
      const zoomRange = minZoomStmt.getAsObject();
      minZoomStmt.free();
      console.log(`Zoom range: ${zoomRange.min_zoom} - ${zoomRange.max_zoom}`);

      if (mapRef.current) {
        console.log(`Current map zoom: ${mapRef.current.getZoom()}`);
        console.log(`Map zoom limits: ${mapRef.current.getMinZoom()} - ${mapRef.current.getMaxZoom()}`);
        console.log(`Current map bounds:`, mapRef.current.getBounds());
      }

      console.log("Current soldiers:", soldiers.length);
      console.log("Trails data:", Object.keys(trailsData).length, "soldiers have trails");
      Object.entries(trailsData).forEach(([id, coords]) => {
        console.log(`Soldier ${id}: ${coords.length} GPS points`);
      });

      console.log("=== Distance Debug Info ===");
      const commandCenter = soldiers.find(
        (soldier) =>
          soldier &&
          soldier.soldier_id === "1" &&
          soldier.gps &&
          typeof soldier.gps.latitude === "number" &&
          typeof soldier.gps.longitude === "number"
      );
      if (commandCenter) {
        console.log(
          `Command Center (Soldier 1): Lat ${commandCenter.gps.latitude}, Lng ${commandCenter.gps.longitude}`
        );
        soldiers.forEach((soldier) => {
          if (
            soldier &&
            soldier.soldier_id &&
            typeof soldier.soldier_id === "string" &&
            soldier.soldier_id !== "1" &&
            soldier.gps &&
            typeof soldier.gps.latitude === "number" &&
            typeof soldier.gps.longitude === "number"
          ) {
            const distance = calculateDistance(
              commandCenter.gps.latitude,
              commandCenter.gps.longitude,
              soldier.gps.latitude,
              soldier.gps.longitude
            );
            console.log(`Distance to Soldier ${soldier.soldier_id}: ${Math.round(distance)} meters`);
          }
        });
      }

      console.log("=== Out of Bounds Debug Info ===");
      console.log("Map metadata bounds:", mapMetadataBounds);
      console.log("Out of bounds soldiers:", Object.keys(outOfBoundsSoldiers));
      Object.entries(outOfBoundsSoldiers).forEach(([id, data]) => {
        console.log(`Soldier ${id} out of bounds: Lat ${data.originalLat}, Lng ${data.originalLng}`);
      });

      console.log("=== Path Tracking Status ===");
      console.log("Path tracking enabled:", showPathTracking);
    }
  };

  return (
    <div className="map-container" style={{ position: "relative", height: "100%", width: "100%" }}>
      <style jsx>{`
        .scifi-panel {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          background: linear-gradient(135deg, rgba(0, 20, 40, 0.95) 0%, rgba(0, 40, 80, 0.95) 100%);
          border: 2px solid #00ffff;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 
            0 0 20px rgba(0, 255, 255, 0.3),
            inset 0 0 20px rgba(0, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          min-width: 400px;
          animation: glow 2s ease-in-out infinite alternate;
        }

        @keyframes glow {
          from {
            box-shadow: 
              0 0 20px rgba(0, 255, 255, 0.3),
              inset 0 0 20px rgba(0, 255, 255, 0.1);
          }
          to {
            box-shadow: 
              0 0 30px rgba(0, 255, 255, 0.5),
              inset 0 0 30px rgba(0, 255, 255, 0.2);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .scifi-title {
          color: #00ffff;
          text-align: center;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 20px;
          text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
          letter-spacing: 2px;
        }

        .scifi-input-group {
          margin-bottom: 16px;
        }

        .scifi-label {
          display: block;
          color: #66fcf1;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .scifi-input {
          width: 100%;
          background: rgba(0, 20, 40, 0.8);
          border: 1px solid #00ffff;
          border-radius: 6px;
          padding: 10px 12px;
          color: #66fcf1;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .scifi-input:focus {
          border-color: #66fcf1;
          box-shadow: 0 0 10px rgba(102, 252, 241, 0.3);
        }

        .scifi-input::placeholder {
          color: rgba(102, 252, 241, 0.5);
        }

        .scifi-button {
          background: linear-gradient(135deg, #00ffff 0%, #0080ff 100%);
          border: none;
          border-radius: 6px;
          padding: 10px 20px;
          color: #001122;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
          margin-bottom: 8px;
        }

        .scifi-button:hover {
          background: linear-gradient(135deg, #66fcf1 0%, #00aaff 100%);
          box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
          transform: translateY(-1px);
        }

        .scifi-button:active {
          transform: translateY(0);
        }

        .scifi-file-input {
          background: rgba(0, 20, 40, 0.8);
          border: 1px dashed #00ffff;
          border-radius: 6px;
          padding: 12px;
          color: #66fcf1;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .scifi-file-input:hover {
          border-color: #66fcf1;
          background: rgba(0, 40, 80, 0.8);
        }

        .scifi-file-input input[type="file"] {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }

        .loader-panel {
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: rgba(0, 20, 40, 0.95);
          border: 1px solid #00ffff;
          border-radius: 8px;
          padding: 12px 20px;
          color: #66fcf1;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(0, 20, 40, 0.8);
          border: 1px solid #00ffff;
          border-radius: 4px;
          margin-top: 8px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00ffff, #66fcf1);
          transition: width 0.3s ease;
        }

        .status-panel {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 1000;
          background: rgba(0, 20, 40, 0.95);
          border: 1px solid #66fcf1;
          border-radius: 8px;
          padding: 12px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          max-width: 200px;
          color: #66fcf1;
          box-shadow: 0 0 10px rgba(102, 252, 241, 0.2);
        }

        .status-title {
          color: #00ffff;
          font-weight: bold;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .soldier-item {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .soldier-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1px solid #00ffff;
          flex-shrink: 0;
        }

        .out-of-bounds-indicator {
          color: #ff4444;
          font-size: 9px;
          font-weight: bold;
          margin-left: 4px;
          animation: pulse 1s ease-in-out infinite;
        }

        .close-button {
          position: absolute;
          top: 8px;
          right: 12px;
          background: none;
          border: none;
          color: #ff4444;
          font-size: 20px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .close-button:hover {
          color: #ff6666;
          text-shadow: 0 0 10px rgba(255, 68, 68, 0.8);
          transform: scale(1.1);
        }

        .toggle-controls {
          position: absolute;
          bottom: 20px;
          left: 20px;
          z-index: 1000;
          background: linear-gradient(135deg, #00ffff 0%, #0080ff 100%);
          border: none;
          border-radius: 50%;
          padding: 12px;
          color: #001122;
          font-size: 16px;
          cursor: pointer;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
          transition: all 0.3s ease;
        }

        .toggle-controls:hover {
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
        }

        .fullscreen-button {
          position: absolute;
          top: 70px;
          right: 270px;
          z-index: 1000;
          background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%);
          border: none;
          border-radius: 50%;
          padding: 12px;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(255, 152, 0, 0.3);
          transition: all 0.3s ease;
        }

        .fullscreen-button:hover {
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(255, 152, 0, 0.5);
        }

        .path-tracking-button {
          position: absolute;
          bottom: 80px;
          left: 20px;
          z-index: 1000;
          background: linear-gradient(135deg, ${showPathTracking ? '#4CAF50' : '#f44336'} 0%, ${showPathTracking ? '#2E7D32' : '#c62828'} 100%);
          border: none;
          border-radius: 50%;
          padding: 12px;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px ${showPathTracking ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'};
          transition: all 0.3s ease;
        }

        .path-tracking-button:hover {
          transform: scale(1.1);
          box-shadow: 0 0 20px ${showPathTracking ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)'};
        }

        .map-container:fullscreen {
          background: #000;
        }

        .map-container:fullscreen .fullscreen-button {
          background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
          box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
        }

        .map-container:fullscreen .fullscreen-button:hover {
          box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
        }

        .offline-indicator {
          position: absolute;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          background: rgba(0, 20, 40, 0.95);
          border: 1px solid #00ffff;
          border-radius: 8px;
          padding: 8px 12px;
          color: #00ffff;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
        }

        .bounds-info {
          position: absolute;
          bottom: 140px;
          right: 20px;
          z-index: 1000;
          background: rgba(0, 20, 40, 0.95);
          border: 1px solid #ff9800;
          border-radius: 8px;
          padding: 8px 12px;
          color: #ff9800;
          font-family: 'Courier New', monospace;
          font-size: 9px;
          max-width: 200px;
          box-shadow: 0 0 10px rgba(255, 152, 0, 0.2);
        }

        .bounds-title {
          color: #ff9800;
          font-weight: bold;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .path-tracking-status {
          position: absolute;
          bottom: 140px;
          left: 20px;
          z-index: 1000;
          background: rgba(0, 20, 40, 0.95);
          border: 1px solid ${showPathTracking ? '#4CAF50' : '#f44336'};
          border-radius: 8px;
          padding: 8px 12px;
          color: ${showPathTracking ? '#4CAF50' : '#f44336'};
          font-family: 'Courier New', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 0 10px ${showPathTracking ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'};
        }

        .out-of-bounds-marker {
          animation: flicker 1s ease-in-out infinite !important;
        }

        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {loader && (
        <div className="loader-panel">
          <span style={{ animation: loader.includes("Error") ? "none" : "pulse 1.5s ease-in-out infinite" }}>
            {loader}
          </span>
          {progress > 0 && progress < 100 && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {showControls && !mapLoaded && (
        <div className="scifi-panel">
          <button
            className="close-button"
            onClick={() => setShowControls(false)}
            title="Close Panel"
          >
            ×
          </button>

          <div className="scifi-title">SELECT MAP</div>

          <div className="scifi-input-group">
            <label className="scifi-label">Map File Path</label>
            <input
              id="filepath"
              className="scifi-input"
              placeholder="Enter path to .mbtiles file"
            />
          </div>

          <button className="scifi-button" onClick={onPath}>
            Load From Path
          </button>

          <div className="scifi-input-group">
            <label className="scifi-label">Upload Map File</label>
            <div className="scifi-file-input">
              <input type="file" accept=".mbtiles" onChange={onFile} />
              Select .mbtiles file from device
            </div>
          </div>

          {mapBounds && (
            <button className="scifi-button" onClick={onFitBounds}>
              Fit to Map Bounds
            </button>
          )}

          <button className="scifi-button" onClick={onDebugTiles}>
            Debug Tiles
          </button>
        </div>
      )}

      {!showControls && !mapLoaded && (
        <button
          className="toggle-controls"
          onClick={() => setShowControls(true)}
          title="Open Map Controls"
        >
          ⚙
        </button>
      )}

      <button
        className="fullscreen-button"
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? "⬜" : "⛶"}
      </button>

      <button
        className="path-tracking-button"
        onClick={togglePathTracking}
        title={showPathTracking ? "Disable Path Tracking & Distance" : "Enable Path Tracking & Distance"}
      >
        {showPathTracking ? "🛤" : "📍"}
      </button>

      <div className="path-tracking-status">
        Path Tracking: {showPathTracking ? "ON" : "OFF"}
      </div>

      {soldiers.length > 0 && (
        <div className="status-panel">
          <div className="status-title">Active Units: {soldiers.length}</div>
          {Object.entries(colorMap).map(([id, color]) => (
            <div key={id} className="soldier-item">
              <div
                className="soldier-dot"
                style={{ 
                  backgroundColor: color,
                  border: outOfBoundsSoldiers[id] ? "2px solid #ff0000" : "1px solid #00ffff"
                }}
              />
              <span>{id}</span>
              {outOfBoundsSoldiers[id] && (
                <span className="out-of-bounds-indicator">OUT</span>
              )}
              <span style={{ color: "#888", fontSize: "10px" }}>
                ({trailsData[id]?.length || 0} pts)
              </span>
            </div>
          ))}
        </div>
      )}

      {mapMetadataBounds && Object.keys(outOfBoundsSoldiers).length > 0 && (
        <div className="bounds-info">
          <div className="bounds-title">Map Bounds</div>
          <div>N: {mapMetadataBounds.north.toFixed(6)}</div>
          <div>S: {mapMetadataBounds.south.toFixed(6)}</div>
          <div>E: {mapMetadataBounds.east.toFixed(6)}</div>
          <div>W: {mapMetadataBounds.west.toFixed(6)}</div>
          <div style={{ color: "#ff4444", marginTop: "4px", fontWeight: "bold" }}>
            {Object.keys(outOfBoundsSoldiers).length} OUT OF BOUNDS
          </div>
        </div>
      )}

      <div
        id="mapid"
        style={{
          height: "100%",
          width: "100%",
          border: "1px solid #66fcf1",
          borderRadius: 8,
          background: "#0a0a0a",
        }}
      />
    </div>
  );
} 