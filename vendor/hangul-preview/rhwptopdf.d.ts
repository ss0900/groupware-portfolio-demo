declare namespace wasm_bindgen {
    /* tslint:disable */
    /* eslint-disable */

    /**
     * `analyzeHwp(bytes)` 결과 — `{ pageCount, fontsRequired }`.
     */
    export class AnalyzeResult {
        private constructor();
        free(): void;
        [Symbol.dispose](): void;
        readonly fontsRequired: string[];
        readonly pageCount: number;
    }

    /**
     * HWP/HWPX 바이트를 분석하여 페이지 수와 사용 폰트 family 목록을 반환한다.
     */
    export function analyzeHwp(bytes: Uint8Array): AnalyzeResult;

    /**
     * 등록된 PDF 변환용 폰트를 모두 해제한다.
     */
    export function clearPdfFonts(): void;

    /**
     * HWP 파일에서 썸네일 이미지만 경량 추출 (전체 파싱 없이).
     *
     * 반환: JSON `{ "format": "png"|"gif", "base64": "...", "width": N, "height": N }`
     * PrvImage 가 없으면 `null` 반환.
     */
    export function extractThumbnail(data: Uint8Array): any;

    /**
     * HWP/HWPX 바이트를 multi-page PDF 바이트로 변환한다.
     *
     * 각 페이지를 SVG 로 렌더한 뒤 `svg2pdf` 로 XObject 청크로 변환하고,
     * `pdf-writer` 로 page tree 를 직접 조립하여 하나의 PDF 로 합친다.
     *
     * 한글 글리프는 빌드 시 임베드된 `EMBEDDED_FONTS` 가 usvg fontdb 에 등록되어
     * 사용된다. 문서가 임베드 폰트와 다른 family 를 지정한 경우 usvg 의 family
     * fallback 으로 처리된다 (정확 매칭이 필요하면 SVG 단계에서
     * `HwpDocument::renderPageSvgWithFonts` 로 임베드한 SVG 를 별도 경로로 사용).
     */
    export function hwpToPdf(bytes: Uint8Array): Uint8Array;

    /**
     * WASM panic hook 초기화 (한 번만 실행)
     */
    export function init_panic_hook(): void;

    /**
     * 디버깅: 현재 등록된 PDF 폰트 수와 fallback family 를 JSON 으로 반환.
     */
    export function pdfFontStatus(): string;

    /**
     * TTF/OTF 폰트 바이트를 PDF 변환용 fontdb 에 등록한다.
     *
     * 같은 폰트를 여러 번 호출하면 중복 등록된다 (`clearPdfFonts` 로 초기화).
     * 추출한 family name 을 keyword 로 serif / sans-serif 계열을 판별하여 해당 generic
     * fallback 으로 지정한다. 한 쪽만 등록된 상태에서는 다른 generic 도 같은 family 로
     * 채워둠 → 한 폰트만 있을 때 모든 글리프가 그 폰트로 fallback.
     * 반환값: 자동 추출된 family name (디버깅용). family 추출 실패 시 빈 문자열.
     */
    export function registerPdfFont(data: Uint8Array): string;

    export function version(): string;

}
declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_analyzeresult_free: (a: number, b: number) => void;
    readonly analyzeHwp: (a: number, b: number) => [number, number, number];
    readonly analyzeresult_fontsRequired: (a: number) => [number, number];
    readonly analyzeresult_pageCount: (a: number) => number;
    readonly clearPdfFonts: () => void;
    readonly extractThumbnail: (a: number, b: number) => any;
    readonly hwpToPdf: (a: number, b: number) => [number, number, number, number];
    readonly pdfFontStatus: () => [number, number];
    readonly registerPdfFont: (a: number, b: number) => [number, number];
    readonly version: () => [number, number];
    readonly init_panic_hook: () => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
