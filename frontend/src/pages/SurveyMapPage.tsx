import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type {
  Scan,
  Detection,
} from "../types/sonar";

import {
  MapPin,
  RefreshCw,
  Crosshair,
  Target,
} from "lucide-react";

/*
 * ============================================================
 * MAPBOX
 * ============================================================
 */

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN;

const API_BASE =
  "https://sonar-x.onrender.com";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type MapPoint = {
  longitude: number;
  latitude: number;
};

type SurveyMapPageProps = {
  onSelectScan?: (scanId: string) => void;
  onNewScan?: () => void;
};

/*
 * ============================================================
 * DEFAULT MAP CENTER
 * ============================================================
 */

const DEFAULT_CENTER: [number, number] = [
  73.71247,
  24.58545,
];

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function isValidCoordinate(
  latitude: unknown,
  longitude: unknown
): boolean {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function escapeHtml(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCoordinate(
  value: number
): string {
  return value.toFixed(6);
}

function formatConfidence(
  detection: Detection
): string {
  const percent =
    typeof detection.confidencePercent ===
    "number"
      ? detection.confidencePercent
      : typeof detection.confidence ===
          "number"
        ? detection.confidence * 100
        : 0;

  return `${percent.toFixed(1)}%`;
}

/*
 * ============================================================
 * PAGE
 * ============================================================
 */

function SurveyMapPage({
  onSelectScan,
}: SurveyMapPageProps) {
  /*
   * ----------------------------------------------------------
   * MAP REFS
   * ----------------------------------------------------------
   */

  const mapContainerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<mapboxgl.Map | null>(null);

  const markersRef =
    useRef<mapboxgl.Marker[]>([]);

  /*
   * ----------------------------------------------------------
   * STATE
   * ----------------------------------------------------------
   */

  const [scans, setScans] =
    useState<Scan[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [mapReady, setMapReady] =
    useState(false);

  /*
   * ==========================================================
   * LOAD SCANS
   * ==========================================================
   *
   * IMPORTANT:
   *
   * We directly call:
   *
   * GET http://localhost:8000/api/scans
   *
   * because Swagger has already confirmed this endpoint
   * returns the scan array correctly.
   *
   * ==========================================================
   */

  const loadScans = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      console.log(
        "[SurveyMap] Loading scans..."
      );

      const response = await fetch(
        `${API_BASE}/api/scans`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      console.log(
        "[SurveyMap] API status:",
        response.status
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load scans: HTTP ${response.status}`
        );
      }

      const result = await response.json();

      console.log(
        "[SurveyMap] Raw API response:",
        result
      );

      /*
       * Backend currently returns:
       *
       * [
       *   {
       *     scanId: "...",
       *     ...
       *   }
       * ]
       */

      const scanList: Scan[] =
        Array.isArray(result)
          ? result
          : Array.isArray(result?.scans)
            ? result.scans
            : [];

      console.log(
        "[SurveyMap] Total scans:",
        scanList.length
      );

      /*
       * Only scans with a valid survey-level
       * location are displayed.
       */

      const scansWithLocation =
        scanList.filter(
          (scan: Scan) =>
            scan.location &&
            isValidCoordinate(
              scan.location.latitude,
              scan.location.longitude
            )
        );

      console.log(
        "[SurveyMap] Georeferenced scans:",
        scansWithLocation.length
      );

      /*
       * Debug individual detections.
       *
       * This will tell us exactly whether the
       * backend has supplied detection.geoLocation.
       */

      scanList.forEach((scan) => {
        if (
          Array.isArray(scan.detections) &&
          scan.detections.length > 0
        ) {
          scan.detections.forEach(
            (detection) => {
              console.log(
                "[SurveyMap] Detection:",
                {
                  scanId: scan.scanId,
                  detectionId: detection.id,
                  className:
                    detection.className,
                  geoLocation:
                    detection.geoLocation,
                }
              );
            }
          );
        }
      });

      setScans(scansWithLocation);
    } catch (error) {
      console.error(
        "[SurveyMap] Failed to load scans:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load survey scans."
      );

      setScans([]);
    } finally {
      setIsLoading(false);
    }
  };

  /*
   * ==========================================================
   * LOAD SCANS ON PAGE LOAD
   * ==========================================================
   */

  useEffect(() => {
    loadScans();
  }, []);

  /*
   * ==========================================================
   * GEOLOCATED DETECTIONS
   * ==========================================================
   *
   * Detection flow:
   *
   * YOLO detection
   *      ↓
   * Bounding box center
   *      ↓
   * GeoTIFF transform
   *      ↓
   * Source CRS
   *      ↓
   * EPSG:4326
   *      ↓
   * detection.geoLocation
   *
   * ==========================================================
   */

  const geolocatedDetections =
    useMemo(() => {
      const results: Array<{
        scan: Scan;
        detection: Detection;
        point: MapPoint;
      }> = [];

      scans.forEach((scan) => {
        const detections =
          Array.isArray(scan.detections)
            ? scan.detections
            : [];

        detections.forEach((detection) => {
          const geoLocation =
            detection.geoLocation;

          if (
            geoLocation &&
            isValidCoordinate(
              geoLocation.latitude,
              geoLocation.longitude
            )
          ) {
            results.push({
              scan,
              detection,
              point: {
                latitude:
                  geoLocation.latitude,
                longitude:
                  geoLocation.longitude,
              },
            });
          }
        });
      });

      console.log(
        "[SurveyMap] Geolocated detections:",
        results.length
      );

      return results;
    }, [scans]);

  /*
   * ==========================================================
   * CREATE MAPBOX MAP
   * ==========================================================
   */

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (!MAPBOX_TOKEN) {
      setErrorMessage(
        "Mapbox token is missing. Check frontend/.env for VITE_MAPBOX_TOKEN."
      );

      return;
    }

    /*
     * Prevent duplicate Mapbox instances.
     */

    if (mapRef.current) {
      return;
    }

    console.log(
      "[Mapbox] Creating map..."
    );

    mapboxgl.accessToken =
      MAPBOX_TOKEN;

    const map =
      new mapboxgl.Map({
        accessToken: MAPBOX_TOKEN,

        container:
          mapContainerRef.current,

        style:
          "mapbox://styles/mapbox/streets-v12",

        center:
          DEFAULT_CENTER,

        zoom: 12,

        attributionControl: true,
      });

    mapRef.current = map;

    /*
     * Navigation controls.
     */

    map.addControl(
      new mapboxgl.NavigationControl(),
      "top-right"
    );

    /*
     * Map loaded.
     */

    const handleLoad = () => {
      console.log(
        "[Mapbox] Map loaded successfully."
      );

      map.resize();

      setMapReady(true);
    };

    map.on(
      "load",
      handleLoad
    );

    /*
     * Keep Mapbox correctly sized.
     */

    const resizeObserver =
      new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });

    resizeObserver.observe(
      mapContainerRef.current
    );

    /*
     * Window resize.
     */

    const handleWindowResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    window.addEventListener(
      "resize",
      handleWindowResize
    );

    /*
     * Cleanup.
     */

    return () => {
      console.log(
        "[Mapbox] Destroying map..."
      );

      resizeObserver.disconnect();

      window.removeEventListener(
        "resize",
        handleWindowResize
      );

      markersRef.current.forEach(
        (marker) => marker.remove()
      );

      markersRef.current = [];

      map.remove();

      mapRef.current = null;

      setMapReady(false);
    };
  }, []);

  /*
   * ==========================================================
   * CREATE / UPDATE MARKERS
   * ==========================================================
   */

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    /*
     * Remove previous markers.
     */

    markersRef.current.forEach(
      (marker) => marker.remove()
    );

    markersRef.current = [];

    const bounds =
      new mapboxgl.LngLatBounds();

    let hasPoints = false;

    /*
     * ========================================================
     * 1. SURVEY POINT MARKERS
     * ========================================================
     *
     * Cyan = GeoTIFF survey location.
     */

    scans.forEach((scan) => {
      if (!scan.location) {
        return;
      }

      const latitude =
        scan.location.latitude;

      const longitude =
        scan.location.longitude;

      if (
        !isValidCoordinate(
          latitude,
          longitude
        )
      ) {
        return;
      }

      const coordinates: [
        number,
        number
      ] = [
        longitude,
        latitude,
      ];

      const detectionCount =
        Array.isArray(scan.detections)
          ? scan.detections.length
          : scan.detectionCount ?? 0;

      const popupHtml = `
        <div
          style="
            font-family: Inter, Arial, sans-serif;
            min-width: 230px;
            color: #111827;
          "
        >
          <div
            style="
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.08em;
              color: #0891b2;
              margin-bottom: 8px;
            "
          >
            SONAR-X SURVEY POINT
          </div>

          <div
            style="
              font-size: 15px;
              font-weight: 700;
              margin-bottom: 10px;
            "
          >
            ${escapeHtml(
              scan.filename
            )}
          </div>

          <div
            style="
              display: grid;
              grid-template-columns: 95px 1fr;
              gap: 5px 8px;
              font-size: 12px;
            "
          >
            <span style="color:#6b7280;">
              Detections
            </span>

            <strong>
              ${detectionCount}
            </strong>

            <span style="color:#6b7280;">
              Latitude
            </span>

            <strong>
              ${formatCoordinate(
                latitude
              )}
            </strong>

            <span style="color:#6b7280;">
              Longitude
            </span>

            <strong>
              ${formatCoordinate(
                longitude
              )}
            </strong>
          </div>
        </div>
      `;

      const marker =
        new mapboxgl.Marker({
          color: "#00d4ff",
        })
          .setLngLat(
            coordinates
          )
          .setPopup(
            new mapboxgl.Popup({
              offset: 25,
              maxWidth: "320px",
            }).setHTML(
              popupHtml
            )
          )
          .addTo(map);

      markersRef.current.push(
        marker
      );

      bounds.extend(
        coordinates
      );

      hasPoints = true;
    });

    /*
     * ========================================================
     * 2. OBJECT / DETECTION MARKERS
     * ========================================================
     *
     * Orange = individual YOLO detection.
     */

    geolocatedDetections.forEach(
      ({
        scan,
        detection,
        point,
      }) => {
        const coordinates: [
          number,
          number
        ] = [
          point.longitude,
          point.latitude,
        ];

        const confidence =
          formatConfidence(
            detection
          );

        const projectedX =
          detection.geoLocation
            ?.projectedX;

        const projectedY =
          detection.geoLocation
            ?.projectedY;

        /*
         * Detection popup.
         */

        const popupHtml = `
          <div
            style="
              font-family: Inter, Arial, sans-serif;
              min-width: 250px;
              color: #111827;
            "
          >
            <div
              style="
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.08em;
                color: #ea580c;
                margin-bottom: 8px;
              "
            >
              SONAR-X OBJECT DETECTION
            </div>

            <div
              style="
                font-size: 16px;
                font-weight: 800;
                margin-bottom: 10px;
              "
            >
              Detection #${escapeHtml(
                detection.detectionIndex
              )}
            </div>

            <div
              style="
                display: grid;
                grid-template-columns: 105px 1fr;
                gap: 6px 8px;
                font-size: 12px;
              "
            >
              <span style="color:#6b7280;">
                Object
              </span>

              <strong>
                ${escapeHtml(
                  detection.className
                )}
              </strong>

              <span style="color:#6b7280;">
                Confidence
              </span>

              <strong>
                ${confidence}
              </strong>

              <span style="color:#6b7280;">
                Latitude
              </span>

              <strong>
                ${formatCoordinate(
                  point.latitude
                )}
              </strong>

              <span style="color:#6b7280;">
                Longitude
              </span>

              <strong>
                ${formatCoordinate(
                  point.longitude
                )}
              </strong>

              ${
                typeof projectedX ===
                "number"
                  ? `
                    <span style="color:#6b7280;">
                      Projected X
                    </span>

                    <strong>
                      ${projectedX.toFixed(
                        3
                      )}
                    </strong>
                  `
                  : ""
              }

              ${
                typeof projectedY ===
                "number"
                  ? `
                    <span style="color:#6b7280;">
                      Projected Y
                    </span>

                    <strong>
                      ${projectedY.toFixed(
                        3
                      )}
                    </strong>
                  `
                  : ""
              }
            </div>

            <div
              style="
                margin-top: 12px;
                padding-top: 9px;
                border-top: 1px solid #e5e7eb;
                font-size: 11px;
                color: #6b7280;
              "
            >
              Source:
              ${escapeHtml(
                scan.filename
              )}
            </div>

            <button
              type="button"
              class="sonar-open-analysis"
              style="
                width: 100%;
                margin-top: 12px;
                padding: 9px 12px;
                border: none;
                border-radius: 7px;
                background: #0891b2;
                color: white;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
              "
            >
              Open in Analysis
            </button>
          </div>
        `;

        /*
         * Create orange marker.
         */

        const marker =
          new mapboxgl.Marker({
            color: "#f97316",
          })
            .setLngLat(
              coordinates
            )
            .setPopup(
              new mapboxgl.Popup({
                offset: 25,
                maxWidth: "340px",
              }).setHTML(
                popupHtml
              )
            )
            .addTo(map);

        /*
         * Open popup handler.
         */

        const popup =
          marker.getPopup();

        if (popup) {
          popup.on(
            "open",
            () => {
              const popupElement =
                popup.getElement();

              if (!popupElement) {
                return;
              }

              const button =
                popupElement.querySelector(
                  ".sonar-open-analysis"
                );

              if (!button) {
                return;
              }

              const newButton =
                button.cloneNode(
                  true
                ) as HTMLElement;

              button.replaceWith(
                newButton
              );

              newButton.addEventListener(
                "click",
                () => {
                  console.log(
                    "[SONAR-X] Open in Analysis clicked",
                    {
                      scanId:
                        scan.scanId,

                      detectionId:
                        detection.id,

                      detectionIndex:
                        detection.detectionIndex,

                      filename:
                        scan.filename,

                      className:
                        detection.className,

                      confidence:
                        detection.confidence,

                      confidencePercent:
                        detection.confidencePercent,

                      latitude:
                        point.latitude,

                      longitude:
                        point.longitude,
                    }
                  );

                  /*
                   * Tell App.tsx which scan
                   * should be opened.
                   */

                  if (onSelectScan) {
                    onSelectScan(
                      scan.scanId
                    );
                  }
                }
              );
            }
          );
        }

        markersRef.current.push(
          marker
        );

        bounds.extend(
          coordinates
        );

        hasPoints = true;
      }
    );

    /*
     * ========================================================
     * FIT MAP TO POINTS
     * ========================================================
     */

    if (hasPoints) {
      map.fitBounds(
        bounds,
        {
          padding: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100,
          },

          maxZoom: 15,

          duration: 800,
        }
      );
    }
  }, [
    scans,
    geolocatedDetections,
    mapReady,
    onSelectScan,
  ]);

  /*
   * ==========================================================
   * COUNTS
   * ==========================================================
   */

  const detectionMarkerCount =
    geolocatedDetections.length;

  const totalDetectionCount =
    scans.reduce(
      (total, scan) =>
        total +
        (Array.isArray(
          scan.detections
        )
          ? scan.detections.length
          : scan.detectionCount ?? 0),
      0
    );

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div
      className="
        h-full
        min-h-0
        w-full
        flex
        flex-col
        bg-slate-950
        text-white
      "
    >
      {/*
       * ======================================================
       * HEADER
       * ======================================================
       */}

      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-slate-800
          bg-slate-950
          px-6
          py-4
        "
      >
        <div>
          <div className="flex items-center gap-3">
            <MapPin
              className="
                h-5
                w-5
                text-cyan-400
              "
              strokeWidth={2}
            />

            <h1 className="text-xl font-semibold">
              Survey Map
            </h1>
          </div>

          <p className="mt-1 text-xs text-slate-400">
            Geo-referenced sonar surveys and
            object-level detections
          </p>
        </div>

        <button
          type="button"
          onClick={loadScans}
          disabled={isLoading}
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-slate-700
            bg-slate-900
            px-3
            py-2
            text-sm
            text-slate-200
            transition
            hover:border-cyan-500
            hover:text-cyan-300
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          <RefreshCw
            className={`
              h-4
              w-4
              ${
                isLoading
                  ? "animate-spin"
                  : ""
              }
            `}
          />

          Refresh
        </button>
      </div>

      {/*
       * ======================================================
       * MAP AREA
       * ======================================================
       */}

      <div className="relative min-h-0 flex-1">
        <div
          ref={mapContainerRef}
          className="
            absolute
            inset-0
            h-full
            w-full
          "
        />

        {/*
         * ====================================================
         * ERROR
         * ====================================================
         */}

        {errorMessage && (
          <div
            className="
              absolute
              left-4
              top-4
              z-20
              max-w-md
              rounded-lg
              border
              border-red-500/40
              bg-red-950/90
              px-4
              py-3
              text-sm
              text-red-200
              shadow-xl
            "
          >
            {errorMessage}
          </div>
        )}

        {/*
         * ====================================================
         * LOADING
         * ====================================================
         */}

        {isLoading && (
          <div
            className="
              absolute
              inset-0
              z-10
              flex
              items-center
              justify-center
              bg-slate-950/35
              backdrop-blur-[1px]
            "
          >
            <div
              className="
                flex
                items-center
                gap-3
                rounded-xl
                border
                border-slate-700
                bg-slate-950/90
                px-5
                py-4
                text-sm
                text-slate-200
                shadow-2xl
              "
            >
              <RefreshCw
                className="
                  h-4
                  w-4
                  animate-spin
                  text-cyan-400
                "
              />

              Loading survey data...
            </div>
          </div>
        )}

        {/*
         * ====================================================
         * MAP INITIALIZATION
         * ====================================================
         */}

        {!mapReady &&
          !errorMessage &&
          !isLoading && (
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                z-10
                flex
                items-center
                justify-center
                bg-slate-950/25
              "
            >
              <div
                className="
                  rounded-xl
                  border
                  border-slate-700
                  bg-slate-950/85
                  px-5
                  py-4
                  text-sm
                  text-slate-300
                  shadow-xl
                "
              >
                Initializing Mapbox...
              </div>
            </div>
          )}

        {/*
         * ====================================================
         * LEGEND
         * ====================================================
         */}

        <div
          className="
            absolute
            bottom-5
            left-5
            z-10
            rounded-xl
            border
            border-slate-700/80
            bg-slate-950/90
            px-4
            py-3
            shadow-2xl
            backdrop-blur
          "
        >
          <div
            className="
              mb-3
              text-[10px]
              font-bold
              uppercase
              tracking-[0.16em]
              text-slate-400
            "
          >
            Map Legend
          </div>

          <div className="space-y-2">
            <div
              className="
                flex
                items-center
                gap-2
                text-xs
                text-slate-200
              "
            >
              <span
                className="
                  inline-block
                  h-3
                  w-3
                  rounded-full
                  bg-cyan-400
                  shadow-[0_0_10px_rgba(34,211,238,0.8)]
                "
              />

              <span>
                Survey point
              </span>
            </div>

            <div
              className="
                flex
                items-center
                gap-2
                text-xs
                text-slate-200
              "
            >
              <span
                className="
                  inline-block
                  h-3
                  w-3
                  rounded-full
                  bg-orange-500
                  shadow-[0_0_10px_rgba(249,115,22,0.8)]
                "
              />

              <span>
                Detected object
              </span>
            </div>
          </div>
        </div>

        {/*
         * ====================================================
         * STATS
         * ====================================================
         */}

        <div
          className="
            absolute
            right-5
            bottom-5
            z-10
            flex
            gap-2
          "
        >
          {/*
           * SURVEY POINTS
           */}

          <div
            className="
              rounded-xl
              border
              border-slate-700/80
              bg-slate-950/90
              px-4
              py-3
              shadow-2xl
              backdrop-blur
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                text-[10px]
                font-bold
                uppercase
                tracking-[0.12em]
                text-slate-400
              "
            >
              <Crosshair
                className="
                  h-3.5
                  w-3.5
                  text-cyan-400
                "
              />

              Survey points
            </div>

            <div
              className="
                mt-1
                text-xl
                font-semibold
                text-cyan-300
              "
            >
              {scans.length}
            </div>
          </div>

          {/*
           * OBJECTS
           */}

          <div
            className="
              rounded-xl
              border
              border-slate-700/80
              bg-slate-950/90
              px-4
              py-3
              shadow-2xl
              backdrop-blur
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                text-[10px]
                font-bold
                uppercase
                tracking-[0.12em]
                text-slate-400
              "
            >
              <Target
                className="
                  h-3.5
                  w-3.5
                  text-orange-400
                "
              />

              Objects
            </div>

            <div
              className="
                mt-1
                text-xl
                font-semibold
                text-orange-300
              "
            >
              {detectionMarkerCount}
            </div>

            {totalDetectionCount !==
              detectionMarkerCount && (
              <div
                className="
                  mt-0.5
                  text-[10px]
                  text-slate-500
                "
              >
                {totalDetectionCount} total
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

export { SurveyMapPage };

export default SurveyMapPage;