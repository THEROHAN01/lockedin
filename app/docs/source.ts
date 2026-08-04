import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';
import { createElement } from 'react';
import { docs } from '../../.source';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  /**
   * Resolves the `icon:` frontmatter key (and `icon` in meta.json) to a Lucide
   * component, which is what puts glyphs on sidebar items, breadcrumbs and
   * `<Card>`s. Fumadocs does nothing with `icon` unless this is supplied — the
   * key is just an unread string otherwise.
   *
   * Unknown names return undefined rather than throwing: a typo should cost the
   * page its icon, not the whole route.
   */
  icon(icon) {
    if (!icon) return;
    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});
