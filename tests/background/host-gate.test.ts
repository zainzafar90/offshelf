import { createHostGate, hostKey } from "../../src/background/host-gate";

describe("createHostGate", () => {
  test("queues acquisitions past the limit until a slot is released", async () => {
    const gate = createHostGate(2);
    const first = await gate.acquire("a.com");
    await gate.acquire("a.com");
    let third = false;
    const pending = gate.acquire("a.com").then(release => { third = true; return release; });
    await Promise.resolve();
    expect(third).toBe(false);
    first();
    await pending;
    expect(third).toBe(true);
  });
  test("hosts are limited independently and release is idempotent", async () => {
    const gate = createHostGate(1);
    const release = await gate.acquire("a.com");
    await gate.acquire("b.com");
    release();
    release();
    await gate.acquire("a.com");
    let blocked = true;
    void gate.acquire("a.com").then(() => { blocked = false; });
    await Promise.resolve();
    expect(blocked).toBe(true);
  });
  test("hostKey only keys http(s) URLs", () => {
    expect(hostKey("https://img.example.com/a.png")).toBe("img.example.com");
    expect(hostKey("data:image/png;base64,AAAA")).toBeUndefined();
    expect(hostKey("not a url")).toBeUndefined();
  });
});
