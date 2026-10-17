import { sampleDocument } from "../helpers/fixtures";

test("reads a library created by the 0.3.0 schema", async () => {
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("offshelf-library", 1);
    open.onupgradeneeded = () => {
      const d = open.result;
      d.createObjectStore("documents", { keyPath: "id" });
      d.createObjectStore("assets", { keyPath: "id" });
      d.createObjectStore("jobs", { keyPath: "id" });
      d.createObjectStore("settings");
    };
    open.onsuccess = () => {
      const tx = open.result.transaction("documents", "readwrite");
      tx.objectStore("documents").put(sampleDocument({ id: "legacy" }));
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
  const store = await import("../../src/storage/library-store");
  expect((await store.getDocument("legacy"))?.id).toBe("legacy");
});
