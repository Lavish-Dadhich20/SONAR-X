import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DashboardPage } from "./pages/DashboardPage";
import { NewScanPage } from "./pages/NewScanPage";
import { ScanHistoryPage } from "./pages/ScanHistoryPage";
import { DetectionsPage } from "./pages/DetectionsPage";
import { SurveyMapPage } from "./pages/SurveyMapPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemStatus } from "./types/sonar";
import { api } from "./services/api";
export function App() {
  const [activeTab, setActiveTab] =
    useState<string>("dashboard");
  const [systemStatus, setSystemStatus] =
    useState<SystemStatus | null>(null);
  const [selectedScanId, setSelectedScanId] =
    useState<string | null>(null);
  /*
   * This value forces NewScanPage to completely
   * reset whenever "New Scan" is clicked.
   *
   * This is important when the user is already
   * inside the New Scan workspace.
   */
  const [newScanKey, setNewScanKey] =
    useState<number>(0);
  // ============================================================
  // SYSTEM STATUS
  // ============================================================
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(
      fetchStatus,
      15000
    );
    return () =>
      clearInterval(interval);
  }, []);
  const fetchStatus = async () => {
    try {
      const status =
        await api.getSystemStatus();
      setSystemStatus(status);
    } catch {
      // Backend offline / starting up
      setSystemStatus({
        yolo: {
          online: false,
          modelName: "YOLO",
          weights: "best.pt",
          classesCount: 6,
        },
        ai: {
          online: false,
          activeProvider: "gemini",
          geminiConfigured: false,
          groqConfigured: false,
          geminiAvailable: false,
          groqAvailable: false,
        },
        database: {
          online: false,
          storageType: "Offline",
          scansCount: 0,
          detectionsCount: 0,
        },
      });
    }
  };
  // ============================================================
  // NEW SCAN
  // ============================================================
  const handleStartNewScan = () => {
    /*
     * Clear any previously selected scan.
     */
    setSelectedScanId(null);
    /*
     * Incrementing the key forces React to destroy
     * the existing NewScanPage and mount a completely
     * fresh one.
     *
     * Therefore this works even when the user is
     * already on the New Scan page.
     */
    setNewScanKey(
      (previous) => previous + 1
    );
    /*
     * Navigate to the New Scan workspace.
     */
    setActiveTab("new-scan");
  };
  // ============================================================
  // OPEN EXISTING SCAN
  // ============================================================
  const handleSelectScanForWorkspace = (
    scanId: string
  ) => {
    setSelectedScanId(scanId);
    /*
     * Do not increment newScanKey here because
     * we WANT to load the selected existing scan.
     */
    setActiveTab("new-scan");
  };
  // ============================================================
  // REPORTS
  // ============================================================
  const handleNavigateToReport = (
    scanId?: string
  ) => {
    if (scanId) {
      setSelectedScanId(scanId);
    }
    setActiveTab("reports");
  };
  // ============================================================
  // HEADER INFORMATION
  // ============================================================
  const getHeaderInfo = () => {
    switch (activeTab) {
      case "dashboard":
        return {
          title: "Dashboard",
          subtitle:
            "Overview of your sonar analysis activity.",
        };
      case "new-scan":
        return {
          title: "New Sonar Scan",
          subtitle:
            "Upload a sonar image to detect and analyze underwater objects.",
        };
      case "history":
        return {
          title: "Scan History",
          subtitle:
            "Historical repository of analyzed sonar scans and inferences.",
        };
      case "detections":
        return {
          title: "Detection Database",
          subtitle:
            "Granular acoustic target detections and localized bounding boxes.",
        };
      case "map":
        return {
          title: "Survey Map",
          subtitle:
            "Geospatial telemetry of genuine geo-tagged sonar passes.",
        };
      case "reports":
        return {
          title: "Analysis Reports",
          subtitle:
            "Structured sonar analysis and analysis documentation.",
        };
      case "model":
        return {
          title: "Model Performance",
          subtitle:
            "Acoustic detection benchmarks and per-class precision metrics.",
        };
      case "settings":
        return {
          title: "Settings",
          subtitle:
            "Acoustic sensitivity, AI providers, and system telemetry.",
        };
      default:
        return {
          title: "SONAR-X",
          subtitle:
            "Intelligent Sonar. Clearer Decisions.",
        };
    }
  };
  const headerInfo =
    getHeaderInfo();
  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-sonar-bg text-sonar-text">
      {/* ======================================================
          SIDEBAR
          ====================================================== */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />
      {/* ======================================================
          MAIN CONTENT
          ====================================================== */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* ====================================================
            HEADER
            ==================================================== */}
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          onNewScan={handleStartNewScan}
          onOpenSettings={() =>
            setActiveTab("settings")
          }
          systemStatus={systemStatus}
        />
        {/* ====================================================
            PAGE CONTENT
            ==================================================== */}
        <main className="flex-1 overflow-y-auto bg-sonar-bg">
          {/* ==================================================
              DASHBOARD
              ================================================== */}
          {activeTab === "dashboard" && (
            <DashboardPage
              onNavigateToNewScan={
                handleStartNewScan
              }
              onNavigateToScan={
                handleSelectScanForWorkspace
              }
              onNavigateToReports={
                handleNavigateToReport
              }
              systemStatus={
                systemStatus
              }
            />
          )}
          {/* ==================================================
              NEW SCAN
              IMPORTANT:
              The key forces a complete reset when
              "New Scan" is clicked.
              ================================================== */}
          {activeTab === "new-scan" && (
            <NewScanPage
              key={newScanKey}
              initialScanId={
                selectedScanId
              }
              onScanSaved={() =>
                fetchStatus()
              }
              onNavigateToReport={
                handleNavigateToReport
              }
            />
          )}
          {/* ==================================================
              SCAN HISTORY
              ================================================== */}
          {activeTab === "history" && (
            <ScanHistoryPage
              onViewScan={
                handleSelectScanForWorkspace
              }
              onGenerateReport={
                handleNavigateToReport
              }
              onNewScan={
                handleStartNewScan
              }
            />
          )}
          {/* ==================================================
              DETECTIONS
              ================================================== */}
          {activeTab === "detections" && (
            <DetectionsPage
              onSelectScan={
                handleSelectScanForWorkspace
              }
              onNewScan={
                handleStartNewScan
              }
            />
          )}
          {/* ==================================================
              SURVEY MAP
              ================================================== */}
          {activeTab === "map" && (
            <SurveyMapPage
              onSelectScan={
                handleSelectScanForWorkspace
              }
              onNewScan={
                handleStartNewScan
              }
            />
          )}
          {/* ==================================================
              REPORTS
              ================================================== */}
          {activeTab === "reports" && (
            <ReportsPage
              initialScanId={
                selectedScanId
              }
              onNewScan={
                handleStartNewScan
              }
            />
          )}
          {/* ==================================================
              SETTINGS
              ================================================== */}
          {activeTab === "settings" && (
            <SettingsPage
              systemStatus={
                systemStatus
              }
              onRefreshStatus={
                fetchStatus
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
