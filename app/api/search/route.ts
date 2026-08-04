import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@app/docs/source';

/**
 * Backs the docs search dialog (Cmd/Ctrl-K).
 *
 * Orama, in-process — no external search service and no index to keep in sync,
 * because the index is built from the same `source` the pages render from. The
 * documents it indexes come from `remarkStructure`, which runs after the mermaid
 * substitution in source.config.ts, so diagram source is not searchable.
 */
export const { GET } = createFromSource(source);
