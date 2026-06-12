# 遊戲每日與每週任務清單

這是一個可以放在 GitHub Pages 的單頁工具，用來追蹤遊戲每日與每週任務。

## 功能

- 新增、編輯、刪除遊戲
- 每日任務每天重置
- 每週任務每週一重置
- 標記哪款遊戲有月卡或通行證
- 記錄版本、卡池與結束日，並自動顯示剩餘天數
- 只看未完成、全部、已完成
- 複製目前未完成清單
- 可用 GitHub Gist 做手機和電腦同步

## GitHub Pages

把這個資料夾裡的檔案放到 GitHub repo 根目錄，然後到 repo 的 `Settings -> Pages` 啟用 GitHub Pages。

建議設定：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

啟用後網址通常會是：

```text
https://你的帳號.github.io/你的repo名稱/
```

## 雲端同步

同步功能使用 GitHub Gist。你需要在 GitHub 建立一個 fine-grained token 或 classic token，並給它 `gist` 權限。

第一次使用：

1. 在工具的「雲端同步」填入 GitHub Token。
2. Gist ID 留空。
3. 按「上傳同步」。
4. 工具會自動建立 secret Gist，並填入 Gist ID。

手機同步：

1. 手機打開同一個 GitHub Pages 網址。
2. 填入同一個 GitHub Token 和 Gist ID。
3. 按「下載雲端」。

注意：Token 會保存在該瀏覽器本機。只在自己的裝置使用，不要貼到公用電腦。Secret Gist 不會公開列出或被搜尋，但如果別人拿到網址仍可能看到內容。
