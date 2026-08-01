import { jsonBody, parseBody, withUser } from '@/http/handler';
import { notFound, ok } from '@/http/respond';
import { patchRoadmapSchema } from '@/http/schemas';
import { getRoadmapFor, updateRoadmapFor } from '@/usecases/roadmaps';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  return withUser(request, async (userId) => {
    const { id } = await context.params;
    const roadmap = await getRoadmapFor(userId, id);
    return roadmap === null ? notFound() : ok(roadmap);
  });
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return withUser(request, async (userId) => {
    const { id } = await context.params;
    const patch = parseBody(patchRoadmapSchema, await jsonBody(request));
    const updated = await updateRoadmapFor(userId, id, patch);
    return updated === null ? notFound() : ok(updated);
  });
}
