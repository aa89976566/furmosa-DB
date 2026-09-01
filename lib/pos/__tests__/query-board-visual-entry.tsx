import { createRoot } from 'react-dom/client';
import { QueryBoardVisualHarness } from '@/lib/pos/__tests__/query-board-visual-harness';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(<QueryBoardVisualHarness />);
