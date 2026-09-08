import { redirect } from 'next/navigation';

// Templates now live on the single "new program" screen. Kept so old links
// and bookmarks still land somewhere useful.
export default function TemplateProgramPage() {
  redirect('/programs/new');
}
