/** 中文：沿用已验证的JPEG页面PDF封装，不访问浏览器或旧报告协议。 English: Reuse the proven JPEG-page PDF container without browser access or old report protocols. */
export interface RasterPdfPage {
    jpegBytes: Uint8Array;
    width: number;
    height: number;
}
const UTF8 = new TextEncoder();
const PAGE_WIDTH_PT = 595.28, PAGE_HEIGHT_PT = 841.89;
const MAX_PDF_RASTER_BYTES = 256 * 1024 * 1024;
class ByteWriter {
    private readonly chunks: Uint8Array[] = [];
    length = 0;
    /** 中文：按UTF-8写入PDF语法。 English: Encode PDF syntax as UTF-8. */
    pushText(value: string): void {
        this.pushBytes(UTF8.encode(value));
    }
    /** 中文：记录实际字节长度以构造交叉引用表。 English: Count actual bytes for cross-reference offsets. */
    pushBytes(value: Uint8Array): void {
        this.chunks.push(value);
        this.length += value.byteLength;
    }
    /** 中文：按写入顺序合并编码片段。 English: Join encoded chunks in write order. */
    finish(): Uint8Array<ArrayBuffer> {
        const output = new Uint8Array(this.length);
        let offset = 0;
        for (const chunk of this.chunks) {
            output.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return output;
    }
}
/** 中文：为实际JPEG页面构造PDF对象、页面树和精确字节索引。 English: Build PDF objects, page trees and exact byte offsets for rendered JPEG pages. */
export function assembleRasterPdf(pages: readonly RasterPdfPage[]): Uint8Array<ArrayBuffer> {
    if (pages.length === 0) {
        throw new Error("At least one raster page is required.");
    }
    let totalRasterBytes = 0;
    for (const page of pages) {
        if (!(page.jpegBytes instanceof Uint8Array) ||
            page.jpegBytes.byteLength === 0) {
            throw new Error("Every raster page must contain JPEG bytes.");
        }
        if (!Number.isInteger(page.width) ||
            !Number.isInteger(page.height) ||
            page.width <= 0 ||
            page.height <= 0) {
            throw new Error("Raster page dimensions must be positive integers.");
        }
        totalRasterBytes += page.jpegBytes.byteLength;
        if (totalRasterBytes > MAX_PDF_RASTER_BYTES) {
            throw new Error("The PDF exceeds the supported memory budget.");
        }
    }
    const writer = new ByteWriter();
    // 中文：只写产品版本，PDF元数据不重复保存车辆私密资料。 English: Metadata identifies only the product version, without duplicating private vehicle data.
    const objectCount = 3 + pages.length * 3;
    const offsets = new Array<number>(objectCount + 1).fill(0);
    writer.pushText("%PDF-1.7\n");
    writer.pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    /** 中文：记录每个PDF对象的字节位置。 English: Record each PDF object’s byte offset. */
    const writeObject = (objectNumber: number, writeBody: () => void): void => {
        offsets[objectNumber] = writer.length;
        writer.pushText(`${objectNumber} 0 obj\n`);
        writeBody();
        writer.pushText("\nendobj\n");
    };
    writeObject(1, () => {
        writer.pushText("<< /Type /Catalog /Pages 2 0 R >>");
    });
    const pageObjectNumbers = pages.map((_, index) => 6 + index * 3);
    writeObject(2, () => {
        writer.pushText(`<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers
            .map((number) => `${number} 0 R`)
            .join(" ")}] >>`);
    });
    writeObject(3, () => {
        writer.pushText("<< /Producer (Vehicle Health Check 1.3.0) >>");
    });
    pages.forEach((page, index) => {
        const imageObject = 4 + index * 3;
        const contentObject = imageObject + 1;
        const pageObject = imageObject + 2;
        const imageName = `Im${index + 1}`;
        writeObject(imageObject, () => {
            writer.pushText(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.byteLength} >>\nstream\n`);
            writer.pushBytes(page.jpegBytes);
            writer.pushText("\nendstream");
        });
        const contentStream = `q\n${PAGE_WIDTH_PT} 0 0 ${PAGE_HEIGHT_PT} 0 0 cm\n` +
            `/${imageName} Do\nQ\n`;
        const contentBytes = UTF8.encode(contentStream);
        writeObject(contentObject, () => {
            writer.pushText(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
            writer.pushBytes(contentBytes);
            writer.pushText("endstream");
        });
        writeObject(pageObject, () => {
            writer.pushText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] ` +
                `/Resources << /ProcSet [/PDF /ImageC] /XObject << /${imageName} ${imageObject} 0 R >> >> ` +
                `/Contents ${contentObject} 0 R >>`);
        });
    });
    const xrefOffset = writer.length;
    writer.pushText(`xref\n0 ${objectCount + 1}\n`);
    writer.pushText("0000000000 65535 f \n");
    for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
        writer.pushText(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`);
    }
    writer.pushText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info 3 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`);
    return writer.finish();
}
