# 汽车健康检测 / Vehicle Health Check 1.3

无需账号的车辆现场检查工具。提供快速、完整两种内置流程，按部位记录状态、照片、备注和测量，并在本机生成中英文报告与 PDF。

A vehicle inspection tool with quick and full built-in workflows, positional findings, photos, notes, measurements and local reports/PDF. No account is required.

## 使用 / Use

1. 新建车辆，核对市场、车型、动力、舵位和单位。
2. 选择快速或完整检测。按指引记录正常、异常、无法确认或不适用；没有选择的项目保持未检查。
3. 选择状态后仍可补充记录，点击“下一项”才切换。资料页面可粘贴原文、填写来源并保存图片/PDF 原件，全部可选。
4. 生成报告并导出 PDF。报告保存生成时的事实，之后编辑检测不会改写它。
5. 在设置中导出 V1.3 备份；备份包含记录和附件，恢复会替换当前浏览器的 V1.3 资料。

Create a vehicle, choose a workflow, follow the guidance and explicitly record findings. Supplementary materials are optional and remain separate from on-site facts. Reports freeze their facts. Export a V1.3 backup before clearing browser data or changing devices.

首次联网取得应用资源后，核心检测、照片、报告和备份可离线使用。资料查询链接需要网络。首次安装/缓存受浏览器支持和存储空间影响。数据仅在当前浏览器，本软件不提供云备份。不同域名的浏览器数据空间相互独立。

After the application resources are prepared online, inspections, photos, reports and backups work offline. External reference links require connectivity. Browser storage and installation support vary. Keep your own backups; origins have separate browser storage.

仅供购车初筛参考，不替代专业检测、维修诊断或车辆历史核验。声音和震动未加入本版本。

For purchase screening only; this does not replace professional inspection, repair diagnosis or vehicle history verification. Sound and vibration are not included.

## 开发 / Development

需要 Node.js 22.13 或更新版本。Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

开发地址为 http://127.0.0.1:5173 。检查和生产构建：

```sh
npm run typecheck
npm run lint
npm run build
npm run start
```

生产预览地址为 http://127.0.0.1:4173 。离线缓存仅在生产构建预览或 HTTPS 部署中注册；开发服务器用于编辑反馈。安装、开发和构建均不会部署。

Production preview runs at http://127.0.0.1:4173. The service worker is registered in production preview/HTTPS deployments, not the development server. Installation, development and build never deploy.

## 结构 / Structure

- src/domain、src/content：已发布专业内容、适用性、逐项事实与评分。Published content, applicability, facts and scoring.
- src/data：业务操作、IndexedDB、附件与备份。Business operations, local records, attachments and backups.
- src/ui：导航、车辆、检查、资料和共用交互。Navigation, vehicles, inspections, materials and shared interaction.
- src/report：冻结报告的共同文字投影、阅读与 PDF。Frozen report presentation and PDF.
- static：图标与原创检查插图。Icons and original inspection illustrations.
- scripts/build.mjs、scripts/service-worker.js：静态构建与实际资源缓存。Static build and resource caching.

详见 [结构与数据流](docs/ARCHITECTURE.md) 和 [独立部署](docs/DEPLOYMENT.md)。

应用版本为 1.3.0；未更改专业内容，内容版本仍是 release-v1.2.0 / checklist-v1.2.0 / workflow-v1.2.0 / score-rule-v1.2.0。本版本使用独立 V1.3 数据空间，不导入或清除旧版本记录。

Application version is 1.3.0. Professional content retains its original release identities. This version uses its own data space and neither imports nor clears older records.

## 许可与来源 / License and provenance

可授权的原创代码和标注原创的应用资源采用 [MIT](LICENSE)。第三方依赖、品牌及引用材料见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。外部资料链接不代表软件自行查询或提供完整历史。

Original code and original application assets use MIT. Third-party components and referenced materials retain their own terms. External links do not mean the application has queried or supplied a complete vehicle history.
