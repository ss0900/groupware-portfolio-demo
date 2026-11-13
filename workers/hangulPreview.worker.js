/* Dedicated, disposable worker: document bytes never leave this browser. */
const vendorUrl = new URL("../vendor/hangul-preview/", self.location.href);
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_PDF_BYTES = 100 * 1024 * 1024;

self.onmessage = async ({ data }) => {
  let ready = false;
  try {
    const { buffer, extension } = data;
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 8) {
      self.postMessage({ ok: false, code: "invalid" });
      return;
    }
    if (buffer.byteLength > MAX_SOURCE_BYTES) {
      self.postMessage({ ok: false, code: "size" });
      return;
    }
    const bytes = new Uint8Array(buffer);
    const cfb = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    const signature = new TextDecoder().decode(bytes.subarray(0, 24));
    const valid = extension === "hwpx"
      ? bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
      : extension === "hwp" && (cfb.every((value, index) => bytes[index] === value) || signature.startsWith("HWP Document File V3.00"));
    if (!valid) {
      self.postMessage({ ok: false, code: "invalid" });
      return;
    }
    importScripts(new URL("rhwptopdf.umd.js", vendorUrl).href);
    await self.RhwpToPdf({ module_or_path: new URL("rhwptopdf.umd_bg.wasm", vendorUrl).href });
    for (const name of ["NanumGothic-Regular.ttf", "NanumMyeongjo-Regular.ttf"]) {
      const response = await fetch(new URL(name, vendorUrl));
      if (!response.ok) throw new Error("Font unavailable");
      self.RhwpToPdf.registerPdfFont(new Uint8Array(await response.arrayBuffer()));
    }
    ready = true;
    const info = self.RhwpToPdf.analyzeHwp(bytes);
    const pageCount = info.pageCount;
    info.free();
    if (!pageCount || pageCount > 200) {
      self.postMessage({ ok: false, code: pageCount > 200 ? "pages" : "invalid" });
      return;
    }
    const pdf = self.RhwpToPdf.hwpToPdf(bytes);
    if (pdf.byteLength > MAX_PDF_BYTES) throw new Error("PDF too large");
    self.postMessage({ ok: true, pdf }, [pdf.buffer]);
  } catch (error) {
    const encrypted = /password|encrypt|암호|배포용/i.test(String(error?.message || error));
    self.postMessage({ ok: false, code: !ready ? "engine" : encrypted ? "encrypted" : "invalid" });
  }
};
