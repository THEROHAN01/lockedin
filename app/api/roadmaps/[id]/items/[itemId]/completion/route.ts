import { withUser } from '@/http/handler';
import { noContent, notFound } from '@/http/respond';
import { markComplete } from '@/usecases/progress';

type Context = { params: Promise<{ id: string; itemId: string }> };

/**
 * Completion is a subresource, so marking it is a PUT: idempotent by definition
 * of the verb rather than by informal promise. Repeating it answers 204 again
 * rather than reporting a conflict.
 *
 * DELETE on this URI is the natural home for un-marking, which is out of MVP
 * scope (ROADMAP feature 7 is one-directional). The append-only progress log
 * means adding it needs no migration.
 */
export async function PUT(request: Request, context: Context): Promise<Response> {
  return withUser(request, async (userId) => {
    const { id, itemId } = await context.params;
    const marked = await markComplete(userId, id, itemId);
    return marked ? noContent() : notFound();
  });
}
