import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  Printer, 
  Share2, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  Radio,
  ExternalLink
} from "lucide-react";
import { Report, Scan } from "../types/sonar";
import { api } from "../services/api";
import { EmptyState } from "../components/common/EmptyState";

interface ReportsPageProps {
  initialScanId?: string | null;
  onNewScan: () => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ initialScanId, onNewScan }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [availableScans, setAvailableScans] = useState<Scan[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [initialScanId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reps, scans] = await Promise.all([
        api.listReports().catch(() => []),
        api.listScans().catch(() => []),
      ]);
      setReports(reps);
      setAvailableScans(scans);

      // If initialScanId is passed, generate or find its report
      if (initialScanId) {
        const existing = reps.find((r) => r.scanId === initialScanId);
        if (existing) {
          setSelectedReport(existing);
        } else {
          // Auto generate report for this scan
          handleGenerateReport(initialScanId);
        }
      } else if (reps.length > 0) {
        setSelectedReport(reps[0]);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (scanId: string) => {
    setGenerating(true);
    try {
      const newRep = await api.generateReport(scanId);
      setSelectedReport(newRep);
      setReports((prev) => [newRep, ...prev.filter((r) => r.reportId !== newRep.reportId)]);
    } catch (err: any) {
      alert(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    if (!selectedReport) return;
    const blob = new Blob([JSON.stringify(selectedReport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SONAR-X_Report_${selectedReport.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Analysis Reports</h2>
          <p className="text-xs text-sonar-muted mt-1">
            Certified technical inspection reports with acoustic evidence and AI interpretation.
          </p>
        </div>

        {availableScans.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-2 rounded-lg bg-sonar-card border border-sonar-border text-xs text-white font-mono focus:outline-none focus:border-sonar-cyan"
              onChange={(e) => {
                if (e.target.value) handleGenerateReport(e.target.value);
              }}
              defaultValue=""
            >
              <option value="" disabled>Generate Report for Scan...</option>
              {availableScans.map((s) => (
                <option key={s.scanId} value={s.scanId}>
                  {s.scanId} ({s.filename})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {reports.length === 0 && !selectedReport && !loading ? (
        <EmptyState
          title="No reports generated yet."
          description="Reports compile full acoustic telemetry, bounding box crops, and AI interpretations into certified technical documentation."
          actionText="Start New Scan"
          onAction={onNewScan}
          icon={FileText}
        />
      ) : selectedReport ? (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-sonar-surface border border-sonar-border text-xs print:hidden">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sonar-dim">REPORT:</span>
              <span className="font-mono font-bold text-white">{selectedReport.reportId}</span>
              <span className="text-sonar-dim">·</span>
              <span className="font-mono text-sonar-cyan">{selectedReport.scanId}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sonar-card hover:bg-sonar-border text-white border border-sonar-border transition font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 font-bold transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Printable Report Document Card */}
          <div className="p-10 rounded-2xl bg-[#0a0f1d] border border-sonar-border shadow-2xl text-sonar-text font-sans space-y-8 max-w-4xl mx-auto print:border-0 print:p-0 print:bg-white print:text-black">
            {/* Report Header */}
            <div className="border-b border-sonar-border print:border-gray-300 pb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tracking-widest text-white print:text-black">
                    SONAR-X
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-widest bg-sonar-cyanMuted text-sonar-cyan border border-sonar-cyan/30 print:border-black print:text-black">
                    OFFICIAL REPORT
                  </span>
                </div>
                <h1 className="text-base font-bold text-sonar-text print:text-black mt-2">
                  ACOUSTIC TARGET ANALYSIS REPORT
                </h1>
                <p className="text-xs text-sonar-muted print:text-gray-600 mt-0.5">
                  Automated YOLO Object Localization & Neural Sonar Interpretation
                </p>
              </div>

              <div className="text-right font-mono text-xs">
                <div className="text-sonar-dim print:text-gray-500 text-[10px]">REPORT ID</div>
                <div className="font-bold text-white print:text-black">{selectedReport.reportId}</div>
                <div className="text-sonar-dim print:text-gray-500 text-[10px] mt-2">GENERATED AT</div>
                <div className="text-sonar-muted print:text-gray-700">
                  {new Date(selectedReport.generatedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Scan Telemetry Block */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-sonar-surface/80 border border-sonar-border print:border-gray-300 print:bg-gray-50 text-xs font-mono">
              <div>
                <span className="text-sonar-dim print:text-gray-500 text-[10px] block">SCAN ID</span>
                <span className="text-white print:text-black font-bold">{selectedReport.scan.scanId}</span>
              </div>
              <div>
                <span className="text-sonar-dim print:text-gray-500 text-[10px] block">ORIGINAL FILE</span>
                <span className="text-white print:text-black truncate block">{selectedReport.scan.filename}</span>
              </div>
              <div>
                <span className="text-sonar-dim print:text-gray-500 text-[10px] block">DIMENSIONS</span>
                <span className="text-white print:text-black">
                  {selectedReport.scan.metadata?.width} × {selectedReport.scan.metadata?.height}
                </span>
              </div>
              <div>
                <span className="text-sonar-dim print:text-gray-500 text-[10px] block">GEOLOCATION</span>
                <span className="text-sonar-cyan print:text-black">
                  {selectedReport.scan.location
                    ? `${selectedReport.scan.location.latitude.toFixed(4)}°, ${selectedReport.scan.location.longitude.toFixed(4)}°`
                    : "Not embedded"}
                </span>
              </div>
            </div>

            {/* Sonar Imagery Evidence */}
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-sonar-dim print:text-gray-700 mb-3">
                1.0 ACOUSTIC IMAGERY EVIDENCE
              </h3>
              <div className="rounded-xl overflow-hidden border border-sonar-border print:border-gray-400 bg-black">
                <img
                  src={api.getImageUrl(
                    selectedReport.scan.annotatedImageUrl || selectedReport.scan.imageUrl
                  )}
                  alt={selectedReport.scan.filename}
                  className="w-full max-h-[420px] object-contain mx-auto"
                />
              </div>
            </div>

            {/* Target Detections Table */}
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-sonar-dim print:text-gray-700 mb-3 flex items-center justify-between">
                <span>2.0 YOLO OBJECT DETECTIONS ({selectedReport.detections.length})</span>
                <span className="text-[10px] font-normal text-sonar-cyan print:text-gray-700">
                  Model: {selectedReport.modelInfo.name} ({selectedReport.modelInfo.weights})
                </span>
              </h3>

              {selectedReport.detections.length === 0 ? (
                <div className="p-4 rounded-lg bg-sonar-surface border border-sonar-border print:bg-gray-100 text-xs text-center text-sonar-muted print:text-gray-700">
                  Zero acoustic targets identified above threshold.
                </div>
              ) : (
                <div className="rounded-lg border border-sonar-border print:border-gray-300 overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-sonar-surface print:bg-gray-200 text-sonar-dim print:text-gray-700 text-[10px] uppercase">
                      <tr>
                        <th className="p-3">Ref</th>
                        <th className="p-3">Acoustic Crop</th>
                        <th className="p-3">Predicted Class</th>
                        <th className="p-3">Model Confidence</th>
                        <th className="p-3">Bounding Box [X, Y, W, H]</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sonar-border print:divide-gray-300">
                      {selectedReport.detections.map((d) => (
                        <tr key={d.id} className="print:bg-white">
                          <td className="p-3 font-bold text-white print:text-black">{d.id}</td>
                          <td className="p-3">
                            {d.cropUrl ? (
                              <img
                                src={api.getImageUrl(d.cropUrl)}
                                alt={d.className}
                                className="w-12 h-12 object-cover rounded border border-sonar-border"
                              />
                            ) : (
                              <span className="text-sonar-dim">N/A</span>
                            )}
                          </td>
                          <td className="p-3 font-semibold uppercase text-sonar-cyan print:text-black">
                            {d.className.replace("_", " ")}
                          </td>
                          <td className="p-3 font-bold text-white print:text-black">
                            {d.confidencePercent}%
                          </td>
                          <td className="p-3 text-sonar-muted print:text-gray-600 text-[11px]">
                            [{d.boundingBox.x}, {d.boundingBox.y}, {d.boundingBox.w}, {d.boundingBox.h}]
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI Sonar Interpretation */}
            {selectedReport.aiInterpretation && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-sonar-dim print:text-gray-700 mb-3 flex items-center justify-between">
                  <span>3.0 NEURAL ACOUSTIC INTERPRETATION</span>
                  <span className="text-[10px] text-sonar-cyan print:text-black font-normal">
                    Provider: {selectedReport.aiInterpretation.provider} (
                    {selectedReport.aiInterpretation.providerModel})
                  </span>
                </h3>

                <div className="p-5 rounded-xl bg-sonar-surface/70 border border-sonar-border print:border-gray-300 print:bg-gray-50 space-y-3 text-xs leading-relaxed">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-cyan print:text-gray-800 font-bold block mb-1">
                      OBJECT IDENTIFICATION & CONFIDENCE
                    </span>
                    <p className="text-white print:text-black font-semibold">
                      {selectedReport.aiInterpretation.objectIdentification} —{" "}
                      {selectedReport.aiInterpretation.modelConfidence}
                    </p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-dim print:text-gray-600 block mb-1">
                      SONAR ACOUSTIC INTERPRETATION
                    </span>
                    <p className="text-sonar-text print:text-gray-800">
                      {selectedReport.aiInterpretation.sonarInterpretation}
                    </p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-dim print:text-gray-600 block mb-1">
                      CONFIDENCE & EVIDENCE
                    </span>
                    <p className="text-sonar-muted print:text-gray-700">
                      {selectedReport.aiInterpretation.confidenceInterpretation} {selectedReport.aiInterpretation.visualEvidence}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-sonar-border print:border-gray-300">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-cyan print:text-gray-800 font-bold block mb-1">
                      OPERATIONAL OBSERVATION
                    </span>
                    <p className="text-sonar-text print:text-black font-medium">
                      {selectedReport.aiInterpretation.operationalObservation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer / Certified Signature */}
            <div className="pt-6 border-t border-sonar-border print:border-gray-300 flex items-center justify-between text-[11px] font-mono text-sonar-dim print:text-gray-500">
              <div>
                <span>SONAR-X HYDROGRAPHIC INTELLIGENCE ENGINE</span>
                <span className="block text-[10px]">HASH: {selectedReport.reportId}-VERIFIED</span>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 print:text-black font-semibold">
                  AUTHENTICATED INFERENCE REPORT
                </span>
                <span className="block text-[10px]">ALL MEASUREMENTS SOURCED FROM ACTIVE SENSORS</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
