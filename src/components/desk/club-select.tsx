import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { ChevronsUpDown } from "lucide-react";
import type { ClubRec, ParsedSave } from "@/lib/cm/types";
import { button, control } from "./ui";

export type ClubOption = {
  id: number;
  name: string;
  search: string;
  detail: string;
};

export function clubOptions(save: ParsedSave): ClubOption[] {
  return [...save.clubs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((club) => {
      const nation = save.nations.find((row) => row.id === club.nationId)?.name ?? "";
      const comp = save.comps.find((row) => row.id === club.divisionId)?.name ?? "";
      const detail = [nation, comp].filter(Boolean).join(" · ");
      return {
        id: club.id,
        name: club.name,
        search: `${club.name} ${club.short} ${nation} ${comp}`.toLowerCase(),
        detail,
      };
    });
}

export function ClubSelect({
  clubs,
  value,
  placeholder = "Search clubs",
  label,
  onPick,
}: {
  clubs: ClubOption[];
  value: ClubRec | null;
  placeholder?: string;
  label: string;
  onPick: (clubId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => (value ? clubs.find((club) => club.id === value.id) : null), [clubs, value]);

  return (
    <div className="px-3 py-1">
      <p className="mb-1 text-xs text-faint">{label}</p>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`${button} h-10 w-full justify-between gap-2 px-2 text-left font-normal`}
            aria-label={label}
          >
            <span className="min-w-0 truncate text-sm">{selected?.name ?? "Choose a club"}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-sm border border-line bg-surface shadow-md"
          >
            <Command
              className="flex flex-col"
              filter={(value, search) => (value.includes(search.trim().toLowerCase()) ? 1 : 0)}
            >
              <Command.Input
                placeholder={placeholder}
                className={`${control} rounded-none border-0 border-b border-line`}
              />
              <Command.List className="max-h-64 overflow-y-auto p-1">
                <Command.Empty className="px-2 py-3 text-sm text-muted">No clubs match.</Command.Empty>
                {clubs.map((club) => (
                  <Command.Item
                    key={club.id}
                    value={club.search}
                    onSelect={() => {
                      onPick(club.id);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-sm text-muted aria-selected:bg-surface-2 aria-selected:text-fg"
                  >
                    <span className="truncate">{club.name}</span>
                    {club.detail ? <span className="truncate text-xs text-faint">{club.detail}</span> : null}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
