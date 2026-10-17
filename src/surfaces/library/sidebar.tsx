import { Archive, BookOpen, CircleDot, FileText, Lock, MessageCircle, Settings, Star, Tag } from "lucide-react";
import type { ReactNode } from "react";
import type { Asset, SavedDocument } from "../../core/model";
import { formatBytes } from "../../core/format";
import type { LibraryQuery, LibraryView } from "../../features/library/library-query";
import { kindCounts, libraryTags, storageBytes, viewCounts } from "../../features/library/library-counts";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Logo } from "../shared/logo";

type SidebarProps = {
  query: LibraryQuery;
  onQueryChange: (patch: Partial<LibraryQuery>) => void;
  documents: SavedDocument[];
  assets: Map<string, Asset>;
  onOpenSettings: () => void;
};

const NAV: [LibraryView, string, ReactNode][] = [
  ["all", "Library", <BookOpen className="size-[15px]" aria-hidden />],
  ["unread", "Unread", <CircleDot className="size-[15px]" aria-hidden />],
  ["starred", "Starred", <Star className="size-[15px]" aria-hidden />],
  ["archive", "Archive", <Archive className="size-[15px]" aria-hidden />],
];

function Row({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-[34px] items-center gap-2.5 rounded-[7px] px-2 text-left text-[12.5px] text-secondary hover:bg-muted-hover",
        active && "bg-muted-hover font-medium text-foreground",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-[11.5px] tabular-nums text-muted-foreground">{count}</span>}
    </button>
  );
}

export function Sidebar({ query, onQueryChange, documents, assets, onOpenSettings }: SidebarProps) {
  const counts = viewCounts(documents);
  const kinds = kindCounts(documents);
  const tags = libraryTags(documents);

  return (
    <aside className="flex min-w-0 flex-col p-3">
      <div className="flex items-center gap-2.5 px-2 pb-5 text-foreground">
        <Logo size={20} /><span className="font-serif text-[21px] leading-none">Offshelf</span>
      </div>
      <nav aria-label="Library views" className="flex flex-col gap-px">
        {NAV.map(([view, label, icon]) => (
          <Row
            key={view}
            active={query.view === view && !query.tag}
            icon={icon}
            label={label}
            count={counts[view]}
            onClick={() => onQueryChange({ view, tag: "", kind: "all" })}
          />
        ))}
      </nav>
      <div className="px-2 pt-4 pb-1 text-[11px] text-muted-foreground">Sources</div>
      <div className="flex flex-col gap-px">
        <Row active={query.kind === "post"} icon={<MessageCircle className="size-[15px]" aria-hidden />} label="X posts" count={kinds.post} onClick={() => onQueryChange({ view: "all", tag: "", kind: "post" })} />
        <Row active={query.kind === "article"} icon={<FileText className="size-[15px]" aria-hidden />} label="Articles" count={kinds.article} onClick={() => onQueryChange({ view: "all", tag: "", kind: "article" })} />
      </div>
      {tags.length > 0 && (
        <>
          <div className="px-2 pt-4 pb-1 text-[11px] text-muted-foreground">Tags</div>
          <div className="flex flex-col gap-px">
            {tags.map(tag => (
              <Row key={tag} active={query.tag === tag} icon={<Tag className="size-[15px]" aria-hidden />} label={tag} onClick={() => onQueryChange({ tag: query.tag === tag ? "" : tag, view: "all", kind: "all" })} />
            ))}
          </div>
        </>
      )}
      <div className="mt-auto flex items-center gap-2.5 px-2 pt-4 pb-2">
        <Lock className="size-[15px] shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-foreground">On this device</div>
          <div className="truncate text-[11.5px] text-muted-foreground">{documents.length} saved · {formatBytes(storageBytes(assets))}</div>
        </div>
      </div>
      <Button variant="ghost" className="justify-start" onClick={onOpenSettings}>
        <Settings className="size-[15px]" aria-hidden />Settings
      </Button>
    </aside>
  );
}
