import { useEffect, useRef } from "react";

/**
 * Terminal xterm + socket.io conectado al namespace /terminal.
 * Las dependencias se cargan vía dynamic import porque `@xterm/xterm` es CJS
 * y rompe el SSR de Remix si se importa estáticamente.
 */
export function SshTerminal({ serverId }: { serverId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }, ioMod] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("socket.io-client"),
      ]);
      await import("@xterm/xterm/css/xterm.css");
      if (disposed) return;

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        theme: { background: "#0f172a", foreground: "#e2e8f0" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current!);
      fit.fit();
      term.writeln("\x1b[36mConectando SSH...\x1b[0m");

      const apiOrigin = window.location.origin.replace(":5274", ":8301");
      const socket = ioMod.io(`${apiOrigin}/terminal`, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => {
        socket.emit("open", { serverId, cols: term.cols, rows: term.rows });
      });
      socket.on("connect_error", (err: Error) => {
        term.writeln(`\r\n\x1b[31m✗ Connect error: ${err.message}\x1b[0m`);
      });
      socket.on("ready", () => term.writeln("\x1b[32m✓ Sesión activa\x1b[0m\r\n"));
      socket.on("data", (d: string) => term.write(d));
      socket.on("error", (msg: string) => term.writeln(`\r\n\x1b[31m✗ ${msg}\x1b[0m`));
      socket.on("exit", (code: number) => term.writeln(`\r\n\x1b[33mShell salió code=${code}\x1b[0m`));

      term.onData((data) => socket.emit("data", data));

      const handleResize = () => {
        fit.fit();
        socket.emit("resize", { cols: term.cols, rows: term.rows });
      };
      window.addEventListener("resize", handleResize);

      cleanup = () => {
        window.removeEventListener("resize", handleResize);
        socket.disconnect();
        term.dispose();
      };
    })().catch(console.error);

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [serverId]);

  return <div ref={containerRef} className="w-full h-full bg-slate-900 p-2" />;
}
