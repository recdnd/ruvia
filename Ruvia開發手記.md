# Ruvia 開發手記

用途：集中記錄你給助理的 **prompt**（或精簡轉述）與當次 **落實摘要**，方便對照需求與程式現況。之後每次有新指示，建議在下方「紀錄」區 **依日期追加一條**。

### 命名規約（持續適用）

- 使用者可見與新程式路徑：**knot**／**menu**／**content**，不用 **node**／**list**／**notes**。
- 舊匯入／遷移仍可讀 JSON 內 `nodes`、`nodeIds`、`ui.layout.nodes` 等 **歷史鍵名**，僅在讀檔與 migrate 層出現。

---

## 紀錄

### 2026-04-18 — Stash 約 70%、縮放字 +200%

**Prompt 要點**

- stash 縮至目前約 **70%**；右下角 `−`/`+` **增大 200%**（字級依 +200% 解為 **3×**，由 11px → 33px）。

**落實摘要**

- `style.css`：右欄 **`calc(468px * 0.7)`**；stash 內距、標題、template 間距與 `.template-btn` 約 ×0.7；`.zoom-btn` **`font-size: 33px`**。
- `docs/stash-template-button.md`：已更新數值說明。

---

### 2026-04-18 — 標題顯示折疊、legacy Node 清洗、縮放列、stash 單一「+」

**Prompt 要點**

- `formatKnotTitle`／focus 編輯完整 title；`normalizeLegacyNodeTitle` 洗掉 `Node n`／舊 `Knot n`；右下角 `−`/`+` 改為常駐最前景、簡潔小字；stash 只留一顆 `+`；確認 stash 按鈕垂直 padding。

**落實摘要**

- `script.js`：顯示用 `getKnotDisplayTitle`、`focusin`/`focusout` 寫回；`normalizeDocument` 末遍歷 knots 正規化標題；`migrate`／`input.nodes` 用 `normalizeLegacyNodeTitle`；`renderTemplates` 僅 `["+"]`。
- `style.css`：`.knot-title` 單行裁切；**workspace grid** 明確 `canvas`/`stash`/`floating-ui` 同列，`floating-ui` **跨欄**、`z-index: 9999`，縮放鈕 **11px**、無框；曾短暫 `display:none` 已撤銷。
- `docs/stash-template-button.md`：註明 **padding 上下左右皆 0**。

---

### 2026-04-18 — Stash 300% 與縮放字加深／500% 字級

**Prompt 要點**

- stash 區整體放大 **300%**。
- 右下角 `−`／`+` 字色加深，字級 **500%**（相對原 8px）。

**落實摘要**

- `style.css`：`grid-template-columns` 右欄 **468px**（156×3）；stash 內距、標題字、template 間距與按鈕邊框／字級隨 **3 倍**；`.zoom-btn` 改 **rgba(0,0,0,0.92)**、`font-size: calc(8px * 5)`、`font-weight: 600`，控制列 `opacity: 1`。
- `docs/stash-template-button.md`：同步比例說明。

---

### 2026-04-18 — 顯示名 `knot-a`／階層 `knot-a--b`（title 與 id 分離）

**Prompt 要點**

- 前端不應再出現 node 語彙；預設名不要 `knot-1/2` 數字序號。
- 希望 `knot-a`、`knot-b`，延伸為 `knot-a--a` 這類；內部 id 與顯示名分開。

**落實摘要**

- `script.js`：`nextRootKnotLabel`、`nextChildKnotLabel`、`resolveNewKnotTitle`；側邊延伸傳 `parentKnot` + `parentId`。
- 匯入無標題：`knot-a` 起算（`knotLabelForImportIndex`）。
- 新增 `docs/knot-title-vs-id.md`。

---

### 2026-04-18 — Stash 模板按鈕外框與「stash」標題

**Prompt 要點**

- `+`／`++`／`+++`：圓角矩形 **1px** 線、**0** 內距貼內容、**無背景**；規格記錄於 `docs/`。
- 側欄「stash / dock」改為僅 **stash**。

**落實摘要**

- `style.css`：`.template-btn` 透明底、`padding: 0`、`border-radius: 2px`、`inline-flex`；hover 仍無底色。
- 新增 `docs/stash-template-button.md`。
- `index.html`：`.stash-title` 改為 `stash`。

---

### 2026-04-18 — 介面用語與縮放鈕可見性

**Prompt 要點**

- 既然已改為 **knot**，前端顯示與後續加工一律跟進；右下 **+ / −** 縮放目前幾乎看不見，改為清楚可見、文字／圖示用最深一階對比，按鈕尺寸調到舒適可點。

**落實摘要**

- `script.js`：`setNodeLayout`→`setKnotLayout`，`getKnotIdsForList`／`getEdgesForList`→`getKnotIdsForMenu`／`getEdgesForMenu`；頂部註解標明舊鍵名僅限匯入。
- `style.css`：縮放區塊 `opacity:1`、專用 `--zoom-fg`（近黑）、白底＋邊框＋陰影、按鈕 **28px**／字 **15px**／字重 600。
- `index.html`：`aria-label`／`title` 標註「畫布縮放（knot 檢視）」與「縮小／放大」；減號改為 Unicode **−** 以利辨識。

---

### 2026-04-18 — 預設標題 `Knot-n`、縮放字級與全站字體

**Prompt 要點**

- `+`／`−` 不要按鈕外框；字與 knot 標題一致；全系統字體統一。
- 前端勿再出現 `Node1`／`Node2`，與資料一致為 **`Knot-xxx`**。

**落實摘要**

- `script.js`：新增 `defaultKnotTitle(state)`（`Knot-\\d+` 取 max+1）；新建／stash／延伸 knot 皆用 `Knot-1` 形式；舊匯入／migrate 預設改為 `Knot-${序號}`。
- `style.css`：`--font-ui`；`html`／`body`、`.knot-title`、`.knot-content-input`、`.template-btn`、`.zoom-btn` 共用；縮放區塊無邊框與底色，字 8px／行高與標題一致。
- 移除 zoom 按鈕之間分隔線與粗字重。

---

### 2026-04-18 — Ambient 控制語言統一（zoom + template）

**Prompt 要點**

- zoom controls 與 stash/template 按鈕要收進同一套 ambient control 視覺語言。
- 刪除 zoom 專用白盒變數，改用共用 `--ambient-ctrl-*`。
- zoom 從「浮窗卡片」改成邊角工具痕跡；template-btn 與 zoom-btn 同語法（細邊、淡底、無陰影、低存在感）。

**落實摘要**

- `style.css`：移除 `--zoom-*` 變數，新增 `--ambient-ctrl-*`（含 white-mode 對應值）。
- `.template-btn` 改為 ambient 版本（共用高度、padding、字級、邊框、hover 行為）。
- `.zoom-controls` 改為低存在感工具條（inline-flex、低 opacity、無陰影、小圓角、無厚 padding）。
- `.zoom-btn` 改為 16x16 字元位風格，加入 `+` 按鈕間淡分隔線；hover 使用同 ambient 色彩。
- `.stash-title` 文字對比再下壓，避免控制元件比區塊標題更重。

---

### 2026-04-18 — 資料核心重建（knot / menu / spec 文件狀態）

**Prompt 要點（摘要）**

- 以 **spec-first** 文件模型重建 Ruvia，非小修補；核心實體：`document`、`lists`→**menus**、`packs`、`nodes`→**knots**、`edges`、`ui`（含 `activeListId`→**activeMenuId**、`layout`）。
- **不要**內建節點類型本體、`type` 不作為核心必填；分類留在 `meta` 等延伸。
- **匯入／匯出**：新格式 `ruvia-doc/0.1`；舊 flat `{ nodes, edges }` 需 **migrate**；驗證／正規化輕量實作。
- **執行期狀態**（選取、拖曳、連線暫態等）不混入匯出。
- 後續補充：**node→knot**、**list→menu**、**notes→content**；**map/** 與 **menu/** 文字需與階層可互推、底層單一真相；避免冗長「規格作文」，以可跑程式為準。

**落實摘要**

- `script.js`：`spec: "ruvia-doc/0.1"`、`document`、`hierarchy`（folders→menu 順序）、`menus`、`packs`、`knots`、`edges`、`ui.layout.knots`、`files.menuText`／`files.structureText`（由 hierarchy+menus 再生）。
- 畫布依 **active menu** 的 `knotIds`／`edgeIds` 篩選；移除內建 `NODE_TYPES`／關係推論，新邊預設 `relation: "link"`。
- `migrateLegacyState`（舊 `nodes`/`edges`）、`normalizeDocument`、`validateDocument`；localStorage `ruvia.v2.state`，可讀一次 `ruvia.v1.state`。
- `index.html`／`style.css`：`knot` 命名與 `.knot*` 樣式；模板列改為通用 stash 捷徑。
- 倉庫內新增 `map/structure.txt`、`menu/menu.txt` 作為與匯出欄位對應之說明佔位（執行期仍以 JSON `files.*` 為準）。

---

### 2026-04-18 — 維護開發手記

**Prompt 要點**

- 持續更新一份 **Ruvia 開發手記**，追蹤所有你給的 prompt 與助理的簡單落實。

**落實摘要**

- 新增本檔 `Ruvia開發手記.md`，並寫入上述重建條目與本條；之後新 prompt 請用「日期 + prompt 要點 + 落實摘要」追加。

---

## 待追補（若你手邊有原文）

以下為較早對話中可能出現、但未逐字存於本檔的項目，若你需要完整對照，可把原 prompt 貼進下一則紀錄，或自行補上一段：

- 單頁畫布、stash、縮放、剪線、ResizeObserver 等 **UI 行為**的逐條需求。
- **pack-menu-kit**、行動版選單等與樣式／套件相關的指示（若曾單獨成條）。

---

## 更新範本（複製使用）

```markdown
### YYYY-MM-DD — 簡短標題

**Prompt 要點**
- （你貼上的需求條列或精簡轉述）

**落實摘要**
- （改了哪些檔／行為／尚未做什麼）
```
