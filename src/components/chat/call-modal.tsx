import { motion } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { callUrl } from "@/components/chat/chat-data";

export function CallModal({ room, onClose }: { room: string; onClose: () => void }) {
  const url = callUrl(room);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col bg-black/90 pt-safe"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-medium text-white">VKM Call</p>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
          </a>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="End call"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <iframe
        title="VKM Call"
        src={url}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="min-h-0 flex-1 border-0"
      />
    </motion.div>
  );
}
