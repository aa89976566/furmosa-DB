export type RestockReceiptLine = {
  lineId: string;
  expectedQuantity: number;
};

export function validateRestockReceipt(
  expectedLines: RestockReceiptLine[],
  submittedQuantities: Map<string, number>,
): void {
  if (expectedLines.length === 0) throw new Error('出貨單沒有可驗收的商品');

  const expectedIds = new Set(expectedLines.map((line) => line.lineId));
  if ([...submittedQuantities.keys()].some((lineId) => !expectedIds.has(lineId))) {
    throw new Error('驗收品項與出貨單不符，請重新整理');
  }

  for (const line of expectedLines) {
    const received = submittedQuantities.get(line.lineId);
    if (!Number.isInteger(received) || received! < 0) {
      throw new Error('請確認每項商品的實收數量');
    }
    if (received !== line.expectedQuantity) {
      throw new Error('實收數量與出貨單不符，請先回報缺少或破損');
    }
  }
}
