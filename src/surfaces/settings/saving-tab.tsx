import type { Settings } from "../../core/model";
import { SETTING_RANGES } from "../../core/model";
import { clampPasses } from "../../features/settings/passes";
import { cn } from "../../lib/utils";
import { focusRing } from "../../ui/focus-ring";
import { Switch } from "../../ui/switch";
import { Item } from "./settings-item";
import { useSettingDraft } from "./use-setting-draft";

type SavingTabProps = {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
};

export function SavingTab({ settings, onSave }: SavingTabProps) {
  const [passes, setPasses] = useSettingDraft(String(settings.maxPasses));

  const commitPasses = () => {
    const clamped = clampPasses(passes);

    setPasses(String(clamped));
    void onSave({ maxPasses: clamped });
  };

  return (
    <div>
      <Item label="Open reader after saving">
        <Switch
          ariaLabel="Open reader after saving"
          checked={settings.openReader}
          onCheckedChange={checked => void onSave({ openReader: checked })}
        />
      </Item>
      <Item label="Load thread continuations" helper="Scrolls the source tab, then restores your position.">
        <Switch
          ariaLabel="Load thread continuations"
          checked={settings.autoScroll}
          onCheckedChange={checked => void onSave({ autoScroll: checked })}
        />
      </Item>
      <Item label="Maximum scroll passes" helper="Capture also stops after 90 seconds. Completeness stays unverified.">
        <input
          type="number"
          aria-label="Maximum scroll passes"
          min={SETTING_RANGES.maxPasses.min}
          max={SETTING_RANGES.maxPasses.max}
          value={passes}
          onChange={event => setPasses(event.target.value)}
          onBlur={commitPasses}
          className={cn("h-[34px] w-[70px] rounded-[7px] border border-border bg-card px-2.5 text-[12.5px] text-foreground", focusRing)}
        />
      </Item>
    </div>
  );
}
