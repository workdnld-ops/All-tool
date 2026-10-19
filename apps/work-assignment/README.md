# 庶務工作 v1.0.0

## 入口與架構

- 工具箱「庶務工作」→ `/apps/work-assignment/index.html`。
- 原生 HTML、CSS、ES modules，沿用其他獨立工具的淺色設計。桌面為表格式排列，760px 以下為卡片。
- `app.mjs` 處理畫面與操作；`model.mjs` 為不依賴 DOM 的資料模型、驗證與統計；`storage.mjs` 處理 Firebase 與本機測試。
- 圖示從專案既有 lucide-react 產生為靜態 SVG，沒有新增執行期 UI 套件。可執行 `node scripts/generate-work-icons.mjs` 重新產生。

## 資料儲存與安全

- 正式環境沿用 Firebase Realtime Database：`users/single-user/workAssignment`。
- 工作、分類、同仁均使用獨立 ID；改名或轉移分類不改 ID。
- schemaVersion 1；工作保留 collaboratorIds、createdAt、updatedAt，尚未實作協作人員或歷史功能。
- 所有寫入透過 `runTransaction` 對最新狀態執行單一命令；不以篩選結果或舊畫面陣列覆蓋資料。還原備份要求修訂號一致。
- 只在路徑完全不存在、且本機沒有舊快照時初始化。初始化本身也是交易，因此多裝置同時開啟不會重複建立 44 項。刪空工作仍保留初始化標記，不會重新補回。
- 新功能不搬移、不改寫其他工具資料，無需既有資料遷移。未知 schemaVersion 拒絕讀寫，不能以預設內容取代。
- 本機快照 key：`ops-work-assignment-snapshot-v1`。已載入頁面斷線後只供查看／匯出，重新連線才允許編輯。這不是完整離線 PWA，離線冷啟動仍需要頁面與 Firebase SDK 資源。
- localhost 使用隔離的 `ops-work-assignment-preview-v1` 本機資料，完全不連 Firebase。兩種儲存都不依賴部署版本，因此重新部署不會重置紀錄。
- 延續目前專案的 single-user 共用架構，沒有新增登入或變更 Firebase 安全規則。正式站使用者共用同一份資料，不是個人帳號隔離。

## 行為

- 初始為 44 項工作、七分類、零位同仁；全部未分配、未評估。未預設任何同仁或星數。
- 工作名稱相同、正規化後相同、長名稱包含或相似度較高時提示；使用者勾選確認後可保留。
- 星級為 null 或 1～5。平均值僅使用有評估工作，無評估時顯示破折號，不是 0 星。
- 同仁停用／刪除是保留 ID 的狀態變更，會提示保留負責人、改為未分配或改指派其他在職同仁。刪除後若仍有工作，仍出現在負擔統計與原負責人欄位。
- 同仁總人數包含停用但未刪除者。工作總覽與負擔統計為完整資料，不隨清單篩選縮減。
- 分類刪除前若有工作，必須選擇轉移分類；至少保留一個分類。
- 手動工作排序在未篩選的「手動排序」模式中，從各工作的操作選單上移／下移。分類以箭頭調整順序。
- JSON 為完整備份；匯入先驗證格式、版本、ID、關聯、數值與日期，再顯示確認。確認時下載「還原前」備份，雲端原子取代僅限此工具。

## 測試與部署

在 All-tool 根目錄執行：

```powershell
npm test
npm run build
```

- `tests/work-assignment.test.mjs` 覆蓋初始化、重載、CRUD、重複提示、分類／同仁關聯、星級、統計、篩選排序、備份驗證與儲存失敗。
- `scripts/prepare-deploy.mjs` 將本工具複製到 deploy，不變更其他工具的來源。
- 工具箱 SW 對本工具網路請求直接放行，避免快取舊版。SW 更新時只清自己的 ops-toolbox-* 快取，保留其他工具的 PWA 快取。
