# All-tool

這個資料夾是整合後要部署的庶務工具箱。外層的工具資料夾是來源備份，不是 Cloudflare 的部署目標。

## 工具清單

- `apps/credit-card-slip-stats`：信用卡簽單紙消耗統計。
- `apps/purchase-accounting`：採購記帳，Cloudflare 會使用 build 後的 `apps/purchase-accounting/dist/`。
- `apps/drink-calculator`：飲料計算器，包含計算頁、品項設定頁與 Firebase 歷史訂單。
- `apps/day-off-record`：排休紀錄，貼上 Google Sheet 排休欄位後輸出 Line 可用文字。

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
