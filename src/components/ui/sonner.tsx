import { Toaster as Sonner } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner> & { mobile?: boolean };

// VKM toasts — a bold, Duolingo-style redesign of sonner. All the look lives in
// styles.css under `.vkm-toaster` (pastel card + saturated border + a popping
// icon badge), so every existing `toast.success/error/...` call is restyled
// with no changes at the call sites. `mobile` picks the layout: a full-width
// bottom banner on the app shell vs a compact top-right card on desktop.
const Toaster = ({ mobile, className, ...props }: ToasterProps) => {
  return (
    <Sonner
      className={[
        "vkm-toaster",
        mobile ? "vkm-toaster--mobile" : "vkm-toaster--desktop",
        className ?? "",
      ].join(" ")}
      // Consistent, chunky glyphs for each state — CSS wraps them in a colored
      // circle badge that pops on entry.
      icons={{
        success: <CheckCircle2 className="vkm-toast-glyph" strokeWidth={3} />,
        error: <XCircle className="vkm-toast-glyph" strokeWidth={3} />,
        warning: <AlertTriangle className="vkm-toast-glyph" strokeWidth={3} />,
        info: <Info className="vkm-toast-glyph" strokeWidth={3} />,
        loading: <Loader2 className="vkm-toast-glyph vkm-toast-glyph--spin" strokeWidth={3} />,
      }}
      toastOptions={{ duration: 3600 }}
      {...props}
    />
  );
};

export { Toaster };
