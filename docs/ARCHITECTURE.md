# 结构与数据流 / Architecture and data flow

本项目使用 React、TypeScript 与 Vite，作为静态 PWA 运行。移除依赖账号与云服务的旧服务端构建，只维护一条应用运行链。
The application is a React/TypeScript/Vite static PWA with one runtime path.

## 模块职责 / Responsibilities

| 位置 / Location | 权威职责 / Responsibility |
| --- | --- |
| src/domain | 内置计划、适用性、状态/测量/前置规则、快转全、撤销及评分 / plans, applicability, facts, continuation, undo, scoring |
| src/content | 真实已发布的专业 JSON / published professional JSON |
| src/data/model.ts | 车辆、检测、资料、附件及报告快照合同 / record and snapshot types |
| src/data/store.ts | 业务操作、写入串行化、单 IndexedDB 事务与提交状态 / business operations and committed local state |
| src/data/backup.ts | V1.3 数据与附件导出，完整校验后原子恢复 / complete backup validation and atomic restore |
| src/ui | 导航与临时表单；共用窗口、视口和滚动 / navigation, drafts, dialogs, viewport and scrolling |
| src/report | 同一冻结事实的报告页面和 PDF / page and PDF from identical frozen facts |
| scripts、static | 普通构建、离线缓存与静态资源 / build, offline cache and assets |

```text
published JSON -> domain/catalog -> domain/plan
UI -> store business operation -> domain validation/scoring
                              -> IndexedDB transaction (state + files)
                              -> publish committed state to React
vehicle + inspection + materials + score -> frozen report
frozen report + referenced files -> report view / PDF
committed state + files <-> V1.3 backup
```

## 保存入口 / Persistence boundary

UI不直接访问IndexedDB或重做评分。LocalStore将写入排队，准备异步结果后，在同一事务中保存state和files。只有事务完成后React得到新状态并显示成功。提交时比较数据库revision，过期窗口必须刷新状态并重试，不能覆盖其他窗口的记录。
UI never accesses IndexedDB or recalculates scoring. LocalStore serializes writes and commits records/files together. React sees only committed state. Revision checks reject stale-window overwrites.

数据库vhcinspect-v1.3中state对象保存记录和附件元数据，files对象保存字节。内存state是已提交数据的展示缓存，不是另一份可独立写入的权威。
The state store contains records/metadata; the files store contains bytes. In-memory state is a committed display cache.

## 事实与报告 / Facts and reports

事实身份为检测加部位任务；异步照片操作捕获选择时的目标。未记录、正常、异常、无法确认、不适用分开。评分按专业概念跨部位汇总；补充资料和单次补充观察不参与官方评分。
Facts are keyed by inspection and positional task. Missing and explicit statuses remain distinct. Supplementary materials and notes never become official scoring facts.

报告深复制生成时的车辆、计划、事实、资料和评分。页面和PDF读取相同快照，之后不重算。附件只有在记录和报告都不再引用时才能清除。资料原件可以本机查看，不拼入现场报告PDF。
Reports deep-copy their facts and score. The page and PDF read that same snapshot. Referenced report attachments survive later inspection edits.

V1.3备份包含完整数据与附件。恢复前校验类型、关系和附件摘要，验证失败不写数据库；不提供旧版迁移协议。
Backups contain complete V1.3 records/files, validated before atomic replacement. There is no legacy migration protocol.

## 交互 / Interaction

应用壳根据visualViewport划分头栏、可滚动正文和稳定底栏。检测详情是独立滚动容器，前进进入新标题，返回读取按检测/项目保存的阅读位置。弹窗只有正文滚动，关闭恢复焦点且不滚动背景。
The viewport-sized shell separates content from controls. Inspection details retain per-task scroll positions; forward navigation starts at the heading. Dialogs scroll independently and restore focus without background movement.

临时草稿用于保留未完成或保存失败的输入；离开时提示。已保存业务数据不依赖表单组件存活。
Temporary drafts retain incomplete/failed input and prompt before leaving. Saved facts do not depend on component lifetime.

