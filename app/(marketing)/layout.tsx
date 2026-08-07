import '@/styles/product.css';

/**
 * Same purpose as app/(app)/layout.tsx and app/(auth)/layout.tsx: scope the
 * product CSS layer to this route group so it stays out of the /docs CSS
 * bundle. See the comment at the top of app/globals.css.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
