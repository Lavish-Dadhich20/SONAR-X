import React, { useEffect, useState } from "react";
import {
  Download,
  FileText,
  Printer,
} from "lucide-react";
import { Report, Scan } from "../types/sonar";
import { api } from "../services/api";
import { EmptyState } from "../components/common/EmptyState";
import jsPDF from "jspdf";

interface ReportsPageProps {
  initialScanId?: string | null;
  onNewScan: () => void;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const formatDate = (value: string | number | Date) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const getImageData = async (
  url: string
): Promise<{
  data: string;
  width: number;
  height: number;
} | null> => {
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const img = new Image();

          img.onload = () => resolve(img);
          img.onerror = () =>
            reject(new Error("Image could not be decoded."));

          img.src = objectUrl;
        }
      );

      const canvas = document.createElement("canvas");

      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;

      const context = canvas.getContext("2d");

      if (!context) {
        return null;
      }

      context.drawImage(image, 0, 0);

      return {
        data: canvas.toDataURL("image/jpeg", 0.88),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.warn(
      "Could not load report image:",
      url,
      error
    );

    return null;
  }
};

const drawFittedImage = (
  pdf: jsPDF,
  image: {
    data: string;
    width: number;
    height: number;
  },
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number
) => {
  if (!image.width || !image.height) {
    return;
  }

  const ratio = Math.min(
    maxWidth / image.width,
    maxHeight / image.height
  );

  const width = image.width * ratio;
  const height = image.height * ratio;

  const drawX =
    x + (maxWidth - width) / 2;

  const drawY =
    y + (maxHeight - height) / 2;

  pdf.addImage(
    image.data,
    "JPEG",
    drawX,
    drawY,
    width,
    height,
    undefined,
    "FAST"
  );
};

const drawWrapped = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 3.8,
  maxLines = 4
) => {
  const safeText = String(text || "—");

  const lines = pdf
    .splitTextToSize(
      safeText,
      maxWidth
    )
    .slice(0, maxLines) as string[];

  pdf.text(lines, x, y, {
    maxWidth,
  });

  return (
    y +
    lines.length * lineHeight
  );
};

const addBatchReportPage = async (
  pdf: jsPDF,
  report: Report
) => {
  const pageWidth = 210;
  const pageHeight = 297;

  const margin = 10;
  const contentWidth =
    pageWidth - margin * 2;

  let y = margin;

  /*
   * ---------------------------------------------------------
   * PAGE BACKGROUND
   * ---------------------------------------------------------
   */

  pdf.setFillColor(
    10,
    15,
    29
  );

  pdf.rect(
    0,
    0,
    pageWidth,
    pageHeight,
    "F"
  );

  pdf.setTextColor(
    255,
    255,
    255
  );

  /*
   * ---------------------------------------------------------
   * HEADER
   * ---------------------------------------------------------
   */

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(16);

  pdf.text(
    "SONAR-X",
    margin,
    y + 6
  );

  pdf.setFont(
    "courier",
    "bold"
  );

  pdf.setFontSize(7);

  pdf.setTextColor(
    34,
    211,
    238
  );

  pdf.text(
    "OFFICIAL REPORT",
    margin + 28,
    y + 5.5
  );

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(11);

  pdf.setTextColor(
    235,
    238,
    245
  );

  pdf.text(
    "ACOUSTIC TARGET ANALYSIS REPORT",
    margin,
    y + 13
  );

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(7.5);

  pdf.setTextColor(
    148,
    163,
    184
  );

  pdf.text(
    "Automated YOLO Object Localization & Neural Sonar Interpretation",
    margin,
    y + 18
  );

  pdf.setFont(
    "courier",
    "normal"
  );

  pdf.setFontSize(6.5);

  pdf.setTextColor(
    148,
    163,
    184
  );

  pdf.text(
    "REPORT ID",
    pageWidth - margin - 45,
    y + 4
  );

  pdf.setTextColor(
    255,
    255,
    255
  );

  pdf.setFont(
    "courier",
    "bold"
  );

  pdf.text(
    String(report.reportId),
    pageWidth - margin,
    y + 8.5,
    {
      align: "right",
    }
  );

  pdf.setFont(
    "courier",
    "normal"
  );

  pdf.setTextColor(
    148,
    163,
    184
  );

  pdf.text(
    "GENERATED AT",
    pageWidth - margin - 45,
    y + 14
  );

  pdf.setTextColor(
    203,
    213,
    225
  );

  pdf.text(
    formatDate(report.generatedAt),
    pageWidth - margin,
    y + 18.5,
    {
      align: "right",
    }
  );

  y += 24;

  pdf.setDrawColor(
    71,
    85,
    105
  );

  pdf.line(
    margin,
    y,
    pageWidth - margin,
    y
  );

  y += 7;

  /*
   * ---------------------------------------------------------
   * TELEMETRY
   * ---------------------------------------------------------
   */

  pdf.setFillColor(
    55,
    65,
    81
  );

  pdf.roundedRect(
    margin,
    y,
    contentWidth,
    24,
    3,
    3,
    "F"
  );

  const telemetry: Array<
    [string, string]
  > = [
    [
      "SCAN ID",
      report.scan.scanId,
    ],
    [
      "ORIGINAL FILE",
      report.scan.filename,
    ],
    [
      "DIMENSIONS",
      `${report.scan.metadata?.width ?? "—"} × ${
        report.scan.metadata?.height ?? "—"
      }`,
    ],
    [
      "GEOLOCATION",
      report.scan.location
        ? `${report.scan.location.latitude.toFixed(
            4
          )}°, ${report.scan.location.longitude.toFixed(
            4
          )}°`
        : "Not embedded",
    ],
  ];

  const telemetryWidth =
    contentWidth / 4;

  telemetry.forEach(
    ([label, value], index) => {
      const x =
        margin +
        index * telemetryWidth +
        3;

      pdf.setFont(
        "courier",
        "normal"
      );

      pdf.setFontSize(6);

      pdf.setTextColor(
        148,
        163,
        184
      );

      pdf.text(
        label,
        x,
        y + 6
      );

      pdf.setFont(
        "courier",
        "bold"
      );

      pdf.setFontSize(6.7);

      pdf.setTextColor(
        255,
        255,
        255
      );

      drawWrapped(
        pdf,
        value,
        x,
        y + 11,
        telemetryWidth - 6,
        3.4,
        3
      );
    }
  );

  y += 30;

  /*
   * ---------------------------------------------------------
   * ACOUSTIC IMAGE
   * ---------------------------------------------------------
   */

  pdf.setFont(
    "courier",
    "bold"
  );

  pdf.setFontSize(7.5);

  pdf.setTextColor(
    148,
    163,
    184
  );

  pdf.text(
    "1.0 ACOUSTIC IMAGERY EVIDENCE",
    margin,
    y
  );

  y += 3;

  const imageBoxHeight = 57;

  pdf.setFillColor(
    0,
    0,
    0
  );

  pdf.roundedRect(
    margin,
    y,
    contentWidth,
    imageBoxHeight,
    3,
    3,
    "F"
  );

  pdf.setDrawColor(
    71,
    85,
    105
  );

  pdf.roundedRect(
    margin,
    y,
    contentWidth,
    imageBoxHeight,
    3,
    3,
    "S"
  );

  const mainImageUrl =
    api.getImageUrl(
      report.scan.annotatedImageUrl ||
        report.scan.imageUrl
    );

  const mainImage =
    await getImageData(
      mainImageUrl
    );

  if (mainImage) {
    drawFittedImage(
      pdf,
      mainImage,
      margin + 2,
      y + 2,
      contentWidth - 4,
      imageBoxHeight - 4
    );
  } else {
    pdf.setFont(
      "courier",
      "normal"
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      148,
      163,
      184
    );

    pdf.text(
      "Acoustic image unavailable",
      pageWidth / 2,
      y +
        imageBoxHeight / 2,
      {
        align: "center",
      }
    );
  }

  y += imageBoxHeight + 7;

  /*
   * ---------------------------------------------------------
   * DETECTIONS
   * ---------------------------------------------------------
   */

  pdf.setFont(
    "courier",
    "bold"
  );

  pdf.setFontSize(7.5);

  pdf.setTextColor(
    148,
    163,
    184
  );

  pdf.text(
    `2.0 YOLO OBJECT DETECTIONS (${report.detections.length})`,
    margin,
    y
  );

  pdf.setFont(
    "courier",
    "normal"
  );

  pdf.setFontSize(6.2);

  pdf.setTextColor(
    34,
    211,
    238
  );

  pdf.text(
    `Model: ${report.modelInfo.name} (${report.modelInfo.weights})`,
    pageWidth - margin,
    y,
    {
      align: "right",
    }
  );

  y += 4;

  const tableX = margin;
  const tableW = contentWidth;
  const headerH = 7;
  const rowH = 13;

  const colX = [
    tableX,
    tableX + 13,
    tableX + 45,
    tableX + 82,
    tableX + 120,
    tableX + tableW,
  ];

  pdf.setFillColor(
    55,
    65,
    81
  );

  pdf.rect(
    tableX,
    y,
    tableW,
    headerH,
    "F"
  );

  pdf.setFont(
    "courier",
    "bold"
  );

  pdf.setFontSize(5.8);

  pdf.setTextColor(
    203,
    213,
    225
  );

  [
    "Ref",
    "Acoustic Crop",
    "Predicted Class",
    "Confidence",
    "Bounding Box",
  ].forEach(
    (header, index) => {
      pdf.text(
        header,
        colX[index] + 2,
        y + 4.5
      );
    }
  );

  y += headerH;

  if (
    report.detections.length ===
    0
  ) {
    pdf.setFillColor(
      31,
      41,
      55
    );

    pdf.rect(
      tableX,
      y,
      tableW,
      12,
      "F"
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      148,
      163,
      184
    );

    pdf.text(
      "Zero acoustic targets identified above threshold.",
      pageWidth / 2,
      y + 7,
      {
        align: "center",
      }
    );

    y += 12;
  } else {
    /*
     * Keep the batch report compact enough
     * for one A4 page.
     */
    for (
      const detection of report.detections.slice(
        0,
        4
      )
    ) {
      pdf.setFillColor(
        17,
        24,
        39
      );

      pdf.rect(
        tableX,
        y,
        tableW,
        rowH,
        "F"
      );

      pdf.setDrawColor(
        71,
        85,
        105
      );

      pdf.line(
        tableX,
        y + rowH,
        tableX + tableW,
        y + rowH
      );

      pdf.setFont(
        "courier",
        "bold"
      );

      pdf.setFontSize(6.3);

      pdf.setTextColor(
        255,
        255,
        255
      );

      pdf.text(
        String(detection.id),
        colX[0] + 2,
        y + 7
      );

      if (
        detection.cropUrl
      ) {
        const crop =
          await getImageData(
            api.getImageUrl(
              detection.cropUrl
            )
          );

        if (crop) {
          drawFittedImage(
            pdf,
            crop,
            colX[1] + 2,
            y + 1,
            27,
            rowH - 2
          );
        }
      }

      pdf.setFont(
        "courier",
        "bold"
      );

      pdf.setFontSize(6);

      pdf.setTextColor(
        34,
        211,
        238
      );

      pdf.text(
        String(
          detection.className
        )
          .replace(
            /_/g,
            " "
          )
          .toUpperCase(),
        colX[2] + 2,
        y + 7
      );

      pdf.setTextColor(
        255,
        255,
        255
      );

      pdf.text(
        `${detection.confidencePercent}%`,
        colX[3] + 2,
        y + 7
      );

      pdf.setTextColor(
        148,
        163,
        184
      );

      pdf.setFontSize(5.7);

      pdf.text(
        `[${detection.boundingBox.x}, ${detection.boundingBox.y}, ${detection.boundingBox.w}, ${detection.boundingBox.h}]`,
        colX[4] + 2,
        y + 7
      );

      y += rowH;
    }

    if (
      report.detections.length >
      4
    ) {
      pdf.setFont(
        "courier",
        "normal"
      );

      pdf.setFontSize(5.8);

      pdf.setTextColor(
        148,
        163,
        184
      );

      pdf.text(
        `+ ${
          report.detections.length - 4
        } additional detections`,
        margin,
        y + 4
      );

      y += 7;
    }
  }

  y += 4;

  /*
   * ---------------------------------------------------------
   * AI INTERPRETATION
   * ---------------------------------------------------------
   */

  if (
    report.aiInterpretation
  ) {
    pdf.setFont(
      "courier",
      "bold"
    );

    pdf.setFontSize(7.5);

    pdf.setTextColor(
      148,
      163,
      184
    );

    pdf.text(
      "3.0 NEURAL ACOUSTIC INTERPRETATION",
      margin,
      y
    );

    y += 4;

    const aiTop = y;
    const aiHeight = 48;

    pdf.setFillColor(
      31,
      41,
      55
    );

    pdf.roundedRect(
      margin,
      aiTop,
      contentWidth,
      aiHeight,
      3,
      3,
      "F"
    );

    pdf.setDrawColor(
      71,
      85,
      105
    );

    pdf.roundedRect(
      margin,
      aiTop,
      contentWidth,
      aiHeight,
      3,
      3,
      "S"
    );

    let aiY =
      aiTop + 7;

    pdf.setFont(
      "courier",
      "bold"
    );

    pdf.setFontSize(5.8);

    pdf.setTextColor(
      34,
      211,
      238
    );

    pdf.text(
      "OBJECT IDENTIFICATION & CONFIDENCE",
      margin + 4,
      aiY
    );

    aiY += 4;

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(7);

    pdf.setTextColor(
      255,
      255,
      255
    );

    aiY = drawWrapped(
      pdf,
      `${report.aiInterpretation.objectIdentification} — ${report.aiInterpretation.modelConfidence}`,
      margin + 4,
      aiY,
      contentWidth - 8,
      3.5,
      2
    );

    aiY += 2;

    pdf.setFont(
      "courier",
      "bold"
    );

    pdf.setFontSize(5.8);

    pdf.setTextColor(
      148,
      163,
      184
    );

    pdf.text(
      "SONAR ACOUSTIC INTERPRETATION",
      margin + 4,
      aiY
    );

    aiY += 4;

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(6.5);

    pdf.setTextColor(
      203,
      213,
      225
    );

    aiY = drawWrapped(
      pdf,
      report.aiInterpretation
        .sonarInterpretation,
      margin + 4,
      aiY,
      contentWidth - 8,
      3.3,
      3
    );

    aiY += 1;

    pdf.setFont(
      "courier",
      "bold"
    );

    pdf.setFontSize(5.8);

    pdf.setTextColor(
      148,
      163,
      184
    );

    pdf.text(
      "OPERATIONAL OBSERVATION",
      margin + 4,
      aiY
    );

    aiY += 4;

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(6.5);

    pdf.setTextColor(
      203,
      213,
      225
    );

    drawWrapped(
      pdf,
      report.aiInterpretation
        .operationalObservation,
      margin + 4,
      aiY,
      contentWidth - 8,
      3.3,
      2
    );

    y =
      aiTop +
      aiHeight +
      5;
  }

  /*
   * ---------------------------------------------------------
   * FOOTER
   * ---------------------------------------------------------
   */

  pdf.setDrawColor(
    71,
    85,
    105
  );

  pdf.line(
    margin,
    pageHeight - 16,
    pageWidth - margin,
    pageHeight - 16
  );

  pdf.setFont(
    "courier",
    "normal"
  );

  pdf.setFontSize(5.8);

  pdf.setTextColor(
    100,
    116,
    139
  );

  pdf.text(
    "SONAR-X HYDROGRAPHIC INTELLIGENCE ENGINE",
    margin,
    pageHeight - 10
  );

  pdf.text(
    `HASH: ${report.reportId}-VERIFIED`,
    margin,
    pageHeight - 6.5
  );

  pdf.setTextColor(
    34,
    197,
    94
  );

  pdf.text(
    "AUTHENTICATED INFERENCE REPORT",
    pageWidth - margin,
    pageHeight - 10,
    {
      align: "right",
    }
  );

  pdf.setTextColor(
    100,
    116,
    139
  );

  pdf.text(
    "ALL MEASUREMENTS SOURCED FROM ACTIVE SENSORS",
    pageWidth - margin,
    pageHeight - 6.5,
    {
      align: "right",
    }
  );
};

/*
 * =========================================================
 * VISIBLE REPORT DOCUMENT
 * =========================================================
 */

const ReportDocument: React.FC<{
  report: Report;
}> = ({ report }) => {
  return (
    <div
      id="sonar-x-report-print"
      className="p-10 rounded-2xl bg-[#0a0f1d] border border-sonar-border shadow-2xl text-sonar-text font-sans space-y-8 max-w-4xl mx-auto print:border-0 print:p-0 print:bg-white print:text-black"
    >
      {/* Header */}

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
          <div className="text-sonar-dim print:text-gray-500 text-[10px]">
            REPORT ID
          </div>

          <div className="font-bold text-white print:text-black">
            {report.reportId}
          </div>

          <div className="text-sonar-dim print:text-gray-500 text-[10px] mt-2">
            GENERATED AT
          </div>

          <div className="text-sonar-muted print:text-gray-700">
            {formatDate(
              report.generatedAt
            )}
          </div>
        </div>
      </div>

      {/* Telemetry */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-sonar-surface/80 border border-sonar-border print:border-gray-300 print:bg-gray-50 text-xs font-mono">
        <div className="min-w-0">
          <span className="text-sonar-dim print:text-gray-500 text-[10px] block mb-1">
            SCAN ID
          </span>

          <span className="text-white print:text-black font-bold block break-all leading-relaxed">
            {report.scan.scanId}
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-sonar-dim print:text-gray-500 text-[10px] block mb-1">
            ORIGINAL FILE
          </span>

          <span
            className="text-white print:text-black block break-all leading-relaxed"
            title={report.scan.filename}
          >
            {report.scan.filename}
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-sonar-dim print:text-gray-500 text-[10px] block mb-1">
            DIMENSIONS
          </span>

          <span className="text-white print:text-black block">
            {report.scan.metadata?.width ??
              "—"}{" "}
            ×{" "}
            {report.scan.metadata?.height ??
              "—"}
          </span>
        </div>

        <div className="min-w-0">
          <span className="text-sonar-dim print:text-gray-500 text-[10px] block mb-1">
            GEOLOCATION
          </span>

          <span className="text-sonar-cyan print:text-black block break-words">
            {report.scan.location
              ? `${report.scan.location.latitude.toFixed(
                  4
                )}°, ${report.scan.location.longitude.toFixed(
                  4
                )}°`
              : "Not embedded"}
          </span>
        </div>
      </div>

      {/* Acoustic Imagery */}

      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-sonar-dim print:text-gray-700 mb-3">
          1.0 ACOUSTIC IMAGERY EVIDENCE
        </h3>

        <div className="rounded-xl overflow-hidden border border-sonar-border print:border-gray-400 bg-black">
          <img
            src={api.getImageUrl(
              report.scan
                .annotatedImageUrl ||
                report.scan.imageUrl
            )}
            alt={report.scan.filename}
            className="w-full max-h-[85mm] print:max-h-[70mm] object-contain mx-auto"
          />
        </div>
      </div>

      {/* Detections */}

      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-sonar-dim print:text-gray-700 mb-3 flex items-center justify-between gap-4">
          <span>
            2.0 YOLO OBJECT DETECTIONS (
            {report.detections.length}
            )
          </span>

          <span className="text-[10px] font-normal text-sonar-cyan print:text-gray-700">
            Model:{" "}
            {report.modelInfo.name} (
            {report.modelInfo.weights})
          </span>
        </h3>

        {report.detections.length ===
        0 ? (
          <div className="p-4 rounded-lg bg-sonar-surface border border-sonar-border print:bg-gray-100 text-xs text-center text-sonar-muted print:text-gray-700">
            Zero acoustic targets identified above threshold.
          </div>
        ) : (
          <div className="rounded-lg border border-sonar-border print:border-gray-300 overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-sonar-surface print:bg-gray-200 text-sonar-dim print:text-gray-700 text-[10px] uppercase">
                <tr>
                  <th className="p-2">
                    Ref
                  </th>

                  <th className="p-2">
                    Acoustic Crop
                  </th>

                  <th className="p-2">
                    Predicted Class
                  </th>

                  <th className="p-2">
                    Model Confidence
                  </th>

                  <th className="p-2">
                    Bounding Box [X, Y, W, H]
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-sonar-border print:divide-gray-300">
                {report.detections.map(
                  (d) => (
                    <tr
                      key={d.id}
                      className="print:bg-white"
                    >
                      <td className="p-2 font-bold text-white print:text-black">
                        {d.id}
                      </td>

                      <td className="p-2">
                        {d.cropUrl ? (
                          <img
                            src={api.getImageUrl(
                              d.cropUrl
                            )}
                            alt={
                              d.className
                            }
                            className="w-12 h-12 object-cover rounded border border-sonar-border"
                          />
                        ) : (
                          <span className="text-sonar-dim">
                            N/A
                          </span>
                        )}
                      </td>

                      <td className="p-2 font-semibold uppercase text-sonar-cyan print:text-black">
                        {String(
                          d.className
                        ).replace(
                          /_/g,
                          " "
                        )}
                      </td>

                      <td className="p-2 font-bold text-white print:text-black">
                        {
                          d.confidencePercent
                        }
                        %
                      </td>

                      <td className="p-2 text-sonar-muted print:text-gray-600 text-[10px]">
                        [
                        {
                          d
                            .boundingBox
                            .x
                        }
                        ,{" "}
                        {
                          d
                            .boundingBox
                            .y
                        }
                        ,{" "}
                        {
                          d
                            .boundingBox
                            .w
                        }
                        ,{" "}
                        {
                          d
                            .boundingBox
                            .h
                        }
                        ]
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Interpretation */}

      {report.aiInterpretation && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-sonar-dim print:text-gray-700 mb-3 flex items-center justify-between gap-4">
            <span>
              3.0 NEURAL ACOUSTIC INTERPRETATION
            </span>

            <span className="text-[10px] text-sonar-cyan print:text-black font-normal">
              Provider:{" "}
              {
                report
                  .aiInterpretation
                  .provider
              }{" "}
              (
              {
                report
                  .aiInterpretation
                  .providerModel
              }
              )
            </span>
          </h3>

          <div className="p-5 rounded-xl bg-sonar-surface/70 border border-sonar-border print:border-gray-300 print:bg-gray-50 space-y-3 text-xs leading-relaxed">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-cyan print:text-gray-800 font-bold block mb-1">
                OBJECT IDENTIFICATION & CONFIDENCE
              </span>

              <p className="text-white print:text-black font-semibold">
                {
                  report
                    .aiInterpretation
                    .objectIdentification
                }{" "}
                —{" "}
                {
                  report
                    .aiInterpretation
                    .modelConfidence
                }
              </p>
            </div>

            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-dim print:text-gray-600 block mb-1">
                SONAR ACOUSTIC INTERPRETATION
              </span>

              <p className="text-sonar-text print:text-gray-800">
                {
                  report
                    .aiInterpretation
                    .sonarInterpretation
                }
              </p>
            </div>

            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-dim print:text-gray-600 block mb-1">
                CONFIDENCE & EVIDENCE
              </span>

              <p className="text-sonar-muted print:text-gray-700">
                {
                  report
                    .aiInterpretation
                    .confidenceInterpretation
                }{" "}
                {
                  report
                    .aiInterpretation
                    .visualEvidence
                }
              </p>
            </div>

            <div className="pt-2 border-t border-sonar-border print:border-gray-300">
              <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-cyan print:text-gray-800 font-bold block mb-1">
                OPERATIONAL OBSERVATION
              </span>

              <p className="text-sonar-text print:text-black font-medium">
                {
                  report
                    .aiInterpretation
                    .operationalObservation
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}

      <div className="pt-6 border-t border-sonar-border print:border-gray-300 flex items-center justify-between text-[11px] font-mono text-sonar-dim print:text-gray-500">
        <div>
          <span>
            SONAR-X HYDROGRAPHIC INTELLIGENCE ENGINE
          </span>

          <span className="block text-[10px]">
            HASH:{" "}
            {report.reportId}
            -VERIFIED
          </span>
        </div>

        <div className="text-right">
          <span className="text-emerald-400 print:text-black font-semibold">
            AUTHENTICATED INFERENCE REPORT
          </span>

          <span className="block text-[10px]">
            ALL MEASUREMENTS SOURCED FROM ACTIVE SENSORS
          </span>
        </div>
      </div>
    </div>
  );
};

/*
 * =========================================================
 * REPORTS PAGE
 * =========================================================
 */

export const ReportsPage: React.FC<
  ReportsPageProps
> = ({
  initialScanId,
  onNewScan,
}) => {
  const [
    reports,
    setReports,
  ] = useState<Report[]>([]);

  const [
    availableScans,
    setAvailableScans,
  ] = useState<Scan[]>([]);

  const [
    selectedReport,
    setSelectedReport,
  ] = useState<Report | null>(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    generatingReport,
    setGeneratingReport,
  ] = useState(false);

  const [
    batchGenerating,
    setBatchGenerating,
  ] = useState(false);

  const [
    batchSize,
    setBatchSize,
  ] = useState<10 | 50>(10);

  /*
   * ---------------------------------------------------------
   * LOAD REPORTS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [
          reps,
          scans,
        ] = await Promise.all([
          api
            .listReports()
            .catch(
              () => [] as Report[]
            ),

          api
            .listScans()
            .catch(
              () => [] as Scan[]
            ),
        ]);

        if (cancelled) {
          return;
        }

        setReports(reps);
        setAvailableScans(scans);

        if (initialScanId) {
          const existing =
            reps.find(
              (report) =>
                report.scanId ===
                initialScanId
            );

          if (existing) {
            setSelectedReport(
              existing
            );
          } else {
            setSelectedReport(
              null
            );

            setGeneratingReport(
              true
            );

            try {
              const newReport =
                await api.generateReport(
                  initialScanId
                );

              if (!cancelled) {
                setSelectedReport(
                  newReport
                );

                setReports(
                  (prev) => [
                    newReport,
                    ...prev.filter(
                      (r) =>
                        r.reportId !==
                        newReport.reportId
                    ),
                  ]
                );
              }
            } catch (error) {
              if (!cancelled) {
                alert(
                  error instanceof Error
                    ? error.message
                    : "Failed to generate report"
                );
              }
            } finally {
              if (!cancelled) {
                setGeneratingReport(
                  false
                );
              }
            }
          }
        } else if (
          reps.length > 0
        ) {
          setSelectedReport(
            reps[0]
          );
        }
      } catch (error) {
        console.error(
          "Failed to load reports:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [initialScanId]);

  /*
   * ---------------------------------------------------------
   * GENERATE SINGLE REPORT
   * ---------------------------------------------------------
   */

  const handleGenerateReport =
    async (scanId: string) => {
      if (
        !scanId ||
        generatingReport
      ) {
        return;
      }

      setGeneratingReport(
        true
      );

      try {
        const newReport =
          await api.generateReport(
            scanId
          );

        setSelectedReport(
          newReport
        );

        setReports(
          (prev) => [
            newReport,
            ...prev.filter(
              (r) =>
                r.reportId !==
                newReport.reportId
            ),
          ]
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to generate report"
        );
      } finally {
        setGeneratingReport(
          false
        );
      }
    };

  /*
   * ---------------------------------------------------------
   * SINGLE REPORT PRINT
   * ---------------------------------------------------------
   */

  const handlePrint = () => {
    if (!selectedReport) {
      return;
    }

    const existing =
      document.getElementById(
        "sonar-x-print-style"
      );

    existing?.remove();

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "sonar-x-print-style";

    style.textContent = `
      @page {
        size: A4;
        margin: 10mm;
      }

      @media print {
        html,
        body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        body * {
          visibility: hidden !important;
        }

        #sonar-x-report-print,
        #sonar-x-report-print * {
          visibility: visible !important;
        }

        #sonar-x-report-print {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;

          width: 100% !important;
          max-width: none !important;

          margin: 0 !important;
          padding: 0 !important;

          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;

          background: #ffffff !important;
          color: #000000 !important;

          zoom: 0.82 !important;
        }

        #sonar-x-report-print > * {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        #sonar-x-report-print img {
          max-height: 62mm !important;
          width: auto !important;
          max-width: 100% !important;
        }

        #sonar-x-report-print th,
        #sonar-x-report-print td {
          padding: 4px !important;
          font-size: 8px !important;
          line-height: 1.15 !important;
        }

        #sonar-x-report-print h1 {
          font-size: 16px !important;
        }

        #sonar-x-report-print h3 {
          margin-top: 4px !important;
          margin-bottom: 4px !important;
        }

        #sonar-x-report-print p {
          line-height: 1.15 !important;
        }
      }
    `;

    document.head.appendChild(
      style
    );

    const cleanup = () => {
      document
        .getElementById(
          "sonar-x-print-style"
        )
        ?.remove();

      window.removeEventListener(
        "afterprint",
        cleanup
      );
    };

    window.addEventListener(
      "afterprint",
      cleanup
    );

    window.print();

    window.setTimeout(
      cleanup,
      2000
    );
  };

  /*
   * ---------------------------------------------------------
   * BATCH PDF
   *
   * IMPORTANT:
   * This does NOT modify selectedReport.
   * This does NOT modify the visible DOM.
   * This does NOT use html2canvas.
   * ---------------------------------------------------------
   */

  const handleBatchPDF = async (
    count: 10 | 50
  ) => {
    if (
      batchGenerating ||
      reports.length === 0
    ) {
      return;
    }

    const batchReports =
      reports.slice(
        0,
        count
      );

    if (
      batchReports.length ===
      0
    ) {
      alert(
        "No reports available for batch export."
      );

      return;
    }

    setBatchSize(
      count
    );

    setBatchGenerating(
      true
    );

    try {
      const pdf =
        new jsPDF({
          orientation:
            "portrait",

          unit: "mm",

          format: "a4",

          compress: true,
        });

      for (
        let index = 0;
        index <
        batchReports.length;
        index += 1
      ) {
        if (index > 0) {
          pdf.addPage();
        }

        await addBatchReportPage(
          pdf,
          batchReports[index]
        );

        /*
         * Give the browser a chance to
         * repaint between reports.
         */
        await wait(0);
      }

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      pdf.save(
        `SONAR-X_Batch_${batchReports.length}_Reports_${date}.pdf`
      );
    } catch (error) {
      console.error(
        "Batch PDF generation failed:",
        error
      );

      alert(
        "Failed to generate the batch PDF. Please check the browser console for details."
      );
    } finally {
      setBatchGenerating(
        false
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * JSON EXPORT
   * ---------------------------------------------------------
   */

  const handleExportJSON =
    () => {
      if (!selectedReport) {
        return;
      }

      const blob =
        new Blob(
          [
            JSON.stringify(
              selectedReport,
              null,
              2
            ),
          ],
          {
            type: "application/json",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href = url;

      anchor.download =
        `SONAR-X_Report_${selectedReport.reportId}.json`;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(
        url
      );
    };

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">

      {/* PAGE HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">

        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Analysis Reports
          </h2>

          <p className="text-xs text-sonar-muted mt-1">
            Certified technical inspection reports with acoustic evidence and AI interpretation.
          </p>
        </div>

        {availableScans.length >
          0 && (
          <div className="flex items-center gap-2">

            <select
              className="px-3 py-2 rounded-lg bg-sonar-card border border-sonar-border text-xs text-white font-mono focus:outline-none focus:border-sonar-cyan"
              onChange={(event) => {
                if (
                  event.target
                    .value
                ) {
                  void handleGenerateReport(
                    event.target
                      .value
                  );
                }
              }}
              defaultValue=""
              disabled={
                generatingReport
              }
            >
              <option
                value=""
                disabled
              >
                Generate Report for Scan...
              </option>

              {availableScans.map(
                (scan) => (
                  <option
                    key={
                      scan.scanId
                    }
                    value={
                      scan.scanId
                    }
                  >
                    {
                      scan.scanId
                    }{" "}
                    (
                    {
                      scan.filename
                    }
                    )
                  </option>
                )
              )}
            </select>

          </div>
        )}
      </div>

      {/* LOADING */}

      {loading ? (
        <div className="rounded-xl border border-sonar-border bg-sonar-surface p-8 text-center text-sonar-muted font-mono text-xs print:hidden">
          Loading reports...
        </div>
      ) : reports.length ===
          0 &&
        !selectedReport ? (
        <EmptyState
          title="No reports generated yet."
          description="Reports compile full acoustic telemetry, bounding box crops, and AI interpretations into certified technical documentation."
          actionText="Start New Scan"
          onAction={
            onNewScan
          }
          icon={FileText}
        />
      ) : selectedReport ? (
        <div className="space-y-6">

          {/* REPORT CONTROLS */}

          <div className="p-4 rounded-xl bg-sonar-surface border border-sonar-border text-xs print:hidden space-y-4">

            {/* TOP ACTIONS */}

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              <div>
                <div className="font-mono text-sonar-dim mb-1">
                  SELECT REPORT
                </div>

                <div className="font-mono font-bold text-white">
                  {
                    selectedReport.reportId
                  }
                </div>

                <div className="text-[10px] text-sonar-muted mt-1">
                  {
                    selectedReport.scanId
                  }
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">

                {/* SINGLE PRINT */}

                <button
                  type="button"
                  onClick={
                    handlePrint
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sonar-card hover:bg-sonar-border text-white border border-sonar-border transition font-medium"
                >
                  <Printer className="w-3.5 h-3.5" />

                  <span>
                    Print / Save PDF
                  </span>
                </button>

                {/* JSON */}

                <button
                  type="button"
                  onClick={
                    handleExportJSON
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 font-bold transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />

                  <span>
                    Export JSON
                  </span>
                </button>

              </div>
            </div>

            {/* REPORT SELECTOR */}

            <div className="rounded-lg border border-sonar-border bg-sonar-card overflow-hidden">

              <div className="px-3 py-2 border-b border-sonar-border flex items-center justify-between">

                <span className="font-mono text-[10px] uppercase tracking-wider text-sonar-dim">
                  Available Reports
                </span>

                <span className="font-mono text-[10px] text-sonar-cyan">
                  {
                    reports.length
                  }{" "}
                  REPORT
                  {reports.length ===
                  1
                    ? ""
                    : "S"}
                </span>

              </div>

              <div className="max-h-56 overflow-y-auto p-2 space-y-1">

                {reports.map(
                  (report) => {
                    const selected =
                      selectedReport.reportId ===
                      report.reportId;

                    return (
                      <button
                        key={
                          report.reportId
                        }
                        type="button"
                        onClick={() =>
                          setSelectedReport(
                            report
                          )
                        }
                        className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                          selected
                            ? "bg-sonar-cyan/10 border-sonar-cyan text-sonar-cyan"
                            : "bg-sonar-bg/40 border-sonar-border text-white hover:bg-sonar-border"
                        }`}
                      >

                        <div className="flex items-center justify-between gap-3">

                          <span className="font-mono font-bold truncate">
                            {
                              report.reportId
                            }
                          </span>

                          {selected && (
                            <span className="text-[9px] font-mono font-bold shrink-0">
                              SELECTED
                            </span>
                          )}

                        </div>

                        <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-sonar-muted">

                          <span className="truncate">
                            {
                              report.scanId
                            }
                          </span>

                          <span className="shrink-0">
                            {
                              report
                                .detections
                                .length
                            }{" "}
                            detections
                          </span>

                        </div>

                      </button>
                    );
                  }
                )}

              </div>
            </div>

            {/* BATCH PDF */}

            <div className="border-t border-sonar-border pt-4">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                <div>
                  <div className="font-mono text-sonar-dim">
                    BATCH PDF EXPORT
                  </div>

                  <div className="text-[10px] text-sonar-muted mt-1">
                    Creates one PDF with one report per A4 page.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">

                  {/* 10 */}

                  <button
                    type="button"
                    onClick={() =>
                      void handleBatchPDF(
                        10
                      )
                    }
                    disabled={
                      batchGenerating ||
                      reports.length ===
                        0
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                      batchSize ===
                      10
                        ? "bg-sonar-cyan text-sonar-bg border-sonar-cyan"
                        : "bg-sonar-card hover:bg-sonar-border text-white border-sonar-border"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />

                    <span>
                      10 Reports PDF
                    </span>
                  </button>

                  {/* 50 */}

                  <button
                    type="button"
                    onClick={() =>
                      void handleBatchPDF(
                        50
                      )
                    }
                    disabled={
                      batchGenerating ||
                      reports.length ===
                        0
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                      batchSize ===
                      50
                        ? "bg-sonar-cyan text-sonar-bg border-sonar-cyan"
                        : "bg-sonar-card hover:bg-sonar-border text-white border-sonar-border"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />

                    <span>
                      50 Reports PDF
                    </span>
                  </button>

                </div>
              </div>

              {batchGenerating && (
                <div className="mt-3 rounded-lg border border-sonar-cyan/30 bg-sonar-cyan/5 px-3 py-2 text-[10px] font-mono text-sonar-cyan">
                  Generating{" "}
                  {
                    batchSize
                  }
                  -report PDF. The visible report and sidebar are not changed.
                </div>
              )}

            </div>

          </div>

          {/* VISIBLE SELECTED REPORT */}

          <ReportDocument
            report={
              selectedReport
            }
          />

        </div>
      ) : null}
    </div>
  );
};