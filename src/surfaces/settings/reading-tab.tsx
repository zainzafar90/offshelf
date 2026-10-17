import { Lock, Monitor, Moon, Sun } from "lucide-react";
import type { Settings } from "../../core/model";
import { Segmented } from "../../ui/segmented";
import { Select } from "../../ui/select";
import { Slider } from "../../ui/slider";
import { Item } from "./settings-item";
import { useSettingDraft } from "./use-setting-draft";

type ReadingTabProps = {
  settings: Settings;
  onSave: (patch: Partial<Settings>) => Promise<void>;
};

export function ReadingTab({ settings, onSave }: ReadingTabProps) {
  const [fontSize, setFontSize] = useSettingDraft(settings.fontSize);

  return (
    <div>
      <Item label="Appearance" helper="Follows your system unless you pick one.">
        <Segmented
          fit="content"
          ariaLabel="Appearance"
          value={settings.theme}
          options={[
            ["light", "Light", <Sun className="size-[13px]" aria-hidden />],
            ["dark", "Dark", <Moon className="size-[13px]" aria-hidden />],
            ["system", "System", <Monitor className="size-[13px]" aria-hidden />],
          ]}
          onChange={value => void onSave({ theme: value as Settings["theme"] })}
        />
      </Item>
      <Item label="Typeface" helper="For articles and threads in the reader.">
        <Select
          ariaLabel="Typeface"
          value={settings.readerFont}
          options={[["serif", "Serif"], ["sans", "Sans"]]}
          onValueChange={value => void onSave({ readerFont: value as Settings["readerFont"] })}
        />
      </Item>
      <Item label="Text size">
        <div className="flex items-center gap-2.5">
          <Slider
            ariaLabel="Text size"
            min={15}
            max={26}
            value={fontSize}
            onValueChange={setFontSize}
            onValueCommit={value => void onSave({ fontSize: value })}
          />
          <span className="w-[30px] text-[12px] text-muted-foreground">{fontSize}px</span>
        </div>
      </Item>
      <Item label="Reading width">
        <Select
          ariaLabel="Reading width"
          value={settings.readerWidth}
          options={[["comfortable", "Comfortable"], ["wide", "Wide"]]}
          onValueChange={value => void onSave({ readerWidth: value as Settings["readerWidth"] })}
        />
      </Item>
      <Item label="Threads" helper="One continuous read, or a card per post.">
        <Select
          ariaLabel="Thread layout"
          value={settings.threadStyle}
          options={[["continuous", "Continuous"], ["cards", "Post cards"]]}
          onValueChange={value => void onSave({ threadStyle: value as Settings["threadStyle"] })}
        />
      </Item>
      <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Lock className="size-[15px] shrink-0" aria-hidden />
        <p className="m-0">No analytics, AI, cloud accounts, or remote scripts. Image downloads contact the original image hosts. Links open only when you choose them.</p>
      </div>
    </div>
  );
}
