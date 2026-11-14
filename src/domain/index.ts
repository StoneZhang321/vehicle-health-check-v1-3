/** 中文：UI和本机业务的领域入口，内部模块不反向导入此文件。 English: Domain entry for UI and local operations; internal modules never import this barrel. */
export * from "./types";
export { loadCatalog, type CatalogRelease } from "./catalog";
export { createPlan, validateWorkflowContext, evaluateWorkflowApplicability } from "./plan";
export * from "./facts";
export { calculateScore, SCORING_VERSION, type ScoringInput, type ScoringRules, type ScoreResult, type ScoredAggregate, type Coverage, type RiskReview } from "./scoring";
export { workflowCanonicalJson, workflowHash } from "./canonical";
