import { Scan, Detection, ModelClass, SystemStatus, DashboardStats, Report, AIAnalysis } from "../types/sonar";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = {
  // Scans
  async uploadScan(file: File): Promise<Scan> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/scans/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },

  async reDetect(scanId: string, conf?: number, iou?: number): Promise<{
    detectionCount: number;
    highestConfidence: number;
    detections: Detection[];
    annotatedImageUrl: string;
  }> {
    const res = await fetch(`${API_BASE}/api/scans/${scanId}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confidenceThreshold: conf,
        iouThreshold: iou,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Re-detection failed" }));
      throw new Error(err.detail || "Detection failed");
    }
    return res.json();
  },

  async interpretScan(scanId: string, provider?: string): Promise<{ aiAnalysis: AIAnalysis; aiProvider: string }> {
    const res = await fetch(`${API_BASE}/api/scans/${scanId}/interpret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "AI interpretation failed" }));
      throw new Error(err.detail || "Interpretation failed");
    }
    return res.json();
  },

  async saveScan(scanId: string): Promise<{ status: string; scanId: string }> {
    const res = await fetch(`${API_BASE}/api/scans/${scanId}/save`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error("Failed to save scan");
    }
    return res.json();
  },

  async listScans(filters?: {
    search?: string;
    objectClass?: string;
    minConfidence?: number;
    aiProvider?: string;
  }): Promise<Scan[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.objectClass) params.append("object_class", filters.objectClass);
    if (filters?.minConfidence !== undefined) params.append("min_confidence", filters.minConfidence.toString());
    if (filters?.aiProvider) params.append("ai_provider", filters.aiProvider);

    const res = await fetch(`${API_BASE}/api/scans?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch scans");
    return res.json();
  },

  async getScan(scanId: string): Promise<Scan> {
    const res = await fetch(`${API_BASE}/api/scans/${scanId}`);
    if (!res.ok) throw new Error("Scan not found");
    return res.json();
  },

  async deleteScan(scanId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/scans/${scanId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete scan");
    return res.json();
  },

  // Detections
  async listDetections(filters?: { objectClass?: string; minConfidence?: number }): Promise<Detection[]> {
    const params = new URLSearchParams();
    if (filters?.objectClass) params.append("object_class", filters.objectClass);
    if (filters?.minConfidence !== undefined) params.append("min_confidence", filters.minConfidence.toString());

    const res = await fetch(`${API_BASE}/api/detections?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch detections");
    return res.json();
  },

  // Model
  async getModelClasses(): Promise<ModelClass[]> {
    const res = await fetch(`${API_BASE}/api/model/classes`);
    if (!res.ok) throw new Error("Failed to load model classes");
    return res.json();
  },

  async getModelMetrics(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/model/metrics`);
    if (!res.ok) throw new Error("Failed to load model metrics");
    return res.json();
  },

  // System
  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch(`${API_BASE}/api/system/status`);
    if (!res.ok) throw new Error("Failed to fetch system status");
    return res.json();
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/api/system/stats`);
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return res.json();
  },

  async updateSettings(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/api/system/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    return res.json();
  },

  // Reports
  async generateReport(scanId: string): Promise<Report> {
    const res = await fetch(`${API_BASE}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanId }),
    });
    if (!res.ok) throw new Error("Failed to generate report");
    return res.json();
  },

  async listReports(): Promise<Report[]> {
    const res = await fetch(`${API_BASE}/api/reports`);
    if (!res.ok) throw new Error("Failed to fetch reports");
    return res.json();
  },

  async getReport(reportId: string): Promise<Report> {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}`);
    if (!res.ok) throw new Error("Report not found");
    return res.json();
  },

  getImageUrl(relativeUrl: string): string {
    if (!relativeUrl) return "";
    if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) {
      return relativeUrl;
    }
    return `${API_BASE}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}`;
  },
};
