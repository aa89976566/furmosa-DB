import { QueryBoard } from '@/components/pos/query-board';
import { RecordsPageFrame } from '@/components/pos/records-page-frame';

export default function PosRecordsLoading() {
  return (
    <RecordsPageFrame>
      <QueryBoard items={[]} state="loading" />
    </RecordsPageFrame>
  );
}
