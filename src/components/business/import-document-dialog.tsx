import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, FileText, Sparkles, UploadCloud, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractDocumentText, ACCEPTED_DOC_TYPES } from "@/lib/pdf-text";
import { extractBusinessProfile } from "@/lib/vkm/business-extract.functions";
import {
  BUSINESS_FIELDS,
  type BusinessFieldKey,
  type ExtractedBusiness,
} from "@/lib/vkm/business-fields";

const LABEL = Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.key, f.label])) as Record<
  BusinessFieldKey,
  string
>;

type Stage = "pick" | "reading" | "review";

/**
 * Upload a business document (PDF / text) → AI extracts profile fields → owner
 * reviews and picks which to apply. The parent decides what "apply" does (fill
 * a form, or save straight to business_brains) via `onApply`.
 */
export function ImportDocumentDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (fields: ExtractedBusiness) => void | Promise<void>;
}) {
  const extract = useServerFn(extractBusinessProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [busyMsg, setBusyMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [fields, setFields] = useState<ExtractedBusiness>({});
  const [chosen, setChosen] = useState<Set<BusinessFieldKey>>(new Set());
  const [notes, setNotes] = useState("");
  const [applying, setApplying] = useState(false);

  function reset() {
    setStage("pick");
    setBusyMsg("");
    setFileName("");
    setFields({});
    setChosen(new Set());
    setNotes("");
    setApplying(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStage("reading");
    try {
      setBusyMsg("Reading your document…");
      const text = await extractDocumentText(file);

      setBusyMsg("Pulling out your business details…");
      const res = await extract({ data: { text } });

      if (!res.ok) {
        toast.error(res.error || "Couldn't extract details");
        setStage("pick");
        return;
      }
      const found = res.fields as ExtractedBusiness;
      const keys = Object.keys(found) as BusinessFieldKey[];
      setFields(found);
      setChosen(new Set(keys));
      setNotes(res.notes || "");
      setStage("review");
    } catch (err) {
      toast.error((err as Error).message || "Couldn't read that file");
      setStage("pick");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggle(key: BusinessFieldKey) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function apply() {
    const picked: ExtractedBusiness = {};
    for (const key of chosen) if (fields[key] != null) picked[key] = fields[key];
    if (!Object.keys(picked).length) {
      toast.error("Select at least one field to apply.");
      return;
    }
    setApplying(true);
    try {
      await onApply(picked);
      close(false);
    } catch (err) {
      toast.error((err as Error).message || "Couldn't apply");
      setApplying(false);
    }
  }

  const foundKeys = Object.keys(fields) as BusinessFieldKey[];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Auto-fill from a document
          </DialogTitle>
          <DialogDescription>
            Upload a business plan, profile or report (PDF or text). We'll read it and pull out your
            details for you to review — nothing is saved until you apply it.
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
            >
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Choose a file</span>
              <span className="text-xs text-muted-foreground">
                PDF, TXT, CSV or Markdown · max 15 MB
              </span>
            </button>
            <p className="text-[11px] text-muted-foreground">
              Your file is read in your browser — only the extracted text is sent for processing.
            </p>
          </div>
        )}

        {stage === "reading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">{busyMsg}</p>
            {fileName && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> {fileName}
              </p>
            )}
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found <span className="font-semibold text-foreground">{foundKeys.length}</span> detail
              {foundKeys.length === 1 ? "" : "s"}. Untick anything that looks wrong, then apply.
            </p>
            <div className="space-y-1.5">
              {foundKeys.map((key) => {
                const active = chosen.has(key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => toggle(key)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-muted/20 opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {LABEL[key]}
                      </span>
                      <span className="block break-words text-sm text-foreground">
                        {fields[key]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {notes && <p className="text-xs italic text-muted-foreground">Note: {notes}</p>}
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <Button
                variant="ghost"
                onClick={() => reset()}
                disabled={applying}
                className="rounded-xl"
              >
                Try another file
              </Button>
              <Button
                onClick={apply}
                disabled={applying}
                className="rounded-xl bg-gradient-navy shadow-vkm"
              >
                {applying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Apply {chosen.size} field{chosen.size === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_DOC_TYPES}
          onChange={onFile}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}
