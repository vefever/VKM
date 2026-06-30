import { useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Send, Loader2, Video, FileDown, ClipboardList, Bell } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/vkm/page-header";
import { SectionCard } from "@/components/vkm/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const TYPES = [
  { key: "announcement", label: "Announcement", icon: Megaphone, color: "#f59e0b" },
  { key: "lms", label: "New LMS video", icon: Video, color: "#8b5cf6" },
  { key: "workbook", label: "Workbook / Download", icon: FileDown, color: "#0ea5e9" },
  { key: "assignment", label: "Assignment", icon: ClipboardList, color: "#3b82f6" },
] as const;

export function BroadcastComposer({ eyebrow = "Mentor · VK" }: { eyebrow?: string }) {
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim()) {
      toast.error("Add a title");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc("notify_participants", {
      _type: type,
      _title: title.trim(),
      _body: body.trim(),
      _link: link.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Could not send", { description: error.message });
    } else {
      toast.success(`Sent to ${data ?? 0} participant${data === 1 ? "" : "s"}`, {
        description: "It's now in their notification bell.",
      });
      setTitle("");
      setBody("");
      setLink("");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <PageHeader
        eyebrow={eyebrow}
        title="Broadcast to participants"
        description="Push a notification to every participant — new content, workbooks, videos or announcements. It lands in their bell in real time."
        icon={Megaphone}
      />

      <SectionCard title="New broadcast" subtitle="Goes to all participants">
        <div className="space-y-5">
          {/* Type picker */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((tp) => {
              const Icon = tp.icon;
              const active = type === tp.key;
              return (
                <button
                  key={tp.key}
                  type="button"
                  onClick={() => setType(tp.key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center text-xs font-medium transition-all hover:-translate-y-0.5",
                    active
                      ? "border-transparent text-white shadow-vkm"
                      : "border-border bg-card text-foreground hover:bg-secondary/50",
                  )}
                  style={active ? { background: tp.color } : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {tp.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New LMS video: Week 8 — CRM Automation"
              className="h-11 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Message (optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="A short line of context…"
              className="min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Link (optional)
            </label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/participant/lms"
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Where the notification takes them when tapped.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={send}
              disabled={sending}
              className="rounded-xl bg-gradient-navy shadow-vkm"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}{" "}
              Send to all
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-secondary/60 px-3 py-2.5 text-xs text-muted-foreground">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Proof approvals, milestone awards and task assignments already notify participants
            automatically — use this for content & announcements.
          </div>
        </div>
      </SectionCard>
    </motion.div>
  );
}
