import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from './layout.shared';
import { source } from './source';

/**
 * RootProvider is scoped to this subtree rather than the app's root layout
 * (app/layout.tsx), which already runs its own theme system (tokens.css,
 * data-theme attribute, THEME_INIT script) — wrapping the whole app would put
 * that in conflict with Fumadocs' own next-themes provider. Theme and search
 * are both disabled: theme to avoid that conflict, search because there is no
 * content yet worth searching.
 */
export default function DocsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
      <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
