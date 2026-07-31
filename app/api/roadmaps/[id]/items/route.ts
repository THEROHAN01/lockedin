import { jsonBody, parseBody, withUser } from '@/http/handler';
import { created, notFound, ok } from '@/http/respond';
import { uploadItemsSchema } from '@/http/schemas';
import {
  addItemsFromCsv,
  listItemsWithCompletionFor,
} from '@/usecases/roadmaps';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  return withUser(request, async (userId) => {
    const { id } = await context.params;
    const { csv } = parseBody(uploadItemsSchema, await jsonBody(request));
    const items = await addItemsFromCsv(userId, id, csv);
    return items === null ? notFound() : created(items);
  });
}

export async function GET(request: Request, context: Context): Promise<Response> {
  return withUser(request, async (userId) => {
    const { id } = await context.params;
    const items = await listItemsWithCompletionFor(userId, id);
    return items === null ? notFound() : ok(items);
  });
}
