import { sniffImage } from "../../src/core/image-format";

test("sniffImage detects PNG and JPEG and rejects text", () => {
  expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  expect(sniffImage(new TextEncoder().encode("<html>"))).toBeFalsy();
});

test("sniffImage detects GIF, WebP, AVIF and BMP by signature", () => {
  const ascii = (text: string, pad = 0) => new Uint8Array([...new TextEncoder().encode(text), ...new Array(pad).fill(0)]);
  expect(sniffImage(ascii("GIF87a"))).toBe("image/gif");
  expect(sniffImage(ascii("GIF89a"))).toBe("image/gif");
  expect(sniffImage(ascii("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  expect(sniffImage(ascii("\0\0\0\x18ftypavif"))).toBe("image/avif");
  expect(sniffImage(ascii("\0\0\0\x18ftypavis"))).toBe("image/avif");
  expect(sniffImage(ascii("BM\0\0"))).toBe("image/bmp");
});

test("sniffImage rejects SVG, empty input, near-misses and non-image ftyp brands", () => {
  const ascii = (text: string) => new TextEncoder().encode(text);
  expect(sniffImage(ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeUndefined();
  expect(sniffImage(new Uint8Array())).toBeUndefined();
  expect(sniffImage(ascii("RIFF\0\0\0\0WAVEfmt "))).toBeUndefined();
  expect(sniffImage(ascii("\0\0\0\x18ftypmp42"))).toBeUndefined();
  expect(sniffImage(new Uint8Array([0xff, 0xd8, 0x00]))).toBeUndefined();
  expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x00]))).toBeUndefined();
});
