"use client";

import { Scenario } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ScenarioPickerProps {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ScenarioPicker({
  scenarios,
  selectedId,
  onSelect,
}: ScenarioPickerProps) {
  return (
    <Select value={selectedId || ""} onValueChange={onSelect}>
      <SelectTrigger className="w-[220px] bg-zinc-900/90 border-zinc-700 text-white text-xs h-8">
        <SelectValue placeholder="Select scenario..." />
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-zinc-700">
        {scenarios.map((s) => (
          <SelectItem
            key={s.id}
            value={s.id}
            className="text-white text-xs hover:bg-zinc-800 focus:bg-zinc-800 focus:text-white"
          >
            <span className="flex items-center gap-2">
              <span className="text-orange-500">🔥</span>
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
