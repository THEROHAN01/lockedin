import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

/**
 * The subset of the mdast node shape this file touches. Declared locally rather
 * than imported from `mdast`/`@types/unist`: those are transitive dependencies
 * of the MDX toolchain, not ours, so importing their types would couple this
 * config to whatever version pnpm happens to hoist.
 */
interface MdxNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MdxNode[];
}

/**
 * Rewrites ```mermaid fences into `<Mermaid chart="..." />` before the code
 * blocks reach Shiki.
 *
 * The engineering pages are verbatim mirrors of docs/*.md (enforced by a
 * doc-sync hook), so their diagrams have to stay as plain fenced blocks in the
 * source — which meant they rendered as walls of syntax-highlighted DSL, and
 * made ARCHITECTURE alone an 800 kB HTML response. Intercepting them here keeps
 * the markdown portable and gets real diagrams, and the fence never reaches the
 * highlighter, so the DSL is not shipped twice.
 *
 * Registered ahead of the default plugins below so the substitution happens
 * before `remarkStructure` indexes the page for search — mermaid source is not
 * something anyone wants to match on.
 */
function remarkMermaid() {
  return function transform(node: MdxNode): void {
    const children = node.children;
    if (!children) return;

    children.forEach((child, index) => {
      if (child.type !== 'code' || child.lang !== 'mermaid') {
        transform(child);
        return;
      }

      /**
       * Cast because an MDX JSX element carries `name`/`attributes`, which are
       * not part of the minimal node shape above. Building it as a plain object
       * and widening once keeps that the only unchecked step.
       */
      children[index] = {
        type: 'mdxJsxFlowElement',
        name: 'Mermaid',
        attributes: [
          {
            type: 'mdxJsxAttribute',
            name: 'chart',
            value: child.value ?? '',
          },
        ],
        children: [],
      } as unknown as MdxNode;
    });
  };
}

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (plugins) => [remarkMermaid, ...plugins],
  },
});
