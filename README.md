# All-tool

這個資料夾是整合後要部署的庶務工具箱。外層的工具資料夾是來源備份，不是 Cloudflare 的部署目標。

## 工具清單

- `apps/course-finder`：課程時間查詢表，內湖／瑞光跨週課表、快速篩選、純文字複製及 CSV 匯出；由 `functions/api/course-calendar.js` 讀取公開課表。
- `apps/work-assignment`：庶務工作，工作分類、同仁指派、難易度與負擔統計、JSON 備份還原。
- `apps/credit-card-slip-stats`：信用卡簽單紙消耗統計。
- `apps/purchase-accounting`：採購記帳，Cloudflare 會使用 build 後的 `apps/purchase-accounting/dist/`。
- `apps/drink-calculator`：飲料計算器，包含計算頁、品項設定頁與 Firebase 歷史訂單。
- `apps/schedule-record`：排班紀錄，貼上 Google Sheet 週班表與排休資料後輸出 Line 可用文字；`apps/schedule-record/view/` 是只讀行事曆隱藏網址。
- `apps/acceptance-form`：驗收單編輯、即時預覽與 A4 橫式 PDF 匯出。
- `apps/leave-lottery`：多日期休假抽籤，共用打掃安排同仁名單並保存抽籤紀錄。

## 2026-11 工具設定與用量統計

- 工具箱排序及縮圖色票：`assets/toolbox-preferences.mjs`，沿用 money-card Firebase 的 `users/single-user/toolboxPreferences`。首次雲端沒有資料時，使用第一個開啟新版裝置的舊 `opsToolboxToolOrder`；之後雲端為主。本機快取 `opsToolboxPreferencesV1` 供載入顯示，未連上雲端時暫停編輯以避免覆寫。排序與顏色透過交易獨立更新。色票固定為使用者提供的 18 色。localhost 僅用本機預覽資料，不存取正式設定。
- 簽單統計：原 `credit-paper-use` Firebase 的 `shops/{shop}/{year}` 更換日期不遷移，新增 `stocktakes/{shop}` 儲存 `{date, quantity}`。每個有效且不重複的更換日期視為一捲；各期間同時列出紀錄數及按歷史間隔估計的用量。延續既有季節定義與間隔歸屬（依更換日），旺季 7～1 月、淡季 2～6 月；無該季樣本時用全期平均。缺漏紀錄會影響推估精度。
- 盤點為最新一次可用整捲數，不是進貨紀錄。依季節用量扣除自盤點日至今天的估計消耗，再推算可用天數與日期；資料不足時不提供天數。補貨後需重新盤點。
- 庶務工作：沿用原 `order`，只移動同分類項目，全部工作依分類順序及分類內順序顯示；搜尋或人員等篩選期間不允許排序，避免隱藏工作造成位置歧義。不重建或覆蓋既有工作。
- 待辦備註：輸入自動增高，依 `visualViewport`（含鍵盤佔用）限制高度，超出才捲動。不變更待辦資料結構。
- 回歸測試：`npm test`，包含用量／閏年／盤點、分類排序、雙裝置設定交易與備註高度。手機驗證使用模擬視窗與隔離資料，仍需實機確認 iOS 鍵盤行為。

## 設計準則

- 後續新增或修改工具時，手機與電腦不必強行使用同一種操作形式。
- 以平台適合的互動為準：手機優先採用觸控友善、滑動、滾筒、底部操作等形式；電腦優先採用下拉選單、鍵盤/滑鼠精準點擊、較密集但清楚的控制。
- 同一功能若需要分流，資料格式與實際功能行為仍要保持一致，只分開呈現與操作方式。

## Cloudflare Pages 設定

如果 GitHub repo 根目錄就是 `All-tool`，Cloudflare 設定如下：

```text
Framework preset: None
Build command: npm run build
Build output directory: deploy
```

如果 GitHub repo 外層還包著其他資料夾，請把 Cloudflare 的 Root directory 設為 `All-tool`。

## 本機打包

```powershell
cd "C:\Users\ACH\Desktop\Codex專案 - 庶務相關工具\All-tool"
npm run build
```

打包完成後會產生 `deploy/`，Cloudflare Pages 發布的就是這個資料夾。

## 飲料計算器資料

飲料計算器使用與採購記帳相同的 Firebase Realtime Database，資料路徑如下：

- `users/single-user/drinkCalculator/items`
- `users/single-user/drinkCalculator/orders`

第一次開啟時若沒有飲料品項，會自動建立預設品項。設定頁可調整品項名稱、箱價、每箱瓶數、排序與啟用狀態。
