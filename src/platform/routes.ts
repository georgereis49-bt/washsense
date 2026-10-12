export const routes = [
  {
    path: "/visao-geral",
    label: "Visão geral",
    icon: "LayoutDashboard",
    module: "dashboard",
  },
  {
    path: "/maquinas",
    label: "Máquinas",
    icon: "WashingMachine",
    module: "details",
    view: "maquinas",
  },
  {
    path: "/reservatorios",
    label: "Reservatórios",
    icon: "Droplets",
    module: "details",
    view: "reservatorios",
  },
  {
    path: "/consumo",
    label: "Consumo",
    icon: "ChartNoAxesCombined",
    module: "details",
    view: "consumo",
  },
  {
    path: "/energia",
    label: "Energia",
    icon: "Zap",
    module: "settings",
    view: "energia",
  },
  {
    path: "/alertas",
    label: "Alertas",
    icon: "Bell",
    module: "details",
    view: "alertas",
  },
  {
    path: "/financeiro",
    label: "Financeiro",
    icon: "CreditCard",
    module: "finance",
  },
  {
    path: "/relatorios",
    label: "Relatórios",
    icon: "FileChartColumn",
    module: "report",
  },
  {
    path: "/configuracoes",
    label: "Configurações",
    icon: "Settings2",
    module: "settings",
  },
] as const;
export function readRoute(hash = window.location.hash) {
  const url = new URL(hash.slice(1) || "/visao-geral", window.location.origin);
  return { route: routes.find((r) => r.path === url.pathname), url };
}
export function legacyRoute(href: string) {
  const url = new URL(href, window.location.href);
  const page = url.pathname.split("/").pop();
  let path: string | undefined;
  if (page === "dashboard.html") path = "/visao-geral";
  if (page === "finance.html") path = "/financeiro";
  if (page === "settings.html")
    path = url.hash === "#energia" ? "/energia" : "/configuracoes";
  if (page === "report.html") path = "/relatorios";
  if (page === "details.html")
    path = "/" + (url.searchParams.get("view") || "reservatorios");
  if (!path) return undefined;
  url.searchParams.delete("view");
  const search = url.searchParams.toString();
  return (
    path +
    (search ? "?" + search : "") +
    (page === "settings.html" && path !== "/energia" ? url.hash : "")
  );
}
