import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
  startOfToday,
  subDays,
} from "date-fns";
import { toPng, toJpeg } from "html-to-image";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Flame,
  CheckCircle2,
  Footprints,
  Trophy,
  Loader2,
  Droplets,
  Dumbbell,
  AlertTriangle,
  Layers3,
  ChevronRight,
  ChevronLeft,
  Search,
  LayoutGrid,
  List as ListIcon,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  CalendarDays,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { AvatarBadge } from "@/components/vkm/avatar-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CONFIG,
  HABITS,
  START_DATE,
  useParticipantHabits,
} from "@/components/habits/habit-tracker";
import { HabitGrid } from "@/components/habits/habit-grid";
import { useParticipantsOverview, type ParticipantRow } from "@/components/coach/coach-data";

const NO_BATCH = "__none";
const VIEW_KEY = "vkm.habits.view";
type Sort = "name" | "points" | "progress";

function batchNum(name: string): number | null {
  const m = name.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

type BatchGroup = { key: string; name: string; rows: ParticipantRow[] };

export function ParticipantHabitsViewer({ eyebrow = "Coach" }: { eyebrow?: string }) {
  const { rows, loading } = useParticipantsOverview();
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">(() =>
    typeof window === "undefined" ? "list" : (localStorage.getItem(VIEW_KEY) as "grid" | "list") || "list",
  );
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [onlyRisk, setOnlyRisk] = useState(false);

  function setViewPersist(v: "grid" | "list") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }

  const groups = useMemo<BatchGroup[]>(() => {
    const m = new Map<string, BatchGroup>();
    for (const p of rows) {
      const key = p.batchId ?? NO_BATCH;
      if (!m.has(key)) m.set(key, { key, name: p.batchName ?? "Unassigned", rows: [] });
      m.get(key)!.rows.push(p);
    }
    return [...m.values()].sort((a, b) => {
      if (a.key === NO_BATCH) return 1;
      if (b.key === NO_BATCH) return -1;
      const na = batchNum(a.name);
      const nb = batchNum(b.name);
      if (na != null && nb != null) return nb - na;
      return a.name.localeCompare(b.name);
    });
  }, [rows]);

  const activeBatch = groups.find((g) => g.key === batchKey) ?? null;
  const selectedPerson = rows.find((p) => p.id === userId) ?? null;

  // Per-day habit snapshot for the batch (list view "6 rounds").
  // Selection is a calendar date (always defaults to today) — each participant's
  // program day_no is derived from their own start date for that calendar day.
  const activeIds = useMemo(() => (activeBatch ? activeBatch.rows.map((r) => r.id) : []), [activeBatch]);
  const { doneFor } = useBatchDayHabits(activeIds);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfToday());
  const isToday = isSameDay(selectedDate, startOfToday());
  const dateLabel = format(selectedDate, "d MMM yyyy");
  const dateSlug = format(selectedDate, "yyyy-MM-dd");

  const calendarFrom = useMemo(() => {
    // Earliest enrollment start in this batch (fall back to cohort anchor).
    let earliest: Date | null = null;
    for (const p of activeBatch?.rows ?? []) {
      if (p.startedAt && (earliest == null || p.startedAt < earliest)) earliest = p.startedAt;
    }
    return startOfDay(earliest ?? START_DATE);
  }, [activeBatch]);
  const calendarTo = startOfToday();

  function dayNoFor(p: ParticipantRow): number | null {
    return programDayOnDate(p.startedAt, selectedDate);
  }
  function doneOnSelectedDate(p: ParticipantRow): Set<string> {
    const day = dayNoFor(p);
    return day == null ? EMPTY_SET : doneFor(p.id, day);
  }

  // Export the day's habit list as a downloaded image — client-side only, never
  // stored anywhere (html-to-image → data URL → download).
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  async function exportImage(fmt: "png" | "jpg") {
    const node = exportRef.current;
    if (!node) return;
    setExporting(true);
    try {
      const opts = { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true };
      const dataUrl =
        fmt === "jpg" ? await toJpeg(node, { ...opts, quality: 0.95 }) : await toPng(node, opts);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `habits-${(activeBatch?.name ?? "batch").replace(/\s+/g, "-")}-${dateSlug}.${fmt}`;
      a.click();
      toast.success(`Downloaded ${fmt.toUpperCase()}`);
    } catch (e) {
      toast.error("Couldn't export image", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  }

  const fileBase = `habits-${(activeBatch?.name ?? "batch").replace(/\s+/g, "-")}-${dateSlug}`;
  const rowData = () =>
    filtered.map((p) => {
      const done = doneOnSelectedDate(p);
      return { name: p.name, done, total: `${done.size}/${HABITS.length}` };
    });

  // Styled Excel (.xlsx) — bold navy header in the platform theme, Done cells
  // tinted green. Client-side only; never stored.
  async function exportSpreadsheet() {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(format(selectedDate, "d MMM"));
      ws.columns = [
        { header: "Name", key: "name", width: 26 },
        ...HABITS.map((h) => ({ header: h.name, key: h.id, width: 15 })),
        { header: "Completed", key: "total", width: 12 },
      ];
      const head = ws.getRow(1);
      head.height = 26;
      head.eachCell((c, col) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
        c.alignment = { vertical: "middle", horizontal: col === 1 ? "left" : "center", wrapText: true };
        c.border = { bottom: { style: "thin", color: { argb: "FFC9A227" } } };
      });
      rowData().forEach((r) => {
        const row = ws.addRow({
          name: r.name,
          ...Object.fromEntries(HABITS.map((h) => [h.id, r.done.has(h.id) ? "Done" : "Not done"])),
          total: r.total,
        });
        HABITS.forEach((h, i) => {
          const cell = row.getCell(i + 2);
          cell.alignment = { horizontal: "center" };
          if (r.done.has(h.id)) {
            cell.font = { color: { argb: "FF15803D" }, bold: true };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF7EE" } };
          } else {
            cell.font = { color: { argb: "FF9AA3AF" } };
          }
        });
        row.getCell(1).font = { bold: true };
        row.getCell(HABITS.length + 2).alignment = { horizontal: "center" };
      });
      ws.views = [{ state: "frozen", ySplit: 1 }];
      const buf = await wb.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `${fileBase}.xlsx`,
      );
      toast.success("Downloaded Excel");
    } catch (e) {
      toast.error("Couldn't export Excel", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  }

  // Themed PDF — navy title bar + gold accent, ✓ / ✗ per habit. (PDFs are static,
  // so no animation — but it's styled to match the app.) Client-side only.
  async function exportPdf() {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const mod = await import("jspdf-autotable");
      // v3 exports the fn as default AND patches jsPDF.prototype.autoTable as a
      // side-effect; the dynamic default isn't always callable, so resolve both.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const autoTable = (mod as any).default ?? (mod as any).autoTable;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runTable = (opts: any) =>
        typeof autoTable === "function"
          ? autoTable(doc, opts)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (doc as any).autoTable(opts);
      const pageW = doc.internal.pageSize.getWidth();
      // Title bar
      doc.setFillColor(11, 37, 69);
      doc.rect(0, 0, pageW, 54, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`${activeBatch?.name ?? "Batch"} · ${dateLabel}`, 40, 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(210, 214, 220);
      doc.text(`Habit completions — ${filtered.length} participants${isToday ? " · Today" : ""}`, 40, 44);
      doc.setTextColor(201, 162, 39);
      doc.setFont("helvetica", "bold");
      doc.text("VK MENTORSHIP", pageW - 40, 30, { align: "right" });

      runTable({
        startY: 66,
        head: [["Name", ...HABITS.map((h) => h.name), "Done"]],
        body: rowData().map((r) => [
          r.name,
          ...HABITS.map((h) => (r.done.has(h.id) ? "✓" : "✗")),
          r.total,
        ]),
        styles: { fontSize: 9, cellPadding: 6, halign: "center", valign: "middle" },
        headStyles: { fillColor: [11, 37, 69], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 150 } },
        alternateRowStyles: { fillColor: [248, 246, 240] },
        margin: { left: 40, right: 40 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index > 0 && data.column.index <= HABITS.length) {
            const on = data.cell.raw === "✓";
            data.cell.styles.textColor = on ? [21, 128, 61] : [180, 185, 195];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 12;
          }
        },
      });
      doc.save(`${fileBase}.pdf`);
      toast.success("Downloaded PDF");
    } catch (e) {
      toast.error("Couldn't export PDF", { description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const filtered = useMemo(() => {
    if (!activeBatch) return [];
    let r = activeBatch.rows;
    if (onlyRisk) r = r.filter((p) => p.atRisk);
    if (q.trim()) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    return [...r].sort((a, b) => {
      if (sort === "points") return b.points - a.points;
      if (sort === "progress") return b.weeksDone - a.weeksDone;
      return a.name.localeCompare(b.name);
    });
  }, [activeBatch, q, sort, onlyRisk]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Participant Habits"
        description="Browse by batch, then open any participant's live 90-day habit & step tracker."
        icon={Activity}
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading participants…
        </div>
      ) : rows.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No participants yet — they appear here once assigned to you.
          </p>
        </SectionCard>
      ) : selectedPerson ? (
        // ── Level 3: one participant's habit detail ──
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setUserId(null)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> {activeBatch?.name ?? "Participants"}
          </button>
          <HabitDetail key={selectedPerson.id} userId={selectedPerson.id} name={selectedPerson.name} />
        </div>
      ) : !activeBatch ? (
        // ── Level 1: batch cards ──
        <BatchPicker groups={groups} onPick={setBatchKey} />
      ) : (
        // ── Level 2: participants in the batch (grid / list) ──
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setBatchKey(null);
                setQ("");
                setOnlyRisk(false);
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Batches
            </Button>
            <div>
              <h2 className="text-base font-semibold text-foreground">{activeBatch.name}</h2>
              <p className="text-[11px] text-muted-foreground">{activeBatch.rows.length} participants</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  className="h-9 w-36 rounded-full pl-8"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger className="h-9 w-32 rounded-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="points">Points</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setOnlyRisk((v) => !v)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  onlyRisk
                    ? "border-transparent bg-destructive/15 text-destructive"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> At risk
              </button>
              <div className="flex rounded-full border border-border p-0.5">
                <ViewBtn active={view === "grid"} onClick={() => setViewPersist("grid")} label="Grid">
                  <LayoutGrid className="h-4 w-4" />
                </ViewBtn>
                <ViewBtn active={view === "list"} onClick={() => setViewPersist("list")} label="List">
                  <ListIcon className="h-4 w-4" />
                </ViewBtn>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <SectionCard>
              <p className="py-10 text-center text-sm text-muted-foreground">No matches.</p>
            </SectionCard>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <PersonCard key={p.id} p={p} onOpen={() => setUserId(p.id)} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <HabitDatePicker
                  value={selectedDate}
                  onChange={setSelectedDate}
                  fromDate={calendarFrom}
                  toDate={calendarTo}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-full" disabled={exporting}>
                      {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportImage("png")}>
                      <ImageIcon className="h-4 w-4" /> Image · PNG
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportImage("jpg")}>
                      <ImageIcon className="h-4 w-4" /> Image · JPG
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportSpreadsheet}>
                      <FileSpreadsheet className="h-4 w-4" /> Excel · XLSX
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPdf}>
                      <FileText className="h-4 w-4" /> PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Captured area for image export (header gives the export context). */}
              <div ref={exportRef} className="overflow-hidden rounded-2xl border border-border bg-white">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {activeBatch.name} · {isToday ? "Today" : dateLabel}
                      {isToday ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">· {dateLabel}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Habit completions — {filtered.length} participants
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-gold">
                    VK Mentorship
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {filtered.map((p) => (
                    <PersonRow
                      key={p.id}
                      p={p}
                      done={doneOnSelectedDate(p)}
                      dayNo={dayNoFor(p)}
                      onOpen={() => setUserId(p.id)}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
        active ? "bg-gradient-navy text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function BatchPicker({ groups, onPick }: { groups: BatchGroup[]; onPick: (key: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const atRisk = g.rows.filter((r) => r.atRisk).length;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onPick(g.key)}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-vkm"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-navy text-primary-foreground">
                <Layers3 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{g.name}</p>
                <p className="text-[11px] text-muted-foreground">{g.rows.length} participants</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {g.rows.slice(0, 5).map((p) => (
                  <AvatarBadge key={p.id} name={p.name} src={p.avatar_url} size="sm" className="ring-2 ring-card" />
                ))}
                {g.rows.length > 5 && (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                    +{g.rows.length - 5}
                  </span>
                )}
              </div>
              {atRisk > 0 && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  {atRisk} at risk
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PersonCard({ p, onOpen }: { p: ParticipantRow; onOpen: () => void }) {
  const pct = Math.round((p.weeksDone / 16) * 100);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-vkm"
    >
      <div className="flex items-center gap-3">
        <AvatarBadge name={p.name} src={p.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{p.batchName ?? "Unassigned"}</p>
        </div>
        {p.atRisk && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            At risk
          </span>
        )}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Week progress</span>
          <span className="tabular-nums">{p.weeksDone}/16</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2D8CFF] transition-colors group-hover:text-navy">
        <Activity className="h-3.5 w-3.5" /> View habit tracker
      </span>
    </button>
  );
}

function PersonRow({
  p,
  done,
  dayNo,
  onOpen,
}: {
  p: ParticipantRow;
  done: Set<string>;
  dayNo: number | null;
  onOpen: () => void;
}) {
  const notInProgram = dayNo == null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50 sm:px-5"
      >
        <AvatarBadge name={p.name} src={p.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
            {notInProgram ? (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Outside program
              </span>
            ) : (
              <>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  Day {dayNo}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                    done.size === HABITS.length
                      ? "bg-[oklch(0.93_0.06_160)] text-[oklch(0.35_0.12_160)]"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {done.size}/{HABITS.length}
                </span>
              </>
            )}
            {p.atRisk && (
              <span className="shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                At risk
              </span>
            )}
          </div>
          {!notInProgram && (
            <div className="mt-1.5">
              <HabitRounds done={done} />
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
      </button>
    </li>
  );
}

// ── One participant's full habit tracker ─────────────────────────────────────
function HabitDetail({ userId, name }: { userId: string; name: string }) {
  const t = useParticipantHabits(userId);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
        <Stat icon={CheckCircle2} accent="text-[#10b981]" label="Today" value={`${t.todayDone}/${HABITS.length}`} />
        <Stat icon={Flame} accent="text-[#f59e0b]" label="Streak" value={`${t.streak}d`} />
        <Stat icon={Activity} accent="text-[#3b82f6]" label="Days done" value={`${t.completedDays}`} />
        <Stat icon={Trophy} accent="text-[oklch(0.5_0.11_80)]" label="Points" value={`${t.points}`} />
        <Stat icon={Footprints} accent="text-[#10b981]" label="Steps" value={`${t.steps}`} />
        <Stat icon={Droplets} accent="text-[#0ea5e9]" label="Water" value={`${(t.waterMl / 1000).toFixed(1)}L`} />
        <Stat icon={Dumbbell} accent="text-[#ef4444]" label="Workout" value={`${t.workoutMinutes}m`} />
      </div>

      {t.loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading {name}'s tracker…
        </div>
      ) : (
        <>
          <HabitGrid
            config={t.config}
            dayState={t.dayState}
            title={`${name} · Habit Tracker`}
            subtitle="Tap any day to see that date's proofs & completions"
            isDone={t.isDone}
            proofsFor={t.proofsFor}
            anchor={t.startedAt ?? undefined}
            defaultOpen
          />
          {t.waterEvents.length > 0 && (
            <SectionCard
              title="Water log · today"
              subtitle="Each glass is timestamped · ⚠ flags rapid logs"
            >
              <ul className="divide-y divide-border">
                {t.waterEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 py-2.5">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white",
                        e.ml > 0 ? "bg-[#0ea5e9]" : "bg-muted-foreground/40",
                      )}
                    >
                      <Droplets className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {e.ml > 0 ? "+" : ""}
                        {e.ml} ml
                        {e.rapid && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> rapid
                          </span>
                        )}
                      </p>
                      {e.reason && <p className="text-xs text-muted-foreground">“{e.reason}”</p>}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {format(new Date(e.created_at), "h:mm a")}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

// One batched read of a batch's habit_logs → which habits each participant
// completed on each day. Lets the list show a per-day 6-habit snapshot without a
// query per row.
function useBatchDayHabits(userIds: string[]) {
  const [byUserDay, setByUserDay] = useState<Map<string, Map<number, Set<string>>>>(new Map());
  const [maxDay, setMaxDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const key = userIds.slice().sort().join(",");

  useEffect(() => {
    if (userIds.length === 0) {
      setByUserDay(new Map());
      setMaxDay(1);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void supabase
      .from("habit_logs")
      .select("user_id, habit_id, day_no")
      .in("user_id", userIds)
      .then(({ data }) => {
        if (!active) return;
        const m = new Map<string, Map<number, Set<string>>>();
        let mx = 1;
        (data ?? []).forEach((r) => {
          if (r.day_no > mx) mx = r.day_no;
          let dm = m.get(r.user_id);
          if (!dm) {
            dm = new Map();
            m.set(r.user_id, dm);
          }
          let s = dm.get(r.day_no);
          if (!s) {
            s = new Set();
            dm.set(r.day_no, s);
          }
          s.add(r.habit_id);
        });
        setByUserDay(m);
        setMaxDay(mx);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const doneFor = (userId: string, day: number) => byUserDay.get(userId)?.get(day) ?? EMPTY_SET;
  return { doneFor, maxDay, loading };
}
const EMPTY_SET = new Set<string>();

// The 6 habit "rounds" for a given day — filled with the habit's colour when
// done, a dashed outline when not.
function HabitRounds({ done }: { done: Set<string> }) {
  return (
    <div className="flex items-center gap-1.5">
      {HABITS.map((h) => {
        const on = done.has(h.id);
        const Icon = h.icon;
        return (
          <span
            key={h.id}
            title={`${h.name} — ${on ? "done" : "not done"}`}
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
              on
                ? "text-white ring-1 ring-black/5"
                : "border border-border bg-secondary/50 text-muted-foreground/45",
            )}
            style={on ? { background: `linear-gradient(135deg, ${h.from}, ${h.to})` } : undefined}
          >
            <Icon className="h-[15px] w-[15px]" />
          </span>
        );
      })}
    </div>
  );
}

/** Map a calendar date → this participant's program day_no (1…totalDays), or null if outside range. */
function programDayOnDate(startedAt: Date | null, date: Date, totalDays = DEFAULT_CONFIG.totalDays): number | null {
  const anchor = startOfDay(startedAt ?? START_DATE);
  const day = differenceInCalendarDays(startOfDay(date), anchor) + 1;
  if (day < 1 || day > totalDays) return null;
  return day;
}

/**
 * Compact calendar date picker for the batch habits list.
 * Defaults to today; no more 112-day button strip / dropdown.
 */
function HabitDatePicker({
  value,
  onChange,
  fromDate,
  toDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  fromDate: Date;
  toDate: Date;
}) {
  const [open, setOpen] = useState(false);
  const today = startOfToday();
  const atToday = isSameDay(value, today);
  const canPrev = differenceInCalendarDays(value, fromDate) > 0;
  const canNext = differenceInCalendarDays(toDate, value) > 0;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        disabled={!canPrev}
        aria-label="Previous day"
        onClick={() => onChange(subDays(startOfDay(value), 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 min-w-[11.5rem] justify-start gap-2 rounded-full px-3 text-left font-medium",
              atToday && "border-gold/40 bg-gold/5",
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-gold" />
            <span className="truncate text-sm">
              {atToday ? (
                <>
                  Today
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    · {format(value, "d MMM")}
                  </span>
                </>
              ) : (
                format(value, "EEE, d MMM yyyy")
              )}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              if (!d) return;
              onChange(startOfDay(d));
              setOpen(false);
            }}
            defaultMonth={value}
            disabled={{ after: toDate, before: fromDate }}
            startMonth={fromDate}
            endMonth={toDate}
            captionLayout="dropdown"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Pick any program day</p>
            {!atToday && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs"
                onClick={() => {
                  onChange(today);
                  setOpen(false);
                }}
              >
                Jump to today
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        disabled={!canNext}
        aria-label="Next day"
        onClick={() => onChange(addDays(startOfDay(value), 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Stat({
  icon: Icon,
  accent,
  label,
  value,
}: {
  icon: typeof Activity;
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-vkm">
      <Icon className={cn("h-5 w-5", accent)} />
      <p className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
