"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_RANGE_LABELS } from "@/lib/utils/dateRange";
import type { DateRangeKey } from "@/lib/contracts/dashboard";
import { CalendarDays } from "lucide-react";

interface Props {
  value: DateRangeKey;
  onChange: (value: DateRangeKey) => void;
}

const OPTIONS: DateRangeKey[] = ["7d", "30d", "90d", "6mo", "1yr", "2yr", "all"];

export function DateRangeSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as DateRangeKey)}>
      <SelectTrigger className="w-72 gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((key) => (
          <SelectItem key={key} value={key}>
            {DATE_RANGE_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
