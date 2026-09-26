import React, { useEffect, useState } from "react";
import { 
  ScanLine, 
  Target, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Clock, 
  MapPin, 
  AlertTriangle,
  Radio,
  FileText
} from "lucide-react";
import { Scan, DashboardStats, SystemStatus } from "../types/sonar";
import { api } from "../services/api";
import { EmptyState } from "../components/common/EmptyState";

interface DashboardPageProps {
  onNavigateToNewScan: () => void;
  onNavigateToScan: (scanId: string) => void;
  onNavigateToReports: (scanId?: string) => void;
  systemStatus: SystemStatus | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateToNewScan,
  onNavigateToScan,
  onNavigateToReports,
  systemStatus,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentScans, setRecentScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, scansData] = await Promise.all([
        api.getDashboardStats().catch(() => null),
        api.listScans().catch(() => []),
      ]);
      setStats(statsData);
      setRecentScans(scansData.slice(0, 5));
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const totalScans = stats?.totalScans ?? 0;
  const objectsDetected = stats?.objectsDetected ?? 0;
  const aiAnalyses = stats?.aiAnalyses ?? 0;
  const highConf = stats?.highConfidenceDetections ?? 0;
  const classDist = stats?.classDistribution ?? {};

  const hasData = totalScans > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-gradient-to-r from-sonar-surface via-sonar-card to-sonar-surface border border-sonar-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-sonar-cyan">
              UNDERWATER ACOUSTIC INTELLIGENCE PLATFORM
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide mt-1">
            SONAR-X Tactical Analysis Center
          </h2>
          <p className="text-xs text-sonar-muted mt-1 max-w-xl">
            Real-time acoustic sonar image analysis, YOLO object localization, and structured AI interpretation for maritime operations.
          </p>
        </div>

        <button
          onClick={onNavigateToNewScan}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-bold tracking-wider transition shadow-lg self-start md:self-auto"
        >
          <ScanLine className="w-4 h-4" />
          <span>START NEW SCAN</span>
        </button>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Scans */}
        <div className="p-5 rounded-xl bg-sonar-surface border border-sonar-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-sonar-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Total Scans</span>
            <ScanLine className="w-4 h-4 text-sonar-cyan" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-mono font-bold text-white tracking-tight">
              {loading ? "-" : totalScans}
            </span>
            <p className="text-[11px] text-sonar-muted mt-1">Logged in database</p>
          </div>
        </div>

        {/* Objects Detected */}
        <div className="p-5 rounded-xl bg-sonar-surface border border-sonar-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-sonar-muted">
            <span className="text-xs font-medium uppercase tracking-wider">Objects Detected</span>
            <Target className="w-4 h-4 text-sonar-cyan" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-mono font-bold text-white tracking-tight">
              {loading ? "-" : objectsDetected}
            </span>
            <p className="text-[11px] text-sonar-muted mt-1">Via YOLO inference</p>
          </div>
        </div>

        {/* AI Analyses */}
        <div className="p-5 rounded-xl bg-sonar-surface border border-sonar-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-sonar-muted">
            <span className="text-xs font-medium uppercase tracking-wider">AI Analyses</span>
            <Sparkles className="w-4 h-4 text-sonar-cyan" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-mono font-bold text-white tracking-tight">
              {loading ? "-" : aiAnalyses}
            </span>
            <p className="text-[11px] text-sonar-muted mt-1">Technical syntheses</p>
          </div>
        </div>

        {/* High Confidence */}
        <div className="p-5 rounded-xl bg-sonar-surface border border-sonar-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-sonar-muted">
            <span className="text-xs font-medium uppercase tracking-wider">High Confidence</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-mono font-bold text-emerald-400 tracking-tight">
              {loading ? "-" : highConf}
            </span>
            <p className="text-[11px] text-sonar-muted mt-1">Confidence ≥ 70%</p>
          </div>
        </div>
      </div>

      {/* Main Section: Recent Scans + Detection Overview */}
      {!hasData && !loading ? (
        <EmptyState
          title="Your sonar workspace is ready."
          description="Upload your first sonar image to begin YOLO detection, acoustic bounding box localization, and AI interpretation."
          actionText="Start New Scan"
          onAction={onNavigateToNewScan}
          icon={Radio}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Scans (2 cols) */}
          <div className="lg:col-span-2 rounded-xl bg-sonar-surface border border-sonar-border overflow-hidden">
            <div className="px-6 py-4 border-b border-sonar-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide">Recent Scans</h3>
                <p className="text-xs text-sonar-muted">Latest analyzed sonar imagery</p>
              </div>
              <button
                onClick={() => onNavigateToScan("")}
                className="text-xs text-sonar-cyan hover:underline flex items-center gap-1 font-mono"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-sonar-border">
              {recentScans.length === 0 ? (
                <div className="p-8 text-center text-xs text-sonar-muted">
                  No sonar scans have been analyzed yet.
                </div>
              ) : (
                recentScans.map((scan) => {
                  const maxConf = Math.round(scan.highestConfidence * 100);
                  const isLow = scan.highestConfidence > 0 && scan.highestConfidence < 0.5;

                  return (
                    <div
                      key={scan.scanId}
                      className="p-4 hover:bg-sonar-card/50 transition flex items-center justify-between gap-4 cursor-pointer"
                      onClick={() => onNavigateToScan(scan.scanId)}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded bg-black border border-sonar-border flex-shrink-0 overflow-hidden">
                          <img
                            src={api.getImageUrl(scan.annotatedImageUrl || scan.imageUrl)}
                            alt={scan.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-white truncate">
                              {scan.scanId}
                            </span>
                            {scan.location && (
                              <span className="flex items-center gap-0.5 text-[10px] text-sonar-cyan font-mono">
                                <MapPin className="w-2.5 h-2.5" />
                                GPS
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-sonar-muted truncate mt-0.5">
                            {scan.filename} · {scan.metadata?.width}x{scan.metadata?.height}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-sonar-dim font-mono">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats & Actions */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-mono text-white font-medium">
                            {scan.detectionCount} {scan.detectionCount === 1 ? "Target" : "Targets"}
                          </div>
                          {scan.detectionCount > 0 && (
                            <div className="text-[11px] font-mono">
                              <span className={isLow ? "text-amber-400" : "text-emerald-400"}>
                                Max: {maxConf}%
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToReports(scan.scanId);
                            }}
                            className="p-1.5 rounded bg-sonar-card hover:bg-sonar-border text-sonar-muted hover:text-white transition"
                            title="Generate Analysis Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Detection Overview (1 col) */}
          <div className="rounded-xl bg-sonar-surface border border-sonar-border p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">Detection Overview</h3>
              <p className="text-xs text-sonar-muted">Actual class distribution from database</p>

              <div className="mt-6 space-y-3">
                {Object.keys(classDist).length === 0 ? (
                  <p className="text-xs text-sonar-muted text-center py-8">
                    Detection distribution will appear after sonar scans are analyzed.
                  </p>
                ) : (
                  Object.entries(classDist).map(([cls, count]) => {
                    const percentage = objectsDetected > 0 ? Math.round((count / objectsDetected) * 100) : 0;
                    return (
                      <div key={cls} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-sonar-text uppercase">
                            {cls.replace("_", " ")}
                          </span>
                          <span className="text-sonar-cyan font-semibold">
                            {count} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-sonar-card overflow-hidden">
                          <div
                            className="h-full bg-sonar-cyan rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* System Readiness Box */}
            <div className="mt-6 p-3.5 rounded-lg bg-sonar-card border border-sonar-border text-xs">
              <span className="text-[10px] font-mono text-sonar-dim uppercase tracking-wider block mb-1">
                Acoustic Processing Core
              </span>
              <div className="flex items-center justify-between text-sonar-muted">
                <span>Model:</span>
                <span className="text-white font-mono font-medium">
                  {systemStatus?.yolo?.weights || "best.pt"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sonar-muted mt-1">
                <span>Classes:</span>
                <span className="text-white font-mono">
                  {systemStatus?.yolo?.classesCount || 6} dynamic
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
