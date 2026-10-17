import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";
import { focusRing } from "./focus-ring";
import { Kbd } from "./kbd";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 rounded-[7px] border border-border bg-card px-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

export function SearchInput({ value, onChange, placeholder, inputRef }: SearchInputProps) {
  return (
    <div className="flex h-9 w-full max-w-[420px] items-center gap-2 rounded-[7px] border border-border bg-card px-2.5 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foreground">
      <Search className="size-[15px] shrink-0" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Kbd>/</Kbd>
    </div>
  );
}
