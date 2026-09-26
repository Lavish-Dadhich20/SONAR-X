import React from "react";
import {
  Sparkles,
  ShieldAlert,
  Cpu,
  Eye,
  CheckCircle,
  Compass,
  MapPin,
  Navigation,
} from "lucide-react";
import { AIAnalysis } from "../../types/sonar";

interface AIInterpretationCardProps {
  analysis: AIAnalysis | null;
  isLoading: boolean;
  onGenerate: () => void;
  activeProvider: string;
  isZeroDetection: boolean;
}

interface VerifiedLocation {
  name?: string;
  fullAddress?: string;
  place?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export const AIInterpretationCard: React.FC<AIInterpretationCardProps> = ({
  analysis,
  isLoading,
  onGenerate,
  activeProvider,
  isZeroDetection,
}) => {
  if (isLoading) {
    return (
      <div className="p-6 rounded-xl border border-sonar-cyan/40 bg-sonar-card/70 relative overflow-hidden">
        {/* Subtle scanning bar animation */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-sonar-cyan to-transparent animate-pulse" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sonar-cyanMuted border border-sonar-cyan/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-sonar-cyan animate-spin" />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">
              GENERATING AI INTERPRETATION
            </h4>

            <p className="text-xs text-sonar-muted">
              Synthesizing acoustic backscatter and YOLO telemetry via{" "}
              {activeProvider.toUpperCase()}...
            </p>
          </div>
        </div>

        {/* Skeleton lines */}
        <div className="space-y-3 animate-pulse pt-2">
          <div className="h-3 bg-sonar-border rounded w-3/4" />
          <div className="h-3 bg-sonar-border rounded w-full" />
          <div className="h-3 bg-sonar-border rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-5 rounded-xl border border-sonar-border bg-sonar-card/50 flex flex-col items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sonar-surface border border-sonar-border flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-sonar-cyan" />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white tracking-wide">
              AI Sonar Interpretation
            </h4>

            <p className="text-xs text-sonar-muted">
              {isZeroDetection
                ? "Generate technical acoustic observation for zero-detection scan."
                : `Generate structured technical explanation using ${activeProvider.toUpperCase()}.`}
            </p>
          </div>
        </div>

        <button
          onClick={onGenerate}
          className="w-full py-2.5 px-4 rounded-lg bg-sonar-card hover:bg-sonar-cyanMuted text-sonar-cyan border border-sonar-cyan/40 text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            {isZeroDetection
              ? "Generate AI Image Observation"
              : "Generate AI Interpretation"}
          </span>
        </button>
      </div>
    );
  }

  const isLowConf =
    analysis.certaintyLevel.includes("LOW") ||
    analysis.certaintyLevel.includes("UNCERTAIN");

  const isNoObj = analysis.certaintyLevel.includes("NO OBJECT");

  /*
   * The backend returns verified Mapbox reverse-geocoded location data
   * inside analysis.location.
   *
   * We intentionally use a local extended type here so you do NOT need
   * to modify types/sonar.ts just to display the new location information.
   */
  const verifiedLocation = (
    analysis as AIAnalysis & {
      location?: VerifiedLocation;
    }
  ).location;

  const hasLocation =
    verifiedLocation &&
    (
      verifiedLocation.fullAddress ||
      verifiedLocation.name ||
      verifiedLocation.place ||
      verifiedLocation.region ||
      verifiedLocation.country ||
      verifiedLocation.latitude !== undefined ||
      verifiedLocation.longitude !== undefined
    );

  return (
    <div className="rounded-xl border border-sonar-border bg-sonar-card/90 overflow-hidden shadow-lg">
      {/* Card Header */}
      <div className="px-5 py-3.5 bg-sonar-surface border-b border-sonar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sonar-cyan" />

          <h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-white">
            AI Sonar Interpretation
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-sonar-cyanMuted text-sonar-cyan border border-sonar-cyan/30">
            {analysis.provider} ({analysis.providerModel})
          </span>

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold ${
              isNoObj
                ? "bg-sonar-border text-sonar-muted"
                : isLowConf
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-emerald-500/20 text-emerald-400 border border-emerald-400/30"
            }`}
          >
            {analysis.certaintyLevel}
          </span>
        </div>
      </div>

      {/* Content Sections */}
      <div className="p-5 space-y-4 text-xs">

        {/* ---------------------------------------------------- */}
        {/* Survey Location */}
        {/* ---------------------------------------------------- */}

        {hasLocation && verifiedLocation && (
          <div className="rounded-lg border border-sonar-cyan/30 bg-sonar-cyan/5 p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <MapPin className="w-3.5 h-3.5 text-sonar-cyan" />

              <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-cyan font-semibold">
                Verified Survey Location
              </span>
            </div>

            {/* Main Location Name */}
            {verifiedLocation.name && (
              <div className="mb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
                  Location
                </span>

                <span className="text-sm font-semibold text-white leading-relaxed">
                  {verifiedLocation.name}
                </span>
              </div>
            )}

            {/* Full Address */}
            {verifiedLocation.fullAddress &&
              verifiedLocation.fullAddress !== verifiedLocation.name && (
                <div className="mb-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
                    Full Address
                  </span>

                  <span className="text-xs text-sonar-text leading-relaxed">
                    {verifiedLocation.fullAddress}
                  </span>
                </div>
              )}

            {/* Place / Region / Country */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {verifiedLocation.place && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
                    Place
                  </span>

                  <span className="text-xs font-medium text-white">
                    {verifiedLocation.place}
                  </span>
                </div>
              )}

              {verifiedLocation.region && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
                    Region
                  </span>

                  <span className="text-xs font-medium text-white">
                    {verifiedLocation.region}
                  </span>
                </div>
              )}

              {verifiedLocation.country && (
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
                    Country
                  </span>

                  <span className="text-xs font-medium text-white">
                    {verifiedLocation.country}
                  </span>
                </div>
              )}
            </div>

            {/* Coordinates */}
            {verifiedLocation.latitude !== undefined &&
              verifiedLocation.longitude !== undefined && (
                <div className="pt-3 border-t border-sonar-cyan/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Navigation className="w-3 h-3 text-sonar-cyan" />

                    <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim">
                      Coordinates
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
                        Latitude
                      </span>

                      <span className="text-xs font-mono font-semibold text-sonar-cyan">
                        {Number(verifiedLocation.latitude).toFixed(6)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
                        Longitude
                      </span>

                      <span className="text-xs font-mono font-semibold text-sonar-cyan">
                        {Number(verifiedLocation.longitude).toFixed(6)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            <p className="mt-3 text-[9px] text-sonar-dim leading-relaxed">
              Location is based on verified survey geospatial metadata and
              reverse geocoding, not visual inference by the AI model.
            </p>
          </div>
        )}

        {/* Object Identification & Confidence Grid */}
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-sonar-border">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
              Object Identification
            </span>

            <span className="text-sm font-semibold text-white">
              {analysis.objectIdentification}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1">
              Model Confidence
            </span>

            <span className="text-sm font-semibold font-mono text-sonar-cyan">
              {analysis.modelConfidence}
            </span>
          </div>
        </div>

        {/* Sonar Interpretation */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1 flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-sonar-cyan" />
            Sonar Interpretation
          </span>

          <p className="text-sonar-text leading-relaxed font-sans">
            {analysis.sonarInterpretation}
          </p>
        </div>

        {/* Confidence Interpretation */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1 flex items-center gap-1.5">
            {isLowConf ? (
              <ShieldAlert className="w-3 h-3 text-amber-400" />
            ) : (
              <CheckCircle className="w-3 h-3 text-emerald-400" />
            )}

            Confidence Interpretation
          </span>

          <p className="text-sonar-muted leading-relaxed font-sans">
            {analysis.confidenceInterpretation}
          </p>
        </div>

        {/* Visual Evidence */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1 flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-sonar-cyan" />
            Visual Evidence
          </span>

          <p className="text-sonar-muted leading-relaxed font-sans">
            {analysis.visualEvidence}
          </p>
        </div>

        {/* Operational Observation */}
        <div className="pt-2 border-t border-sonar-border">
          <span className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim block mb-1 flex items-center gap-1.5">
            <Compass className="w-3 h-3 text-sonar-cyan" />
            Operational Observation
          </span>

          <p className="text-sonar-text leading-relaxed font-sans font-medium">
            {analysis.operationalObservation}
          </p>
        </div>
      </div>
    </div>
  );
};