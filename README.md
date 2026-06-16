# All-tool

這個資料夾是整合後要部署的庶務工具箱。外層的 `信用卡簽單紙消耗統計` 和 `採購記帳` 是原始來源備份，不是部署目標。

## 要部署哪裡

部署時請使用 `All-tool` 這個資料夾作為網站根目錄。

- 首頁入口：`index.html`
- 信用卡簽單紙統計：`apps/credit-card-slip-stats/index.html`
- 採購記帳靜態版：`apps/purchase-accounting/dist/`

如果部署到 Cloudflare Pages，建議設定：

- Root directory：如果 GitHub repo 根目錄就是 `All-tool`，留空；如果 repo 是外層資料夾，填 `All-tool`
- Build command：`npm run build`
- Output directory：`deploy`

Cloudflare build 時會先產生採購記帳靜態版，再把實際網站檔案整理到 `deploy/`。Cloudflare 只會發布 `deploy/`，不會發布原始碼、`node_modules` 或 npm 快取。

如果只是本機或簡單靜態空間部署，先執行 `npm run build`，再上傳 `deploy/` 內容即可。

## GitHub 到 Cloudflare Pages

1. 在 GitHub 建立 repository，例如 `all-tool`。
2. 在這個資料夾初始化並推送：

   ```powershell
   cd "C:\Users\ACH\Desktop\Codex專案 - 庶務相關工具\All-tool"
   git add .
   git commit -m "Initial All-tool deployment"
   git branch -M main
   git remote add origin https://github.com/你的帳號/all-tool.git
   git push -u origin main
   ```

3. 到 Cloudflare Dashboard > Workers & Pages > Create application > Pages > Connect to Git。
4. 選 GitHub repository，設定：

   ```text
   Framework preset: None
   Production branch: main
   Root directory: 留空
   Build command: npm run build
   Build output directory: deploy
   ```

如果你不是把 `All-tool` 當 repo 根目錄，而是把外層資料夾整包推到 GitHub，Cloudflare 的 Root directory 請填 `All-tool`。

## 工具

- `apps/credit-card-slip-stats`：信用卡簽單紙消耗統計，副本來源是 `信用卡簽單紙消耗統計/原始版本`。
- `apps/purchase-accounting`：採購記帳，副本來源是 `採購記帳/原始版本`。

原始版本資料夾只作為備份與來源，不直接修改。所有整合調整都放在 `apps/` 副本中。

## 入口

- `index.html`：庶務工具首頁。
- `manifest.json`：工具首頁 PWA 設定。
- `sw.js`：工具首頁基本離線快取。

採購記帳是 Vite/React 專案，需要先在 `apps/purchase-accounting` build，首頁會連到 `apps/purchase-accounting/dist/`。

## 本機產生部署資料夾

```powershell
cd "C:\Users\ACH\Desktop\Codex專案 - 庶務相關工具\All-tool"
npm run build
```

build 完成後會產生 `deploy/`。這個資料夾就是實際要被 Cloudflare Pages 發布的網站內容。
