"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[Admin] Rendering error:", error);
  }, [error]);

  return (
    <main className="p-6">
      <h2 className="mb-2 text-lg font-semibold text-white">Seite konnte nicht geladen werden</h2>
      <pre className="mb-4 overflow-auto rounded bg-[#1a1a1a] p-3 text-xs text-red-400">
        {error.message}
        {error.digest ? `\ndigest: ${error.digest}` : ""}
      </pre>
      <button className="brand-button-secondary" onClick={unstable_retry} type="button">
        Neu versuchen
      </button>
    </main>
  );
}
