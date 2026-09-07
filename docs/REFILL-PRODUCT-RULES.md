# 換罐計劃商品規則

> 本文件是 Furmosa HQ / POS 對「換罐計劃商品」的唯一業務規則說明。

## 唯一判定來源

1. **商品是否屬於換罐計劃，只看 `Product.productCategory`.**
2. `Product.productCategory === 'JAR_EXCHANGE'` → HQ / POS 顯示「換罐計劃」。
3. 其他 category → 不顯示換罐計劃標籤。

## 店家加入規則

- 店家只要有實際訂購 `JAR_EXCHANGE` 商品，即視為有參與換罐計劃。
- 「店家是否參與」是由商品交易事實推導，不作為商品判定來源。
- 店家 tag / type 可作 CRM、篩選或歷史紀錄，但不可反向決定商品是不是換罐商品。

## HQ 執行畫面

- 出貨品項直接在對應商品顯示「換罐計劃」。
- 不另外顯示「換罐包裝」「罐裝」「一般包裝」等重複資訊。
- 執行人員看到「換罐計劃」即依既有換罐 SOP 處理。
- 數量必須比 SKU / 單位更容易辨識，避免多件商品被看成單件。

## 禁止的重複判定規則

以下規則不得再新增或作為 runtime fallback：

- 店家類型是 `jar_exchange`，所以其所有商品都是換罐商品。
- SKU 以 `RF-` 開頭，所以商品是換罐商品。
- 商品名稱包含「換罐」，所以商品是換罐商品。
- 店名出現在某份換罐店家清單，所以訂單商品是換罐商品。
- 包裝欄位決定商品是否屬於換罐計劃。

## 程式碼唯一入口

- 判定：`lib/product-category.ts` → `isJarExchangeProductCategory()`
- 顯示：`lib/product-category.ts` → `productProgramLabel()`

新的 HQ / POS 功能需要判斷換罐商品時，必須使用上述 helper，不得另寫 `category === 'JAR_EXCHANGE'` 的 UI 規則。

## 歷史資料

早期 migration 可使用名稱規則做一次性資料回填；回填完成後 runtime 一律只讀 `Product.productCategory`。不得把 migration fallback 帶回 production runtime。
