import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Mermaid } from './mermaid';

/**
 * The component set every MDX page is compiled against.
 *
 * Registered globally rather than imported per file so a page can reach for
 * `<Steps>` or `<Callout>` without an import line — that is the whole point of
 * Fumadocs' MDX layer, and an `.mdx` file that has to declare imports stops
 * being writable by anyone who isn't already in the codebase.
 *
 * `defaultMdxComponents` is what supplies the styled `pre`/`a`/`table`/heading
 * overrides (anchored headings, the code block with its copy button), so it has
 * to stay spread in first.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Callout,
    File,
    Files,
    Folder,
    Step,
    Steps,
    Tab,
    Tabs,
    TypeTable,
    /** Not written by hand — see the remark plugin in source.config.ts. */
    Mermaid,
    ...components,
  };
}
