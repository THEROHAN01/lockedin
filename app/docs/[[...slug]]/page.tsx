import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GITHUB_BRANCH, GITHUB_OWNER, GITHUB_REPO } from '../layout.shared';
import { getMDXComponents } from '../mdx-components';
import { source } from '../source';

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      /**
       * 'clerk' keeps the current heading pinned and marks the reading position
       * in the rail. It earns its place on these pages specifically: ARCHITECTURE
       * and DECISIONS are long, densely-headed documents where the plain TOC
       * gives no sense of where you are in them.
       */
      tableOfContent={{ style: 'clerk' }}
      /**
       * Every page under content/docs is a file in the repo, and the
       * engineering ones are mirrors of docs/*.md that have to be corrected at
       * the source. Linking the file directly is the difference between a
       * reader reporting a mistake and fixing it.
       */
      editOnGithub={{
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        sha: GITHUB_BRANCH,
        path: `content/docs/${page.path}`,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const { title, description } = page.data;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: page.url,
    },
    alternates: { canonical: page.url },
  };
}
