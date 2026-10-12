import { useEffect, useRef, useState } from "react";
import { context, enhance } from "./runtime";
import { Button, EmptyState, Skeleton } from "./design/components";
const templates = import.meta.glob("./modules/*.html", {
  query: "?raw",
  import: "default",
});
const controllers = import.meta.glob("./modules/*.js", { import: "default" });
type Props = {
  module: string;
  url: string;
  navigate: (path: string) => void;
  demo: boolean;
};
export default function Module({ module, url, navigate, demo }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    async function load() {
      try {
        const [html, mount] = await Promise.all([
          templates[`./modules/${module}.html`](),
          controllers[`./modules/${module}.js`](),
        ]);
        if (cancelled || !ref.current) return;
        const root = ref.current;
        root.innerHTML = html as string;
        const moduleUrl = new URL(url);
        const args = context(root, moduleUrl, navigate);
        (mount as (...args: unknown[]) => void)(...args);
        if (module === "settings") {
          const energy = await controllers["./modules/energy.js"]();
          if (cancelled) return;
          (energy as (...args: unknown[]) => void)(...args);
          const tab = moduleUrl.hash.slice(1);
          if (tab)
            root
              .querySelector<HTMLButtonElement>(
                `.settings-tab[data-tab="${CSS.escape(tab)}"]`,
              )
              ?.click();
          if (tab === "energia") {
            root.classList.add("ws-energy-module");
            root.querySelector("h1")!.textContent = "Energia e tarifas";
            root.querySelector(".settings-head p")!.textContent =
              "Consulte a tarifa ANEEL e acompanhe a composição do custo estimado de energia.";
          }
          if (demo)
            root
              .querySelectorAll<HTMLButtonElement>("#refreshTariff")
              .forEach((button) => {
                button.disabled = true;
                button.title = "Consulta real disponível na sessão autenticada";
              });
        }
        if (module === "report") {
          const type = root.querySelector<HTMLSelectElement>("#type");
          const requested = moduleUrl.searchParams.get("type");
          if (
            type &&
            requested &&
            [...type.options].some((o) => o.value === requested)
          ) {
            type.value = requested;
            type.dispatchEvent(new Event("change"));
          }
        }
        if (demo && module === "settings") {
          root
            .querySelectorAll<HTMLInputElement>("#energyDistributor")
            .forEach((input) => (input.readOnly = true));
          root
            .querySelectorAll<HTMLSelectElement>("#energyGroup")
            .forEach((select) => (select.disabled = true));
        }
        cleanup = enhance(root, navigate);
        setStatus("ready");
      } catch (error) {
        console.error("Falha ao carregar módulo", error);
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [module, url, navigate, demo]);
  return (
    <>
      {status === "loading" && <Skeleton />}
      {status === "error" && (
        <EmptyState
          error
          title="Não foi possível abrir este módulo"
          description="Recarregue a plataforma para tentar novamente."
        >
          <Button onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </EmptyState>
      )}
      <div className="ws-module" ref={ref} hidden={status !== "ready"} />
    </>
  );
}
