"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileType2,
  File as FileIcon,
} from "lucide-react";

interface ImagePreviewModalProps {
  open: boolean;
  imageUrl: string | null;
  title?: string;
  /** Original file name (used for type detection when the URL has no extension) */
  fileName?: string | null;
  onClose: () => void;
}

type PreviewKind = "image" | "pdf" | "text" | "sheet" | "docx" | "office" | "unknown";

const TEXT_EXTENSIONS = ["txt", "log", "md", "json", "xml", "html", "htm", "rtf"];
const SHEET_EXTENSIONS = ["xlsx", "xlsm", "xlsb", "xls", "csv", "tsv", "ods"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "heic"];
const OFFICE_EXTENSIONS = ["doc", "ppt", "pptx", "odt", "odp"];

const MAX_TEXT_CHARS = 400_000;
const MAX_SHEET_ROWS = 1_000;
const MAX_SHEET_COLS = 60;

function getExtension(value: string | null | undefined): string {
  if (!value) return "";
  // Drop query string / hash first (signed URLs), then take the last path segment.
  const withoutQuery = value.split("?")[0].split("#")[0];
  const lastSegment = withoutQuery.split("/").pop() || "";
  const match = lastSegment.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function resolveKind(fileUrl: string | null, fileName?: string | null, title?: string): PreviewKind {
  // File name wins over the URL: S3 keys can be renamed/unsuffixed, the name is authoritative.
  const ext = getExtension(fileName) || getExtension(title) || getExtension(fileUrl);

  if (!ext) {
    if (fileUrl?.startsWith("data:application/pdf")) return "pdf";
    if (fileUrl?.startsWith("data:text/")) return "text";
    if (fileUrl?.startsWith("data:image/")) return "image";
    return "unknown";
  }

  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (SHEET_EXTENSIONS.includes(ext)) return "sheet";
  if (TEXT_EXTENSIONS.includes(ext)) return "text";
  if (OFFICE_EXTENSIONS.includes(ext)) return "office";
  return "unknown";
}

function officeViewerUrl(fileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

function extractDocxText(xml: string): string[] {
  const paragraphs: string[] = [];

  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (!doc.querySelector("parsererror")) {
      const nodes = doc.getElementsByTagName("w:p");
      for (let i = 0; i < nodes.length; i += 1) {
        const runs = nodes[i].getElementsByTagName("w:t");
        let line = "";
        for (let j = 0; j < runs.length; j += 1) {
          line += runs[j].textContent ?? "";
        }
        paragraphs.push(line);
      }
      return paragraphs;
    }
  } catch {
    // fall through to the regex based extraction
  }

  const blocks = xml.split(/<w:p[ >]/).slice(1);
  for (const block of blocks) {
    const texts = block.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    paragraphs.push(texts.map((t) => t.replace(/<[^>]+>/g, "")).join(""));
  }
  return paragraphs;
}

function decodeText(buffer: ArrayBuffer): string {
  const decoded = new TextDecoder("utf-8").decode(buffer);
  return decoded.length > MAX_TEXT_CHARS
    ? `${decoded.slice(0, MAX_TEXT_CHARS)}\n\n... file truncated for preview, download to see the full content.`
    : decoded;
}

export default function ImagePreviewModal({
  open,
  imageUrl,
  title = "Preview",
  fileName,
  onClose,
}: ImagePreviewModalProps) {
  const kind = useMemo(() => resolveKind(imageUrl, fileName, title), [imageUrl, fileName, title]);
  // Unknown/extension-less files keep the image viewer as before and fall back to the
  // download panel only if the browser cannot actually render them.
  const isImage = kind === "image" || kind === "unknown";
  const displayName = fileName || title || "Document";

  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docParagraphs, setDocParagraphs] = useState<string[] | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [sheetTruncated, setSheetTruncated] = useState(false);
  const workbookRef = useRef<Record<string, string[][]>>({});
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !imageUrl) return;

    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setScale(1);
    setIsLoading(true);
    setLoadError(null);
    setTextContent(null);
    setDocParagraphs(null);
    setSheetNames([]);
    setActiveSheet("");
    setSheetRows([]);
    setSheetTruncated(false);
    workbookRef.current = {};
  }, [open, imageUrl]);

  // Text / spreadsheet / docx files are fetched and rendered inline; an <img> or a raw
  // iframe cannot display them.
  useEffect(() => {
    if (!open || !imageUrl) return;
    if (kind !== "text" && kind !== "sheet" && kind !== "docx") return;

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        if (kind === "text") {
          setTextContent(decodeText(buffer));
        } else if (kind === "sheet") {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "array" });
          if (cancelled) return;

          const parsed: Record<string, string[][]> = {};
          let truncated = false;

          workbook.SheetNames.forEach((name) => {
            const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], {
              header: 1,
              defval: "",
              raw: false,
              blankrows: false,
            });
            if (rows.length > MAX_SHEET_ROWS) truncated = true;
            parsed[name] = rows.slice(0, MAX_SHEET_ROWS).map((row) => {
              if (row.length > MAX_SHEET_COLS) truncated = true;
              return row.slice(0, MAX_SHEET_COLS).map((cell) => String(cell ?? ""));
            });
          });

          workbookRef.current = parsed;
          setSheetNames(workbook.SheetNames);
          setActiveSheet(workbook.SheetNames[0] || "");
          setSheetRows(parsed[workbook.SheetNames[0]] || []);
          setSheetTruncated(truncated);
        } else {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(buffer);
          const documentXml = await zip.file("word/document.xml")?.async("string");
          if (cancelled) return;
          if (!documentXml) throw new Error("Unsupported Word document");
          setDocParagraphs(extractDocxText(documentXml));
        }

        if (!cancelled) setIsLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error("Preview failed:", error);
        setIsLoading(false);
        setLoadError(
          kind === "sheet"
            ? "This spreadsheet could not be read for preview."
            : kind === "docx"
              ? "This document could not be read for preview."
              : "This file could not be read for preview.",
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, imageUrl, kind]);

  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEsc);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !isImage) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.5 : 0.5;
        setScale((prev) => Math.min(Math.max(0.5, prev + delta), 10));
      }
    };

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [open, isImage]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 10));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleSheetChange = (name: string) => {
    setActiveSheet(name);
    setSheetRows(workbookRef.current[name] || []);
  };

  const handleOpenInNewTab = useCallback(() => {
    if (!imageUrl) return;
    window.open(imageUrl, "_blank", "noopener,noreferrer");
  }, [imageUrl]);

  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Keep the real file name when we have one, otherwise append the URL extension.
      link.download = getExtension(displayName)
        ? displayName
        : `${displayName}.${getExtension(imageUrl) || "file"}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  }, [imageUrl, displayName]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isImage || scale <= 1.2) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isImage || !isDragging || scale <= 1.2) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!open || !imageUrl) return null;

  const KindIcon =
    kind === "sheet" ? FileSpreadsheet : kind === "docx" || kind === "office" ? FileType2 : kind === "text" ? FileText : FileIcon;

  const fallbackPanel = (message: string, hint?: string) => (
    <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-8 py-10 text-center">
      <KindIcon className="h-12 w-12 text-white/60" />
      <div>
        <p className="text-base font-medium text-white break-all">{displayName}</p>
        <p className="mt-2 text-sm text-white/60">{message}</p>
        {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        <button
          onClick={handleOpenInNewTab}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loadError) {
      return fallbackPanel(loadError, "You can still download the file or open it in a new tab.");
    }

    if (kind === "pdf") {
      return (
        <iframe
          src={imageUrl}
          title={displayName}
          className="h-[82vh] w-[92vw] max-w-[1200px] rounded-lg border border-white/10 bg-white"
          onLoad={() => setIsLoading(false)}
        />
      );
    }

    if (kind === "office") {
      return (
        <iframe
          src={officeViewerUrl(imageUrl)}
          title={displayName}
          className="h-[82vh] w-[92vw] max-w-[1200px] rounded-lg border border-white/10 bg-white"
          onLoad={() => setIsLoading(false)}
        />
      );
    }

    if (kind === "text") {
      if (textContent === null) return null;
      return (
        <div className="h-[82vh] w-[92vw] max-w-[1200px] overflow-auto rounded-lg border border-white/10 bg-[#0F1419] p-6">
          <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gray-200">
            {textContent || "This file is empty."}
          </pre>
        </div>
      );
    }

    if (kind === "docx") {
      if (docParagraphs === null) return null;
      const hasContent = docParagraphs.some((line) => line.trim().length > 0);
      return (
        <div className="h-[82vh] w-[92vw] max-w-[1200px] overflow-auto rounded-lg border border-white/10 bg-white p-10">
          {hasContent ? (
            <div className="mx-auto max-w-[820px] space-y-3 text-[15px] leading-relaxed text-gray-900">
              {docParagraphs.map((line, index) =>
                line.trim() ? <p key={index}>{line}</p> : <div key={index} className="h-3" />,
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-500">
              This document has no readable text content (it may only contain images or shapes).
            </p>
          )}
        </div>
      );
    }

    if (kind === "sheet") {
      if (!sheetNames.length) return null;
      return (
        <div className="flex h-[82vh] w-[92vw] max-w-[1200px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0F1419]">
          {sheetNames.length > 1 && (
            <div className="flex flex-wrap gap-1 border-b border-white/10 bg-[#151B23] px-3 py-2">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSheetChange(name)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    name === activeSheet
                      ? "bg-purple-600 text-white"
                      : "text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-auto">
            {sheetRows.length === 0 ? (
              <p className="p-6 text-sm text-white/60">This sheet is empty.</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {sheetRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? "bg-[#151B23]" : "hover:bg-white/5"}>
                      <td className="sticky left-0 z-10 border border-white/10 bg-[#121720] px-3 py-1.5 text-right text-xs text-white/40">
                        {rowIndex + 1}
                      </td>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`whitespace-pre-wrap border border-white/10 px-3 py-1.5 align-top ${
                            rowIndex === 0 ? "font-semibold text-white" : "text-gray-200"
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {sheetTruncated && (
            <div className="border-t border-white/10 bg-[#151B23] px-4 py-2 text-xs text-white/50">
              Large file - preview limited to the first {MAX_SHEET_ROWS} rows and {MAX_SHEET_COLS} columns. Download the
              file to see everything.
            </div>
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <img
          ref={imageRef}
          src={imageUrl}
          alt={displayName}
          className="h-full w-full object-contain select-none transition-opacity duration-300"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: "center center",
            opacity: isLoading ? 0 : 1,
          }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setLoadError(
              kind === "image"
                ? "This image could not be loaded."
                : "Preview is not available for this file type.",
            );
          }}
          draggable={false}
        />
      );
    }

    return fallbackPanel("Preview is not supported for this file type.");
  };

  const showSpinner = isLoading && !loadError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="relative w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-linear-to-b from-black/80 to-transparent">
          <h2 id="modal-title" className="text-lg font-semibold text-white truncate max-w-md">
            {displayName}
          </h2>
          <div className="flex items-center gap-1">
            {!isImage && (
              <>
                <button
                  onClick={handleOpenInNewTab}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                  aria-label="Open in new tab"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                  aria-label="Download file"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isImage && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-white text-sm font-medium min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 10}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <button
              onClick={handleRotate}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
              aria-label="Rotate"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
              aria-label="Reset view"
              title="Reset view"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <button
              onClick={handleDownload}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
              aria-label="Download image"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        )}

        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center p-10 mb-10 overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isImage && scale > 1.2 ? (isDragging ? "grabbing" : "grab") : "default",
          }}
        >
          {showSpinner && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {renderContent()}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-white/60 text-xs">
          {isImage ? (
            <>
              Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded">ESC</kbd> to close - Hold{" "}
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Ctrl</kbd> + scroll to zoom
            </>
          ) : (
            <>
              Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded">ESC</kbd> to close
            </>
          )}
        </div>
      </div>
    </div>
  );
}
