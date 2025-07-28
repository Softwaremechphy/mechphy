// components/MapSection.js
"use client";

import { useEffect, useRef, useState } from "react";

export default function MapSection({ soldiers, selectedSoldierId }) {
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const mapInitializedRef = useRef(false);
  const mbTilesLayerRef = useRef(null);
  const mapContainerRef = useRef(null);

  const [trailsData, setTrailsData] = useState({});
  const [colorMap, setColorMap] = useState({});
  const [loader, setLoader] = useState("");
  const [progress, setProgress] = useState(0); // New state for progress
  const [mapBounds, setMapBounds] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [defaultZoomLevel, setDefaultZoomLevel] = useState(15);
  const [showControls, setShowControls] = useState(true);

  const soldierColors = [
    "#FF4C4C",
    "#4CAF50",
    "#2196F3",
    "#FFCA28",
    "#9C27B0",
    "#FF9800",
  ];

  function generateColorFromId(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + (hash * 31);
    }
    return soldierColors[Math.abs(hash) % soldierColors.length];
  }

  useEffect(() => {
    const container = document.getElementById("mapid");
    if (!container) return;

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

    let L;
    import("leaflet")
      .then((mod) => {
        L = mod.default || mod;

        if (mapInitializedRef.current || mapRef.current) {
          return;
        }

        const script = document.createElement("script");
        script.src = "/sqljs/sql-wasm.js";
        script.onload = () => {
          window
            .initSqlJs({ locateFile: () => "/sqljs/sql-wasm.wasm" })
            .then((SQL) => {
              if (mapInitializedRef.current || mapRef.current) {
                return;
              }

              setLoader("Initializing map…");

              try {
                mapRef.current = L.map("mapid", {
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
                      this._db = new SQL.Database(new Uint8Array(buf));
                      this._getMetadata();
                      setLoader("");
                      setProgress(100); // Complete progress
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
              } catch (error) {
                console.error("Error creating map:", error);
                setLoader(`Map Error: ${error.message}`);
              }
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
      })
      .catch((err) => {
        console.error("Leaflet load failed:", err);
        setLoader(`Leaflet Error: ${err.message}`);
      });

    return () => {
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
      soldiers.forEach(({ soldier_id }) => {
        if (!next[soldier_id]) {
          next[soldier_id] = generateColorFromId(soldier_id);
          added = true;
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
      soldiers.forEach(({ soldier_id, gps }) => {
        if (
          gps &&
          typeof gps.latitude === "number" &&
          typeof gps.longitude === "number"
        ) {
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
        }
      });
      return updated ? next : prev;
    });
  }, [soldiers]);

  useEffect(() => {
    if (!mapInitializedRef.current || !mapRef.current) return;

    soldiers.forEach(({ soldier_id, gps, hit_status, imu }) => {
      if (
        !gps ||
        typeof gps.latitude !== "number" ||
        typeof gps.longitude !== "number"
      )
        return;

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
  }, [soldiers, colorMap]);

  useEffect(() => {
    if (!mapInitializedRef.current || !mapRef.current) return;

    const map = mapRef.current;
    Object.values(markersRef.current).forEach((m) => {
      if (m.trail) {
        map.removeLayer(m.trail);
        delete m.trail;
      }
    });

    if (!selectedSoldierId) {
      Object.entries(trailsData).forEach(([id, coords]) => {
        if (coords.length < 2) return;
        const color = colorMap[id] || generateColorFromId(id);
        const pl = L.polyline(coords, {
          color: color,
          weight: 2,
          opacity: 0.6,
          dashArray: "4,6",
        });
        pl.addTo(map);
        if (markersRef.current[id]) {
          markersRef.current[id].trail = pl;
        }
      });
      Object.values(markersRef.current).forEach((m) => m.setOpacity(1));
    } else {
      const coords = trailsData[selectedSoldierId] || [];
      if (coords.length > 1) {
        const color =
          colorMap[selectedSoldierId] || generateColorFromId(selectedSoldierId);
        const pl = L.polyline(coords, {
          color: color,
          weight: 3,
          opacity: 0.8,
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
      const sel = markersRef.current[selectedSoldierId];
      if (sel) map.setView(sel.getLatLng(), map.getZoom());
    }
  }, [trailsData, selectedSoldierId, colorMap]);

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
    }
  };

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
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

      {soldiers.length > 0 && (
        <div className="status-panel">
          <div className="status-title">Active Units: {soldiers.length}</div>
          {Object.entries(colorMap).map(([id, color]) => (
            <div key={id} className="soldier-item">
              <div
                className="soldier-dot"
                style={{ backgroundColor: color }}
              />
              <span>{id}</span>
              <span style={{ color: "#888", fontSize: "10px" }}>
                ({trailsData[id]?.length || 0} pts)
              </span>
            </div>
          ))}
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