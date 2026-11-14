/** 中文：报告展示和显式导出的公共入口。 English: Public entry for report presentation and explicit export. */
export { ReportView, type ReportViewProps } from "./ReportView";
export { createReportPdfBlob, exportReportPdf, type ReportPdfVariant, type ReportPdfResult } from "./pdf";
export { THIRD_PARTY_STATEMENT, type GetReportFile } from "./presentation";
