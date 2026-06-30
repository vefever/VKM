import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJI: Record<string, string[]> = {
  Smileys: "😀 😄 😁 😅 😂 🙂 😉 😊 😍 😘 😎 🤩 🤔 😴 😇 🥳 😢 😭 😤 😡 🥺 😬 🤯 🤗".split(" "),
  Gestures: "👍 👎 👏 🙌 🙏 💪 🤝 👊 ✌️ 🤞 👌 🫶 🫡 👋 ✋ 🤙".split(" "),
  Symbols: "❤️ 🔥 ⭐ ✨ 💯 ✅ ❌ ⚡ 🎯 🏆 🎉 💡 ⏰ 📌 ✔️ ❗".split(" "),
  Work: "💼 📈 📊 📝 📅 📞 💻 📱 💰 🤑 🚀 🧠 📦 🛠️ 🗂️ 📣".split(" "),
};

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {Object.entries(EMOJI).map(([cat, list]) => (
            <div key={cat}>
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {list.map((e, i) => (
                  <button
                    key={`${cat}-${i}`}
                    type="button"
                    onClick={() => onPick(e)}
                    className="rounded-md p-1 text-xl transition-colors hover:bg-secondary"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
