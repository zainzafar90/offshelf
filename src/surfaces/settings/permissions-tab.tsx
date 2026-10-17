import { useEffect, useState } from "react";
import { errorMessage } from "../../core/errors";
import { listHostAccess, revokeHostAccess } from "../../storage/host-permissions";
import { Button } from "../../ui/button";
import { toast } from "../shared/toast";

const MUTED_NOTE = "m-0 py-3 text-[12px] text-muted-foreground";

export function PermissionsTab() {
  const [origins, setOrigins] = useState<string[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listHostAccess().then(
      result => {
        if (!cancelled) setOrigins(result);
      },
      error => {
        if (cancelled) return;

        setLoadFailed(true);
        toast(errorMessage(error), "error");
      },
    );

    return () => { cancelled = true; };
  }, []);

  const revoke = async (origin: string) => {
    try {
      await revokeHostAccess(origin);
    } catch (error) {
      toast(errorMessage(error), "error");

      return;
    }

    setOrigins(current => (current ?? []).filter(item => item !== origin));
    toast("Access revoked. Saved offline images are unchanged.");
  };

  if (loadFailed) return <p className={MUTED_NOTE}>Could not load website access.</p>;

  if (origins === null) return <p role="status" className={MUTED_NOTE}>Loading website access…</p>;

  if (origins.length === 0) {
    return (
      <p className={MUTED_NOTE}>
        No persistent website access granted. Offshelf asks only when an image needs it.
      </p>
    );
  }

  return (
    <div className="flex flex-col py-1">
      {origins.map(origin => (
        <div key={origin} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
          <code className="truncate text-[12px] text-foreground">{origin}</code>
          <Button variant="outline" size="sm" onClick={() => void revoke(origin)}>Revoke</Button>
        </div>
      ))}
    </div>
  );
}
