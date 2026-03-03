"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

function formatWithCommas(raw: string): string {
  // Remove everything except digits and one period
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  const integer = parts[0] ? Number(parts[0]).toLocaleString("en-US") : "";
  const decimal = parts.length > 1 ? "." + parts[1] : "";
  return integer + decimal;
}

function cleanRaw(val: string): string {
  return val.replace(/[^0-9.]/g, "");
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  className,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (!value) return "";
    const formatted = formatWithCommas(value);
    return formatted ? `$${formatted}` : "";
  });
  const [isFocused, setIsFocused] = useState(false);

  // Sync from external value prop when not focused
  useEffect(() => {
    if (!isFocused) {
      if (!value) {
        setDisplayValue("");
      } else {
        const formatted = formatWithCommas(value);
        setDisplayValue(formatted ? `$${formatted}` : "");
      }
    }
  }, [value, isFocused]);

  function handleFocus() {
    setIsFocused(true);
    // Strip $ and commas to show raw numeric value
    const raw = cleanRaw(displayValue);
    setDisplayValue(raw);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Allow only numeric chars and period while typing
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    setDisplayValue(raw);
  }

  function handleBlur() {
    setIsFocused(false);
    const raw = cleanRaw(displayValue);
    if (!raw) {
      setDisplayValue("");
      onChange("");
      return;
    }
    const formatted = formatWithCommas(raw);
    setDisplayValue(`$${formatted}`);
    onChange(raw);
  }

  return (
    <div className={cn("relative", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none select-none">
        $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue.startsWith("$") && !isFocused ? displayValue.slice(1) : displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="pl-7"
      />
    </div>
  );
}
