import { sendToWorker } from "../../src/storage/worker-client";

const sendMessage = vi.fn();
beforeEach(() => {
  sendMessage.mockReset();
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
});
afterEach(() => vi.unstubAllGlobals());

describe("sendToWorker", () => {
  test("sends the request and returns the reply payload", async () => {
    sendMessage.mockResolvedValue({ ok: true, job: { id: "j1" } });
    const reply = await sendToWorker({ type: "offshelf:start", tabId: 3, mode: "auto" });
    expect(sendMessage).toHaveBeenCalledWith({ type: "offshelf:start", tabId: 3, mode: "auto" });
    expect(reply.job).toEqual({ id: "j1" });
  });
  test("throws the worker error text", async () => {
    sendMessage.mockResolvedValue({ ok: false, error: "Document not found." });
    await expect(sendToWorker({ type: "offshelf:delete", documentId: "d" })).rejects.toThrow("Document not found.");
  });
  test("throws a generic error when the failure has no text", async () => {
    sendMessage.mockResolvedValue({ ok: false });
    await expect(sendToWorker({ type: "offshelf:changed" })).rejects.toThrow("The Offshelf background worker failed.");
  });
  test.each([undefined, null, "ok", 1, {}, { ok: "true" }, { error: "x" }])("rejects the malformed reply %j", async reply => {
    sendMessage.mockResolvedValue(reply);
    await expect(sendToWorker({ type: "offshelf:changed" })).rejects.toThrow("The Offshelf background worker did not respond.");
  });
  test("passes through a rejected send", async () => {
    sendMessage.mockRejectedValue(new Error("Could not establish connection."));
    await expect(sendToWorker({ type: "offshelf:changed" })).rejects.toThrow("Could not establish connection.");
  });
});
