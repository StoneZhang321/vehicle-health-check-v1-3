/** 中文：稳定序列化与内容摘要，供计划与评分共享。 English: Stable serialization and content hashes shared by plans and scoring. */
export function workflowCanonicalJson(value: unknown): string {
    /** 中文：递归排序普通对象键、保留数组顺序并将负零归一为零；拒绝非有限数值及其他非 JSON 值。
     * English: Recursively sort plain-object keys, preserve array order, and normalize negative zero; reject non-finite numbers and other non-JSON values.
     */
    function normalize(input: unknown): unknown {
        if (input === null || typeof input === "string" || typeof input === "boolean")
            return input;
        if (typeof input === "number" && Number.isFinite(input))
            return Object.is(input, -0) ? 0 : input;
        if (Array.isArray(input))
            return input.map(normalize);
        if (input && typeof input === "object" && Object.getPrototypeOf(input) === Object.prototype) {
            return Object.fromEntries(Object.keys(input).sort().map((key) => [key, normalize((input as Record<string, unknown>)[key])]));
        }
        throw new Error("WORKFLOW_NON_JSON_VALUE");
    }
    return JSON.stringify(normalize(value));
}
/** 中文：对规范 JSON 的 UTF-8 字节计算 SHA-256，返回固定小写十六进制摘要。
 * English: Hash canonical JSON UTF-8 bytes with SHA-256 and return the lowercase hexadecimal digest.
 */
export async function workflowHash(value: unknown): Promise<string> {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workflowCanonicalJson(value)));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
