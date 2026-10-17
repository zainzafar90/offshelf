import { useState } from "react";
import type { Asset, SavedDocument } from "../../core/model";
import { errorMessage } from "../../core/errors";
import { hostname } from "../../core/url";
import type { MissingMedia } from "../../features/reader/missing-media";
import { missingMedia } from "../../features/reader/missing-media";
import { Button } from "../../ui/button";
import { Dialog, DialogContent } from "../../ui/dialog";
import { toast } from "../shared/toast";
import { requestHostAccess } from "../../storage/host-permissions";
import { sendToWorker } from "../../storage/worker-client";

type MediaDialogProps = {
  doc: SavedDocument;
  assets: Map<string, Asset>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => Promise<void>;
};

type MediaFormProps = Pick<MediaDialogProps, "doc" | "onOpenChange" | "onChanged"> & Pick<MissingMedia, "missing" | "origins">;

function MediaForm({ doc, missing, origins, onOpenChange, onChanged }: MediaFormProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(origins));
  const [busy, setBusy] = useState(false);

  const toggleOrigin = (origin: string) => setSelected(previous => {
    const next = new Set(previous);

    if (next.has(origin)) next.delete(origin); else next.add(origin);

    return next;
  });

  const retryImages = async () => {
    await sendToWorker({ type: "offshelf:retry-images", documentId: doc.id });
    toast("Retrying missing images.");
    onOpenChange(false);
    await onChanged();
  };

  const runBusy = async (task: () => Promise<void>) => {
    setBusy(true);

    try {
      await task();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const allowAndRetry = () => {
    const requested = [...selected];

    if (busy) return;

    if (!requested.length) {
      toast("Select at least one image host.", "error");

      return;
    }

    /* permissions.request must run synchronously in the click. */
    void runBusy(async () => {
      const granted = await requestHostAccess(requested);

      if (!granted) {
        toast("Permission was not granted. The saved text is unchanged.", "error");

        return;
      }

      await retryImages();
    });
  };

  if (missing.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-[18px] pb-5">
        <p className="text-[12.5px] text-muted-foreground">Every captured image is available offline.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-[18px] pb-5">
      <p className="text-[12px] text-muted-foreground">
        Image hosts may need permission before Offshelf can download their files. Only the selected hosts receive persistent access. You can revoke it in Settings.
      </p>
      {origins.map(origin => (
        <label key={origin} className="flex items-center gap-2.5 text-[12.5px] text-foreground">
          <input type="checkbox" checked={selected.has(origin)} onChange={() => toggleOrigin(origin)} />
          {origin}
        </label>
      ))}
      <div className="flex gap-2">
        {origins.length > 0 && <Button disabled={busy} onClick={allowAndRetry}>Allow selected hosts & retry</Button>}
        <Button variant="outline" disabled={busy} onClick={() => void runBusy(retryImages)}>Retry without new access</Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {missing.map(asset => (
          <div key={asset.id} className="text-[11.5px]">
            <strong className="text-foreground">{asset.alt || hostname(asset.sourceUrl)}</strong>{" "}
            <span className="text-muted-foreground">{asset.error || "Not downloaded yet."}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Form state lives in the content, which unmounts on close. */
export function MediaDialog({ doc, assets, open, onOpenChange, onChanged }: MediaDialogProps) {
  const { missing, origins, total, saved } = missingMedia(doc, assets);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keep the images, too." description={`${saved} of ${total} images are stored on this device.`}>
        <MediaForm doc={doc} missing={missing} origins={origins} onOpenChange={onOpenChange} onChanged={onChanged} />
      </DialogContent>
    </Dialog>
  );
}
