import React from "react";
import {
  LayoutDashboard,
  Crosshair,
  History,
  Target,
  MapPin,
  FileText,
  Settings,
  Radio,
} from "lucide-react";
import { SystemStatus } from "../../types/sonar";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  systemStatus: SystemStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  systemStatus,
}) => {
  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "new-scan",
      label: "New Scan",
      icon: Crosshair,
    },
    {
      id: "history",
      label: "Scan History",
      icon: History,
    },
    {
      id: "detections",
      label: "Detections",
      icon: Target,
    },
    {
      id: "map",
      label: "Survey Map",
      icon: MapPin,
    },
    {
      id: "reports",
      label: "Reports",
      icon: FileText,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  const yoloOnline =
    systemStatus?.yolo?.online ?? false;

  const aiOnline =
    systemStatus?.ai?.online ?? false;

  const dbOnline =
    systemStatus?.database?.online ?? false;

  return (
    <aside className="w-[250px] min-w-[250px] bg-sonar-surface border-r border-sonar-border flex flex-col h-screen select-none z-30">

      {/* Brand Header */}
      <div className="p-5 border-b border-sonar-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">

            <div className="relative w-8 h-8 rounded-lg bg-sonar-card border border-sonar-cyan/40 flex items-center justify-center overflow-hidden">
              <Radio className="w-4 h-4 text-sonar-cyan animate-pulse" />

              <div className="absolute inset-0 bg-sonar-cyan/10 rounded-lg pointer-events-none" />
            </div>

            <div>
              <span className="text-lg font-semibold tracking-[0.18em] text-white">
                SONAR-X
              </span>
            </div>

          </div>

          <p className="text-[11px] text-sonar-muted mt-1.5 tracking-tight font-medium">
            Intelligent Sonar. Clearer Decisions.
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-sonar-cyanMuted text-sonar-cyan border border-sonar-cyan/40 shadow-sm"
                  : "text-sonar-muted hover:text-sonar-text hover:bg-sonar-card/70 border border-transparent"
              }`}
            >

              <Icon
                className={`w-4 h-4 ${
                  isActive
                    ? "text-sonar-cyan"
                    : "text-sonar-muted"
                }`}
              />

              <span>{item.label}</span>

              {item.id === "new-scan" && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sonar-cyan animate-ping" />
              )}

            </button>
          );
        })}

      </nav>

      {/* System Status Section */}
      <div className="p-4 border-t border-sonar-border bg-sonar-bg/40">

        <div className="text-[10px] font-mono uppercase tracking-wider text-sonar-dim mb-2.5">
          System Status
        </div>

        <div className="space-y-2 text-xs font-mono">

          {/* YOLO */}
          <div className="flex items-center justify-between">

            <span className="text-sonar-muted flex items-center gap-1.5">

              <span
                className={`w-2 h-2 rounded-full ${
                  yoloOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                    : "bg-rose-500"
                }`}
              />

              YOLO
            </span>

            <span
              className={
                yoloOnline
                  ? "text-emerald-400 text-[11px]"
                  : "text-rose-400 text-[11px]"
              }
            >
              {yoloOnline ? "Online" : "Offline"}
            </span>

          </div>

          {/* AI */}
          <div className="flex items-center justify-between">

            <span className="text-sonar-muted flex items-center gap-1.5">

              <span
                className={`w-2 h-2 rounded-full ${
                  aiOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                    : "bg-amber-400"
                }`}
              />

              AI
            </span>

            <span
              className={
                aiOnline
                  ? "text-emerald-400 text-[11px]"
                  : "text-amber-400 text-[11px]"
              }
            >
              {aiOnline
                ? systemStatus?.ai?.activeProvider?.toUpperCase() ||
                  "Online"
                : "Ready"}
            </span>

          </div>

          {/* Database */}
          <div className="flex items-center justify-between">

            <span className="text-sonar-muted flex items-center gap-1.5">

              <span
                className={`w-2 h-2 rounded-full ${
                  dbOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                    : "bg-amber-400"
                }`}
              />

              Database
            </span>

            <span
              className={
                dbOnline
                  ? "text-emerald-400 text-[11px]"
                  : "text-amber-400 text-[11px]"
              }
            >
              {dbOnline ? "Online" : "Fallback"}
            </span>

          </div>

        </div>
      </div>

    </aside>
  );
};