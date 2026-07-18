# All-tool

這個資料夾是整合後要部署的庶務工具箱。外層的工具資料夾是來源備份，不是 Cloudflare 的部署目標。

## 工具清單

- `apps/credit-card-slip-stats`：信用卡簽單紙消耗統計。
- `apps/purchase-accounting`：採購記帳，Cloudflare 會使用 build 後的 `apps/purchase-accounting/dist/`。
- `apps/drink-calculator`：飲料計算器，包含計算頁、品項設定頁與 Firebase 歷史訂單。
- `apps/schedule-record`：排班紀錄，貼上 Google Sheet 週班表後輸出 Line 可用文字。

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
