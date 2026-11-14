import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  normalizeTaskFacts,
  taskDependencyBlockers,
  taskFactInput,
  type FrozenInspectionPlan,
  type FrozenTaskEntry,
  type Locale,
  type TaskFactInput,
  type TaskObservation,
  type TaskStatus,
} from "../../domain";
import { Dialog } from "../common/Dialog";
import { TaskMeasurements } from "./TaskMeasurements";
import { requirementLabel } from "../../domain/requirements";
import {
  inspectionError,
  taskStatusLabel,
  taskTitle,
  workflowText,
} from "./presentation";
import { WorkflowIcon } from "./WorkflowIcon";
import styles from "./inspection.module.css";

export interface InspectionAttachment {
  id: string;
  taskEntryId: string;
  name: string;
  mimeType: string;
  url: string;
}
export interface SupplementView {
  id: string;
  title: string;
  note: string;
}
/** 中文：父层绑定本次检测并在落盘后完成回调；工作区不访问存储或评分。 English: The parent binds this inspection and resolves callbacks after persistence; this workspace never accesses storage or scoring. */
export interface InspectionWorkspaceProps {
  inspectionId: string;
  locale: Locale;
  plan: FrozenInspectionPlan;
  observations: TaskObservation[];
  currentTaskEntryId: string | null;
  scrollPositions: Map<string, number>;
  attachments: InspectionAttachment[];
  supplements: SupplementView[];
  readOnly?: boolean;
  onNavigate: (entryId: string) => Promise<void>;
  onSaveFacts: (entryId: string, facts: TaskFactInput) => Promise<void>;
  onAttach: (entryId: string, files: File[]) => Promise<void>;
  onRemoveAttachment: (entryId: string, fileId: string) => Promise<void>;
  onBatchNormal: (
    entryIds: string[],
  ) => Promise<{ affectedCount: number; undoId: string }>;
  onUndoBatch: (
    undoId: string,
  ) => Promise<{ restoredCount: number; conflictCount: number }>;
  onSaveSupplement: (input: {
    id?: string;
    title: string;
    note: string;
  }) => Promise<void>;
  onRemoveSupplement: (id: string) => Promise<void>;
  onComplete: () => Promise<void>;
  onContinueFull?: () => Promise<void>;
  onOpenMaterials: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}
interface Draft {
  facts: TaskFactInput;
  revision: number;
  dirty: boolean;
  error: string;
}
interface AttachmentRequest {
  entryId: string;
  files: File[];
  save: InspectionWorkspaceProps["onAttach"];
}

/** 中文：逐部位编辑保留临时无效输入，只有明确导航才切项；父布局提供可用高度。 English: Positional editing retains incomplete input and changes items only on explicit navigation; the parent supplies usable height. */
export function InspectionWorkspace(props: InspectionWorkspaceProps) {
  const { locale, plan, scrollPositions } = props;
  const t = (zh: string, en: string) => (locale === "en" ? en : zh);
  const visible = plan.tasks.filter((task) => task.applicable);
  const entry =
    visible.find((task) => task.entryId === props.currentTaskEntryId) ??
    visible[0];
  const currentIndex = visible.findIndex(
    (task) => task.entryId === entry?.entryId,
  );
  const committed = props.observations.find(
    (row) => row.taskEntryId === entry?.entryId,
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftsRef = useRef(drafts);
  const sequence = useRef(0),
    queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  const draft = entry ? drafts[entry.entryId] : undefined;
  const facts = draft?.facts ?? taskFactInput(committed);
  const [conditions, setConditions] = useState<Record<string, boolean>>({});
  const [listOpen, setListOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [batchOpen, setBatchOpen] = useState(false),
    [batchSelected, setBatchSelected] = useState<string[]>([]),
    [batchConfirmed, setBatchConfirmed] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [preview, setPreview] = useState<InspectionAttachment | null>(null),
    [remove, setRemove] = useState<InspectionAttachment | null>(null);
  const [supplement, setSupplement] = useState<{
    id?: string;
    title: string;
    note: string;
  } | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [failedAttachment, setFailedAttachment] =
    useState<AttachmentRequest | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    cameraInput = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<{
    entryId: string;
    save: InspectionWorkspaceProps["onAttach"];
  } | null>(null);
  const scroll = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const nextPosition = useRef<{ entryId: string; top: number } | null>(null);
  const previousEntry = useRef<string | null>(null);
  const dirty =
    Object.values(drafts).some((value) => value.dirty) ||
    supplement !== null ||
    failedAttachment !== null;
  const savedCount = props.observations.filter(
    (row) =>
      row.status !== null &&
      visible.some((task) => task.entryId === row.taskEntryId),
  ).length;
  const blockers = entry
    ? taskDependencyBlockers(plan, entry.entryId, props.observations)
    : [];
  const conditionReady =
    !!entry &&
    (conditions[entry.entryId] ??
      (committed?.status === "normal" || committed?.status === "abnormal"));
  const safetyReady =
    !entry?.definition.safetyGateRequired ||
    (facts.riskAcknowledgement?.decision === "continue" &&
      facts.riskAcknowledgement.warningVersion ===
        entry.definition.warningVersion);
  const sameConcept = entry
    ? visible.filter(
        (task) =>
          task.definition.stableKey === entry.definition.stableKey &&
          task.aggregationKey === entry.aggregationKey,
      )
    : [];
  const attachments = props.attachments.filter(
    (file) => file.taskEntryId === entry?.entryId,
  );

  useEffect(() => {
    props.onDirtyChange?.(dirty);
  }, [dirty, props.onDirtyChange]);
  useEffect(() => () => latest.current.onDirtyChange?.(false), []);
  // 中文：已保存编辑以新提交事实为准，另一个窗口更新时只保留尚未保存的输入。
  // English: Refresh saved editors from committed facts; retain only unsaved input after another window updates records.
  useEffect(() => {
    const next = Object.fromEntries(
      Object.entries(draftsRef.current).filter(([, value]) => value.dirty),
    );
    if (Object.keys(next).length !== Object.keys(draftsRef.current).length) {
      draftsRef.current = next;
      setDrafts(next);
    }
  }, [props.observations]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.values(draftsRef.current).some((value) => value.dirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  // 中文：父层按检测保留位置，返回资料页之前的项目时恢复；保存和输入重绘不改变阅读位置。
  // English: The parent keeps positions per inspection, including returns from materials; saves and typing never reset reading position.
  useLayoutEffect(() => {
    const entryId = entry?.entryId;
    const pane = scroll.current;
    // 中文：手机目录会隐藏详情，须等详情重新可见再定位，否则隐藏时的滚动设置会丢失。
    // English: The mobile directory hides details; defer positioning until the pane is visible again.
    if (!entryId || !pane?.getClientRects().length) return;
    const requested = nextPosition.current;
    pane.scrollTop =
      requested?.entryId === entryId
        ? requested.top
        : (scrollPositions.get(entryId) ?? 0);
    // 中文：同步记住实际位置，防止跨布局关闭目录时在滚动事件到达前恢复陈旧值。
    // English: Record the applied position synchronously so closing the directory after a resize cannot replay a stale value before the scroll event.
    scrollPositions.set(entryId, pane.scrollTop);
    nextPosition.current = null;
    previousEntry.current = entryId;
    heading.current?.focus({ preventScroll: true });
  }, [entry?.entryId, listOpen, scrollPositions]);
  // 中文：卸载前读取真实滚动容器，避免 ref 已清空而丢失离开时的位置。
  // English: Capture the actual scroller before unmount so ref detachment cannot lose its final position.
  useLayoutEffect(() => {
    const pane = scroll.current;
    return () => {
      if (pane?.getClientRects().length && previousEntry.current)
        latest.current.scrollPositions.set(previousEntry.current, pane.scrollTop);
    };
  }, []);

  function storeDraft(entryId: string, value: Draft) {
    const next = { ...draftsRef.current, [entryId]: value };
    draftsRef.current = next;
    setDrafts(next);
  }
  /** 中文：有效输入串行保存；较早保存完成不能覆盖用户后来输入的草稿或附件。 English: Save valid input serially; earlier completions cannot replace newer drafts or attachments. */
  function changeFacts(patch: Partial<TaskFactInput>) {
    if (!entry || props.readOnly) return;
    const target = entry,
      save = props.onSaveFacts,
      revision = ++sequence.current;
    const source = latest.current.observations.find(
      (row) => row.taskEntryId === target.entryId,
    );
    const next = {
      ...(draftsRef.current[target.entryId]?.facts ?? taskFactInput(source)),
      ...patch,
      evidenceFileIds: source?.evidenceFileIds ?? [],
    };
    let normalized: TaskFactInput;
    try {
      normalized = normalizeTaskFacts(target, next);
      if (
        (next.status === "normal" || next.status === "abnormal") &&
        taskDependencyBlockers(
          plan,
          target.entryId,
          latest.current.observations,
        ).length
      )
        throw new Error("TASK_DEPENDENCY_BLOCKED");
    } catch (failure) {
      storeDraft(target.entryId, {
        facts: next,
        revision,
        dirty: true,
        error: inspectionError(failure, locale),
      });
      return;
    }
    storeDraft(target.entryId, {
      facts: next,
      revision,
      dirty: true,
      error: "",
    });
    queue.current = queue.current.then(async () => {
      try {
        const currentSource = latest.current.observations.find(
          (row) => row.taskEntryId === target.entryId,
        );
        await save(target.entryId, {
          ...normalized,
          evidenceFileIds:
            currentSource?.evidenceFileIds ?? normalized.evidenceFileIds,
        });
        const current = draftsRef.current[target.entryId];
        if (current?.revision === revision)
          storeDraft(target.entryId, { ...current, dirty: false, error: "" });
      } catch (failure) {
        const current = draftsRef.current[target.entryId];
        if (current?.revision === revision)
          storeDraft(target.entryId, {
            ...current,
            dirty: true,
            error: inspectionError(failure, locale),
          });
      }
    });
  }
  async function settled() {
    await queue.current;
    if (Object.values(draftsRef.current).some((value) => value.dirty))
      throw new Error("UNSAVED_INPUT");
  }
  async function act(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(inspectionError(failure, locale));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  /** 中文：离开先等待保存；前进看新标题，返回使用该部位上次位置。 English: Await saves before leaving; forward starts at the new heading and back restores that position's scroll. */
  async function navigate(target: FrozenTaskEntry, back = false) {
    if (target.entryId === entry?.entryId) {
      setListOpen(false);
      return;
    }
    await act(async () => {
      await settled();
      if (entry && scroll.current?.getClientRects().length)
        scrollPositions.set(entry.entryId, scroll.current.scrollTop);
      nextPosition.current = {
        entryId: target.entryId,
        top: back ? (scrollPositions.get(target.entryId) ?? 0) : 0,
      };
      try {
        await props.onNavigate(target.entryId);
      } catch (failure) {
        nextPosition.current = null;
        throw failure;
      }
      setListOpen(false);
      setNotice("");
    });
  }
  function chooseStatus(status: TaskStatus) {
    changeFacts({
      status,
      inspectedAt: new Date().toISOString(),
      findingCodes: status === "abnormal" ? facts.findingCodes : [],
      resolutionReason:
        status === "unknown" || status === "not_applicable"
          ? facts.resolutionReason
          : null,
    });
  }
  /** 中文：文件选择前捕获检测回调和任务身份，选择返回后仍写入原部位。 English: Capture the inspection callback and task identity before file selection so delayed selections still save to the original position. */
  function chooseFiles(camera: boolean) {
    if (!entry) return;
    fileTarget.current = { entryId: entry.entryId, save: props.onAttach };
    (camera ? cameraInput : fileInput).current?.click();
  }
  function selectedFiles(files: FileList | null) {
    const target = fileTarget.current;
    fileTarget.current = null;
    if (!target || !files?.length) return;
    void attach({ ...target, files: Array.from(files) });
  }
  async function attach(request: AttachmentRequest) {
    await act(async () => {
      try {
        await request.save(request.entryId, request.files);
        setFailedAttachment(null);
        setNotice(t("附件已保存。", "Attachments saved."));
      } catch (failure) {
        setFailedAttachment(request);
        throw failure;
      }
    });
  }
  function clearCleanDrafts() {
    const next = Object.fromEntries(
      Object.entries(draftsRef.current).filter(([, value]) => value.dirty),
    );
    draftsRef.current = next;
    setDrafts(next);
  }

  return (
    <section
      className={`${styles.root} ${styles.workspace}`}
      aria-label={t("逐项检测", "Inspection workspace")}
    >
      <header className={styles.workspaceHeader}>
        <div className={styles.between}>
          <h2>
            {t(
              plan.mode === "quick" ? "快速检测" : "完整检测",
              plan.mode === "quick" ? "Quick inspection" : "Full inspection",
            )}
          </h2>
          <span className={styles.badge}>
            {savedCount} / {visible.length} {t("已记录", "recorded")}
          </span>
        </div>
        <div className={styles.toolbar}>
          <button
            className={styles.mobileOnly}
            onClick={() => setListOpen(!listOpen)}
            aria-expanded={listOpen}
          >
            {listOpen
              ? t("返回当前项", "Current item")
              : t("项目目录", "Item list")}
          </button>
          <button
            onClick={() =>
              void act(async () => {
                await settled();
                props.onOpenMaterials();
              })
            }
          >
            {t("补充资料", "Materials")}
          </button>
          <button
            disabled={busy || props.readOnly}
            onClick={() => setSupplement({ title: "", note: "" })}
          >
            {t("补充观察", "Add observation")}
          </button>
          <button
            disabled={busy}
            className={styles.primary}
            onClick={() => setCompleteOpen(true)}
          >
            {t("生成报告", "Create report")}
          </button>
        </div>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.workspaceGrid}>
        <aside
          className={`${styles.listPane} ${listOpen ? "" : styles.listHidden}`}
          aria-label={t("检测目录", "Inspection contents")}
        >
          {plan.sections
            .filter((section) =>
              visible.some((task) => task.sectionEntryId === section.entryId),
            )
            .map((section) => (
              <details
                open={section.entryId === entry?.sectionEntryId}
                key={section.entryId}
              >
                <summary>{workflowText(section.name, locale)}</summary>
                <nav>
                  {visible
                    .filter((task) => task.sectionEntryId === section.entryId)
                    .map((task) => (
                      <button
                        className={`${styles.navButton} ${task.entryId === entry?.entryId ? styles.selected : ""}`}
                        aria-current={
                          task.entryId === entry?.entryId ? "step" : undefined
                        }
                        key={task.entryId}
                        disabled={busy}
                        onClick={() =>
                          void navigate(
                            task,
                            visible.indexOf(task) < currentIndex,
                          )
                        }
                      >
                        <strong>{taskTitle(task, locale)}</strong>
                        <span>
                          {workflowText(task.positionLabel, locale)} ·{" "}
                          {taskStatusLabel(
                            props.observations.find(
                              (row) => row.taskEntryId === task.entryId,
                            )?.status ?? null,
                            locale,
                          )}
                        </span>
                      </button>
                    ))}
                </nav>
              </details>
            ))}
        </aside>
        <section
          className={`${styles.detailPane} ${listOpen ? styles.detailHidden : ""}`}
        >
          <div
            className={styles.detailScroll}
            ref={scroll}
            onScroll={(event) => {
              if (entry && event.currentTarget.getClientRects().length)
                scrollPositions.set(entry.entryId, event.currentTarget.scrollTop);
            }}
            data-scroll-region="inspection-detail"
          >
            {entry ? (
              <div className={styles.stack}>
                <div className={styles.detailContext}>
                  <div>
                    <p className={styles.muted}>
                      {workflowText(entry.positionLabel, locale)} ·{" "}
                      {currentIndex + 1} / {visible.length}
                    </p>
                    <h3 ref={heading} tabIndex={-1}>
                      {taskTitle(entry, locale)}
                    </h3>
                  </div>
                  <span className={styles.badge}>
                    {taskStatusLabel(facts.status, locale)}
                  </span>
                </div>
                <p>{workflowText(entry.task.scope, locale)}</p>
                <details>
                  <summary>
                    {t("检查方法与判断说明", "Method and guidance")}
                  </summary>
                  <div className={styles.stack}>
                    <p>{workflowText(entry.definition.explanation, locale)}</p>
                    <ol>
                      {entry.definition.steps[locale].map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                    <p>
                      <strong>{t("正常参考：", "Normal guidance: ")}</strong>
                      {workflowText(entry.definition.normalSigns, locale)}
                    </p>
                    <p>
                      {workflowText(
                        entry.definition.reinspectionAdvice,
                        locale,
                      )}
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    {t(
                      "工具、车辆状态与配合条件",
                      "Tools, vehicle state and assistance",
                    )}
                  </summary>
                  <ul>
                    {[...new Set(Object.values(entry.requirements).flat())].map(
                      (key) => (
                        <li key={key}>{requirementLabel(key, locale)}</li>
                      ),
                    )}
                  </ul>
                </details>
                <section
                  className={`${styles.notice} ${styles.stack}`}
                  aria-label={t("安全说明", "Safety instructions")}
                >
                  <strong>
                    {t("安全与停步条件", "Safety and stop conditions")}
                  </strong>
                  <p>{workflowText(entry.definition.safetyWarning, locale)}</p>
                  {entry.definition.stopConditions[locale].length > 0 && (
                    <ul>
                      {entry.definition.stopConditions[locale].map(
                        (condition, index) => (
                          <li key={index}>{condition}</li>
                        ),
                      )}
                    </ul>
                  )}
                  {entry.definition.safetyGateRequired && !props.readOnly && (
                    <>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={safetyReady}
                          onChange={(event) =>
                            changeFacts({
                              riskAcknowledgement: event.target.checked
                                ? {
                                    warningVersion:
                                      entry.definition.warningVersion,
                                    decision: "continue",
                                    decidedAt: new Date().toISOString(),
                                  }
                                : null,
                            })
                          }
                        />
                        {t(
                          "已阅读安全说明，当前条件允许继续",
                          "I have read the safety instructions and current conditions allow me to continue",
                        )}
                      </label>
                      <button
                        onClick={() =>
                          changeFacts({
                            status: "unknown",
                            inspectedAt: new Date().toISOString(),
                            findingCodes: [],
                            resolutionReason: t(
                              "安全条件不足，停止操作并等待专业复检。",
                              "Safety conditions are insufficient. Stop and arrange professional reinspection.",
                            ),
                            riskAcknowledgement: {
                              warningVersion: entry.definition.warningVersion,
                              decision: "skip_for_reinspection",
                              decidedAt: new Date().toISOString(),
                            },
                          })
                        }
                      >
                        {t(
                          "停止操作，记录待复检",
                          "Stop and record a reinspection need",
                        )}
                      </button>
                    </>
                  )}
                </section>
                {blockers.length > 0 && (
                  <section className={`${styles.notice} ${styles.stack}`}>
                    <strong>
                      {t("先完成这些项目", "Complete these items first")}
                    </strong>
                    {blockers.map((id) => {
                      const prerequisite = plan.tasks.find(
                        (task) => task.entryId === id,
                      )!;
                      return (
                        <button
                          key={id}
                          onClick={() => void navigate(prerequisite, true)}
                        >
                          {taskTitle(prerequisite, locale)}
                        </button>
                      );
                    })}
                    <p>
                      {t(
                        "前提不足时可记录无法确认或实际不适用。",
                        "If prerequisites are unavailable, record why confirmation is unavailable or why the item does not apply.",
                      )}
                    </p>
                  </section>
                )}
                {!props.readOnly && (
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={conditionReady}
                      onChange={(event) =>
                        setConditions((current) => ({
                          ...current,
                          [entry.entryId]: event.target.checked,
                        }))
                      }
                    />
                    {t(
                      "已核对所需工具、现场、车辆状态和人员条件",
                      "I have checked the required tools, site, vehicle state and assistance",
                    )}
                  </label>
                )}
                <div
                  className={styles.states}
                  aria-label={t("检查结果", "Inspection result")}
                >
                  {(
                    [
                      "normal",
                      "abnormal",
                      "unknown",
                      "not_applicable",
                    ] as TaskStatus[]
                  ).map((status) => (
                    <button
                      key={status}
                      className={styles.stateButton}
                      data-status={status}
                      aria-pressed={facts.status === status}
                      disabled={
                        props.readOnly ||
                        ((status === "normal" || status === "abnormal") &&
                          (!conditionReady ||
                            !safetyReady ||
                            blockers.length > 0))
                      }
                      onClick={() => chooseStatus(status)}
                    >
                      <WorkflowIcon name={status} />
                      {taskStatusLabel(status, locale)}
                    </button>
                  ))}
                </div>
                {facts.status === "abnormal" && (
                  <fieldset className={styles.stack} disabled={props.readOnly}>
                    <legend>
                      {t("选择本项目异常迹象", "Choose findings for this item")}
                    </legend>
                    {entry.definition.findings
                      .filter((finding) =>
                        entry.task.findingCodes.includes(finding.findingCode),
                      )
                      .map((finding) => (
                        <label
                          className={styles.checkLabel}
                          key={finding.findingCode}
                        >
                          <input
                            type="checkbox"
                            checked={facts.findingCodes.includes(
                              finding.findingCode,
                            )}
                            onChange={(event) =>
                              changeFacts({
                                findingCodes: event.target.checked
                                  ? [...facts.findingCodes, finding.findingCode]
                                  : facts.findingCodes.filter(
                                      (code) => code !== finding.findingCode,
                                    ),
                              })
                            }
                          />
                          <span>
                            {workflowText(finding.label, locale)}
                            {finding.evidenceRequirements.length > 0 && (
                              <small className={styles.muted}>
                                {" "}
                                ·{" "}
                                {finding.evidenceRequirements
                                  .map((key) => requirementLabel(key, locale))
                                  .join(" ")}
                              </small>
                            )}
                          </span>
                        </label>
                      ))}
                  </fieldset>
                )}
                {(facts.status === "unknown" ||
                  facts.status === "not_applicable") && (
                  <label>
                    {facts.status === "unknown"
                      ? t(
                          "无法确认的原因（必填）",
                          "Why confirmation is unavailable (required)",
                        )
                      : t(
                          "不适用的实际理由（必填）",
                          "Actual reason this does not apply (required)",
                        )}
                    <textarea
                      disabled={props.readOnly}
                      value={facts.resolutionReason ?? ""}
                      maxLength={2000}
                      onChange={(event) =>
                        changeFacts({ resolutionReason: event.target.value })
                      }
                    />
                  </label>
                )}
                <label>
                  {t("备注", "Notes")}
                  <textarea
                    disabled={props.readOnly}
                    value={facts.note}
                    maxLength={20000}
                    onChange={(event) =>
                      changeFacts({ note: event.target.value })
                    }
                  />
                </label>
                <TaskMeasurements
                  entry={entry}
                  values={facts.measurementValues}
                  locale={locale}
                  units={plan.context.units}
                  disabled={!!props.readOnly}
                  onChange={(measurementValues) =>
                    changeFacts({ measurementValues })
                  }
                />
                <div
                  role="status"
                  aria-live="polite"
                  className={draft?.error ? styles.error : styles.saveFeedback}
                >
                  {draft?.dirty
                    ? draft.error || t("正在保存…", "Saving…")
                    : t("已保存", "Saved")}
                  {draft?.error && (
                    <div className={styles.row}>
                      <button onClick={() => changeFacts({})}>
                        {t("重试保存", "Retry save")}
                      </button>
                      <button
                        onClick={() => {
                          const next = { ...draftsRef.current };
                          delete next[entry.entryId];
                          draftsRef.current = next;
                          setDrafts(next);
                          setError("");
                        }}
                      >
                        {t("放弃未保存修改", "Discard unsaved changes")}
                      </button>
                    </div>
                  )}
                </div>
                <section className={styles.stack}>
                  <h4>{t("当前部位照片", "Photos for this position")}</h4>
                  <div className={styles.attachmentGrid}>
                    {attachments.map((file) => (
                      <article className={styles.attachment} key={file.id}>
                        <button
                          className={styles.imageButton}
                          aria-label={`${t("查看照片", "View photo")}: ${file.name}`}
                          onClick={() => setPreview(file)}
                        >
                          <img
                            src={file.url}
                            alt={`${taskTitle(entry, locale)} — ${workflowText(entry.positionLabel, locale)}`}
                          />
                        </button>
                        <p>{file.name}</p>
                        {!props.readOnly && (
                          <button
                            disabled={busy}
                            onClick={() => setRemove(file)}
                          >
                            {t("移除照片", "Remove photo")}
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                  {!attachments.length && (
                    <p className={styles.muted}>
                      {t(
                        "照片将绑定到当前项目和部位。",
                        "Photos are linked to this item and position.",
                      )}
                    </p>
                  )}
                </section>
                {failedAttachment && (
                  <div className={styles.error}>
                    <p>
                      {t(
                        "附件未保存，原选择仍保留。",
                        "Attachments were not saved; the original selection is retained.",
                      )}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() => void attach(failedAttachment)}
                    >
                      {t("重试保存附件", "Retry attachments")}
                    </button>
                  </div>
                )}
                {!props.readOnly && sameConcept.length > 1 && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      setBatchSelected([]);
                      setBatchConfirmed(false);
                      setBatchOpen(true);
                    }}
                  >
                    {t(
                      "批量确认同类部位",
                      "Confirm similar positions together",
                    )}
                  </button>
                )}
                {!props.readOnly && undoId && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await settled();
                        const result = await props.onUndoBatch(undoId);
                        clearCleanDrafts();
                        setUndoId(null);
                        setNotice(
                          t(
                            `已撤销 ${result.restoredCount} 项；保留 ${result.conflictCount} 项后续修改。`,
                            `Undid ${result.restoredCount} items; preserved ${result.conflictCount} later edits.`,
                          ),
                        );
                      })
                    }
                  >
                    {t("撤销上次批量确认", "Undo last batch confirmation")}
                  </button>
                )}
                {!props.readOnly && facts.status !== null && (
                  <button
                    onClick={() =>
                      changeFacts({
                        status: null,
                        inspectedAt: null,
                        findingCodes: [],
                        resolutionReason: null,
                      })
                    }
                  >
                    {t(
                      "清除结果，保留备注与照片",
                      "Clear result; keep notes and photos",
                    )}
                  </button>
                )}
                {notice && (
                  <p className={styles.notice} role="status">
                    {notice}
                  </p>
                )}
                {props.supplements.length > 0 && (
                  <section className={styles.stack}>
                    <h4>
                      {t(
                        "本次补充观察（不计分）",
                        "Additional observations (not scored)",
                      )}
                    </h4>
                    {props.supplements.map((row) => (
                      <article className={styles.card} key={row.id}>
                        <h4>{row.title}</h4>
                        <p className={styles.preserveText}>{row.note}</p>
                        {!props.readOnly && (
                          <div className={styles.row}>
                            <button onClick={() => setSupplement(row)}>
                              {t("编辑", "Edit")}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void act(() => props.onRemoveSupplement(row.id))
                              }
                            >
                              {t("删除补充观察", "Delete observation")}
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </section>
                )}
                {props.onContinueFull && plan.mode === "quick" && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await settled();
                        await props.onContinueFull!();
                      })
                    }
                  >
                    {t(
                      "以本次记录继续完整检测",
                      "Continue to a full inspection",
                    )}
                  </button>
                )}
              </div>
            ) : (
              <p>
                {t("当前车辆没有适用项目。", "No items apply to this vehicle.")}
              </p>
            )}
          </div>
          {entry && (
            <footer
              className={styles.actionBar}
              aria-label={t("检查操作", "Inspection actions")}
            >
              <button
                aria-label={t("上一项", "Previous item")}
                disabled={busy || currentIndex <= 0}
                onClick={() => void navigate(visible[currentIndex - 1], true)}
              >
                ← {t("上项", "Prev")}
              </button>
              {!props.readOnly && (
                <>
                  <button disabled={busy} onClick={() => chooseFiles(true)}>
                    <WorkflowIcon name="camera" />
                    {t("拍照", "Camera")}
                  </button>
                  <button
                    className={styles.primary}
                    disabled={busy}
                    onClick={() => chooseFiles(false)}
                  >
                    {t("选照片", "Photos")}
                  </button>
                </>
              )}
              <button
                aria-label={t("下一项", "Next item")}
                disabled={busy || currentIndex >= visible.length - 1}
                onClick={() => void navigate(visible[currentIndex + 1])}
              >
                {t("下项", "Next")} →
              </button>
            </footer>
          )}
        </section>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
        multiple
        hidden
        onChange={(event) => {
          selectedFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          selectedFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {preview && (
        <Dialog title={preview.name} onClose={() => setPreview(null)}>
          <img
            className={styles.previewImage}
            src={preview.url}
            alt={preview.name}
          />
        </Dialog>
      )}
      {remove && (
        <Dialog
          title={t("移除这张照片", "Remove this photo")}
          onClose={() => !busy && setRemove(null)}
          actions={
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await props.onRemoveAttachment(remove.taskEntryId, remove.id);
                  setRemove(null);
                })
              }
            >
              {t("确认移除", "Remove photo")}
            </button>
          }
        >
          <p>
            {t(
              "仅从当前项目移除，已生成报告保留原照片。",
              "Remove it from this item. Existing reports retain their photo.",
            )}
          </p>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
      {batchOpen && (
        <Dialog
          title={t(
            "只确认实际检查过的同类部位",
            "Confirm only positions you actually checked",
          )}
          onClose={() => !busy && setBatchOpen(false)}
          actions={
            <button
              disabled={busy || !batchConfirmed || !batchSelected.length}
              onClick={() =>
                void act(async () => {
                  await settled();
                  const result = await props.onBatchNormal(batchSelected);
                  clearCleanDrafts();
                  setUndoId(result.undoId);
                  setNotice(
                    t(
                      `已确认 ${result.affectedCount} 个部位，可撤销。`,
                      `Confirmed ${result.affectedCount} positions. Undo is available.`,
                    ),
                  );
                  setBatchOpen(false);
                })
              }
            >
              {t("确认所选正常", "Mark selected normal")}
            </button>
          }
        >
          <div className={`${styles.root} ${styles.stack}`}>
            {sameConcept.map((task) => {
              let eligible = true;
              try {
                normalizeTaskFacts(task, {
                  ...taskFactInput(
                    props.observations.find(
                      (row) => row.taskEntryId === task.entryId,
                    ),
                  ),
                  status: "normal",
                  findingCodes: [],
                  resolutionReason: null,
                  inspectedAt: new Date().toISOString(),
                });
                eligible = !taskDependencyBlockers(
                  plan,
                  task.entryId,
                  props.observations,
                ).length;
              } catch {
                eligible = false;
              }
              return (
                <label className={styles.checkLabel} key={task.entryId}>
                  <input
                    type="checkbox"
                    disabled={!eligible || busy}
                    checked={batchSelected.includes(task.entryId)}
                    onChange={(event) =>
                      setBatchSelected(
                        event.target.checked
                          ? [...batchSelected, task.entryId]
                          : batchSelected.filter((id) => id !== task.entryId),
                      )
                    }
                  />
                  <span>
                    {taskTitle(task, locale)} ·{" "}
                    {workflowText(task.positionLabel, locale)}
                    {!eligible && (
                      <small>
                        {t(
                          "（请先逐项补齐前提或测量）",
                          " (Complete prerequisites or readings individually first)",
                        )}
                      </small>
                    )}
                  </span>
                </label>
              );
            })}
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={batchConfirmed}
                onChange={(event) => setBatchConfirmed(event.target.checked)}
              />
              {t(
                "我已实际检查所选部位，未发现各自定义的异常。",
                "I checked each selected position and found none of its defined issues.",
              )}
            </label>
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
      {supplement && (
        <Dialog
          title={t("本次补充观察", "Additional observation")}
          onClose={() => !busy && setSupplement(null)}
          actions={
            <button
              disabled={busy || !supplement.title.trim()}
              onClick={() =>
                void act(async () => {
                  await props.onSaveSupplement(supplement);
                  setSupplement(null);
                })
              }
            >
              {t("保存观察", "Save observation")}
            </button>
          }
        >
          <div className={`${styles.root} ${styles.stack}`}>
            <p>
              {t(
                "仅属于本次检测，不改变官方评分。",
                "This belongs to this inspection and does not change official scoring.",
              )}
            </p>
            <label>
              {t("标题", "Title")}
              <input
                value={supplement.title}
                maxLength={200}
                onChange={(event) =>
                  setSupplement({ ...supplement, title: event.target.value })
                }
              />
            </label>
            <label>
              {t("观察记录", "Observation notes")}
              <textarea
                value={supplement.note}
                maxLength={20000}
                onChange={(event) =>
                  setSupplement({ ...supplement, note: event.target.value })
                }
              />
            </label>
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
      {completeOpen && (
        <Dialog
          title={t("生成本次报告", "Create an inspection report")}
          onClose={() => !busy && setCompleteOpen(false)}
          actions={
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await settled();
                  await props.onComplete();
                  setCompleteOpen(false);
                })
              }
            >
              {busy
                ? t("正在生成…", "Creating…")
                : t("确认生成报告", "Create report")}
            </button>
          }
        >
          <p>
            {t(
              `已记录 ${savedCount}/${visible.length} 项。未记录项目保留未完成。之后修改检测不会改写本次报告。`,
              `${savedCount}/${visible.length} items are recorded. Unrecorded items remain incomplete. Later inspection edits will not change this report.`,
            )}
          </p>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </section>
  );
}
