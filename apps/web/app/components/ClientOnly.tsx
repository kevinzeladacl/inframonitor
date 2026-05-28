import { useEffect, useState } from "react";

/**
 * Renderiza children sólo en el cliente. Para wrapper de cosas que dependen
 * del DOM (xterm.js, socket.io-client, etc.) y no pueden ejecutarse en SSR.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated ? <>{children()}</> : <>{fallback}</>;
}
