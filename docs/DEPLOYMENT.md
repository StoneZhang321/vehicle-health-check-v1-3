# 独立部署 / Independent deployment

安装、开发、构建不进行发布。这个应用只需要静态文件托管，不需要账号后端、用户数据库、邮件、OCR或云文件存储。
Installation, development and build never publish. The app needs static hosting only, without account/database/email/OCR/file services.

1. npm ci
2. npm run typecheck && npm run lint && npm run build
3. 将 dist/ 部署到自己的 HTTPS 静态托管。根路径提供 index.html；保留图标、assets/、illustrations/、manifest.webmanifest 和 sw.js。
4. 通过自己的域名打开，核对资源加载、保存/重开和 PDF；准备缓存后再断网核验。

Deploy dist/ to your own HTTPS static host at its origin root. Keep all emitted assets. Application navigation uses hashes and resource URLs use the current origin; no owner-hosted runtime services are required.

## Cloudflare 示例 / Example

复制 deploy/example.json 为自己的配置，修改name，并在需要时添加自己的account_id和自定义域routes。使用自己的Cloudflare登录或受保护令牌，再显式执行：

```sh
npx wrangler login
npx wrangler deploy --config deploy/my-config.json
```

示例不指定任何原作者账号或正式域名。项目没有自动发布工作流。认证材料不得提交Git。
The example does not target the original author's account/domain. There is no automatic deployment workflow. Never commit credentials.

[Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/) · [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

