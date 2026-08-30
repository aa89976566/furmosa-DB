import { createRoot } from 'react-dom/client';
import { QueryBoardVisualLab } from '@/lib/pos/__tests__/query-board-visual-lab';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(<QueryBoardVisualLab />);
