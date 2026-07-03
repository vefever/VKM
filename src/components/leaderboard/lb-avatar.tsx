import { cn } from "@/lib/utils";
import { initialsOf } from "@/hooks/use-leaderboard";

// Leaderboard avatar: shows the uploaded profile photo when present, else the
// name's initials. `className` sets the size/ring/background (shared by every row).
export function LbAvatar({
  name,
  avatar,
  className,
}: {
  name: string;
  avatar: string | null;
  className?: string;
}) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }
  return <span className={className}>{initialsOf(name)}</span>;
}
