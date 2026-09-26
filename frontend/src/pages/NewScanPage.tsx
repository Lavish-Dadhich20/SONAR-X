import React, { useEffect, useRef, useState } from "react";

import {
  UploadCloud,
  Sliders,
  Save,
  FileText,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Target,
  X,
} from "lucide-react";

import { Scan } from "../types/sonar";

import { api } from "../services/api";

import { SonarImageViewer } from "../components/viewer/SonarImageViewer";

import { AIInterpretationCard } from "../components/analysis/AIInterpretationCard";

interface NewScanPageProps {
  onScanSaved: (scan: Scan) => void;
  onNavigateToReport: (scanId: string) => void;
  initialScanId?: string | null;
}

export const NewScanPage: React.FC<NewScanPageProps> = ({
  onScanSaved,
  onNavigateToReport,
  initialScanId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentScan, setCurrentScan] =
    useState<Scan | null>(null);

  const [selectedDetectionId, setSelectedDetectionId] =
    useState<string | null>(null);

  const [isUploading, setIsUploading] =
    useState<boolean>(false);

  const [isDetecting, setIsDetecting] =
    useState<boolean>(false);

  const [isInterpreting, setIsInterpreting] =
    useState<boolean>(false);

  const [isSaving, setIsSaving] =
    useState<boolean>(false);

  const [savedSuccess, setSavedSuccess] =
    useState<boolean>(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [confThreshold, setConfThreshold] =
    useState<number>(0.25);

  const [iouThreshold, setIouThreshold] =
    useState<number>(0.45);

  const [isDraggingOver, setIsDraggingOver] =
    useState<boolean>(false);

  // ============================================================
  // HUMAN CHECK NOTIFICATION
  // ============================================================

  const [showHumanCheckNotification, setShowHumanCheckNotification] =
    useState<boolean>(false);

  // ============================================================
  // LOAD INITIAL SCAN
  // ============================================================

  useEffect(() => {
    if (initialScanId) {
      loadScan(initialScanId);
    }
  }, [initialScanId]);

  // ============================================================
  // HUMAN CHECK CONFIDENCE MONITOR
  // ============================================================

  useEffect(() => {
    if (!currentScan) {
      setShowHumanCheckNotification(false);
      return;
    }

    const detections = currentScan.detections || [];

    const hasLowConfidenceDetection = detections.some((det) => {
      const confidencePercent =
        typeof det.confidencePercent === "number"
          ? det.confidencePercent
          : typeof det.confidence === "number"
            ? det.confidence * 100
            : 0;

      return confidencePercent < 50;
    });

    setShowHumanCheckNotification(
      hasLowConfidenceDetection
    );
  }, [currentScan]);

  // ============================================================
  // LOAD SCAN
  // ============================================================

  const loadScan = async (scanId: string) => {
    try {
      const scan = await api.getScan(scanId);

      setCurrentScan(scan);

      if (
        scan.detections &&
        scan.detections.length > 0
      ) {
        setSelectedDetectionId(
          scan.detections[0].id
        );
      } else {
        setSelectedDetectionId(null);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to load scan"
      );
    }
  };

  // ============================================================
  // FILE UPLOAD
  // ============================================================

  const handleFileUpload = async (file: File) => {
    setErrorMessage(null);
    setSavedSuccess(false);
    setShowHumanCheckNotification(false);
    setIsUploading(true);

    try {
      const scan = await api.uploadScan(file);

      setCurrentScan(scan);

      if (
        scan.detections &&
        scan.detections.length > 0
      ) {
        setSelectedDetectionId(
          scan.detections[0].id
        );
      } else {
        setSelectedDetectionId(null);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          "Failed to upload and analyze image"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================
  // DRAG & DROP
  // ============================================================

  const handleDrop = (
    e: React.DragEvent
  ) => {
    e.preventDefault();

    setIsDraggingOver(false);

    if (
      e.dataTransfer.files &&
      e.dataTransfer.files.length > 0
    ) {
      handleFileUpload(
        e.dataTransfer.files[0]
      );
    }
  };

  // ============================================================
  // RE-DETECTION
  // ============================================================

  const handleReDetect = async () => {
    if (!currentScan) return;

    setIsDetecting(true);
    setErrorMessage(null);

    try {
      const result = await api.reDetect(
        currentScan.scanId,
        confThreshold,
        iouThreshold
      );

      setCurrentScan((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          detectionCount:
            result.detectionCount,

          highestConfidence:
            result.highestConfidence,

          detections:
            result.detections,

          annotatedImageUrl:
            result.annotatedImageUrl,
        };
      });

      if (
        result.detections &&
        result.detections.length > 0
      ) {
        setSelectedDetectionId(
          result.detections[0].id
        );
      } else {
        setSelectedDetectionId(null);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          "Re-detection failed"
      );
    } finally {
      setIsDetecting(false);
    }
  };

  // ============================================================
  // AI INTERPRETATION
  // ============================================================

  const handleGenerateAI = async () => {
    if (!currentScan) return;

    setIsInterpreting(true);
    setErrorMessage(null);

    try {
      const result =
        await api.interpretScan(
          currentScan.scanId
        );

      setCurrentScan((prev) => {
        if (!prev) return prev;

        return {
          ...prev,

          aiAnalysis:
            result.aiAnalysis,

          aiProvider:
            result.aiProvider,

          status:
            "Interpreted",
        };
      });
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          "AI interpretation failed"
      );
    } finally {
      setIsInterpreting(false);
    }
  };

  // ============================================================
  // SAVE SCAN
  // ============================================================

  const handleSaveScan = async () => {
    if (!currentScan) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await api.saveScan(
        currentScan.scanId
      );

      setSavedSuccess(true);

      setCurrentScan((prev) =>
        prev
          ? {
              ...prev,
              saved: true,
            }
          : prev
      );

      onScanSaved(currentScan);

      setTimeout(() => {
        setSavedSuccess(false);
      }, 3000);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          "Failed to save scan"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // START NEW SCAN
  // ============================================================

  const handleStartNew = () => {
    setCurrentScan(null);

    setSelectedDetectionId(null);

    setErrorMessage(null);

    setSavedSuccess(false);

    setShowHumanCheckNotification(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ============================================================
  // UPLOAD WORKSPACE
  // ============================================================

  if (!currentScan) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">

        {/* Page Header */}

        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            New Sonar Scan
          </h2>

          <p className="text-xs text-sonar-muted mt-1">
            Upload a sonar image to detect and
            analyze underwater objects.
          </p>
        </div>

        {/* Error */}

        {errorMessage && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />

            <span>
              {errorMessage}
            </span>
          </div>
        )}

        {/* Upload Box */}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() =>
            setIsDraggingOver(false)
          }
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center transition-all ${
            isDraggingOver
              ? "border-sonar-cyan bg-sonar-cyanMuted/20"
              : "border-sonar-border bg-sonar-surface/50 hover:border-sonar-borderLight hover:bg-sonar-surface/80"
          }`}
        >

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.tif,.tiff"
            className="hidden"
            onChange={(e) => {
              if (
                e.target.files &&
                e.target.files.length > 0
              ) {
                handleFileUpload(
                  e.target.files[0]
                );
              }
            }}
          />

          {/* Upload Icon */}

          <div className="relative w-20 h-20 rounded-2xl bg-sonar-card border border-sonar-border flex items-center justify-center mb-6 shadow-xl">

            <UploadCloud className="w-10 h-10 text-sonar-cyan" />

            {isUploading && (
              <div className="absolute inset-0 rounded-2xl border-2 border-sonar-cyan border-t-transparent animate-spin" />
            )}

          </div>

          {/* Title */}

          <h3 className="text-lg font-semibold text-white tracking-wide">
            {isUploading
              ? "Uploading & Analyzing Sonar Imagery..."
              : "Upload Sonar Image"}
          </h3>

          <p className="text-xs text-sonar-muted mt-2 max-w-md">
            Drag and drop your sonar image
            here, or browse from your computer.
          </p>

          {/* Browse Button */}

          <div className="mt-6 flex items-center gap-3">

            <button
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={isUploading}
              className="px-6 py-2.5 rounded-lg bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-bold tracking-wider transition shadow-lg disabled:opacity-50"
            >
              Browse Files
            </button>

          </div>

          {/* Supported Formats */}

          <div className="mt-8 flex items-center gap-4 text-[11px] font-mono text-sonar-dim flex-wrap justify-center">

            <span>
              SUPPORTED: JPG, JPEG, PNG, TIFF
            </span>

            <span>·</span>

            <span>
              REAL SENSOR METADATA EXTRACTION
            </span>

            <span>·</span>

            <span>
              YOLO INFERENCE
            </span>

          </div>

        </div>

      </div>
    );
  }

  // ============================================================
  // ANALYSIS WORKSPACE
  // ============================================================

  const meta =
    currentScan.metadata || {};

  const detections =
    currentScan.detections || [];

  const selectedDetection =
    detections.find(
      (d) =>
        d.id === selectedDetectionId
    );

  // ============================================================
  // LOW CONFIDENCE DETECTIONS
  // ============================================================

  const lowConfidenceDetections =
    detections.filter((det) => {
      const confidencePercent =
        typeof det.confidencePercent ===
        "number"
          ? det.confidencePercent
          : typeof det.confidence ===
              "number"
            ? det.confidence * 100
            : 0;

      return confidencePercent < 50;
    });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ======================================================
          HUMAN CHECK NOTIFICATION
          ====================================================== */}

      {showHumanCheckNotification && (
        <div className="fixed top-5 right-5 z-[9999] w-[390px] max-w-[calc(100vw-2rem)]">

          <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-[#15120a] shadow-2xl shadow-black/50">

            {/* Left Accent */}

            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />

            <div className="p-4 pl-5">

              <div className="flex items-start gap-3">

                {/* Warning Icon */}

                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30">

                  <AlertTriangle className="h-5 w-5 text-amber-400" />

                </div>

                {/* Notification Content */}

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">

                    <h3 className="text-sm font-semibold text-amber-300">
                      Human Check Recommended
                    </h3>

                    <button
                      onClick={() =>
                        setShowHumanCheckNotification(
                          false
                        )
                      }
                      className="text-sonar-muted hover:text-white transition"
                      aria-label="Close notification"
                    >
                      <X className="h-4 w-4" />
                    </button>

                  </div>

                  <p className="mt-1.5 text-xs leading-relaxed text-sonar-muted">
                    One or more detected
                    objects have a confidence
                    below 50%. Manual review is
                    recommended before making an
                    operational decision.
                  </p>

                  {/* Low Confidence Objects */}

                  <div className="mt-3 space-y-1.5">

                    {lowConfidenceDetections.map(
                      (det) => {
                        const confidencePercent =
                          typeof det.confidencePercent ===
                          "number"
                            ? det.confidencePercent
                            : (det.confidence || 0) *
                              100;

                        return (
                          <div
                            key={det.id}
                            className="flex items-center justify-between rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5"
                          >

                            <span className="text-[11px] font-mono text-white uppercase">
                              {det.className.replace(
                                "_",
                                " "
                              )}
                            </span>

                            <span className="text-[11px] font-mono font-bold text-amber-400">
                              {confidencePercent.toFixed(
                                1
                              )}
                              %
                            </span>

                          </div>
                        );
                      }
                    )}

                  </div>

                  <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-amber-500/70">
                    AI assistance · Human verification recommended
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          TOP WORKSPACE HEADER
          ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sonar-border">

        <div>

          <div className="flex items-center gap-2">

            <span className="text-xs font-mono uppercase tracking-widest text-sonar-cyan">
              ANALYSIS WORKSPACE
            </span>

            <span className="text-sonar-dim">
              /
            </span>

            <span className="text-xs font-mono text-white font-semibold">
              {currentScan.scanId}
            </span>

          </div>

          <p className="text-xs text-sonar-muted mt-0.5">
            {currentScan.filename}
            {" · "}
            YOLO Detected:{" "}
            {currentScan.detectionCount}{" "}
            {currentScan.detectionCount === 1
              ? "Object"
              : "Objects"}
          </p>

        </div>

        {/* Workspace Actions */}

        <div className="flex items-center gap-2 flex-wrap">

          <button
            onClick={handleStartNew}
            className="px-3 py-1.5 rounded bg-sonar-card hover:bg-sonar-border border border-sonar-border text-xs text-sonar-muted hover:text-white transition"
          >
            New Scan
          </button>

          <button
            onClick={handleSaveScan}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition border ${
              savedSuccess ||
              currentScan.saved
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-sonar-card text-sonar-text hover:text-white border-sonar-border"
            }`}
          >

            {savedSuccess ||
            currentScan.saved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}

            <span>
              {savedSuccess
                ? "Saved to DB!"
                : currentScan.saved
                  ? "Saved"
                  : "Save Scan"}
            </span>

          </button>

          <button
            onClick={() =>
              onNavigateToReport(
                currentScan.scanId
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-semibold tracking-wide transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />

            <span>
              Generate Report
            </span>
          </button>

        </div>

      </div>

      {/* ======================================================
          ERROR MESSAGE
          ====================================================== */}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">

          <AlertCircle className="w-4 h-4 flex-shrink-0" />

          <span>
            {errorMessage}
          </span>

        </div>
      )}

      {/* ======================================================
          MAIN 2 COLUMN WORKSPACE
          ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ====================================================
            LEFT SIDE
            ==================================================== */}

        <div className="lg:col-span-7 space-y-4">

          {/* Sonar Image Viewer */}

          <SonarImageViewer
            originalImageUrl={
              currentScan.imageUrl
            }
            annotatedImageUrl={
              currentScan.annotatedImageUrl
            }
            detections={detections}
            selectedDetectionId={
              selectedDetectionId
            }
            onSelectDetection={
              setSelectedDetectionId
            }
            filename={
              currentScan.filename
            }
          />

          {/* ==================================================
              DETECTION SENSITIVITY
              ================================================== */}

          <div className="p-4 rounded-xl bg-sonar-surface border border-sonar-border space-y-3">

            <div className="flex items-center justify-between text-xs">

              <span className="font-semibold text-white flex items-center gap-1.5">

                <Sliders className="w-3.5 h-3.5 text-sonar-cyan" />

                Detection Sensitivity Controls

              </span>

              <button
                onClick={handleReDetect}
                disabled={isDetecting}
                className="flex items-center gap-1 text-[11px] font-mono text-sonar-cyan hover:underline disabled:opacity-50"
              >

                <RotateCw
                  className={`w-3 h-3 ${
                    isDetecting
                      ? "animate-spin"
                      : ""
                  }`}
                />

                <span>
                  {isDetecting
                    ? "Re-evaluating..."
                    : "Re-run Inference"}
                </span>

              </button>

            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">

              {/* Confidence */}

              <div>

                <div className="flex justify-between text-sonar-muted mb-1 text-[11px]">

                  <span>
                    CONFIDENCE THRESHOLD
                  </span>

                  <span className="text-sonar-cyan">
                    {Math.round(
                      confThreshold * 100
                    )}
                    %
                  </span>

                </div>

                <input
                  type="range"
                  min="0.10"
                  max="0.90"
                  step="0.05"
                  value={confThreshold}
                  onChange={(e) =>
                    setConfThreshold(
                      parseFloat(
                        e.target.value
                      )
                    )
                  }
                  className="w-full h-1.5 bg-sonar-card rounded-lg appearance-none cursor-pointer accent-sonar-cyan"
                />

              </div>

              {/* IoU */}

              <div>

                <div className="flex justify-between text-sonar-muted mb-1 text-[11px]">

                  <span>
                    IoU THRESHOLD
                  </span>

                  <span className="text-sonar-cyan">
                    {Math.round(
                      iouThreshold * 100
                    )}
                    %
                  </span>

                </div>

                <input
                  type="range"
                  min="0.10"
                  max="0.90"
                  step="0.05"
                  value={iouThreshold}
                  onChange={(e) =>
                    setIouThreshold(
                      parseFloat(
                        e.target.value
                      )
                    )
                  }
                  className="w-full h-1.5 bg-sonar-card rounded-lg appearance-none cursor-pointer accent-sonar-cyan"
                />

              </div>

            </div>

          </div>

        </div>

        {/* ====================================================
            RIGHT SIDE
            ==================================================== */}

        <div className="lg:col-span-5 space-y-4">

          {/* ==================================================
              METADATA CARD
              ================================================== */}

          <div className="p-4 rounded-xl bg-sonar-surface border border-sonar-border text-xs">

            <div className="flex items-center justify-between border-b border-sonar-border pb-2.5 mb-3">

              <span className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">
                Scan Telemetry & Metadata
              </span>

              <span className="text-[10px] font-mono text-sonar-cyan">
                {currentScan.modelVersion}
              </span>

            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-mono text-[11px]">

              {/* Resolution */}

              <div>

                <span className="text-sonar-dim block">
                  RESOLUTION
                </span>

                <span className="text-white">
                  {meta.width} ×{" "}
                  {meta.height} px
                </span>

              </div>

              {/* File Size */}

              <div>

                <span className="text-sonar-dim block">
                  FILE SIZE
                </span>

                <span className="text-white">
                  {meta.fileSizeFormatted}
                </span>

              </div>

              {/* Format */}

              <div>

                <span className="text-sonar-dim block">
                  FORMAT
                </span>

                <span className="text-white">
                  {meta.format}
                </span>

              </div>

              {/* Capture */}

              <div>

                <span className="text-sonar-dim block">
                  CAPTURE TIMESTAMP
                </span>

                <span className="text-white truncate block">
                  {meta.captureDate ||
                    "Not recorded in EXIF"}
                </span>

              </div>

              {/* GPS */}

              <div className="col-span-2 pt-1 border-t border-sonar-border flex items-center justify-between">

                <span className="text-sonar-dim">
                  GPS GEOLOCATION
                </span>

                {currentScan.location ? (
                  <span className="text-sonar-cyan flex items-center gap-1 font-semibold">

                    <MapPin className="w-3 h-3" />

                    {currentScan.location.latitude.toFixed(
                      4
                    )}
                    °N,{" "}
                    {currentScan.location.longitude.toFixed(
                      4
                    )}
                    °E

                  </span>
                ) : (
                  <span className="text-sonar-muted">
                    No GPS coordinates
                  </span>
                )}

              </div>

            </div>

          </div>

          {/* ==================================================
              DETECTION RESULTS
              ================================================== */}

          <div className="rounded-xl bg-sonar-surface border border-sonar-border overflow-hidden">

            <div className="px-5 py-3 bg-sonar-card border-b border-sonar-border flex items-center justify-between">

              <div className="flex items-center gap-2">

                <Target className="w-4 h-4 text-sonar-cyan" />

                <h4 className="text-xs font-semibold uppercase tracking-wider text-white font-mono">
                  Detection Results
                </h4>

              </div>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sonar-cyanMuted text-sonar-cyan border border-sonar-cyan/30">
                {detections.length}{" "}
                {detections.length === 1
                  ? "Target"
                  : "Targets"}
              </span>

            </div>

            <div className="p-4 space-y-2.5 max-h-[280px] overflow-y-auto">

              {detections.length === 0 ? (
                <div className="py-8 px-4 text-center">

                  <p className="text-xs font-semibold text-white">
                    No Objects Detected
                  </p>

                  <p className="text-[11px] text-sonar-muted mt-1 leading-relaxed">
                    YOLO did not identify any
                    objects above the configured
                    confidence threshold (
                    {Math.round(
                      confThreshold * 100
                    )}
                    %).
                  </p>

                </div>
              ) : (
                detections.map((det) => {

                  const isSelected =
                    selectedDetectionId ===
                    det.id;

                  const confidencePercent =
                    typeof det.confidencePercent ===
                    "number"
                      ? det.confidencePercent
                      : typeof det.confidence ===
                          "number"
                        ? det.confidence * 100
                        : 0;

                  const isLow =
                    confidencePercent < 50;

                  const bbox =
                    det.boundingBox;

                  return (
                    <div
                      key={det.id}
                      onClick={() =>
                        setSelectedDetectionId(
                          det.id
                        )
                      }
                      className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-sonar-cyanMuted/30 border-sonar-cyan shadow-sm"
                          : "bg-sonar-card/70 border-sonar-border hover:border-sonar-borderLight"
                      }`}
                    >

                      {/* Detection Information */}

                      <div className="flex items-center gap-3 min-w-0">

                        {det.cropUrl && (
                          <div className="w-10 h-10 rounded bg-black border border-sonar-border overflow-hidden flex-shrink-0">

                            <img
                              src={api.getImageUrl(
                                det.cropUrl
                              )}
                              alt={
                                det.className
                              }
                              className="w-full h-full object-cover"
                            />

                          </div>
                        )}

                        <div className="min-w-0">

                          <div className="flex items-center gap-1.5">

                            <span className="text-xs font-bold text-white uppercase tracking-wide truncate">
                              {det.className.replace(
                                "_",
                                " "
                              )}
                            </span>

                            {isLow && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                LOW
                              </span>
                            )}

                          </div>

                          <div className="text-[10px] font-mono text-sonar-muted mt-0.5">
                            BBox: [X:{" "}
                            {bbox.x} Y:{" "}
                            {bbox.y} W:{" "}
                            {bbox.w} H:{" "}
                            {bbox.h}]
                          </div>

                        </div>

                      </div>

                      {/* Confidence */}

                      <div className="text-right flex-shrink-0">

                        <span
                          className={`text-sm font-bold font-mono ${
                            isLow
                              ? "text-amber-400"
                              : "text-sonar-cyan"
                          }`}
                        >
                          {confidencePercent.toFixed(
                            1
                          )}
                          %
                        </span>

                        <span className="block text-[9px] font-mono text-sonar-dim">
                          CONFIDENCE
                        </span>

                      </div>

                    </div>
                  );
                })
              )}

            </div>

          </div>

          {/* ==================================================
              AI INTERPRETATION
              ================================================== */}

          <AIInterpretationCard
            analysis={
              currentScan.aiAnalysis ||
              null
            }
            isLoading={isInterpreting}
            onGenerate={handleGenerateAI}
            activeProvider={
              currentScan.aiProvider ||
              "Gemini"
            }
            isZeroDetection={
              detections.length === 0
            }
          />

        </div>

      </div>

    </div>
  );
};

export default NewScanPage;