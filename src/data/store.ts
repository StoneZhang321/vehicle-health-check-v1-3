/** 中文：所有业务写入在此串行验证、提交，并只发布已成功持久化的状态。 English: Serialize and validate business writes here, publishing state only after persistence succeeds. */
import {
  createPlan, createTaskObservation, normalizeTaskFacts, taskDependencyBlockers,
  markSelectedTasksNormal, undoTaskBatch, continueQuickTaskFacts, calculateScore, loadCatalog, isVinVerified,
  type TaskFactInput, type BatchNormalUndo, type InspectionMode, type Locale,
} from "../domain";
import { emptyState, type LocalState, type VehicleInput, type Inspection, type AttachmentTarget, type Material, type Supplement, type TrashKind, type Settings, type Report } from "./model";
import { sanitizeEvidenceImage, sha256Blob } from "./images";
import { encodeBackup, decodeBackup, type StoredFile } from "./backup";

const now = () => new Date().toISOString();
const id = (prefix: string) => prefix + "_" + crypto.randomUUID();
type PendingFiles = Map<string, StoredFile>;
type Listener = () => void;

/** 中文：只有当前业务记录与报告快照拥有附件；删除时统一计算引用。 English: Live records and report snapshots own file references; one collector governs cleanup. */
export function referencedFiles(state: LocalState): Set<string> {
  return new Set([
    ...state.inspections.flatMap(record => [...record.observations.flatMap(fact => fact.evidenceFileIds), ...record.materials.flatMap(material => material.fileIds)]),
    ...state.reports.flatMap(report => report.fileIds),
  ]);
}

/** 中文：同一数据库只有一个业务入口；名称参数只用于独立测试数据库。 English: One business entry per database; a configurable name isolates test databases. */
export class LocalStore {
  private state: LocalState = emptyState();
  private database: Promise<IDBDatabase> | null = null;
  private initialization: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<Listener>();
  private undoRecords = new Map<string, { inspectionId: string; value: BatchNormalUndo }>();
  constructor(private readonly databaseName = "vhcinspect-v1.3") {}
  getSnapshot = () => this.state;
  subscribe = (listener: Listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  /** 中文：读取全新V1.3空间，不访问或清除旧版本数据库。 English: Open only the new V1.3 space without reading or clearing older databases. */
  private open(): Promise<IDBDatabase> {
    if (!this.database) this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("state");
        request.result.createObjectStore("files", { keyPath: "id" });
      };
      request.onerror = () => reject(request.error ?? new Error("LOCAL_STORAGE_UNAVAILABLE"));
      request.onblocked = () => reject(new Error("LOCAL_STORAGE_BLOCKED"));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.database = null; };
        resolve(db);
      };
    });
    return this.database;
  }

  /** 中文：首次加载已提交状态；失败可重试且不会假装得到空数据库。 English: Load committed state; failures can be retried and never masquerade as an empty database. */
  initialize = async (): Promise<void> => {
    if (!this.initialization) this.initialization = (async () => {
      const db = await this.open();
      const saved = await new Promise<LocalState | undefined>((resolve, reject) => {
        const request = db.transaction("state").objectStore("state").get("current");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (saved) {
        if (saved.format !== "vhcinspect-state-1.3") throw new Error("LOCAL_DATA_INVALID");
        this.state = saved;
      }
      this.listeners.forEach(listener => listener());
    })().catch(error => { this.initialization = null; this.database = null; throw error; });
    return this.initialization;
  };

  /** 中文：准备异步业务结果后，将状态和新附件放在同一事务。 English: Prepare async business changes, then commit state and new files in one transaction. */
  private change<T>(operation: (draft: LocalState, files: PendingFiles) => Promise<T> | T): Promise<T> {
    const result = this.queue.then(async () => {
      await this.initialize();
      const draft = structuredClone(this.state), files: PendingFiles = new Map();
      const answer = await operation(draft, files);
      draft.revision = this.state.revision + 1;
      await this.commit(draft, files);
      return answer;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async commit(next: LocalState, files: PendingFiles, replace = false): Promise<void> {
    const db = await this.open();
    const keep = referencedFiles(next);
    next.attachments = next.attachments.filter(file => keep.has(file.id));
    const removed = this.state.attachments.filter(file => !keep.has(file.id));
    let newerState: LocalState | undefined;
    try { await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["state", "files"], "readwrite");
      const current = tx.objectStore("state").get("current");
      // 中文：同一事务比较版本，阻止另一个标签页被过期快照静默覆盖。 English: Compare revisions inside the write transaction to prevent stale tabs from silently overwriting data.
      current.onsuccess = () => {
        const saved = current.result as LocalState | undefined;
        if ((saved?.revision ?? 0) !== next.revision - 1) { newerState = saved; tx.abort(); return; }
        tx.objectStore("state").put(next, "current");
        const target = tx.objectStore("files");
        if (replace) target.clear();
        else removed.forEach(file => target.delete(file.id));
        files.forEach(file => target.put(file));
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("LOCAL_SAVE_FAILED"));
      tx.onerror = () => reject(tx.error ?? new Error("LOCAL_SAVE_FAILED"));
    }); } catch (error) {
      if (newerState) { this.state = newerState; this.listeners.forEach(listener => listener()); throw new Error("LOCAL_DATA_CHANGED"); }
      throw error;
    }
    this.state = next;
    this.listeners.forEach(listener => listener());
  }

  /** 中文：只允许修改仍存在的检测；报告快照从不通过此入口更新。 English: Edit existing inspections only; report snapshots never pass through this path. */
  private inspection(state: LocalState, inspectionId: string): Inspection {
    const result = state.inspections.find(record => record.id === inspectionId && !record.deletedAt);
    if (!result || state.vehicles.find(vehicle => vehicle.id === result.vehicleId)?.deletedAt) throw new Error("INSPECTION_NOT_FOUND");
    return result;
  }

  createVehicle = (input: VehicleInput) => this.change(state => {
    if (!input.name.trim()) throw new Error("VEHICLE_NAME_REQUIRED");
    const record = { ...structuredClone(input), id: id("vehicle"), createdAt: now(), updatedAt: now(), deletedAt: null };
    state.vehicles.push(record);
    return record.id;
  });

  updateVehicle = (vehicleId: string, input: VehicleInput) => this.change(state => {
    if (!input.name.trim()) throw new Error("VEHICLE_NAME_REQUIRED");
    const vehicle = state.vehicles.find(record => record.id === vehicleId && !record.deletedAt);
    if (!vehicle) throw new Error("VEHICLE_NOT_FOUND");
    Object.assign(vehicle, structuredClone(input), { updatedAt: now() });
  });

  /** 中文：固定创建时的车辆条件和内置计划，后续车辆编辑不更换当前检测范围。 English: Freeze vehicle conditions and the built-in plan when starting an inspection. */
  createInspection = (vehicleId: string, mode: InspectionMode) => this.change(async state => {
    const vehicle = state.vehicles.find(record => record.id === vehicleId && !record.deletedAt);
    if (!vehicle) throw new Error("VEHICLE_NOT_FOUND");
    const plan = await createPlan(vehicle.context, mode), inspectionId = id("inspection"), timestamp = now();
    const observations = await Promise.all(plan.tasks.map(entry => createTaskObservation(plan, entry.entryId, { inspectionId, now: timestamp })));
    state.inspections.push({ id: inspectionId, vehicleId, mode, plan, observations,
      currentTaskEntryId: plan.tasks.find(entry => entry.applicable)?.entryId ?? null,
      materials: [], supplements: [], continuedFrom: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    return inspectionId;
  });

  /** 中文：事实校验和前置条件只有领域实现；保存不得修改照片关联。 English: Domain code owns fact validation and prerequisites; forms cannot overwrite photo associations. */
  saveTaskFacts = (inspectionId: string, entryId: string, input: TaskFactInput) => this.change(state => {
    const inspection = this.inspection(state, inspectionId);
    const entry = inspection.plan.tasks.find(task => task.entryId === entryId && task.applicable);
    const fact = inspection.observations.find(record => record.taskEntryId === entryId);
    if (!entry || !fact) throw new Error("TASK_NOT_FOUND");
    const normalized = normalizeTaskFacts(entry, { ...input, evidenceFileIds: fact.evidenceFileIds });
    if ((normalized.status === "normal" || normalized.status === "abnormal") && taskDependencyBlockers(inspection.plan, entryId, inspection.observations).length) throw new Error("TASK_DEPENDENCY_BLOCKED");
    Object.assign(fact, normalized, { version: fact.version + 1, updatedAt: now() });
    inspection.updatedAt = now();
  });

  saveCursor = (inspectionId: string, entryId: string) => this.change(state => {
    const inspection = this.inspection(state, inspectionId);
    if (!inspection.plan.tasks.some(entry => entry.entryId === entryId && entry.applicable)) throw new Error("TASK_NOT_FOUND");
    inspection.currentTaskEntryId = entryId;
  });

  /** 中文：文件选择时传入固定检测/部位目标，图片处理完成后仍写回原目标。 English: Capture the inspection/position at file selection and retain that target after image processing. */
  attachFiles = (target: AttachmentTarget, selected: File[]) => this.change(async (state, pending) => {
    const inspection = this.inspection(state, target.inspectionId);
    let destinations: string[];
    if ("taskEntryId" in target) {
      const fact = inspection.observations.find(record => record.taskEntryId === target.taskEntryId);
      if (!fact) throw new Error("TASK_NOT_FOUND");
      destinations = fact.evidenceFileIds;
      fact.version += 1; fact.updatedAt = now();
    } else {
      let material = inspection.materials.find(record => record.kind === target.materialKind);
      if (!material) { material = { kind: target.materialKind, text: "", sourceName: "", sourceUrl: "", fileIds: [] }; inspection.materials.push(material); }
      destinations = material.fileIds;
    }
    destinations.push(...await this.prepareFiles(state, pending, selected, "taskEntryId" in target));
    inspection.updatedAt = now();
  });

  /** 中文：照片净化与资料原件分开处理，共用文件落盘元数据。 English: Sanitize inspection photos but retain material originals, using the same file metadata path. */
  private async prepareFiles(state: LocalState, pending: PendingFiles, selected: File[], photo: boolean): Promise<string[]> {
    const added: string[] = [];
    for (const file of selected) {
      if (!file.size) throw new Error("FILE_EMPTY");
      let blob: Blob;
      if (photo) blob = (await sanitizeEvidenceImage(file)).blob;
      else {
        const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          if (header !== "%PDF-") throw new Error("FILE_SIGNATURE_MISMATCH");
          blob = new Blob([await file.arrayBuffer()], { type: "application/pdf" });
        } else if (file.type.startsWith("image/")) blob = file;
        else throw new Error("IMAGE_OR_PDF_REQUIRED");
      }
      const fileId = id("file"), sha256 = await sha256Blob(blob);
      state.attachments.push({ id: fileId, name: file.name, mimeType: blob.type, size: blob.size, sha256, createdAt: now() });
      pending.set(fileId, { id: fileId, type: blob.type, bytes: await blob.arrayBuffer() });
      added.push(fileId);
    }
    return added;
  }

  removeAttachment = (target: AttachmentTarget, fileId: string) => this.change(state => {
    const inspection = this.inspection(state, target.inspectionId);
    if ("taskEntryId" in target) {
      const fact = inspection.observations.find(record => record.taskEntryId === target.taskEntryId);
      if (!fact) throw new Error("TASK_NOT_FOUND");
      fact.evidenceFileIds = fact.evidenceFileIds.filter(value => value !== fileId);
      fact.version += 1; fact.updatedAt = now();
    } else {
      const material = inspection.materials.find(record => record.kind === target.materialKind);
      if (material) material.fileIds = material.fileIds.filter(value => value !== fileId);
    }
    inspection.updatedAt = now();
  });

  /** 中文：资料原文逐字保存，空白记录省略，不解析成身份或评分事实。 English: Preserve material text verbatim, omit blank records, and never infer identity or scoring facts. */
  saveMaterial = (inspectionId: string, input: Omit<Material, "fileIds"> & { fileIds?: string[]; files?: File[] }) => this.change(async (state, pending) => {
    const inspection = this.inspection(state, inspectionId);
    if (input.sourceUrl.trim() && !/^https?:\/\//i.test(input.sourceUrl.trim())) throw new Error("SOURCE_URL_INVALID");
    const previous = inspection.materials.find(material => material.kind === input.kind);
    const keep = input.fileIds ?? previous?.fileIds ?? [];
    if (keep.some(fileId => !previous?.fileIds.includes(fileId))) throw new Error("ATTACHMENT_NOT_FOUND");
    const added = await this.prepareFiles(state, pending, input.files ?? [], false);
    const material: Material = { kind: input.kind, text: input.text, sourceName: input.sourceName, sourceUrl: input.sourceUrl, fileIds: [...keep, ...added] };
    inspection.materials = inspection.materials.filter(record => record.kind !== input.kind);
    if (material.text.trim() || material.sourceName.trim() || material.sourceUrl.trim() || material.fileIds.length) inspection.materials.push(material);
    inspection.updatedAt = now();
  });

  saveSupplement = (inspectionId: string, input: Omit<Supplement, "id"> & { id?: string }) => this.change(state => {
    if (!input.title.trim()) throw new Error("SUPPLEMENT_TITLE_REQUIRED");
    const inspection = this.inspection(state, inspectionId);
    const record: Supplement = { ...input, id: input.id ?? id("supplement") };
    inspection.supplements = [...inspection.supplements.filter(value => value.id !== record.id), record];
    inspection.updatedAt = now();
  });
  removeSupplement = (inspectionId: string, supplementId: string) => this.change(state => {
    const inspection = this.inspection(state, inspectionId);
    inspection.supplements = inspection.supplements.filter(record => record.id !== supplementId);
    inspection.updatedAt = now();
  });

  /** 中文：批量确认的撤销记录只留在当前存储实例内存中，不写入备份；撤销按事实版本跳过之后修改的项目。 English: Batch undo records live only in this store instance, outside backups; version checks preserve facts edited after the batch. */
  batchNormal = (inspectionId: string, entries: string[]) => this.change(state => {
    const inspection = this.inspection(state, inspectionId);
    const result = markSelectedTasksNormal(inspection.plan, inspection.observations, entries, { now: now() });
    inspection.observations = result.observations; inspection.updatedAt = now();
    const undoId = id("undo");
    this.undoRecords.set(undoId, { inspectionId, value: result.undo });
    return { affectedCount: result.affectedCount, undoId };
  });
  undoBatch = (inspectionId: string, undoId: string) => this.change(state => {
    const undo = this.undoRecords.get(undoId), inspection = this.inspection(state, inspectionId);
    if (!undo || undo.inspectionId !== inspectionId) throw new Error("UNDO_UNAVAILABLE");
    const result = undoTaskBatch(inspection.observations, undo.value, { now: now() });
    inspection.observations = result.observations; inspection.updatedAt = now();
    return { restoredCount: result.restored.length, conflictCount: result.conflicts.length };
  });

  /** 中文：快速继续完整创建独立检测，只有领域判定相同条件的事实得到复制。 English: Continue into an independent full inspection, copying only domain-approved matching facts. */
  continueFull = (inspectionId: string) => this.change(async state => {
    const source = this.inspection(state, inspectionId);
    const plan = await createPlan(source.plan.context, "full"), targetId = id("inspection"), timestamp = now();
    const observations = await continueQuickTaskFacts(source.plan, plan, source.observations, { inspectionId: targetId, now: timestamp });
    state.inspections.push({ id: targetId, vehicleId: source.vehicleId, mode: "full", plan, observations,
      currentTaskEntryId: plan.tasks.find(entry => entry.applicable && observations.find(fact => fact.taskEntryId === entry.entryId)?.status === null)?.entryId ?? plan.tasks.find(entry => entry.applicable)?.entryId ?? null,
      materials: structuredClone(source.materials), supplements: structuredClone(source.supplements), continuedFrom: source.id,
      createdAt: timestamp, updatedAt: timestamp, deletedAt: null });
    return targetId;
  });

  /** 中文：评分和报告来自同一事务前的事实，存入独立快照后永不重算。 English: Score and snapshot the same facts, then never recompute the stored report. */
  generateReport = (inspectionId: string, locale: Locale) => this.change(async state => {
    const inspection = this.inspection(state, inspectionId), vehicle = state.vehicles.find(record => record.id === inspection.vehicleId)!;
    const { rules, rulesHash } = await loadCatalog();
    const score = await calculateScore({ plan: inspection.plan, taskObservations: inspection.observations, rules, expectedRulesHash: rulesHash, vinVerified: isVinVerified(inspection.plan, inspection.observations) });
    const report: Report = { id: id("report"), inspectionId, locale, generatedAt: now(), appVersion: "1.3.0",
      vehicle: structuredClone(vehicle), inspection: structuredClone(inspection), score, deletedAt: null,
      fileIds: [...new Set([...inspection.observations.flatMap(fact => fact.evidenceFileIds), ...inspection.materials.flatMap(material => material.fileIds)])] };
    state.reports.push(report);
    return report.id;
  });

  updateSettings = (settings: Partial<Settings>) => this.change(state => { state.settings = { ...state.settings, ...settings }; });

  /** 中文：车辆删除作为一组进入回收站；检测单独删除不会移除已生成报告。 English: Trash a vehicle as a group; deleting an inspection alone retains generated reports. */
  moveToTrash = (kind: TrashKind, recordId: string) => this.change(state => {
    const timestamp = now();
    const record = kind === "vehicle" ? state.vehicles.find(value => value.id === recordId)
      : kind === "inspection" ? state.inspections.find(value => value.id === recordId) : state.reports.find(value => value.id === recordId);
    if (!record) throw new Error("RECORD_NOT_FOUND");
    record.deletedAt = timestamp;
    if (kind === "vehicle") {
      state.inspections.filter(value => value.vehicleId === recordId && !value.deletedAt).forEach(value => { value.deletedAt = timestamp; });
      state.reports.filter(value => value.vehicle.id === recordId && !value.deletedAt).forEach(value => { value.deletedAt = timestamp; });
    }
  });

  /** 中文：相同删除时间标识车辆的同批记录，恢复时不复活此前单独删除的检测或报告。 English: Matching deletion timestamps identify a vehicle's deletion group, leaving previously trashed inspections and reports untouched. */
  restoreTrash = (kind: TrashKind, recordId: string) => this.change(state => {
    const record = kind === "vehicle" ? state.vehicles.find(value => value.id === recordId)
      : kind === "inspection" ? state.inspections.find(value => value.id === recordId) : state.reports.find(value => value.id === recordId);
    if (!record) throw new Error("RECORD_NOT_FOUND");
    if (kind !== "vehicle") {
      const vehicleId = kind === "inspection" ? state.inspections.find(value => value.id === recordId)!.vehicleId : state.reports.find(value => value.id === recordId)!.vehicle.id;
      if (state.vehicles.find(value => value.id === vehicleId)?.deletedAt) throw new Error("RESTORE_VEHICLE_FIRST");
    }
    const timestamp = record.deletedAt; record.deletedAt = null;
    if (kind === "vehicle") {
      state.inspections.filter(value => value.vehicleId === recordId && value.deletedAt === timestamp).forEach(value => { value.deletedAt = null; });
      state.reports.filter(value => value.vehicle.id === recordId && value.deletedAt === timestamp).forEach(value => { value.deletedAt = null; });
    }
  });

  purgeTrash = (kind: TrashKind, recordId: string) => this.change(state => {
    if (kind === "vehicle") {
      if (!state.vehicles.find(value => value.id === recordId)?.deletedAt) throw new Error("NOT_IN_TRASH");
      state.vehicles = state.vehicles.filter(value => value.id !== recordId);
      state.inspections = state.inspections.filter(value => value.vehicleId !== recordId);
      state.reports = state.reports.filter(value => value.vehicle.id !== recordId);
    } else if (kind === "inspection") {
      if (!state.inspections.find(value => value.id === recordId)?.deletedAt) throw new Error("NOT_IN_TRASH");
      state.inspections = state.inspections.filter(value => value.id !== recordId);
    } else {
      if (!state.reports.find(value => value.id === recordId)?.deletedAt) throw new Error("NOT_IN_TRASH");
      state.reports = state.reports.filter(value => value.id !== recordId);
    }
  });

  /** 中文：读取原始附件字节用于预览、PDF和备份，缺失时明确报错。 English: Read attachment bytes for preview, PDF and backup; missing files are explicit errors. */
  getFile = async (fileId: string): Promise<Blob> => {
    const db = await this.open();
    const file = await new Promise<StoredFile>((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").get(fileId);
      request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error("ATTACHMENT_MISSING"));
      request.onerror = () => reject(request.error);
    });
    return new Blob([file.bytes], { type: file.type });
  };

  exportBackup = async (): Promise<Blob> => {
    await this.queue; await this.initialize();
    const state = structuredClone(this.state), files = new Map<string, Blob>();
    for (const file of state.attachments) files.set(file.id, await this.getFile(file.id));
    return encodeBackup(state, files);
  };

  /** 中文：完整校验备份及附件后一次替换V1.3空间；失败不改变原数据。 English: Validate the entire backup and files before atomically replacing V1.3 data. */
  restoreBackup = (file: Blob): Promise<void> => {
    const result = this.queue.then(async () => {
      await this.initialize();
      const restored = await decodeBackup(file);
      restored.state.revision = this.state.revision + 1;
      await this.commit(restored.state, restored.files, true);
      this.undoRecords.clear();
    });
    this.queue = result.catch(() => undefined);
    return result;
  };
}

export const localStore = new LocalStore();
