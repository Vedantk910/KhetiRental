import Link from "next/link";
import "./globals.css";

// Only reached for paths the locale middleware does not handle; everything else uses [locale]/not-found.tsx.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-4 font-ui">
        <main className="flex flex-col items-center gap-6 text-center">
          <title>Page not found – KhetiRental</title>
          <h1 className="text-h1">We couldn&apos;t find that page.</h1>
          <Link
            href="/en"
            className="inline-flex min-h-tap-lg items-center rounded-control bg-action px-6 text-body font-bold text-action-on"
          >
            Go home
          </Link>
        </main>
      </body>
    </html>
  );
}
