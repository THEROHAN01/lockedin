import { redirect } from 'next/navigation';
import { currentUserId } from '@/http/session';

export default async function Home() {
  const userId = await currentUserId();
  redirect(userId === null ? '/sign-in' : '/roadmaps');
}
