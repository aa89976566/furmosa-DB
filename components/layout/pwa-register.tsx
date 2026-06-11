'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/push-client';

/** 主畫面 Web App：預先註冊 Service Worker，供 Web Push 使用 */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void registerServiceWorker().catch(() => {
      // 註冊失敗不阻擋主流程
    });
  }, []);

  return null;
}
