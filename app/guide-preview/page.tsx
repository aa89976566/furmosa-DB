import { notFound } from 'next/navigation';
import GuidePreview from './preview';

export default function Page() {
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  return <GuidePreview />;
}
