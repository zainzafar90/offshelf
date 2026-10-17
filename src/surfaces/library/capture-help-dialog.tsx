import { Dialog, DialogContent } from "../../ui/dialog";
import { Kbd } from "../../ui/kbd";

type CaptureHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STEPS: [string, string, string][] = [
  ["1", "Open an article or X thread", "For threads, open the first post when possible. Log in normally where needed."],
  ["2", "Click Offshelf in your toolbar", "Pin the extension from Chrome’s puzzle-piece menu for easy access."],
  ["3", "Choose Save this page", "Keep the source tab open. The popup can close while capture continues."],
];

export function CaptureHelpDialog({ open, onOpenChange }: CaptureHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Save a page" description="Offshelf captures the page you’re already reading.">
        <div className="flex flex-col gap-4 px-[18px] pb-5">
          {STEPS.map(([number, title, description]) => (
            <div key={number} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-foreground">{number}</span>
              <div>
                <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
                <p className="text-[12px] text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-[8px] bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            <span>Or save the active page with</span>
            <Kbd>Alt + Shift + S</Kbd>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Some pages restrict access. Offshelf does not bypass paywalls or recover deleted, private, or unloaded posts.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
