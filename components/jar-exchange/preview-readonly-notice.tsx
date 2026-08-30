import { Button } from '@/components/ui/button';

const DISABLED_WRITES = ['確認', '撤銷', '新增', '開通', '修改', '刪除'] as const;

export function PreviewReadonlyNotice() {
  return (
    <div className="px-5 py-4">
      <p className="text-sm text-navy">為什麼不能操作</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Preview 正在讀正式資料，所以所有會改資料的動作都先停用。下面的按鈕不能按，伺服器也會拒絕寫入。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {DISABLED_WRITES.map((label) => (
          <Button key={label} type="button" size="sm" variant="outline" disabled>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
