"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Pencil, Eraser, Trash2, Save, Upload, Palette, Minus, Plus, Move, Navigation } from "lucide-react";

export default function TacticalMap() {
  const mapRef = useRef(null);
  const drawingLayerRef = useRef(null);
  const drawingRef = useRef(false);
  const currentPathRef = useRef(null);
  const mapInitializedRef = useRef(false);
  const mbTilesLayerRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef({});
  const outOfBoundsMarkersRef = useRef({});
  const distanceLinesRef = useRef({});
  const distanceLabelsRef = useRef({});

  const [loader, setLoader] = useState("");
  const [progress, setProgress] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Drawing states
  const [drawingMode, setDrawingMode] = useState("pan");
  const [lineWidth, setLineWidth] = useState(3);
  const [drawingColor, setDrawingColor] = useState("#ff0000");
  const [opacity, setOpacity] = useState(0.8);

  // Refs for state variables
  const drawingModeRef = useRef(drawingMode);
  const drawingColorRef = useRef(drawingColor);
  const lineWidthRef = useRef(lineWidth);
  const opacityRef = useRef(opacity);

  // Store drawn paths for clearing/saving
  const pathsRef = useRef([]);

  // Update refs when state changes
  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  useEffect(() => {
    drawingColorRef.current = drawingColor;
  }, [drawingColor]);

  useEffect(() => {
    lineWidthRef.current = lineWidth;
  }, [lineWidth]);

  useEffect(() => {
    opacityRef.current = opacity;
  }, [opacity]);

  const colors = [
    { color: "#ff0000", name: "Red" },
    { color: "#00ff00", name: "Green" },
    { color: "#0000ff", name: "Blue" },
    { color: "#ffff00", name: "Yellow" },
    { color: "#ff00ff", name: "Magenta" },
    { color: "#00ffff", name: "Cyan" },
    { color: "#ffffff", name: "White" },
    { color: "#000000", name: "Black" },
    { color: "#ff8000", name: "Orange" },
    { color: "#8000ff", name: "Purple" },
  ];

  const widths = [1, 2, 3, 5, 8, 12, 16, 20];

  // Fallback tile for missing tiles
  const fallbackTile =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=";

  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.getElementById("mapid");
      if (!container) {
        console.error("Map container not found");
        setLoader("Error: Map container not found");
        return;
      }
      if (mapInitializedRef.current || mapRef.current || container._leaflet_id) return;

      mapContainerRef.current = container;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "/leaflet.css";
        document.head.appendChild(link);
      }

      setLoader("Initializing map…");

      try {
        mapRef.current = L.map(container, {
          center: [28.5471399, 77.1945754],
          zoom: 15,
          minZoom: 1,
          maxZoom: 25,
          preferCanvas: true,
          zoomControl: true,
          attributionControl: false,
        });

        const zoomControl = L.control.zoom({
          position: "topright",
        });
        zoomControl.addTo(mapRef.current);

        // Initialize drawing layer
        drawingLayerRef.current = L.layerGroup().addTo(mapRef.current);

        class MBTilesLayer extends L.TileLayer {
          _db = null;

          loadMBTilesFromArrayBuffer = (buf) => {
            console.log("Loading MBTiles from buffer, size:", buf.byteLength);
            try {
              this._db = new window.SQL.Database(new Uint8Array(buf));
              this._getMetadata();
              setLoader("");
              setProgress(100);
              setMapLoaded(true);
              setShowControls(false);
              setTimeout(() => {
                this.redraw();
              }, 100);
              console.log("MBTiles loaded successfully");
            } catch (error) {
              console.error("Error loading MBTiles:", error);
              setLoader("Error: Failed to load MBTiles file");
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

              // Query zoom levels first
              const zoomStmt = this._db.prepare(
                "SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level"
              );
              const zooms = [];
              while (zoomStmt.step()) {
                zooms.push(zoomStmt.getAsObject().zoom_level);
              }
              zoomStmt.free();
              console.log("Available zoom levels:", zooms);

              // Calculate min and max zoom
              const minZoom = zooms.length > 0 ? Math.min(...zooms) : 1;
              const maxZoom = zooms.length > 0 ? Math.max(...zooms) : 25;
              console.log(`Adjusting zoom range: ${minZoom} - ${maxZoom}`);

              this.options.minZoom = minZoom;
              this.options.maxZoom = Math.min(maxZoom, 21);

              if (mapRef.current) {
                mapRef.current.setMinZoom(minZoom);
                mapRef.current.setMaxZoom(Math.min(maxZoom, 21));
              }

              // Handle bounds after zooms are defined
              if (metadata.bounds) {
                const bounds = metadata.bounds.split(",").map(Number);
                if (bounds.length === 4) {
                  const sw = [bounds[1], bounds[0]];
                  const ne = [bounds[3], bounds[2]];
                  const leafletBounds = L.latLngBounds(sw, ne);
                  setMapBounds(leafletBounds);

                  const idealZoom = mapRef.current.getBoundsZoom(leafletBounds);
                  const clampedZoom = Math.max(minZoom, Math.min(idealZoom, maxZoom - 1));

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
              img.src = fallbackTile;
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
                    img.src = fallbackTile;
                    done(null, img);
                  };
                  img.src = url;
                } else {
                  console.warn(`Empty tile data for ${z}/${x}/${y}`);
                  img.src = fallbackTile;
                  done(null, img);
                }
              } else {
                if (z <= 12) {
                  console.warn(`Missing tile at zoom ${z}: ${x}/${y} (critical for zoom out)`);
                }
                img.src = fallbackTile;
                done(null, img);
              }
              stmt.free();
            } catch (error) {
              console.error(`Error getting tile ${z}/${x}/${y}:`, error);
              img.src = fallbackTile;
              done(null, img);
            }

            return img;
          }
        }

        mbTilesLayerRef.current = new MBTilesLayer({
          minZoom: 1,
          maxZoom: 25,
          tms: true,
          errorTileUrl: fallbackTile,
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
              window.SQL = SQL;
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

  const setupDrawingEvents = () => {
    if (!mapRef.current || !drawingLayerRef.current) {
      console.log("Map or drawing layer not ready for event setup");
      return;
    }

    const map = mapRef.current;

    const getEventLatLng = (e) => {
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      let clientX, clientY;
      if (e.type.startsWith("touch")) {
        if (e.touches && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        } else {
          return null;
        }
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const containerPoint = L.point(x, y);
      return map.containerPointToLatLng(containerPoint);
    };

    const startDrawing = (e) => {
      if (drawingModeRef.current === "pan") return;
      console.log("Start drawing - mode:", drawingModeRef.current);
      e.preventDefault();
      e.stopPropagation();
      const latlng = getEventLatLng(e);
      if (!latlng) return;
      drawingRef.current = true;
      if (drawingModeRef.current === "draw") {
        currentPathRef.current = L.polyline([latlng], {
          color: drawingColorRef.current,
          weight: lineWidthRef.current,
          opacity: opacityRef.current,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(drawingLayerRef.current);
        pathsRef.current.push(currentPathRef.current);
      } else if (drawingModeRef.current === "eraser") {
        const clickPoint = latlng;
        let minDistance = Infinity;
        let pathToRemove = null;
        pathsRef.current.forEach((path) => {
          const points = path.getLatLngs();
          points.forEach((point) => {
            const distance = clickPoint.distanceTo(point);
            if (distance < minDistance) {
              minDistance = distance;
              pathToRemove = path;
            }
          });
        });
        if (pathToRemove && minDistance < 1000 / Math.pow(2, map.getZoom())) {
          drawingLayerRef.current.removeLayer(pathToRemove);
          pathsRef.current = pathsRef.current.filter((p) => p !== pathToRemove);
        }
      }
    };

    const draw = (e) => {
      if (!drawingRef.current || drawingModeRef.current !== "draw") return;
      console.log("Drawing");
      e.preventDefault();
      e.stopPropagation();
      const latlng = getEventLatLng(e);
      if (!latlng) return;
      if (currentPathRef.current) {
        currentPathRef.current.addLatLng(latlng);
      }
    };

    const stopDrawing = (e) => {
      if (drawingRef.current) {
        console.log("Stop drawing");
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      drawingRef.current = false;
      currentPathRef.current = null;
    };

    ["mousedown", "mousemove", "mouseup", "mouseleave", "touchstart", "touchmove", "touchend"].forEach((event) => {
      map.getContainer().removeEventListener(event, () => {});
    });

    map.getContainer().addEventListener("mousedown", startDrawing, { passive: false });
    map.getContainer().addEventListener("mousemove", draw, { passive: false });
    map.getContainer().addEventListener("mouseup", stopDrawing, { passive: false });
    map.getContainer().addEventListener("mouseleave", stopDrawing, { passive: false });

    map.getContainer().addEventListener("touchstart", startDrawing, { passive: false });
    map.getContainer().addEventListener("touchmove", draw, { passive: false });
    map.getContainer().addEventListener("touchend", stopDrawing, { passive: false });

    console.log("Event listeners attached to map container");
  };

  useEffect(() => {
    if (mapRef.current && drawingLayerRef.current) {
      setupDrawingEvents();
    }
  }, [mapLoaded]);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f && mbTilesLayerRef.current) {
      console.log("Loading MBTiles from file:", f.name);
      setLoader(`Loading ${f.name}…`);
      setProgress(0);
      const r = new FileReader();
      r.onprogress = (event) => {
        if (event.lengthComputable) {
          const newProgress = Math.round((event.loaded / event.total) * 100);
          setProgress(newProgress);
          setLoader(`Loading ${f.name}: ${newProgress}%`);
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

  const clearCanvas = () => {
    if (drawingLayerRef.current) {
      drawingLayerRef.current.clearLayers();
      pathsRef.current = [];
      console.log("Drawing layer cleared");
    }
  };

  const saveDrawing = () => {
    if (drawingLayerRef.current) {
      const canvas = document.createElement("canvas");
      const bounds = mapRef.current.getBounds();
      const topLeft = mapRef.current.latLngToContainerPoint(bounds.getNorthWest());
      const bottomRight = mapRef.current.latLngToContainerPoint(bounds.getSouthEast());
      canvas.width = bottomRight.x - topLeft.x;
      canvas.height = bottomRight.y - topLeft.y;
      const ctx = canvas.getContext("2d");

      pathsRef.current.forEach((path) => {
        const latlngs = path.getLatLngs();
        const style = path.options;
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.weight;
        ctx.globalAlpha = style.opacity;
        ctx.lineCap = style.lineCap;
        ctx.lineJoin = style.lineJoin;
        ctx.beginPath();
        latlngs.forEach((latlng, index) => {
          const point = mapRef.current.latLngToContainerPoint(latlng);
          if (index === 0) {
            ctx.moveTo(point.x - topLeft.x, point.y - topLeft.y);
          } else {
            ctx.lineTo(point.x - topLeft.x, point.y - topLeft.y);
          }
        });
        ctx.stroke();
      });

      const link = document.createElement("a");
      link.download = "tactical-plan.png";
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const setTool = (tool) => {
    console.log("Setting tool to:", tool);
    setDrawingMode(tool);
    if (mapRef.current) {
      if (tool === "pan") {
        mapRef.current.dragging.enable();
        mapRef.current.scrollWheelZoom.enable();
        mapRef.current.doubleClickZoom.enable();
        mapRef.current.boxZoom.enable();
        mapRef.current.keyboard.enable();
        mapRef.current.getContainer().style.cursor = "grab";
      } else {
        mapRef.current.dragging.disable();
        mapRef.current.scrollWheelZoom.disable();
        mapRef.current.doubleClickZoom.disable();
        mapRef.current.boxZoom.disable();
        mapRef.current.keyboard.disable();
        mapRef.current.getContainer().style.cursor = tool === "eraser" ? "crosshair" : "crosshair";
      }
    }
  };

  const testDraw = () => {
    if (drawingLayerRef.current) {
      const center = mapRef.current.getCenter();
      const offset = 0.001;
      const path = L.polyline(
        [
          [center.lat - offset, center.lng - offset],
          [center.lat + offset, center.lng + offset],
        ],
        {
          color: "#ff0000",
          weight: 5,
          opacity: 0.8,
        }
      ).addTo(drawingLayerRef.current);
      pathsRef.current.push(path);
      console.log("Test line drawn");
    }
  };

  const debugTiles = () => {
    if (mbTilesLayerRef.current && mbTilesLayerRef.current._db) {
      const db = mbTilesLayerRef.current._db;
      console.log("=== Enhanced MBTiles Debug Info ===");
      
      const zoomStmt = db.prepare("SELECT zoom_level, COUNT(*) as count FROM tiles GROUP BY zoom_level ORDER BY zoom_level");
      console.log("Tile distribution by zoom level:");
      while (zoomStmt.step()) {
        const row = zoomStmt.getAsObject();
        console.log(`  Zoom ${row.zoom_level}: ${row.count} tiles`);
      }
      zoomStmt.free();
      
      const minZoomStmt = db.prepare("SELECT MIN(zoom_level) as min_zoom, MAX(zoom_level) as max_zoom FROM tiles");
      minZoomStmt.step();
      const zoomRange = minZoomStmt.getAsObject();
      minZoomStmt.free();
      console.log(`Data zoom range: ${zoomRange.min_zoom} - ${zoomRange.max_zoom}`);
      
      if (mapRef.current) {
        const currentZoom = mapRef.current.getZoom();
        console.log(`Current map zoom: ${currentZoom}`);
        console.log(`Map zoom limits: ${mapRef.current.getMinZoom()} - ${mapRef.current.getMaxZoom()}`);
        console.log(`Current map bounds:`, mapRef.current.getBounds());
        
        const center = mapRef.current.getCenter();
        const zoom = Math.floor(currentZoom);
        const tileX = Math.floor((center.lng + 180) / 360 * Math.pow(2, zoom));
        const tileY = Math.floor((1 - Math.log(Math.tan(center.lat * Math.PI / 180) + 1 / Math.cos(center.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        const tileYTMS = Math.pow(2, zoom) - tileY - 1;
        
        console.log(`Center tile at current zoom ${zoom}: x=${tileX}, y=${tileY} (TMS: ${tileYTMS})`);
        
        const tileStmt = db.prepare("SELECT COUNT(*) as exists FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?");
        tileStmt.bind([zoom, tileX, tileYTMS]);
        tileStmt.step();
        const exists = tileStmt.getAsObject().exists > 0;
        tileStmt.free();
        console.log(`Center tile exists in database: ${exists}`);
      }
    }
  };

  const forceRedraw = () => {
    if (mbTilesLayerRef.current) {
      console.log("Forcing map redraw...");
      mbTilesLayerRef.current.redraw();
    }
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%", background: "#0a0a0a", display: "flex" }}>
      {loader && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#66fcf1",
            background: "rgba(0,0,0,0.9)",
            padding: "8px 16px",
            borderRadius: "6px",
            zIndex: 1001,
            border: "1px solid #00ffff",
          }}
        >
          {loader} {progress > 0 && progress < 100 && `(${progress}%)`}
        </div>
      )}

      {showControls && !mapLoaded && (
        <div
          style={{
            position: "absolute",
            top: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            background: "rgba(0,0,0,0.95)",
            padding: "20px 30px",
            borderRadius: "8px",
            border: "1px solid #00ffff",
            boxShadow: "0 0 20px rgba(0,255,255,0.3)",
          }}
        >
          <label
            style={{
              display: "block",
              color: "#00ffff",
              fontFamily: "monospace",
              marginBottom: "15px",
              textAlign: "center",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            📍 Upload MBTiles Map for Tactical Planning
          </label>
          <input
            type="file"
            accept=".mbtiles"
            onChange={onFile}
            style={{
              padding: "10px",
              color: "#66fcf1",
              backgroundColor: "#001122",
              border: "1px solid #00ffff",
              borderRadius: "4px",
              cursor: "pointer",
              width: "100%",
              fontSize: "14px",
            }}
          />
          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "#66fcf1",
              fontFamily: "monospace",
            }}
          >
            Supports offline MBTiles format maps with enhanced loading
          </div>
        </div>
      )}

      {mapLoaded && (
        <div
          style={{
            width: sidebarCollapsed ? "50px" : "280px",
            background: "rgba(0,0,0,0.95)",
            border: "1px solid #00ffff",
            boxShadow: "0 0 20px rgba(0,255,255,0.3)",
            zIndex: 1000,
            transition: "width 0.3s ease",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "15px",
              borderBottom: "1px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3
              style={{
                color: "#00ffff",
                margin: 0,
                fontSize: "16px",
                fontFamily: "monospace",
                display: sidebarCollapsed ? "none" : "block",
              }}
            >
              Tactical Tools
            </h3>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                background: "transparent",
                border: "1px solid #00ffff",
                color: "#00ffff",
                padding: "5px",
                borderRadius: "3px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sidebarCollapsed ? <Navigation size={16} /> : <Minus size={16} />}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div style={{ padding: "15px", flex: 1, overflowY: "auto" }}>
              <div style={{ marginBottom: "20px" }}>
                <h4
                  style={{
                    color: "#66fcf1",
                    fontSize: "14px",
                    marginBottom: "10px",
                    fontFamily: "monospace",
                  }}
                >
                  Drawing Tools
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "8px",
                    marginBottom: "15px",
                  }}
                >
                  <button
                    onClick={() => setTool("pan")}
                    style={{
                      background: drawingMode === "pan" ? "#00ffff" : "transparent",
                      color: drawingMode === "pan" ? "#000" : "#00ffff",
                      border: "1px solid #00ffff",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      fontSize: "12px",
                    }}
                  >
                    <Move size={16} />
                    Pan
                  </button>
                  <button
                    onClick={() => setTool("draw")}
                    style={{
                      background: drawingMode === "draw" ? "#00ffff" : "transparent",
                      color: drawingMode === "draw" ? "#000" : "#00ffff",
                      border: "1px solid #00ffff",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      fontSize: "12px",
                    }}
                  >
                    <Pencil size={16} />
                    Draw
                  </button>
                  <button
                    onClick={() => setTool("eraser")}
                    style={{
                      background: drawingMode === "eraser" ? "#00ffff" : "transparent",
                      color: drawingMode === "eraser" ? "#000" : "#00ffff",
                      border: "1px solid #00ffff",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      fontSize: "12px",
                    }}
                  >
                    <Eraser size={16} />
                    Erase
                  </button>
                  <button
                    onClick={testDraw}
                    style={{
                      background: "transparent",
                      color: "#66fcf1",
                      border: "1px solid #66fcf1",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      fontSize: "12px",
                    }}
                  >
                    Test
                  </button>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      color: "#66fcf1",
                      fontSize: "12px",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Color:
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gap: "4px",
                    }}
                  >
                    {colors.map((colorObj) => (
                      <button
                        key={colorObj.color}
                        onClick={() => setDrawingColor(colorObj.color)}
                        style={{
                          width: "30px",
                          height: "30px",
                          backgroundColor: colorObj.color,
                          border:
                            drawingColor === colorObj.color
                              ? "2px solid #00ffff"
                              : "1px solid #333",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                        title={colorObj.name}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <label
                    style={{
                      color: "#66fcf1",
                      fontSize: "12px",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Line Width: {lineWidth}px
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "4px",
                    }}
                  >
                    {widths.map((width) => (
                      <button
                        key={width}
                        onClick={() => setLineWidth(width)}
                        style={{
                          background: lineWidth === width ? "#00ffff" : "transparent",
                          color: lineWidth === width ? "#000" : "#66fcf1",
                          border: "1px solid #66fcf1",
                          padding: "6px",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        {width}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      color: "#66fcf1",
                      fontSize: "12px",
                      display: "block",
                      marginBottom: "8px",
                    }}
                  >
                    Opacity: {Math.round(opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      accentColor: "#00ffff",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <button
                    onClick={clearCanvas}
                    style={{
                      background: "transparent",
                      color: "#ff6b6b",
                      border: "1px solid #ff6b6b",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      fontSize: "12px",
                    }}
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                  <button
                    onClick={saveDrawing}
                    style={{
                      background: "transparent",
                      color: "#51cf66",
                      border: "1px solid #51cf66",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                      fontSize: "12px",
                    }}
                  >
                    <Save size={14} />
                    Save
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    marginTop: "10px",
                  }}
                >
                  <button
                    onClick={debugTiles}
                    style={{
                      background: "transparent",
                      color: "#ffd43b",
                      border: "1px solid #ffd43b",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Debug
                  </button>
                  <button
                    onClick={forceRedraw}
                    style={{
                      background: "transparent",
                      color: "#74c0fc",
                      border: "1px solid #74c0fc",
                      padding: "8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        id="mapid"
        style={{
          flex: 1,
          position: "relative",
          background: "#0a0a0a",
        }}
      />

      {mapLoaded && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            background: "rgba(0,0,0,0.8)",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #333",
            color: "#66fcf1",
            fontSize: "12px",
            fontFamily: "monospace",
            zIndex: 1000,
          }}
        >
          Mode: {drawingMode} | Color: {drawingColor} | Width: {lineWidth}px | Opacity: {Math.round(opacity * 100)}% | Zoom: {mapRef.current ? Math.round(mapRef.current.getZoom() * 10) / 10 : 'N/A'}
        </div>
      )}
    </div>
  );
}