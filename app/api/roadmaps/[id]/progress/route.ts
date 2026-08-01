import { withUser } from '@/http/handler';
import { notFound, ok } from '@/http/respond';
import { getProgressFor } from '@/usecases/progress';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  return withUser(request, async (userId) => {
    const { id } = await context.params;
    const progress = await getProgressFor(userId, id);
    return progress === null ? notFound() : ok(progress);
  });
}
