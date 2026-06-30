import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addMinutes,
  addWeeks,
  format,
  getHours,
  getMinutes,
  isBefore,
  isAfter,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  User,
  Video,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useMeetings,
  useSchedulableParticipants,
  scheduleMeeting,
  type Meeting,
} from "@/components/meetings/meetings-data";
import { ZoomMeetingModal } from "@/components/meetings/zoom-meeting-modal";

// ─── Calendar constants ─────────────────────────────────────────────────────
const HOUR_START = 7; // 7 AM
const HOUR_END = 22; // 10 PM
const PX_PER_HOUR = 64;
const TOTAL_HEIGHT = PX_PER_HOUR * (HOUR_END - HOUR_START);
const TOTAL_MINS = (HOUR_END - HOUR_START) * 60;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

// ─── Helpers ────────────────────────────────────────────────────────────────
function minsFromStart(d: Date) {
  return (getHours(d) - HOUR_START) * 60 + getMinutes(d);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function meetingGeometry(m: Meeting) {
  const start = parseISO(m.start_time);
  const sm = minsFromStart(start);
  const em = sm + m.duration_min;
  const top = Math.max(0, (sm / TOTAL_MINS) * TOTAL_HEIGHT);
  const height = Math.max(20, ((Math.min(em, TOTAL_MINS) - Math.max(sm, 0)) / TOTAL_MINS) * TOTAL_HEIGHT);
  return { top, height };
}

type MeetingStatus = "past" | "active" | "upcoming" | "cancelled";

function statusOf(m: Meeting): MeetingStatus {
  if (m.status === "cancelled") return "cancelled";
  const now = new Date();
  const s = parseISO(m.start_time);
  const e = addMinutes(s, m.duration_min);
  if (isAfter(now, e)) return "past";
  if (isBefore(now, s)) return "upcoming";
  return "active";
}

const STATUS_STYLES: Record<MeetingStatus, string> = {
  upcoming:
    "bg-[#2D8CFF]/12 border-l-[3px] border-[#2D8CFF] text-[#2D8CFF] hover:bg-[#2D8CFF]/20",
  active:
    "bg-emerald-500/12 border-l-[3px] border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20",
  past: "bg-secondary/40 border-l-[3px] border-border text-muted-foreground hover:bg-secondary/60",
  cancelled:
    "bg-destructive/8 border-l-[3px] border-destructive/30 text-destructive/60 line-through hover:bg-destructive/12",
};

// ─── Main export ─────────────────────────────────────────────────────────────
export function MeetingsCalendar() {
  const { user, hasRole } = useAuth();
  const staff = hasRole("coach") || hasRole("mentor") || hasRole("super_admin");
  const { meetings, loading, error, reload } = useMeetings();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSlot, setScheduleSlot] = useState<{ date: string; time: string } | null>(null);
  const [instantOpen, setInstantOpen] = useState(false);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [joining, setJoining] = useState<Meeting | null>(null);

  const userName =
    (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Guest";

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group meetings by calendar day key
  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const key = format(parseISO(m.start_time), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return map;
  }, [meetings]);

  // Today's agenda list for the sidebar
  const todayMeetings = useMemo(() => {
    const key = format(new Date(), "yyyy-MM-dd");
    return (byDay.get(key) ?? []).sort(
      (a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime(),
    );
  }, [byDay]);

  // Scroll the time grid to current time on mount
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nowPx = (minsFromStart(new Date()) / TOTAL_MINS) * TOTAL_HEIGHT;
    el.scrollTop = Math.max(0, nowPx - 80);
  }, []);

  function openSlot(day: Date, hour: number) {
    if (!staff) return;
    setScheduleSlot({ date: format(day, "yyyy-MM-dd"), time: `${pad(hour)}:00` });
    setScheduleOpen(true);
  }

  function handleInstantCreated(id: string, topic: string) {
    setJoining({
      id,
      topic,
      host_id: user?.id ?? "",
      participant_id: null,
      start_time: new Date().toISOString(),
      duration_min: 30,
      join_url: null,
      status: "scheduled",
      zoom_meeting_id: null,
      hostName: userName,
      participantName: "",
    });
    void reload();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-3"
      style={{ minHeight: "calc(100dvh - 5rem)" }}
    >
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {staff ? "Coach" : "Participant"}
          </p>
          <h1 className="text-2xl font-bold text-foreground">Calendar & Meetings</h1>
        </div>
        {staff && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setInstantOpen(true)}
              className="gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Zap className="h-4 w-4" /> Start now
            </Button>
            <Button
              onClick={() => {
                setScheduleSlot(null);
                setScheduleOpen(true);
              }}
              className="gap-1.5 rounded-xl bg-gradient-navy text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Schedule
            </Button>
          </div>
        )}
      </div>

      {/* ── Week navigator ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setWeekStart(subWeeks(weekStart, 1))}
          className="h-8 w-8 rounded-lg"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </p>
          <button
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Today
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setWeekStart(addWeeks(weekStart, 1))}
          className="h-8 w-8 rounded-lg"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Main layout: calendar + sidebar ─────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Calendar grid */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          {/* Day header row */}
          <div
            className="grid shrink-0 border-b border-border"
            style={{ gridTemplateColumns: "3rem repeat(7, 1fr)" }}
          >
            <div className="h-11" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col items-center justify-center border-l border-border py-2",
                  isToday(day) && "bg-[#2D8CFF]/8",
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {format(day, "EEE")}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-sm font-bold leading-none",
                    isToday(day)
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#2D8CFF] text-xs text-white"
                      : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
            ))}
          </div>

          {/* Scrollable time body */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/60" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: "3rem repeat(7, 1fr)",
                  height: TOTAL_HEIGHT,
                }}
              >
                {/* Hour lines (behind everything) */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute left-0 right-0 border-t border-border/40"
                    style={{ top: (h - HOUR_START) * PX_PER_HOUR }}
                  />
                ))}

                {/* Time gutter */}
                <div className="relative">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute right-2 -translate-y-2.5 text-[10px] text-muted-foreground/60"
                      style={{ top: (h - HOUR_START) * PX_PER_HOUR }}
                    >
                      {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayMeetings = byDay.get(key) ?? [];
                  return (
                    <DayColumn
                      key={key}
                      day={day}
                      meetings={dayMeetings}
                      staff={staff}
                      onSlotClick={openSlot}
                      onMeetingClick={setSelected}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Today's agenda sidebar (desktop only) */}
        <aside className="hidden w-60 shrink-0 flex-col gap-3 lg:flex">
          <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Today · {format(new Date(), "MMM d")}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {todayMeetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <CalendarDays className="h-7 w-7 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No meetings today</p>
                  {staff && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 rounded-lg text-xs"
                      onClick={() => {
                        setScheduleSlot(null);
                        setScheduleOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3" /> Schedule
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {todayMeetings.map((m) => {
                    const s = statusOf(m);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelected(m)}
                        className={cn(
                          "w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-accent",
                          s === "active" && "ring-1 ring-emerald-500/50",
                        )}
                      >
                        <p className="truncate text-xs font-semibold text-foreground">
                          {m.topic}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {format(parseISO(m.start_time), "h:mm a")} · {m.duration_min}m
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {m.participantName || m.hostName}
                        </p>
                        {s === "active" && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Live now
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming this week pill */}
          {meetings.filter((m) => statusOf(m) === "upcoming" && !isSameDay(parseISO(m.start_time), new Date())).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Coming up
              </p>
              <div className="space-y-1">
                {meetings
                  .filter(
                    (m) =>
                      statusOf(m) === "upcoming" &&
                      !isSameDay(parseISO(m.start_time), new Date()),
                  )
                  .slice(0, 4)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelected(m)}
                      className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                    >
                      <p className="truncate text-xs font-medium text-foreground">
                        {m.participantName || m.hostName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(m.start_time), "EEE h:mm a")}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── Meeting detail sheet ─────────────────────────────────────── */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-sm p-6">
          {selected && (
            <MeetingDetail
              m={selected}
              staff={staff}
              onJoin={() => {
                setJoining(selected);
                setSelected(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Schedule dialog ──────────────────────────────────────────── */}
      {staff && (
        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={(v) => {
            setScheduleOpen(v);
            if (!v) setScheduleSlot(null);
          }}
          onScheduled={reload}
          defaultSlot={scheduleSlot}
        />
      )}

      {/* ── Instant meeting dialog ───────────────────────────────────── */}
      {staff && (
        <InstantMeetingDialog
          open={instantOpen}
          onOpenChange={setInstantOpen}
          onCreated={handleInstantCreated}
        />
      )}

      {/* ── Zoom in-app meeting ──────────────────────────────────────── */}
      <AnimatePresence>
        {joining && (
          <ZoomMeetingModal
            meetingId={joining.id}
            topic={joining.topic}
            userName={userName}
            joinUrl={joining.join_url}
            onClose={() => setJoining(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Day column (the 7-column grid cell) ────────────────────────────────────
function DayColumn({
  day,
  meetings,
  staff,
  onSlotClick,
  onMeetingClick,
}: {
  day: Date;
  meetings: Meeting[];
  staff: boolean;
  onSlotClick: (day: Date, hour: number) => void;
  onMeetingClick: (m: Meeting) => void;
}) {
  // "Now" indicator position
  const nowPct =
    isToday(day)
      ? (minsFromStart(new Date()) / TOTAL_MINS) * 100
      : -1;

  return (
    <div
      className={cn(
        "relative border-l border-border/40",
        isToday(day) && "bg-[#2D8CFF]/[0.03]",
      )}
    >
      {/* Clickable hour slots for scheduling */}
      {staff &&
        HOURS.map((h) => (
          <div
            key={h}
            onClick={() => onSlotClick(day, h)}
            title={`Schedule at ${h < 12 ? h : h - 12}${h < 12 ? " AM" : " PM"}`}
            className="absolute inset-x-0 cursor-pointer transition-colors hover:bg-[#2D8CFF]/8"
            style={{ top: (h - HOUR_START) * PX_PER_HOUR, height: PX_PER_HOUR }}
          />
        ))}

      {/* Meeting event blocks */}
      {meetings.map((m) => {
        const { top, height } = meetingGeometry(m);
        const status = statusOf(m);
        return (
          <button
            key={m.id}
            onClick={(e) => {
              e.stopPropagation();
              onMeetingClick(m);
            }}
            className={cn(
              "absolute inset-x-0.5 z-10 overflow-hidden rounded-lg px-1.5 py-1 text-left transition-all",
              STATUS_STYLES[status],
            )}
            style={{ top, height }}
          >
            <p className="truncate text-[11px] font-semibold leading-tight">{m.topic}</p>
            {height > 28 && (
              <p className="truncate text-[10px] leading-tight opacity-75">{m.participantName}</p>
            )}
            {height > 44 && (
              <p className="text-[10px] leading-tight opacity-60">
                {format(parseISO(m.start_time), "h:mm a")}
              </p>
            )}
            {status === "active" && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            )}
          </button>
        );
      })}

      {/* "Now" indicator */}
      {nowPct >= 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 z-20"
          style={{ top: `${nowPct}%` }}
        >
          <div className="relative border-t-2 border-red-500">
            <div className="absolute -left-0.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Meeting detail sheet content ────────────────────────────────────────────
function MeetingDetail({
  m,
  staff,
  onJoin,
}: {
  m: Meeting;
  staff: boolean;
  onJoin: () => void;
}) {
  const status = statusOf(m);
  const start = parseISO(m.start_time);
  const end = addMinutes(start, m.duration_min);

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="mb-4">
        <SheetTitle className="text-base leading-tight">{m.topic}</SheetTitle>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-3">
        {/* Date / time */}
        <div className="flex items-start gap-2.5 rounded-xl bg-secondary/50 px-3 py-2.5">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {format(start, "EEEE, MMMM d")}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(start, "h:mm a")} – {format(end, "h:mm a")} · {m.duration_min} min
            </p>
          </div>
        </div>

        {/* Participant */}
        <div className="flex items-center gap-2.5 rounded-xl bg-secondary/50 px-3 py-2.5">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-[11px] text-muted-foreground">{staff ? "Participant" : "Coach"}</p>
            <p className="text-sm font-medium text-foreground">
              {staff ? m.participantName : m.hostName}
            </p>
          </div>
        </div>

        {/* Status banner */}
        {status === "active" && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            This meeting is live right now
          </div>
        )}
        {status === "cancelled" && (
          <div className="rounded-xl bg-destructive/8 px-3 py-2.5 text-sm text-destructive/70">
            This meeting was cancelled.
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {status !== "cancelled" && status !== "past" && (
            <Button
              onClick={onJoin}
              className="w-full gap-1.5 rounded-xl bg-[#2D8CFF] text-white hover:bg-[#2D8CFF]/90"
            >
              <Video className="h-4 w-4" />
              {status === "active" ? "Join live meeting" : "Join meeting"}
            </Button>
          )}
          {m.join_url && (
            <a
              href={m.join_url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open in Zoom app ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Instant meeting dialog ──────────────────────────────────────────────────
function InstantMeetingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string, topic: string) => void;
}) {
  const { people, loading } = useSchedulableParticipants();
  const [participantId, setParticipantId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("Quick coaching call");
  const [busy, setBusy] = useState(false);

  const filtered = people.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Reset on close
  useEffect(() => {
    if (!open) {
      setParticipantId("");
      setSelectedName("");
      setSearch("");
      setTopic("Quick coaching call");
    }
  }, [open]);

  async function start() {
    if (!participantId) return toast.error("Choose a participant first");
    setBusy(true);
    try {
      const result = await scheduleMeeting({
        participantId,
        topic: topic.trim() || "Quick coaching call",
        startTime: new Date(Date.now() + 60_000).toISOString(),
        duration: 30,
      });
      toast.success("Meeting created — joining now");
      onOpenChange(false);
      onCreated(result.id, topic.trim() || "Quick coaching call");
    } catch (e) {
      toast.error("Could not start meeting", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-emerald-500" /> Start an instant meeting
          </DialogTitle>
          <DialogDescription>
            Creates a Zoom room starting in 1 minute — no planning needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="rounded-lg"
              placeholder="Quick coaching call"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Participant</Label>
            {participantId ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-accent/40 px-3 py-2">
                <span className="text-sm font-medium text-foreground">{selectedName}</span>
                <button
                  onClick={() => {
                    setParticipantId("");
                    setSelectedName("");
                    setSearch("");
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search participants…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg"
                />
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">
                        No participants found
                      </p>
                    ) : (
                      filtered.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setParticipantId(p.id);
                            setSelectedName(p.name);
                            setSearch(p.name);
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                            {p.name[0]?.toUpperCase()}
                          </span>
                          <span className="flex-1 truncate">{p.name}</span>
                          {participantId === p.id && (
                            <Check className="h-3.5 w-3.5 text-[#2D8CFF]" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={start}
            disabled={busy || !participantId}
            className="gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Start now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule dialog ─────────────────────────────────────────────────────────
function ScheduleDialog({
  open,
  onOpenChange,
  onScheduled,
  defaultSlot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScheduled: () => void;
  defaultSlot: { date: string; time: string } | null;
}) {
  const { people, loading } = useSchedulableParticipants();
  const now = new Date();

  const [participantId, setParticipantId] = useState("");
  const [topic, setTopic] = useState("Coaching call");
  const [date, setDate] = useState(format(now, "yyyy-MM-dd"));
  const [time, setTime] = useState(`${pad((now.getHours() + 1) % 24)}:00`);
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);

  // Sync pre-filled time slot when dialog opens from a calendar click
  useEffect(() => {
    if (open && defaultSlot) {
      setDate(defaultSlot.date);
      setTime(defaultSlot.time);
    }
    if (!open) {
      setParticipantId("");
      setTopic("Coaching call");
    }
  }, [open, defaultSlot]);

  async function submit() {
    if (!participantId) return toast.error("Pick a participant");
    const startTime = new Date(`${date}T${time}`);
    if (isNaN(startTime.getTime())) return toast.error("Invalid date / time");
    setBusy(true);
    try {
      await scheduleMeeting({
        participantId,
        topic: topic.trim() || "Coaching call",
        startTime: startTime.toISOString(),
        duration: Number(duration),
      });
      toast.success("Meeting scheduled", { description: "It's on the calendar." });
      onScheduled();
      onOpenChange(false);
    } catch (e) {
      toast.error("Could not schedule", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-[#2D8CFF]" /> Schedule Zoom meeting
          </DialogTitle>
          <DialogDescription>
            Creates a Zoom meeting and adds it to the participant's calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label>Participant</Label>
            <Select value={participantId} onValueChange={setParticipantId}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder={loading ? "Loading…" : "Choose a participant"} />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                {!loading && people.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    No participants in your batches yet.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["15", "30", "45", "60", "90"].map((d) => (
                  <SelectItem key={d} value={d}>
                    {d} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="gap-1.5 rounded-lg bg-gradient-navy text-primary-foreground hover:opacity-90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            Create & schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
