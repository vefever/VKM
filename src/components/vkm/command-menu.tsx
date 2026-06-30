import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { NAV_BY_ROLE } from "@/components/vkm/nav-config";
import type { AppRole } from "@/hooks/use-auth";

export function CommandMenu({
  role, open, onOpenChange,
}: { role: AppRole; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const groups = NAV_BY_ROLE[role];

  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!openRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to anywhere in VKM…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((g, gi) => (
          <div key={g.label}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={g.label}>
              {g.items.map((item) => (
                <CommandItem
                  key={item.to}
                  value={`${g.label} ${item.label}`}
                  onSelect={() => {
                    onOpenChange(false);
                    navigate({ to: item.to });
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
