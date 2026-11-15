'use client';
import { Button } from '@/components/ui/button';
export function HqAdjustmentTrigger({ orderId, index, add = false, variant = false }: { orderId: string; index?: number; add?: boolean; variant?: boolean }) {
  return <Button type="button" size="sm" variant={add ? 'default' : 'outline'} onClick={() => document.dispatchEvent(new CustomEvent('hq-order-editor', { detail: { orderId, index, add, variant } }))}>{add ? '新增商品' : variant ? '更換香氣' : '修改商品'}</Button>;
}
