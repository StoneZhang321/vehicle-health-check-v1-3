/** 中文：V1.3备份包含完整记录与附件字节；导入先校验再交给单一事务。 English: V1.3 backups contain records and attachment bytes; validate before handing them to one transaction. */
import { indexTaskObservations, validateWorkflowContext, type Locale } from "../domain";
import type { LocalState, Inspection, Vehicle, Material, Report } from "./model";
import { sha256Blob } from "./images";

export interface StoredFile { id: string; type: string; bytes: ArrayBuffer }
interface BackupFile { id: string; type: string; base64: string }
interface Backup { format: "vhcinspect-backup-1.3"; exportedAt: string; state: LocalState; files: BackupFile[] }
function invalid(): never { throw new Error("BACKUP_INVALID"); }
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
};
const text = (value: unknown): value is string => typeof value === "string";
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : invalid();
const uniqueIds = (values: unknown[]): void => {
  const ids = values.map(value => object(value).id);
  if (ids.some(value => !text(value) || !value) || new Set(ids).size !== ids.length) invalid();
};
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const nullableDate = (value: unknown) => value === null || (text(value) && Number.isFinite(Date.parse(value)));
const locale = (value: unknown): value is Locale => value === "zh-CN" || value === "en";

/** 中文：分块编码避免对大量附件字节展开函数参数。 English: Encode chunks without spreading large attachment buffers into function arguments. */
function base64(bytes: Uint8Array): string {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) result += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(result);
}
function bytes(encoded: string): ArrayBuffer {
  const binary = atob(encoded), result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index);
  return result.buffer;
}

/** 中文：保存导出时的独立状态，导出期间后续编辑不混入该备份。 English: Export a detached state so later edits cannot mix into the backup. */
export async function encodeBackup(state: LocalState, files: Map<string, Blob>): Promise<Blob> {
  const encoded: BackupFile[] = [];
  for (const metadata of state.attachments) {
    const file = files.get(metadata.id);
    if (!file || file.size !== metadata.size || await sha256Blob(file) !== metadata.sha256) throw new Error("ATTACHMENT_MISSING");
    encoded.push({ id: metadata.id, type: metadata.mimeType, base64: base64(new Uint8Array(await file.arrayBuffer())) });
  }
  const backup: Backup = { format: "vhcinspect-backup-1.3", exportedAt: new Date().toISOString(), state, files: encoded };
  return new Blob([JSON.stringify(backup)], { type: "application/json" });
}

function validateVehicle(value: unknown): asserts value is Vehicle {
  const row = object(value);
  for (const key of ["id", "name", "make", "model", "year", "vin", "mileage", "region", "createdAt", "updatedAt"]) if (!text(row[key])) invalid();
  if (!row.id || !String(row.name).trim() || !["km", "mile"].includes(String(row.mileageUnit)) || !nullableDate(row.deletedAt)) invalid();
  validateWorkflowContext(row.context as Vehicle["context"]);
}
function validateMaterials(value: unknown): asserts value is Material[] {
  const rows = list(value), kinds = new Set();
  for (const value of rows) {
    const row = object(value);
    if (!["history", "maintenance", "ownership", "recalls"].includes(String(row.kind)) || kinds.has(row.kind)) invalid();
    kinds.add(row.kind);
    if (!text(row.text) || !text(row.sourceName) || !text(row.sourceUrl) || !strings(row.fileIds)) invalid();
    if (row.sourceUrl.trim() && !/^https?:\/\//i.test(row.sourceUrl.trim())) invalid();
  }
}
function validateInspection(value: unknown): asserts value is Inspection {
  const row = object(value), plan = object(row.plan);
  if (!text(row.id) || !text(row.vehicleId) || !["quick", "full"].includes(String(row.mode)) || !nullableDate(row.deletedAt)) invalid();
  if (!text(row.createdAt) || !text(row.updatedAt) || !(row.continuedFrom === null || text(row.continuedFrom))) invalid();
  if (plan.contractVersion !== "vhc-inspection-plan-v1.3" || plan.mode !== row.mode || !text(plan.snapshotHash)) invalid();
  validateWorkflowContext(plan.context as Inspection["plan"]["context"]);
  const tasks = list(plan.tasks), sections = list(plan.sections), taskIds = new Set(tasks.map(task => object(task).entryId));
  if (taskIds.size !== tasks.length || !sections.length || !tasks.length) invalid();
  if (row.currentTaskEntryId !== null && !taskIds.has(row.currentTaskEntryId)) invalid();
  const observations = list(row.observations);
  if (observations.some(fact => object(fact).inspectionId !== row.id)) invalid();
  indexTaskObservations(row.plan as Inspection["plan"], observations as Inspection["observations"]);
  validateMaterials(row.materials);
  uniqueIds(list(row.supplements));
  for (const supplement of row.supplements as unknown[]) {
    const record = object(supplement);
    if (!text(record.title) || !text(record.note)) invalid();
  }
}
function validateReport(value: unknown): asserts value is Report {
  const row = object(value);
  if (!text(row.id) || !text(row.inspectionId) || !text(row.generatedAt) || row.appVersion !== "1.3.0" || !locale(row.locale) || !nullableDate(row.deletedAt) || !strings(row.fileIds)) invalid();
  validateVehicle(row.vehicle); validateInspection(row.inspection);
  if (row.inspection.id !== row.inspectionId || row.inspection.vehicleId !== row.vehicle.id) invalid();
  const score = object(row.score);
  if (typeof score.total !== "number" || !Number.isFinite(score.total) || !Array.isArray(score.components)) invalid();
  for (const key of ["completion", "standardCoverage"]) object(score[key]);
}

/** 中文：拒绝旧版或损坏备份，并校验照片/原件引用和字节，避免半恢复。 English: Reject older/corrupt backups and validate file references and bytes before any restore. */
export async function decodeBackup(file: Blob): Promise<{ state: LocalState; files: Map<string, StoredFile> }> {
  try {
    const backup = object(JSON.parse(await file.text()));
    if (backup.format !== "vhcinspect-backup-1.3") invalid();
    const source = object(backup.state);
    if (source.format !== "vhcinspect-state-1.3" || !Number.isSafeInteger(source.revision)) invalid();
    const vehicles = list(source.vehicles), inspections = list(source.inspections), reports = list(source.reports), attachments = list(source.attachments);
    [vehicles, inspections, reports, attachments].forEach(uniqueIds);
    vehicles.forEach(validateVehicle); inspections.forEach(validateInspection); reports.forEach(validateReport);
    const vehicleIds = new Set(vehicles.map(value => object(value).id));
    if (inspections.some(value => !vehicleIds.has(object(value).vehicleId))) invalid();
    const settings = object(source.settings);
    if (!locale(settings.locale) || !["CN", "US", "CA"].includes(String(settings.market)) || !["system", "light", "dark"].includes(String(settings.theme))) invalid();
    const units = object(settings.units);
    if (!["km", "mile"].includes(String(units.distance)) || !["C", "F"].includes(String(units.temperature)) || !["kPa", "PSI"].includes(String(units.pressure)) || !["CNY", "USD", "CAD"].includes(String(units.currency))) invalid();
    const encoded = list(backup.files); uniqueIds(encoded);
    if (encoded.length !== attachments.length) invalid();
    const files = new Map<string, StoredFile>();
    for (const value of attachments) {
      const metadata = object(value);
      if (!text(metadata.id) || !text(metadata.name) || !text(metadata.mimeType) || !text(metadata.sha256) || typeof metadata.size !== "number") invalid();
      const saved = object(encoded.find(value => object(value).id === metadata.id));
      if (!text(saved.base64) || saved.type !== metadata.mimeType) invalid();
      const data = bytes(saved.base64), blob = new Blob([data], { type: metadata.mimeType });
      if (data.byteLength !== metadata.size || await sha256Blob(blob) !== metadata.sha256) invalid();
      files.set(metadata.id, { id: metadata.id, type: metadata.mimeType, bytes: data });
    }
    const state = source as unknown as LocalState;
    const references = [
      ...state.inspections.flatMap(inspection => [...inspection.observations.flatMap(fact => fact.evidenceFileIds), ...inspection.materials.flatMap(material => material.fileIds)]),
      ...state.reports.flatMap(report => [...report.fileIds, ...report.inspection.observations.flatMap(fact => fact.evidenceFileIds), ...report.inspection.materials.flatMap(material => material.fileIds)]),
    ];
    if (references.some(reference => !files.has(reference))) invalid();
    return { state, files };
  } catch (error) {
    if (error instanceof Error && error.message === "BACKUP_INVALID") throw error;
    throw new Error("BACKUP_INVALID", { cause: error });
  }
}
