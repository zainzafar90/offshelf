import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Copy, Download, FileDown, FolderDown } from "lucide-react";
import type { Asset, SavedDocument } from "../../core/model";
import { errorMessage } from "../../core/errors";
import { copyMarkdown, exportHtml, exportMarkdownZip, exportPdf } from "../../exports/actions";
import { Button } from "../../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { toast } from "../shared/toast";

type ExportMenuProps = { doc: SavedDocument; assets: Map<string, Asset> };

type ExportOption = { label: string; description: string; icon: ReactNode; run: () => Promise<void> | void; toastMessage?: string };

const SEPARATOR_BEFORE_INDEX = 3;

export function ExportMenu({ doc, assets }: ExportMenuProps) {
  const [pending, setPending] = useState(false);
  const options: ExportOption[] = [
    { label: "HTML", description: "One file, with offline images", icon: <FileDown className="size-[15px]" aria-hidden />, run: () => exportHtml(doc, assets), toastMessage: "Offline HTML downloaded." },
    { label: "Markdown ZIP", description: "article.md + an assets folder", icon: <FolderDown className="size-[15px]" aria-hidden />, run: () => exportMarkdownZip(doc, assets), toastMessage: "Markdown archive downloaded." },
    { label: "PDF", description: "Chrome Print → Save as PDF", icon: <Download className="size-[15px]" aria-hidden />, run: () => exportPdf(doc) },
    { label: "Copy Markdown", description: "Image links stay online", icon: <Copy className="size-[15px]" aria-hidden />, run: () => copyMarkdown(doc, assets), toastMessage: "Markdown copied. Image links require internet access." },
  ];

  const run = async (option: ExportOption) => {
    if (pending) return;

    setPending(true);

    try {
      await option.run();

      if (option.toastMessage) toast(option.toastMessage);
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Download className="size-[15px]" aria-hidden />Export<ChevronDown className="size-[13px]" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[230px]">
        {options.map((option, index) => (
          <DropdownMenuItem
            key={option.label}
            disabled={pending}
            onSelect={() => void run(option)}
            className={index === SEPARATOR_BEFORE_INDEX ? "mt-1 h-auto border-t border-border py-2 pt-3" : "h-auto py-2"}
          >
            {option.icon}
            <span className="ml-2 flex flex-col">
              <strong className="font-medium text-foreground">{option.label}</strong>
              <small className="text-[11px] text-muted-foreground">{option.description}</small>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
