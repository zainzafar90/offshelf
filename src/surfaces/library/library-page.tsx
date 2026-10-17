import { useState } from "react";
import type { SavedDocument } from "../../core/model";
import { errorMessage } from "../../core/errors";
import { addSamples } from "../../features/samples/samples";
import type { LibraryQuery } from "../../features/library/library-query";
import { queryDocuments } from "../../features/library/library-query";
import { ReaderView } from "../reader/reader-view";
import type { SettingsTab } from "../settings/settings-dialog";
import { SettingsDialog } from "../settings/settings-dialog";
import { toast } from "../shared/toast";
import { useLibrary } from "../shared/use-library";
import { useTheme } from "../shared/use-theme";
import { CaptureHelpDialog } from "./capture-help-dialog";
import { JobRows } from "./job-rows";
import { LibraryBody } from "./library-body";
import { SearchRow } from "./search-row";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { TitleBar, VIEW_LABELS } from "./title-bar";
import { useLibraryQuery } from "./use-library-query";
import { useReaderRoute } from "./use-reader-route";
import { useSearchShortcut } from "./use-search-shortcut";

export function LibraryPage() {
  const { documents, assets, jobs, settings, loading, error, refresh, update, saveProgress, remove, saveSettings } = useLibrary();
  const [query, patchQuery] = useLibraryQuery();
  const [page, setPage] = useState(1);
  const [layout, setLayoutState] = useState<"grid" | "list">(() => (localStorage.getItem("offshelf-layout-v3") === "list" ? "list" : "grid"));
  const [captureHelpOpen, setCaptureHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("reading");
  const searchInputRef = useSearchShortcut();

  useTheme(settings.theme);

  const openSettings = (tab: SettingsTab) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };
  const route = useReaderRoute({ documents, loading, remove, onSettingsLink: () => openSettings("reading") });

  const setQuery = (patch: Partial<LibraryQuery>) => {
    patchQuery(patch);
    setPage(1);
  };
  const setLayout = (next: "grid" | "list") => {
    setLayoutState(next);
    localStorage.setItem("offshelf-layout-v3", next);
  };
  const handleStar = (doc: SavedDocument) => void update(doc.id, { starred: !doc.starred });
  const handleTryReader = async () => {
    try {
      await addSamples();
      await refresh();
      toast("Added six original reading samples. All are labeled Sample.");
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };

  const filtered = queryDocuments(documents, query);
  const openDocument = route.openId ? documents.find(doc => doc.id === route.openId) : undefined;

  return (
    <div className="grid h-screen grid-cols-[216px_1fr] bg-page p-2.5 pl-0">
      <Sidebar
        query={query}
        onQueryChange={patch => {
          setQuery(patch);

          if (route.openId) route.closeReader();
        }}
        documents={documents}
        assets={assets}
        onOpenSettings={() => openSettings("reading")}
      />
      <main className="grid grid-rows-[auto_auto_auto_1fr_auto] overflow-hidden rounded-xl border border-border bg-background">
        {openDocument && (
          <ReaderView
            key={openDocument.id}
            doc={openDocument}
            assets={assets}
            settings={settings}
            crumb={query.tag || VIEW_LABELS[query.view]}
            onBack={route.closeReader}
            onChanged={refresh}
            onUpdate={update}
            onSaveProgress={saveProgress}
            onRemove={route.removeDocument}
            onDeleted={route.closeReaderAfterDelete}
            onOpenAppearance={() => openSettings("reading")}
          />
        )}
        {!route.openId && (
          <>
            <TitleBar query={query} onImport={() => openSettings("library")} onSavePage={() => setCaptureHelpOpen(true)} />
            <SearchRow query={query} onQueryChange={setQuery} resultCount={filtered.length} layout={layout} onLayoutChange={setLayout} searchInputRef={searchInputRef} />
            <div className="flex flex-col gap-3 overflow-auto px-[18px] py-3.5 pb-6">
              <JobRows jobs={jobs} documents={documents} onRefresh={refresh} />
              <LibraryBody
                documents={documents}
                visible={filtered}
                assets={assets}
                loading={loading}
                error={error}
                search={query.search}
                layout={layout}
                page={page}
                onRefresh={refresh}
                onSavePage={() => setCaptureHelpOpen(true)}
                onTryReader={handleTryReader}
                onLoadMore={() => setPage(p => p + 1)}
                onOpen={route.openDoc}
                onStar={handleStar}
              />
            </div>
            <StatusBar documents={documents} assets={assets} />
          </>
        )}
      </main>
      <CaptureHelpDialog open={captureHelpOpen} onOpenChange={setCaptureHelpOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
        settings={settings}
        onSave={saveSettings}
        onChanged={refresh}
      />
    </div>
  );
}
