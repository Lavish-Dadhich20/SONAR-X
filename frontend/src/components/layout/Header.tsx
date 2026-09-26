import React from "react";
import { PlusCircle, Sliders, ShieldCheck } from "lucide-react";
import { SystemStatus } from "../../types/sonar";

interface HeaderProps {
  title: string;
  subtitle: string;
  onNewScan: () => void;
  onOpenSettings: () => void;
  systemStatus: SystemStatus | null;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onNewScan,
  onOpenSettings,
  systemStatus,
}) => {
  const isAllGood = systemStatus?.yolo?.online && systemStatus?.database?.online;

  return (
    <header className="h-16 px-6 border-b border-sonar-border bg-sonar-surface/80 backdrop-blur flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-base font-semibold tracking-wide text-white flex items-center gap-2">
          {title}
        </h1>
        <p className="text-xs text-sonar-muted">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Status chip */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-sonar-card border border-sonar-border text-xs font-mono">
          <ShieldCheck className={`w-3.5 h-3.5 ${isAllGood ? "text-emerald-400" : "text-amber-400"}`} />
          <span className="text-sonar-muted">SYSTEM:</span>
          <span className={isAllGood ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
            {isAllGood ? "OPERATIONAL" : "DEGRADED"}
          </span>
        </div>

        {/* Model badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-sonar-cyanMuted border border-sonar-cyan/30 text-xs font-mono text-sonar-cyan">
          <span>best.pt</span>
          <span className="text-sonar-dim">|</span>
          <span>{systemStatus?.yolo?.classesCount || 6} Classes</span>
        </div>

        {/* Action button */}
        <button
          onClick={onNewScan}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-semibold tracking-wide transition shadow-sm"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Scan</span>
        </button>

        <button
          onClick={onOpenSettings}
          title="System Settings"
          className="p-1.5 rounded-md text-sonar-muted hover:text-white hover:bg-sonar-card border border-sonar-border transition"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
