import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  FileText, 
  MapPin, 
  Sparkles, 
  AlertTriangle,
  Radio,
  SlidersHorizontal
} from "lucide-react";
import { Scan, ModelClass } from "../types/sonar";
import { api } from "../services/api";
import { EmptyState } from "../components/common/EmptyState";

interface ScanHistoryPageProps {
  onViewScan: (scanId: string) => void;
  onGenerateReport: (scanId: string) => void;
  onNewScan: () => void;
}

export const ScanHistoryPage: React.FC<ScanHistoryPageProps> = ({
  onViewScan,
  onGenerateReport,
  onNewScan,
}) => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [modelClasses, setModelClasses] = useState<ModelClass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [minConf, setMinConf] = useState<number>(0);
  const [aiProviderFilter, setAiProviderFilter] = useState<string>("");

  useEffect(() => {
    loadClasses();
    fetchScans();
  }, []);

  const loadClasses = async () => {
    try {
      const cls = await api.getModelClasses();
      setModelClasses(cls);
    } catch {
      // fallback
    }
  };

  const fetchScans = async () => {
    setLoading(true);
    try {
      const data = await api.listScans({
        search: searchTerm || undefined,
        objectClass: selectedClass || undefined,
        minConfidence: minConf > 0 ? minConf / 100 : undefined,
        aiProvider: aiProviderFilter || undefined,
      });
      setScans(data);
    } catch (err) {
      console.error("Failed to load scans:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scanId: string) => {
    if (!window.confirm(`Permanently delete scan ${scanId}?`)) return;
    try {
      await api.deleteScan(scanId);
      setScans((prev) => prev.filter((s) => s.scanId !== scanId));
    } catch (err) {
      alert("Failed to delete scan.");
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchScans();
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedClass("");
    setMinConf(0);
    setAiProviderFilter("");
    setTimeout(fetchScans, 50);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Scan History</h2>
          <p className="text-xs text-sonar-muted mt-1">
            Historical log of all analyzed sonar imagery and inference telemetry.
          </p>
        </div>

        <button
          onClick={onNewScan}
          className="px-4 py-2 rounded-lg bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-semibold tracking-wide transition shadow-sm self-start sm:self-auto"
        >
          New Sonar Scan
        </button>
      </div>

      {/* Filter and Search Bar */}
      <form
        onSubmit={handleApplyFilters}
        className="p-4 rounded-xl bg-sonar-surface border border-sonar-border flex flex-wrap items-center gap-3 text-xs"
      >
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-sonar-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Scan ID or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-sonar-card border border-sonar-border text-white placeholder-sonar-dim focus:outline-none focus:border-sonar-cyan font-mono"
          />
        </div>

        {/* Class Filter */}
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-3 py-2 rounded-lg bg-sonar-card border border-sonar-border text-sonar-text focus:outline-none focus:border-sonar-cyan font-mono"
        >
          <option value="">All Object Classes</option>
          {modelClasses.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name.replace("_", " ").toUpperCase()}
            </option>
          ))}
        </select>

        {/* AI Provider Filter */}
        <select
          value={aiProviderFilter}
          onChange={(e) => setAiProviderFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-sonar-card border border-sonar-border text-sonar-text focus:outline-none focus:border-sonar-cyan font-mono"
        >
          <option value="">All AI Providers</option>
          <option value="Gemini">Gemini</option>
          <option value="Groq">Groq</option>
        </select>

        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-sonar-card hover:bg-sonar-border text-sonar-cyan border border-sonar-cyan/30 font-medium transition"
        >
          Filter
        </button>

        {(searchTerm || selectedClass || minConf > 0 || aiProviderFilter) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3 py-2 text-sonar-muted hover:text-white transition"
          >
            Reset
          </button>
        )}
      </form>

      {/* Main Table */}
      {scans.length === 0 && !loading ? (
        <EmptyState
          title="No sonar scans have been analyzed yet."
          description="Your database is ready. Begin by executing an inference scan with the YOLO detector."
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
                  <th className="py-3 px-4">Scan</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Detections</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">AI Analysis</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sonar-border/60">
                {scans.map((scan) => {
                  const maxConf = Math.round(scan.highestConfidence * 100);
                  const isLow = scan.highestConfidence > 0 && scan.highestConfidence < 0.5;

                  return (
                    <tr
                      key={scan.scanId}
                      className="hover:bg-sonar-card/40 transition cursor-pointer"
                      onClick={() => onViewScan(scan.scanId)}
                    >
                      {/* Scan & Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-black border border-sonar-border overflow-hidden flex-shrink-0">
                            <img
                              src={api.getImageUrl(scan.annotatedImageUrl || scan.imageUrl)}
                              alt={scan.filename}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-white block">{scan.scanId}</span>
                            <span className="text-[10px] text-sonar-muted truncate block max-w-[150px]">
                              {scan.filename}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-sonar-muted">
                        {new Date(scan.createdAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4">
                        {scan.location ? (
                          <span className="text-sonar-cyan flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {scan.location.latitude.toFixed(2)}°, {scan.location.longitude.toFixed(2)}°
                          </span>
                        ) : (
                          <span className="text-sonar-dim">No GPS</span>
                        )}
                      </td>

                      {/* Detections */}
                      <td className="py-3 px-4 text-white font-semibold">
                        {scan.detectionCount} {scan.detectionCount === 1 ? "Target" : "Targets"}
                      </td>

                      {/* Confidence */}
                      <td className="py-3 px-4">
                        {scan.detectionCount > 0 ? (
                          <span className={isLow ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                            {maxConf}%
                          </span>
                        ) : (
                          <span className="text-sonar-dim">N/A</span>
                        )}
                      </td>

                      {/* AI Analysis */}
                      <td className="py-3 px-4">
                        {scan.aiAnalysis ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-sonar-cyanMuted text-sonar-cyan border border-sonar-cyan/30">
                            <Sparkles className="w-2.5 h-2.5" />
                            {scan.aiProvider || "AI"}
                          </span>
                        ) : (
                          <span className="text-sonar-dim">Pending</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-sonar-card text-sonar-muted border border-sonar-border">
                          {scan.status || "Completed"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onViewScan(scan.scanId)}
                            title="View in Workspace"
                            className="p-1.5 rounded hover:bg-sonar-card text-sonar-muted hover:text-white transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onGenerateReport(scan.scanId)}
                            title="Generate Report"
                            className="p-1.5 rounded hover:bg-sonar-card text-sonar-muted hover:text-sonar-cyan transition"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(scan.scanId)}
                            title="Delete Scan"
                            className="p-1.5 rounded hover:bg-sonar-card text-sonar-muted hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
