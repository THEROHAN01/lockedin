import { jsonBody, parseBody, withUser } from '@/http/handler';
import { created, ok } from '@/http/respond';
import { createRoadmapSchema } from '@/http/schemas';
import { createRoadmapForUser, listRoadmapsFor } from '@/usecases/roadmaps';

export async function POST(request: Request): Promise<Response> {
  return withUser(request, async (userId) => {
    const input = parseBody(createRoadmapSchema, await jsonBody(request));
    return created(await createRoadmapForUser(userId, input));
  });
}

export async function GET(request: Request): Promise<Response> {
  return withUser(request, async (userId) => ok(await listRoadmapsFor(userId)));
}
