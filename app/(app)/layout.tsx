import '@/styles/product.css';

/**
 * Exists only to put the product layer in this route group's CSS bundle.
 *
 * product.css cannot be imported from the root layout: it is unlayered global
 * CSS, so it outranks every Fumadocs utility it overlaps with, and /docs
 * rendered as a collision of two design systems. Importing it here and in
 * app/(auth)/layout.tsx keeps it on the product routes only. See the comment at
 * the top of app/globals.css.
 */
export default function ProductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
