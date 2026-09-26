import React, { useEffect, useState } from "react";
import {
  Filter,
  ArrowUpRight,
  Radio,
} from "lucide-react";

import {
  Detection,
  ModelClass,
} from "../types/sonar";

import { api } from "../services/api";

import { EmptyState } from "../components/common/EmptyState";

interface DetectionsPageProps {
  onSelectScan: (
    scanId: string,
    detectionId?: string
  ) => void;

  onNewScan: () => void;
}

export const DetectionsPage: React.FC<
  DetectionsPageProps
> = ({
  onSelectScan,
  onNewScan,
}) => {
  const [detections, setDetections] =
    useState<Detection[]>([]);

  const [modelClasses, setModelClasses] =
    useState<ModelClass[]>([]);

  const [selectedClass, setSelectedClass] =
    useState<string>("");

  const [minConf, setMinConf] =
    useState<number>(0);

  const [loading, setLoading] =
    useState<boolean>(true);

  useEffect(() => {
    loadClasses();
    fetchDetections();
  }, []);

  const loadClasses = async () => {
    try {
      const cls =
        await api.getModelClasses();

      setModelClasses(
        Array.isArray(cls) ? cls : []
      );
    } catch (error) {
      console.error(
        "Failed to load model classes:",
        error
      );

      setModelClasses([]);
    }
  };

  const fetchDetections = async () => {
    setLoading(true);

    try {
      const data =
        await api.listDetections({
          objectClass:
            selectedClass || undefined,

          minConfidence:
            minConf > 0
              ? minConf / 100
              : undefined,
        });

      setDetections(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Failed to load detections:",
        error
      );

      setDetections([]);
    } finally {
      setLoading(false);
    }
  };

  const getDetectionId = (
    detection: Detection
  ): string | undefined => {
    return detection.id || detection._id;
  };

  const getClassName = (
    detection: Detection
  ): string => {
    return (
      detection.className?.trim() ||
      "Unknown"
    );
  };

  const getConfidencePercent = (
    detection: Detection
  ): number => {
    if (
      typeof detection.confidencePercent ===
      "number"
    ) {
      return detection.confidencePercent;
    }

    if (
      typeof detection.confidence ===
      "number"
    ) {
      return detection.confidence * 100;
    }

    return 0;
  };

  const getBoundingBoxText = (
    detection: Detection
  ): string => {
    const bbox =
      detection.boundingBox;

    if (!bbox) {
      return "N/A";
    }

    return `[${bbox.x}, ${bbox.y}, ${bbox.w}, ${bbox.h}]`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Detection Database
          </h2>

          <p className="text-xs text-sonar-muted mt-1">
            Global catalog of detected underwater
            targets with acoustic bounding boxes
            and confidence.
          </p>
        </div>

        <button
          onClick={onNewScan}
          className="px-4 py-2 rounded-lg bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-semibold tracking-wide transition shadow-sm self-start sm:self-auto"
        >
          New Sonar Scan
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-sonar-surface border border-sonar-border flex flex-wrap items-center gap-4 text-xs font-mono">

        <div className="flex items-center gap-2">

          <Filter className="w-3.5 h-3.5 text-sonar-cyan" />

          <span className="text-sonar-muted">
            Filter by Class:
          </span>

          <select
            value={selectedClass}
            onChange={(event) => {
              const value =
                event.target.value;

              setSelectedClass(value);

              setTimeout(
                fetchDetections,
                50
              );
            }}
            className="px-3 py-1.5 rounded-lg bg-sonar-card border border-sonar-border text-white focus:outline-none focus:border-sonar-cyan"
          >
            <option value="">
              All Classes
            </option>

            {modelClasses.map(
              (modelClass) => (
                <option
                  key={modelClass.id}
                  value={modelClass.name}
                >
                  {(
                    modelClass.name ||
                    "Unknown"
                  )
                    .replace("_", " ")
                    .toUpperCase()}
                </option>
              )
            )}
          </select>
        </div>

        <div className="flex items-center gap-2">

          <span className="text-sonar-muted">
            Min Confidence:
          </span>

          <select
            value={minConf}
            onChange={(event) => {
              const value = parseInt(
                event.target.value,
                10
              );

              setMinConf(value);

              setTimeout(
                fetchDetections,
                50
              );
            }}
            className="px-3 py-1.5 rounded-lg bg-sonar-card border border-sonar-border text-white focus:outline-none focus:border-sonar-cyan"
          >
            <option value="0">
              All Confidences
            </option>

            <option value="50">
              ≥ 50%
            </option>

            <option value="75">
              ≥ 75%
            </option>

            <option value="90">
              ≥ 90%
            </option>
          </select>
        </div>

        <button
          onClick={fetchDetections}
          className="px-3 py-1.5 rounded-lg bg-sonar-card hover:bg-sonar-border text-sonar-cyan border border-sonar-cyan/30 transition ml-auto"
        >
          Refresh
        </button>
      </div>

      {/* Empty State */}
      {detections.length === 0 &&
      !loading ? (
        <EmptyState
          title="No detections recorded."
          description="The detection database currently contains zero objects. Upload and run inference on a sonar image to populate detected objects."
          actionText="Start New Scan"
          onAction={onNewScan}
          icon={Radio}
        />
      ) : (
        <div className="rounded-xl bg-sonar-surface border border-sonar-border overflow-hidden shadow-lg">

          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs font-mono">

              <thead className="bg-sonar-card/80 border-b border-sonar-border text-[11px] uppercase tracking-wider text-sonar-dim">

                <tr>

                  <th className="py-3 px-4">
                    Detection
                  </th>

                  <th className="py-3 px-4">
                    Class
                  </th>

                  <th className="py-3 px-4">
                    Confidence
                  </th>

                  <th className="py-3 px-4">
                    Scan Reference
                  </th>

                  <th className="py-3 px-4">
                    Bounding Box (Norm)
                  </th>

                  <th className="py-3 px-4">
                    Recorded Date
                  </th>

                  <th className="py-3 px-4 text-right">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-sonar-border/60">

                {detections.map(
                  (detection, index) => {

                    const detectionId =
                      getDetectionId(
                        detection
                      );

                    const className =
                      getClassName(
                        detection
                      );

                    const confidencePercent =
                      getConfidencePercent(
                        detection
                      );

                    const isLow =
                      detection.isLowConfidence ??
                      confidencePercent < 50;

                    const scanId =
                      detection.scanId;

                    const key =
                      `${scanId || "unknown"}_${
                        detectionId ||
                        `detection_${index}`
                      }`;

                    return (
                      <tr
                        key={key}
                        className="hover:bg-sonar-card/40 transition cursor-pointer"
                        onClick={() =>
                          onSelectScan(
                            scanId,
                            detectionId
                          )
                        }
                      >

                        {/* Thumbnail & ID */}
                        <td className="py-3 px-4">

                          <div className="flex items-center gap-3">

                            {detection.cropUrl ? (
                              <div className="w-10 h-10 rounded bg-black border border-sonar-border overflow-hidden flex-shrink-0">

                                <img
                                  src={api.getImageUrl(
                                    detection.cropUrl
                                  )}
                                  alt={className}
                                  className="w-full h-full object-cover"
                                />

                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded bg-sonar-card border border-sonar-border flex items-center justify-center text-[10px] text-sonar-dim">
                                ACOUSTIC
                              </div>
                            )}

                            <span className="font-bold text-white">
                              {detectionId ||
                                `DET-${index + 1}`}
                            </span>

                          </div>

                        </td>

                        {/* Class */}
                        <td className="py-3 px-4">

                          <div className="flex items-center gap-1.5">

                            <span className="font-semibold text-white uppercase">
                              {className
                                .replace(
                                  /_/g,
                                  " "
                                )}
                            </span>

                            {isLow && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                LOW
                              </span>
                            )}

                          </div>

                        </td>

                        {/* Confidence */}
                        <td className="py-3 px-4">

                          <span
                            className={`font-bold ${
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

                        </td>

                        {/* Scan Reference */}
                        <td className="py-3 px-4 text-sonar-muted">
                          {scanId ||
                            "Unknown Scan"}
                        </td>

                        {/* Bounding Box */}
                        <td className="py-3 px-4 text-[11px] text-sonar-dim">
                          {getBoundingBoxText(
                            detection
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-sonar-muted">

                          {detection.createdAt
                            ? new Date(
                                detection.createdAt
                              ).toLocaleDateString()
                            : "N/A"}

                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right">

                          <button
                            onClick={(event) => {
                              event.stopPropagation();

                              onSelectScan(
                                scanId,
                                detectionId
                              );
                            }}
                            className="inline-flex items-center gap-1 text-sonar-cyan hover:underline text-xs"
                          >
                            <span>
                              Inspect
                            </span>

                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

    </div>
  );
};