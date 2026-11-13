'use client';
import { Button } from '@/components/ui/button';
export function HqAdjustmentTrigger({ orderId, index, add = false }: { orderId: string; index?: number; add?: boolean }) {
  return <Button type="button" size="sm" variant={add ? 'default' : 'outline'} onClick={() => document.dispatchEvent(new CustomEvent('hq-order-editor', { detail: { orderId, index, add } }))}>{add ? '新增商品' : '修改商品'}</Button>;
}
