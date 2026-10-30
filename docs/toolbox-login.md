# 庶務工具密碼登入

## 部署前設定（必要）

Cloudflare > Workers & Pages > all-tool > Settings > Variables and Secrets：

在 Production 與使用中的 Preview 環境新增以下兩項 **Secret**，不要選一般公開前端環境變數：

- `TOOLBOX_PASSWORD`：設定為網站共用密碼，至少 8 字元。不要把密碼寫進原始碼或提交 Git。
- `TOOLBOX_SESSION_SECRET`：獨立、隨機的簽章密鑰，至少 32 字元。可在本機 PowerShell 執行 `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))` 產生，貼到此 Secret，勿分享或提交。

完成後重新部署。未設定時網站會回應 503，刻意拒絕存取，而不是略過登入。

## Cloudflare 安全設定

- Settings > Runtime > Fail open/closed 必須設為 **Fail closed**。否則免費 Functions 額度用完時，Cloudflare 可能略過 middleware 直接提供靜態頁面。
- Settings > General > Preview access 啟用 **Restrict previews**，讓舊的部署雜湊網址也受到 Cloudflare Access 保護。舊部署不會自動取得新版 middleware，僅更新主網址不足以保護它們。
- 2026-10-30 已於正式專案確認 Fail closed 與預覽存取限制生效，並實測早期部署網址轉往 Cloudflare Access。正式網址仍使用本站密碼，不要求 Cloudflare 帳號。

官方說明：https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed

## 記住裝置

登入後設定 `__Host-toolbox-session` Cookie，180 天有效，採 HttpOnly、Secure、SameSite=Lax，不儲存明碼。每個瀏覽器／PWA 的 Cookie 儲存區可能不同；無痕、清除網站資料、重新安裝或系統清除資料後須重新登入。這不是裝置硬體綁定。

首頁「登出」會要求確認並清除該瀏覽器憑證，不清除訂單或本機設定。修改任一伺服器 Secret 並重新部署會使所有舊憑證失效。站內開啟中的頁面會在切回前景及每五分鐘驗證狀態。

## 範圍與限制

- 根 middleware 保護首頁、直接工具網址、API 和靜態程式資源；獨立的公開課程／抽籤網站不受影響。
- 圖示、manifest 與僅用於登入檢查／淘汰快取的程式是公開資源，不含工具資料或密碼。
- 網站使用 network-only Service Worker，更新時清除 Cache Storage 的離線快取，不操作 localStorage／IndexedDB。舊裝置需先連線重開並完成 Service Worker 更新；無法遠端抹除已下載的舊檔案或既有資料。
- Cloudflare Functions 將處理全站請求，會比原來只查課表的路由使用更多額度；無額外定時 Worker。
- 每個 isolate 對同 IP 的錯誤密碼提供 10 次／5 分鐘暫存限制，非全球持久化限流；高風險用途應另外設定 Cloudflare WAF Rate Limiting／Access。
- **這是網站存取保護，不是 Firebase 資料庫授權。** 現有直接從前端連線的 Firebase 設定及規則未改動；資料庫是否能被外部讀寫必須另行稽核與遷移，不能以網站密碼代替資料庫規則。

## 測試與本機預覽

`npm test` 包含登入、Cookie、過期、竄改、密碼輪替、跨站提交、錯誤限流、直接網址、登出與未設定時拒絕存取的測試。測試密碼僅為虛構資料。

本機可以使用未追蹤的 `.dev.vars` 設定兩個 Secret，再執行 `wrangler pages dev deploy`。`.dev.vars*`、`.env*` 已排除 Git；不要使用正式密碼做公開截圖或測試輸出。
