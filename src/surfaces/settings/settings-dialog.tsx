import type { Settings } from "../../core/model";
import { AnimatedHeight } from "../../ui/animated-height";
import { Dialog, DialogContent } from "../../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { LibraryTab } from "./library-tab";
import { PermissionsTab } from "./permissions-tab";
import { ReadingTab } from "./reading-tab";
import { SavingTab } from "./saving-tab";

export type SettingsTab = "reading" | "saving" | "library" | "permissions";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: SettingsTab;
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  onChanged: () => Promise<void>;
};

export function SettingsDialog({ open, onOpenChange, initialTab, settings, onSave, onChanged }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Settings" description="Everything stays in this browser. No account required.">
        {/* Key lands each entry point on its tab. */}
        <Tabs key={initialTab} defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="reading">Reading</TabsTrigger>
            <TabsTrigger value="saving">Saving</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>
          <AnimatedHeight className="max-h-[60vh] overflow-auto px-[18px] pb-4">
            <TabsContent value="reading">
              <ReadingTab settings={settings} onSave={onSave} />
            </TabsContent>
            <TabsContent value="saving">
              <SavingTab settings={settings} onSave={onSave} />
            </TabsContent>
            <TabsContent value="library">
              <LibraryTab onChanged={onChanged} />
            </TabsContent>
            <TabsContent value="permissions">
              <PermissionsTab />
            </TabsContent>
          </AnimatedHeight>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
