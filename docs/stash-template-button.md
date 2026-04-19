# Stash 模板按鈕規格（`+`）

對應選擇器：`.template-tray` 內的 `.template-btn`（內容由 `script.js` 的 `renderTemplates()` 產生，目前僅一顆 `+`）。

## Stash 欄整體

- 右欄寬度：`grid-template-columns` 第二欄為 **`calc(468px * 0.7)`**（在先前加寬後再縮至 70%）。
- 標題、內距、按鈕字級／邊框／圓角隨同一比例約 **0.7** 調整（見 `style.css` 中 `.stash-pane`、`.stash-title`、`.template-tray`、`.template-btn`）。

## 形狀與邊框（按鈕）

- **圓角矩形外框**：`border-radius: 4px`（隨 stash 縮放後數值）。
- **邊線**：`2px solid`，顏色 `--ambient-ctrl-border`。
- **內距**：`padding: 0`（**上下左右皆為 0**）— 邊框緊貼字。

## 背景

- **無背景色**：`background: transparent`；hover／focus 仍透明，只改字色與邊框色。

## 字體

- `font-family: var(--font-ui)`。
- **`font-size: 17px`**（隨 stash 約 0.7 比例）。

## 實作檔案

- 樣式：`style.css`。
- 行為：`script.js` 中 `renderTemplates()`。
