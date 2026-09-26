import React, { useState, useRef, useEffect } from "react";

import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Layers,
  Crosshair,
  AlertTriangle,
} from "lucide-react";

import { Detection } from "../../types/sonar";
import { api } from "../../services/api";

interface SonarImageViewerProps {
  originalImageUrl: string;
  annotatedImageUrl?: string | null;
  detections: Detection[];
  selectedDetectionId: string | null;
  onSelectDetection: (id: string | null) => void;
  filename: string;
}

export const SonarImageViewer: React.FC<SonarImageViewerProps> = ({
  originalImageUrl,
  annotatedImageUrl,
  detections,
  selectedDetectionId,
  onSelectDetection,
  filename,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const [isDragging, setIsDragging] =
    useState<boolean>(false);

  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
  }>({
    x: 0,
    y: 0,
  });

  const [isFullscreen, setIsFullscreen] =
    useState<boolean>(false);

  const [showAnnotated, setShowAnnotated] =
    useState<boolean>(false);

  const [showOverlayBoxes, setShowOverlayBoxes] =
    useState<boolean>(true);

  const [hoveredDetectionId, setHoveredDetectionId] =
    useState<string | null>(null);

  /*
   * Convert a GeoTIFF URL into the browser-safe PNG preview URL.
   *
   * Example:
   *
   * /uploads/test2.tif
   *       ↓
   * /uploads/test2_preview.png
   *
   * /uploads/20260925_test2.tiff
   *       ↓
   * /uploads/20260925_test2_preview.png
   */
  const getBrowserSafeImageUrl = (
    imageUrl: string
  ): string => {
    if (!imageUrl) {
      return "";
    }

    const normalizedUrl = imageUrl.trim();

    if (
      normalizedUrl
        .toLowerCase()
        .endsWith(".tif")
    ) {
      return normalizedUrl.replace(
        /\.tif$/i,
        "_preview.png"
      );
    }

    if (
      normalizedUrl
        .toLowerCase()
        .endsWith(".tiff")
    ) {
      return normalizedUrl.replace(
        /\.tiff$/i,
        "_preview.png"
      );
    }

    return normalizedUrl;
  };

  /*
   * Convert the backend path into a complete browser URL.
   */
  const getSafeImageUrl = (
    imageUrl: string
  ): string => {
    const safePath =
      getBrowserSafeImageUrl(imageUrl);

    return api.getImageUrl(safePath);
  };

  /*
   * Reset zoom and pan when the image changes.
   */
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [originalImageUrl]);

  /*
   * Zoom controls.
   */
  const handleZoomIn = () => {
    setZoom((prev) =>
      Math.min(prev + 0.3, 4)
    );
  };

  const handleZoomOut = () => {
    setZoom((prev) =>
      Math.max(prev - 0.3, 0.5)
    );
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  /*
   * Mouse pan.
   */
  const handleMouseDown = (
    e: React.MouseEvent
  ) => {
    if (e.button !== 0) return;

    setIsDragging(true);

    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const handleMouseMove = (
    e: React.MouseEvent
  ) => {
    if (!isDragging) return;

    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  /*
   * Fullscreen.
   */
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .catch(() => {});

      setIsFullscreen(true);
    } else {
      document
        .exitFullscreen()
        .catch(() => {});

      setIsFullscreen(false);
    }
  };

  /*
   * Browser-safe base image.
   *
   * IMPORTANT:
   * If backend gives us a TIFF URL, this converts it
   * to the generated PNG preview.
   */
  const safeOriginalImageUrl =
    getSafeImageUrl(originalImageUrl);

  /*
   * Annotated image is already PNG/JPG, so we only
   * normalize it through the normal API URL helper.
   */
  const safeAnnotatedImageUrl =
    annotatedImageUrl
      ? api.getImageUrl(annotatedImageUrl)
      : null;

  const activeImageUrl =
    showAnnotated &&
    safeAnnotatedImageUrl
      ? safeAnnotatedImageUrl
      : safeOriginalImageUrl;

  /*
   * If an old scan still points at the TIFF and the
   * generated preview isn't available, show a useful
   * error instead of leaving a broken image.
   */
  const handleImageError = () => {
    console.error(
      "[SonarImageViewer] Failed to load image:",
      activeImageUrl
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-[#05080f] rounded-xl border border-sonar-border overflow-hidden select-none ${
        isFullscreen
          ? "h-screen w-screen p-0 rounded-none border-0"
          : "h-[620px]"
      }`}
    >
      {/* =====================================================
          TOP TOOLBAR
          ===================================================== */}

      <div className="h-11 px-4 bg-sonar-surface/90 border-b border-sonar-border flex items-center justify-between text-xs font-mono text-sonar-muted z-10">
        <div className="flex items-center gap-2 truncate">
          <span className="text-white font-medium truncate max-w-[200px]">
            {filename}
          </span>

          <span className="text-sonar-dim">
            |
          </span>

          <span className="text-sonar-cyan">
            Zoom: {Math.round(zoom * 100)}%
          </span>

          {selectedDetectionId && (
            <>
              <span className="text-sonar-dim">
                |
              </span>

              <span className="text-amber-400">
                Target Selected:{" "}
                {selectedDetectionId}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Original / Annotated */}

          {annotatedImageUrl && (
            <button
              onClick={() =>
                setShowAnnotated(
                  !showAnnotated
                )
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition border ${
                showAnnotated
                  ? "bg-sonar-cyanMuted text-sonar-cyan border-sonar-cyan/40"
                  : "bg-sonar-card text-sonar-muted hover:text-white border-sonar-border"
              }`}
              title="Toggle YOLO Annotated Image"
            >
              <Layers className="w-3.5 h-3.5" />

              <span>
                {showAnnotated
                  ? "YOLO Plot"
                  : "Original"}
              </span>
            </button>
          )}

          {/* Detection overlay */}

          <button
            onClick={() =>
              setShowOverlayBoxes(
                !showOverlayBoxes
              )
            }
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition border ${
              showOverlayBoxes
                ? "bg-sonar-cyanMuted text-sonar-cyan border-sonar-cyan/40"
                : "bg-sonar-card text-sonar-muted hover:text-white border-sonar-border"
            }`}
            title="Toggle Interactive Detection Boxes"
          >
            <Crosshair className="w-3.5 h-3.5" />

            <span>
              Overlay
            </span>
          </button>

          <div className="h-4 w-px bg-sonar-border mx-1" />

          {/* Zoom */}

          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-sonar-card hover:bg-sonar-borderLight text-sonar-muted hover:text-white border border-sonar-border transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-sonar-card hover:bg-sonar-borderLight text-sonar-muted hover:text-white border border-sonar-border transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded bg-sonar-card hover:bg-sonar-borderLight text-sonar-muted hover:text-white border border-sonar-border transition"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded bg-sonar-card hover:bg-sonar-borderLight text-sonar-muted hover:text-white border border-sonar-border transition"
            title={
              isFullscreen
                ? "Exit Fullscreen"
                : "Fullscreen"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* =====================================================
          IMAGE STAGE
          ===================================================== */}

      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-grid-pattern"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="relative transition-transform duration-75 origin-center inline-block"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* =================================================
              BASE SONAR IMAGE
              ================================================= */}

          <img
            ref={imageRef}
            src={activeImageUrl}
            alt={filename}
            draggable={false}
            onError={handleImageError}
            className="w-auto min-w-[520px] max-w-[900px] max-h-[540px] h-auto object-contain block shadow-2xl rounded border border-sonar-border/60 pointer-events-auto"
          />

          {/* =================================================
              INTERACTIVE DETECTION BOXES
              ================================================= */}

          {showOverlayBoxes &&
            !showAnnotated && (
              <div className="absolute inset-0 pointer-events-none">
                {detections.map(
                  (det, index) => {
                    const isSelected =
                      selectedDetectionId ===
                      det.id;

                    const isHovered =
                      hoveredDetectionId ===
                      det.id;

                    const isLow =
                      Boolean(
                        det.isLowConfidence
                      );

                    const bbox =
                      det.boundingBox;

                    /*
                     * Some older MongoDB records may
                     * not contain a bounding box.
                     */
                    if (!bbox) {
                      return null;
                    }

                    /*
                     * Some older records may not
                     * contain an ID.
                     */
                    const detectionId =
                      det.id ??
                      `detection-${index}`;

                    const className =
                      det.className ??
                      "Unknown";

                    const confidence =
                      det.confidencePercent ??
                      Math.round(
                        (det.confidence ?? 0) *
                          100
                      );

                    const left =
                      `${bbox.x * 100}%`;

                    const top =
                      `${bbox.y * 100}%`;

                    const width =
                      `${bbox.w * 100}%`;

                    const height =
                      `${bbox.h * 100}%`;

                    return (
                      <div
                        key={detectionId}
                        onClick={(e) => {
                          e.stopPropagation();

                          onSelectDetection(
                            isSelected
                              ? null
                              : detectionId
                          );
                        }}
                        onMouseEnter={() =>
                          setHoveredDetectionId(
                            detectionId
                          )
                        }
                        onMouseLeave={() =>
                          setHoveredDetectionId(
                            null
                          )
                        }
                        style={{
                          left,
                          top,
                          width,
                          height,
                        }}
                        className={`absolute pointer-events-auto cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? "border-2 border-sonar-cyan bg-sonar-cyan/20 shadow-[0_0_15px_rgba(0,212,255,0.6)] z-20"
                            : isHovered
                            ? "border-2 border-cyan-300 bg-sonar-cyan/10 z-10"
                            : isLow
                            ? "border border-dashed border-amber-400/80 bg-amber-500/10"
                            : "border border-sonar-cyan/70 bg-sonar-cyan/5"
                        }`}
                      >
                        {/* Corner marks */}

                        <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />

                        <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />

                        <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />

                        <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />

                        {/* HUD label */}

                        <div
                          className={`absolute -top-6 left-0 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider flex items-center gap-1 whitespace-nowrap shadow-md ${
                            isSelected
                              ? "bg-sonar-cyan text-black font-bold"
                              : isLow
                              ? "bg-amber-500 text-black font-semibold"
                              : "bg-sonar-card/90 text-sonar-cyan border border-sonar-cyan/40"
                          }`}
                        >
                          {isLow && (
                            <AlertTriangle className="w-2.5 h-2.5" />
                          )}

                          <span>
                            {className
                              .toUpperCase()
                              .replace(
                                "_",
                                " "
                              )}
                          </span>

                          <span className="opacity-90">
                            {confidence}%
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
        </div>

        {/* Watermark */}

        <div className="absolute bottom-3 left-4 text-[10px] font-mono text-sonar-dim pointer-events-none">
          ACOUSTIC SENSOR DISPLAY // SONAR-X
        </div>
      </div>
    </div>
  );
};