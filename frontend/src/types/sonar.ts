export interface GPSCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeoSpatialBounds {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

export interface GeoSpatialResolution {
  x: number;
  y: number;
}

export interface GeoSpatialCenter {
  latitude: number;
  longitude: number;
}

export interface GeoSpatialMetadata {
  isGeoTIFF: boolean;
  hasGeodata: boolean;
  filename?: string;
  crs?: string | null;
  width?: number;
  height?: number;
  bandCount?: number;

  resolution?: GeoSpatialResolution | null;

  bounds?: GeoSpatialBounds | null;

  centerProjected?: {
    x: number;
    y: number;
  } | null;

  center?: GeoSpatialCenter | null;

  transform?: number[];

  error?: string;
}

export interface ImageMetadata {
  filename: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  width: number;
  height: number;
  format: string;

  captureDate?: string | null;
  gps?: GPSCoordinates | null;

  isGeoTIFF?: boolean;
  geospatial?: GeoSpatialMetadata | null;
}

export interface BoundingBoxPixel {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  pixel?: BoundingBoxPixel;
}

export interface DetectionGeoLocation {
  latitude: number;
  longitude: number;
  projectedX?: number;
  projectedY?: number;
}

export interface Detection {
  id: string;
  _id?: string;
  detectionIndex: number;
  scanId: string;
  filename?: string;
  classId: number;
  className: string;
  confidence: number;
  confidencePercent: number;
  isLowConfidence: boolean;
  boundingBox: BoundingBox;
  cropUrl?: string | null;
  createdAt?: string;
  geoLocation?: DetectionGeoLocation | null;
}

export interface AIAnalysis {
  objectIdentification: string;
  modelConfidence: string;
  sonarInterpretation: string;
  confidenceInterpretation: string;
  visualEvidence: string;
  operationalObservation: string;
  certaintyLevel: string;

  provider?: string;
  providerModel?: string;

  location?: GPSCoordinates | null;
  geospatial?: GeoSpatialMetadata | null;

  note?: string;
}

export interface Scan {
  scanId: string;
  filename: string;

  savedFilename?: string;

  imageUrl: string;
  annotatedImageUrl?: string | null;

  timestamp?: string;
  createdAt: string;

  metadata: ImageMetadata;

  location?: GPSCoordinates | null;

  isGeoTIFF?: boolean;
  geospatial?: GeoSpatialMetadata | null;

  modelVersion?: string;

  detectionCount: number;
  highestConfidence: number;

  detections: Detection[];

  aiProvider?: string | null;
  aiAnalysis?: AIAnalysis | null;

  status?: string;
  saved?: boolean;
}

export interface ModelClass {
  id: number;
  name: string;
}

export interface ModelMetrics {
  precision?: number;
  recall?: number;
  map50?: number;
  map50_95?: number;
  accuracy?: number;

  [key: string]: unknown;
}

export interface SystemStatus {
  backend?: boolean;

  yolo: {
    online: boolean;
    classesCount: number;
    weights?: string;
    [key: string]: unknown;
  };

  ai: {
    online: boolean;
    activeProvider?: string;
    geminiConfigured?: boolean;
    groqConfigured?: boolean;
    [key: string]: unknown;
  };

  database: {
    online: boolean;
    storageType?: string;
    latencyMs?: number | null;
    scansCount?: number;
    detectionsCount?: number;
    [key: string]: unknown;
  };

  [key: string]: unknown;
}

export interface DashboardStats {
  totalScans: number;
  objectsDetected: number;
  aiAnalyses: number;
  highConfidenceDetections: number;

  averageConfidence?: number;
  lowConfidenceDetections?: number;

  classDistribution: Record<string, number>;

  [key: string]: unknown;
}

/* ---------------------------------------------------------
   REPORT TYPES
--------------------------------------------------------- */

export interface ReportModelInfo {
  name: string;
  weights: string;
}

export interface Report {
  reportId: string;

  scanId?: string;

  title?: string;
  description?: string;

  filename?: string;

  createdAt?: string;
  updatedAt?: string;

  generatedAt: string;

  scan: Scan;

  modelInfo: ReportModelInfo;

  aiInterpretation: AIAnalysis;

  detections: Detection[];

  status?: string;
}