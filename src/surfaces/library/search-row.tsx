import { Image, LayoutGrid, List } from "lucide-react";
import type { RefObject } from "react";
import type { KindFilter, LibraryQuery, SortOrder } from "../../features/library/library-query";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { SearchInput } from "../../ui/input";
import { Segmented } from "../../ui/segmented";
import { Select } from "../../ui/select";

type SearchRowProps = {
  query: LibraryQuery;
  onQueryChange: (patch: Partial<LibraryQuery>) => void;
  resultCount: number;
  layout: "grid" | "list";
  onLayoutChange: (layout: "grid" | "list") => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
};

const SORT_OPTIONS: [string, string][] = [["newest", "Recently saved"], ["oldest", "Oldest first"], ["title", "Title A–Z"]];

export function SearchRow({ query, onQueryChange, resultCount, layout, onLayoutChange, searchInputRef }: SearchRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-[18px] pb-3.5">
      <div className="min-w-[220px] flex-[1_1_260px]">
        <SearchInput
          value={query.search}
          onChange={search => onQueryChange({ search })}
          placeholder="Search text, people, links, or images"
          inputRef={searchInputRef}
        />
      </div>
      <Segmented
        ariaLabel="Filter by kind"
        fit="content"
        value={query.kind}
        options={[["all", "All"], ["post", "Posts"], ["article", "Articles"]]}
        onChange={value => onQueryChange({ kind: value as KindFilter })}
      />
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={query.imageOnly}
        onClick={() => onQueryChange({ imageOnly: !query.imageOnly })}
        className={cn(query.imageOnly && "bg-muted-hover text-foreground")}
      >
        <Image className="size-[15px]" aria-hidden />With images
      </Button>
      <div className="ml-auto flex items-center gap-2.5">
        <Select
          ariaLabel="Sort library"
          value={query.sort}
          onValueChange={value => onQueryChange({ sort: value as SortOrder })}
          options={SORT_OPTIONS}
        />
        <Segmented
          ariaLabel="Layout"
          fit="content"
          value={layout}
          options={[["grid", "Grid", <LayoutGrid key="grid" className="size-[13px]" aria-hidden />], ["list", "List", <List key="list" className="size-[13px]" aria-hidden />]]}
          onChange={value => onLayoutChange(value as "grid" | "list")}
        />
        <span className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">{`${resultCount} saved`}</span>
      </div>
    </div>
  );
}
