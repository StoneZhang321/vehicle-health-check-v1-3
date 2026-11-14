/** 中文：V1.3本机保存模型；报告拥有生成时的独立事实。 English: V1.3 local records; reports own their frozen facts. */
import type { FrozenInspectionPlan, InspectionMode, Locale, TaskObservation, WorkflowVehicleContext, LocalizedUnitPreferences, Market } from "../domain/types";
import type { ScoreResult } from "../domain/scoring";

export type MaterialKind = "history" | "maintenance" | "ownership" | "recalls";
export interface Material { kind: MaterialKind; text: string; sourceName: string; sourceUrl: string; fileIds: string[] }
export interface Supplement { id: string; title: string; note: string }
export interface VehicleInput {
  name: string; make: string; model: string; year: string; vin: string;
  mileage: string; mileageUnit: "km" | "mile"; region: string;
  context: WorkflowVehicleContext;
}
export interface Vehicle extends VehicleInput { id: string; createdAt: string; updatedAt: string; deletedAt: string | null }
export interface Inspection {
  id: string; vehicleId: string; mode: InspectionMode; plan: FrozenInspectionPlan;
  observations: TaskObservation[]; currentTaskEntryId: string | null;
  materials: Material[]; supplements: Supplement[];
  continuedFrom: string | null; createdAt: string; updatedAt: string; deletedAt: string | null;
}
export interface Attachment { id: string; name: string; mimeType: string; size: number; sha256: string; createdAt: string }
/** 中文：附件通过不可变ID引用，原记录编辑不会改变已保存报告。 English: Immutable file IDs keep report evidence independent of later edits. */
export interface Report {
  id: string; inspectionId: string; locale: Locale; generatedAt: string; appVersion: "1.3.0";
  vehicle: Vehicle; inspection: Inspection; score: ScoreResult; fileIds: string[]; deletedAt: string | null;
}
export interface Settings { locale: Locale; market: Market; units: LocalizedUnitPreferences; theme: "system" | "light" | "dark" }
export interface LocalState {
  format: "vhcinspect-state-1.3"; revision: number;
  vehicles: Vehicle[]; inspections: Inspection[]; reports: Report[]; attachments: Attachment[]; settings: Settings;
}
export type TrashKind = "vehicle" | "inspection" | "report";
export type AttachmentTarget = { inspectionId: string; taskEntryId: string } | { inspectionId: string; materialKind: MaterialKind };
export const defaultUnits = (market: Market): LocalizedUnitPreferences => market === "US"
  ? { distance: "mile", temperature: "F", pressure: "PSI", currency: "USD" }
  : { distance: "km", temperature: "C", pressure: "kPa", currency: market === "CA" ? "CAD" : "CNY" };
/** 中文：首次默认跟随浏览器语言，用户设置之后只读已保存值。 English: First use follows browser language; subsequent launches use saved preferences. */
export function emptyState(): LocalState {
  const locale: Locale = typeof navigator !== "undefined" && navigator.language.startsWith("zh") ? "zh-CN" : "en";
  const market = locale === "zh-CN" ? "CN" : "US";
  return { format: "vhcinspect-state-1.3", revision: 0, vehicles: [], inspections: [], reports: [], attachments: [],
    settings: { locale, market, units: defaultUnits(market), theme: "system" } };
}

