export type QuoteCite = { author: string; handle?: string; avatarAssetId?: string };

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean; href?: string };

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "heading"; content: Inline[]; level: 1 | 2 | 3 | 4 | 5 | 6; anchor: string }
  | { type: "image"; assetId: string; alt: string; caption?: string }
  | { type: "quote"; blocks: Block[]; cite?: QuoteCite }
  | { type: "list"; ordered: boolean; start: number; items: Block[][] }
  | { type: "code"; text: string; language?: string }
  | { type: "table"; rows: Inline[][][]; header: boolean }
  | { type: "embed"; url: string; label: string; posterAssetId?: string }
  | { type: "rule" };

export type Section = {
  id: string; sourceUrl: string; author?: string; handle?: string; publishedAt?: string;
  relation?: "selected" | "candidate"; excluded?: boolean; avatarAssetId?: string; blocks: Block[];
};

export type DocumentKind = "article" | "thread" | "x-article" | "selection";

export type Completeness = "page-snapshot" | "partial" | "unverified";

export type Warning = { code: string; message: string };

export type SavedDocument = {
  schemaVersion: 1; id: string; sourceUrl: string; title: string; author: string; siteName: string;
  kind: DocumentKind; excerpt: string; capturedAt: string; updatedAt: string; publishedAt?: string;
  sections: Section[]; assetIds: string[]; warnings: Warning[]; completeness: Completeness;
  wordCount: number; readingMinutes: number; starred: boolean; archived: boolean; read: boolean;
  progress: number; tags: string[];
};

export type AssetDescriptor = { id: string; sourceUrl: string; alt: string };

type AssetStatus = "pending" | "saved" | "failed" | "permission";

export type Asset = AssetDescriptor & {
  status: AssetStatus; blob?: Blob; bytes: number; mime?: string; attempts: number; error?: string; updatedAt: string;
};

export type Snapshot = { document: SavedDocument; assets: AssetDescriptor[] };

export type CaptureMode = "auto" | "article" | "thread" | "selection" | "area";

export type JobStatus = "capturing" | "downloading" | "done" | "failed" | "cancelled" | "interrupted";

export type CaptureJob = {
  id: string; tabId: number; sourceUrl: string; documentId: string; title: string; status: JobStatus;
  message: string; error?: string; createdAt: string; updatedAt: string; posts: number; images: number; savedImages: number;
  options: { mode: CaptureMode; autoScroll: boolean; maxPasses: number };
};

export type Settings = {
  theme: "light" | "dark" | "system"; readerFont: "serif" | "sans"; fontSize: number;
  readerWidth: "comfortable" | "wide"; threadStyle: "continuous" | "cards";
  autoScroll: boolean; maxPasses: number; openReader: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "light", readerFont: "serif", fontSize: 20, readerWidth: "comfortable",
  threadStyle: "continuous", autoScroll: true, maxPasses: 24, openReader: true,
};

export const SETTING_RANGES = { fontSize: { min: 15, max: 26 }, maxPasses: { min: 1, max: 80 } } as const;

export const LIMITS = {
  maxAssetBytes: 20 * 1024 * 1024,
  maxCaptureBytes: 180 * 1024 * 1024,
  maxBackupBytes: 250 * 1024 * 1024,
  maxAssets: 150,
  maxPosts: 150,
  maxBlocks: 7000,
  maxTextChars: 600_000,
  fetchTimeoutMs: 15_000,
  imageRetries: 2,
  imageBackoffMs: [500, 1500],
  retryAfterCapMs: 5000,
  maxRequestsPerHost: 2,
  maxCaptureMs: 90_000,
} as const;
