import { useState } from "react";
import { Download, FileText, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** True when the uploaded certificate is a PDF (vs. an image). */
export function isPdfCertificate(fileUrl: string, fileType?: string | null): boolean {
  if (fileType) return fileType.toLowerCase().includes("pdf");
  return /\.pdf(\?|#|$)/i.test(fileUrl ?? "");
}

/**
 * Downloads the certificate as a real file (not a navigation). Fetching as a
 * blob keeps the saved filename ours and avoids the browser simply opening the
 * PDF in a tab. Falls back to a direct link if the fetch is blocked by CORS.
 */
export async function downloadCertificate(fileUrl: string, filename: string): Promise<void> {
  try {
    const res = await fetch(fileUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  } catch {
    // CORS or network blocked the blob path — open it directly instead.
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

/**
 * Renders an issued certificate: a real preview of the uploaded file (image
 * inline, PDF in an embedded viewer) plus download / open-full actions.
 */
export function CertificateView({
  fileUrl,
  fileType,
  title,
  filename,
  className,
  compact = false,
}: {
  fileUrl: string;
  fileType?: string | null;
  title?: string | null;
  filename?: string;
  className?: string;
  compact?: boolean;
}) {
  const pdf = isPdfCertificate(fileUrl, fileType);
  const [busy, setBusy] = useState(false);
  const name = filename || `${(title || "certificate").replace(/[^\w.-]+/g, "_")}${pdf ? ".pdf" : ""}`;

  async function onDownload() {
    setBusy(true);
    try {
      await downloadCertificate(fileUrl, name);
      toast.success("Certificate downloaded");
    } catch (e) {
      toast.error("Download failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-2xl border-2 border-gold/40 bg-secondary/30 shadow-vkm">
        {pdf ? (
          <object data={`${fileUrl}#toolbar=0&navpanes=0`} type="application/pdf" className={cn("w-full bg-white", compact ? "h-[320px]" : "h-[520px]")}>
            {/* Fallback when the browser can't inline-render a PDF (common on mobile). */}
            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Your certificate is a PDF. Open or download it to view.</p>
              <Button variant="outline" className="rounded-xl" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Maximize2 className="h-4 w-4" /> Open certificate
                </a>
              </Button>
            </div>
          </object>
        ) : (
          <img src={fileUrl} alt={title || "Certificate"} className="w-full bg-white object-contain" loading="lazy" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onDownload} disabled={busy} className="rounded-xl bg-gradient-navy text-primary-foreground shadow-vkm hover:opacity-90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download certificate
        </Button>
        <Button variant="outline" className="rounded-xl" asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            <Maximize2 className="h-4 w-4" /> Open full size
          </a>
        </Button>
      </div>
    </div>
  );
}
