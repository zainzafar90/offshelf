import type { Asset, SavedDocument } from "../../core/model";
import { libraryBodyState } from "../../features/library/library-body-state";
import { Button } from "../../ui/button";
import { EmptyState } from "./empty-state";
import { LibraryGrid } from "./library-grid";

type LibraryBodyProps = {
  documents: SavedDocument[];
  visible: SavedDocument[];
  assets: Map<string, Asset>;
  loading: boolean;
  error?: string;
  search: string;
  layout: "grid" | "list";
  page: number;
  onRefresh: () => void;
  onSavePage: () => void;
  onTryReader: () => void;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  onStar: (doc: SavedDocument) => void;
};

export function LibraryBody(props: LibraryBodyProps) {
  const { documents, visible, assets, loading, error, search, layout, page } = props;
  const bodyState = libraryBodyState({ loading, error, visibleCount: visible.length });

  switch (bodyState) {
    case "loading":
      return null;
    case "error":
      return (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center text-muted-foreground">
          <p className="text-[12.5px]">{`Offshelf could not open the library: ${error}`}</p>
          <Button variant="outline" onClick={props.onRefresh}>Try again</Button>
        </div>
      );
    case "empty":
      return <EmptyState filtered={documents.length > 0} search={search} onSavePage={props.onSavePage} onTryReader={props.onTryReader} />;
    case "populated":
      return <LibraryGrid documents={visible} assets={assets} layout={layout} page={page} onLoadMore={props.onLoadMore} onOpen={props.onOpen} onStar={props.onStar} />;
  }
}
