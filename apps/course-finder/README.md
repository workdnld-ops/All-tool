# 課程時間查詢表

從「課程時間查詢表」聊天室的 iSKI finder 移植至 All-tool；原始 Sites 專案不變。保留課程解析、SB／SK／自主訓練、班別連動、1／2／4 週及純文字格式，改成與工具箱相同的原生 HTML／CSS／ES modules，不加入 Next 或新的套件依賴。

- 入口：`/apps/course-finder/`，具有工具箱按鈕與手機可收合的篩選區。
- 資料：`GET /api/course-calendar?start=YYYY-MM-DD&weeks=1|2|4`，Cloudflare Pages Functions 在伺服器端讀取 iSKI 公開課表。只查詢 location_id=1 的內湖與瑞光。
- 查詢以台北日期為準，只接受本週至未來八週的週一；最多合併四週。保留原站顏色判定，畫面只列彩色且尚未開始的時段，並明確提示部分週次讀取失敗。
- 固定上游網址，不接受任意代理網址、不登入、不讀取私人帳號、不寫入 Firebase；篩選只存在當次頁面。
- 每週快取最長 60 秒（記憶體與可用時的 Cloudflare Cache API）；重複併發請求共用讀取。每次最多三個上游請求並行，單一讀取 15 秒逾時。切換篩選不呼叫 API，背景不輪詢課表。
- 根目錄 `_routes.json` 僅將課表 API 交給 Functions，其他工具維持靜態服務。根 Service Worker 不攔截本工具與 API；離線時顯示錯誤，不把舊課表當作即時可預約資訊。
- `npm test` 包含原始解析／篩選案例與 API 範圍、快取、去重、故障及輸出格式回歸測試。
- 本機完整預覽需使用 `wrangler pages dev deploy`（先 `npm run build`）；單純的靜態檔案伺服器不提供課表 API。Git 整合部署會自動編譯根目錄 `functions/`，不需另外部署 Worker 或設定金鑰。

彩色只代表原站未以灰色標示，實際開課及名額仍以 iSKI 原站為準。原站 HTML 格式變更時解析會報錯，需再更新解析規則。
