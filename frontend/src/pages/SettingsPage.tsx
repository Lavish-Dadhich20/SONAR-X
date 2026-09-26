import React, { useState, useEffect } from "react";
import { 
  Sliders, 
  Sparkles, 
  Database, 
  Cpu, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  Key,
  Radio
} from "lucide-react";
import { SystemStatus, ModelClass } from "../types/sonar";
import { api } from "../services/api";

interface SettingsPageProps {
  systemStatus: SystemStatus | null;
  onRefreshStatus: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ systemStatus, onRefreshStatus }) => {
  const [activeProvider, setActiveProvider] = useState<string>("gemini");
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const [groqApiKey, setGroqApiKey] = useState<string>("");
  const [confThreshold, setConfThreshold] = useState<number>(0.25);
  const [iouThreshold, setIouThreshold] = useState<number>(0.45);
  const [modelClasses, setModelClasses] = useState<ModelClass[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (systemStatus?.ai?.activeProvider) {
      setActiveProvider(systemStatus.ai.activeProvider);
    }
    loadClasses();
  }, [systemStatus]);

  const loadClasses = async () => {
    try {
      const cls = await api.getModelClasses();
      setModelClasses(cls);
    } catch {}
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings({
        activeAiProvider: activeProvider,
        geminiApiKey: geminiApiKey || undefined,
        groqApiKey: groqApiKey || undefined,
        confidenceThreshold: confThreshold,
        iouThreshold: iouThreshold,
      });
      setSaveSuccess(true);
      onRefreshStatus();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert("Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-sonar-border">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">System Settings</h2>
          <p className="text-xs text-sonar-muted mt-1">
            Configure YOLO inference parameters, AI providers, and database telemetry.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-bold tracking-wider transition shadow-sm disabled:opacity-50"
        >
          {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saveSuccess ? "SAVED" : "SAVE SETTINGS"}</span>
        </button>
      </div>

      <div className="space-y-6">
        {/* Section 1: AI Provider Selection */}
        <div className="p-6 rounded-xl bg-sonar-surface border border-sonar-border space-y-4">
          <div className="flex items-center gap-2 border-b border-sonar-border pb-3">
            <Sparkles className="w-4 h-4 text-sonar-cyan" />
            <h3 className="text-sm font-semibold text-white tracking-wide">AI Provider Engine</h3>
          </div>

          <p className="text-xs text-sonar-muted leading-relaxed">
            Select the multimodal engine responsible for generating structured acoustic interpretations from YOLO telemetry and sonar backscatter.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            {/* Gemini */}
            <div
              onClick={() => setActiveProvider("gemini")}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                activeProvider === "gemini"
                  ? "bg-sonar-cyanMuted/20 border-sonar-cyan shadow-sm"
                  : "bg-sonar-card/50 border-sonar-border hover:border-sonar-borderLight"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Google Gemini
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    systemStatus?.ai?.geminiConfigured
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                />
              </div>
              <p className="text-[11px] text-sonar-muted">
                Multimodal direct vision analysis (gemini-1.5-flash / gemini-2.0-flash).
              </p>
            </div>

            {/* Groq */}
            <div
              onClick={() => setActiveProvider("groq")}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                activeProvider === "groq"
                  ? "bg-sonar-cyanMuted/20 border-sonar-cyan shadow-sm"
                  : "bg-sonar-card/50 border-sonar-border hover:border-sonar-borderLight"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Groq LPU
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    systemStatus?.ai?.groqConfigured
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  }`}
                />
              </div>
              <p className="text-[11px] text-sonar-muted">
                Ultra-low latency inference via Llama-3.3-70b-versatile.
              </p>
            </div>
          </div>

          {/* Optional API Key Inputs */}
          <div className="space-y-3 pt-3 border-t border-sonar-border font-mono text-xs">
            <div>
              <label className="text-[11px] text-sonar-dim uppercase block mb-1">
                GEMINI API KEY (Optional override)
              </label>
              <input
                type="password"
                placeholder={systemStatus?.ai?.geminiConfigured ? "•••••••••••••••• (Configured on server)" : "Enter Gemini API Key..."}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded bg-sonar-card border border-sonar-border text-white placeholder-sonar-dim focus:outline-none focus:border-sonar-cyan"
              />
            </div>

            <div>
              <label className="text-[11px] text-sonar-dim uppercase block mb-1">
                GROQ API KEY (Optional override)
              </label>
              <input
                type="password"
                placeholder={systemStatus?.ai?.groqConfigured ? "•••••••••••••••• (Configured on server)" : "Enter Groq API Key..."}
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded bg-sonar-card border border-sonar-border text-white placeholder-sonar-dim focus:outline-none focus:border-sonar-cyan"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Detection Thresholds */}
        <div className="p-6 rounded-xl bg-sonar-surface border border-sonar-border space-y-4">
          <div className="flex items-center gap-2 border-b border-sonar-border pb-3">
            <Sliders className="w-4 h-4 text-sonar-cyan" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Default Detection Parameters
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 font-mono text-xs">
            <div>
              <div className="flex justify-between text-sonar-muted mb-1 text-[11px]">
                <span>DEFAULT CONFIDENCE THRESHOLD</span>
                <span className="text-sonar-cyan">{Math.round(confThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-sonar-card rounded-lg appearance-none cursor-pointer accent-sonar-cyan"
              />
              <span className="text-[10px] text-sonar-dim mt-1 block">
                Minimum probability to retain detected acoustic bounding box.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-sonar-muted mb-1 text-[11px]">
                <span>DEFAULT IoU THRESHOLD</span>
                <span className="text-sonar-cyan">{Math.round(iouThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={iouThreshold}
                onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-sonar-card rounded-lg appearance-none cursor-pointer accent-sonar-cyan"
              />
              <span className="text-[10px] text-sonar-dim mt-1 block">
                Non-maximum suppression threshold for overlapping bounding boxes.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Model & Dynamic Classes */}
        <div className="p-6 rounded-xl bg-sonar-surface border border-sonar-border space-y-4">
          <div className="flex items-center gap-2 border-b border-sonar-border pb-3">
            <Cpu className="w-4 h-4 text-sonar-cyan" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Model & Loaded Classes
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-sonar-dim">CURRENT WEIGHTS:</span>
              <span className="text-white font-bold">{systemStatus?.yolo?.weights || "best.pt"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sonar-dim">LOADED CLASSES:</span>
              <span className="text-sonar-cyan font-bold">{modelClasses.length} Dynamic</span>
            </div>
            <div className="pt-2">
              <span className="text-[11px] text-sonar-dim uppercase block mb-2">
                ACTIVE ACOUSTIC TARGET CATEGORIES
              </span>
              <div className="flex flex-wrap gap-2">
                {modelClasses.map((c) => (
                  <span
                    key={c.id}
                    className="px-2.5 py-1 rounded bg-sonar-card border border-sonar-border text-[11px] text-white"
                  >
                    {c.id}: {c.name.replace("_", " ").toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Database Telemetry */}
        <div className="p-6 rounded-xl bg-sonar-surface border border-sonar-border space-y-4">
          <div className="flex items-center gap-2 border-b border-sonar-border pb-3">
            <Database className="w-4 h-4 text-sonar-cyan" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Database Persistence Telemetry
            </h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-sonar-dim">STORAGE BACKEND:</span>
              <span className="text-white font-bold">{systemStatus?.database?.storageType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sonar-dim">DATABASE STATUS:</span>
              <span
                className={
                  systemStatus?.database?.online ? "text-emerald-400 font-bold" : "text-amber-400"
                }
              >
                {systemStatus?.database?.online ? "CONNECTED (ONLINE)" : "PERSISTENT FALLBACK"}
              </span>
            </div>
            {systemStatus?.database?.latencyMs && (
              <div className="flex justify-between">
                <span className="text-sonar-dim">PING LATENCY:</span>
                <span className="text-sonar-cyan">{systemStatus.database.latencyMs} ms</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sonar-dim">STORED SCANS COUNT:</span>
              <span className="text-white">{systemStatus?.database?.scansCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sonar-dim">STORED DETECTIONS COUNT:</span>
              <span className="text-white">{systemStatus?.database?.detectionsCount || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
