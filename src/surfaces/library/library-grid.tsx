import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Asset, SavedDocument } from "../../core/model";
import { PAGE_SIZE } from "../../features/library/library-query";
import { Button } from "../../ui/button";
import { ArticleCard } from "./article-card";
import { ListRow } from "./list-row";
import { PostCard } from "./post-card";

const ROW_PX = 4;
const GAP_PX = 12;

/* 4px rows; cells span their card's measured height. */
function MasonryCell({ children }: { children: ReactNode }) {
  const cell = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = cell.current;
    const card = element?.firstElementChild;

    if (!element || !card) return;

    const place = () => { element.style.gridRowEnd = `span ${Math.ceil((card.getBoundingClientRect().height + GAP_PX) / ROW_PX)}`; };

    place();
    const observer = new ResizeObserver(place);

    observer.observe(card);

    return () => observer.disconnect();
  }, []);

  return <div ref={cell}><div>{children}</div></div>;
}

type CardProps = Pick<LibraryGridProps, "assets" | "onOpen" | "onStar"> & { doc: SavedDocument };

function LibraryCard({ doc, ...rest }: CardProps) {
  if (doc.kind === "thread") return <PostCard doc={doc} {...rest} />;

  return <ArticleCard doc={doc} {...rest} />;
}

type LibraryGridProps = {
  documents: SavedDocument[];
  assets: Map<string, Asset>;
  layout: "grid" | "list";
  page: number;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  onStar: (doc: SavedDocument) => void;
};

export function LibraryGrid({ documents, assets, layout, page, onLoadMore, onOpen, onStar }: LibraryGridProps) {
  const visible = documents.slice(0, PAGE_SIZE * page);

  return (
    <>
      {layout === "grid" ? (
        <div className="grid grid-flow-row-dense auto-rows-[4px] grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-3">
          {visible.map(doc => (
            <MasonryCell key={doc.id}>
              <LibraryCard doc={doc} assets={assets} onOpen={onOpen} onStar={onStar} />
            </MasonryCell>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map(doc => <ListRow key={doc.id} doc={doc} assets={assets} onOpen={onOpen} onStar={onStar} />)}
        </div>
      )}
      {documents.length > visible.length && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onLoadMore}>Load more</Button>
        </div>
      )}
    </>
  );
}
