import type { Asset, SavedDocument } from "../../core/model";
import { cn } from "../../lib/utils";
import type { UrlFor } from "./blocks/block-view";
import { BlockView } from "./blocks/block-view";

type ThreadViewProps = {
  doc: SavedDocument;
  assets: Map<string, Asset>;
  urlFor: UrlFor;
  cards: boolean;
};

// One continuous read with an "n / N" marker per post, or (threadStyle "cards")
// each post as its own bordered card.
export function ThreadView({ doc, assets, urlFor, cards }: ThreadViewProps) {
  const posts = doc.sections.filter(section => !section.excluded);

  return (
    <div>
      {posts.map((section, index) => (
        <div
          key={section.id}
          id={`offshelf-post-${index + 1}`}
          data-thread-post
          className={cn(cards ? "mb-3 rounded-[10px] border border-border p-4" : "border-t border-border py-[18px] first:border-t-0 first:pt-0")}
        >
          <div className="mb-1.5 text-[11.5px] text-muted-foreground">{index + 1} / {posts.length}</div>
          <BlockView blocks={section.blocks} assets={assets} urlFor={urlFor} variant="reader" />
        </div>
      ))}
    </div>
  );
}
