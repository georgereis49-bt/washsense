import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  WashingMachine,
  Droplets,
  ChartNoAxesCombined,
  Zap,
  Bell,
  CreditCard,
  FileChartColumn,
  Settings2,
  Building2,
  ShieldCheck,
  PanelLeftClose,
  UserRound,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  ChevronRight,
  LogOut,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
const navIcons: Record<string, LucideIcon> = {
  LayoutDashboard,
  WashingMachine,
  Droplets,
  ChartNoAxesCombined,
  Zap,
  Bell,
  CreditCard,
  FileChartColumn,
  Settings2,
};
import { client } from "./supabase";
import { readRoute, routes } from "./routes";
import Module from "./Module";
import { Badge, Button, EmptyState, Skeleton } from "./design/components";
const demo =
  new URLSearchParams(window.location.hash.split("?")[1]?.split("#")[0]).get(
    "demo",
  ) === "1";
const initialTheme = () =>
  localStorage.getItem("washsense-theme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [session, setSession] = useState<Session | null>(null);
  const [auth, setAuth] = useState(demo ? "ready" : "loading");
  const [collapsed, setCollapsed] = useState(
    localStorage.getItem("washsense-sidebar") === "collapsed",
  );
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [toast, setToast] = useState("");
  const [visited, setVisited] = useState<
    Record<string, { module: string; url: string }>
  >({});
  const { route, url } = readRoute(hash);
  const navigate = useCallback((path: string) => {
    const u = new URL(path, window.location.origin);
    if (demo) u.searchParams.set("demo", "1");
    window.location.hash = u.pathname + u.search + u.hash;
    setMobile(false);
    setMenu(false);
  }, []);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setMobile(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (demo) return;
    let active = true;
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAuth("error");
          return;
        }
        if (!data.session) {
          window.location.replace("/login.html");
          return;
        }
        setSession(data.session);
        setAuth("ready");
      })
      .catch(() => {
        if (active) setAuth("error");
      });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT") {
        setVisited({});
        window.location.replace("/login.html");
      }
      setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("washsense-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem(
      "washsense-sidebar",
      collapsed ? "collapsed" : "expanded",
    );
  }, [collapsed]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const key = route ? route.path + url.search + url.hash : "";
  useEffect(() => {
    if (!route || auth !== "ready" || (demo && route.module === "finance"))
      return;
    const moduleUrl = new URL(url.href);
    if ("view" in route) {
      if (route.module === "details")
        moduleUrl.searchParams.set("view", route.view);
      else moduleUrl.hash = route.view;
    }
    setVisited((current) =>
      current[key]
        ? current
        : { ...current, [key]: { module: route.module, url: moduleUrl.href } },
    );
    document.title = "WashSense — " + route.label;
    document.querySelector<HTMLElement>("#workspace")?.focus();
    const timer = setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>(
          "#workspace > section:not([hidden]) .ws-module",
        )
        .forEach((root) => root.dispatchEvent(new Event("washsense:activate")));
    }, 0);
    return () => clearTimeout(timer);
  }, [key, auth]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  async function logout() {
    if (demo) {
      window.location.assign("/login.html");
      return;
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) setToast("Não foi possível sair. Tente novamente.");
  }
  const identity = demo ? "Demonstração" : session?.user.email || "Minha conta";
  return (
    <div className={`ws-platform ${collapsed ? "ws-collapsed" : ""}`}>
      <a
        className="ws-skip"
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("workspace")?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      {mobile && (
        <button
          className="ws-overlay"
          aria-label="Fechar navegação"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`ws-sidebar ${mobile ? "ws-open" : ""}`}
        aria-label="Navegação principal"
      >
        <a href="/index.html" className="ws-brand">
          <img src="/assets/washsense-logo-white.svg" alt="WashSense" />
          <span className="ws-brand-compact">
            W<span>S</span>
          </span>
        </a>
        <div className="ws-workspace">
          <span>ESPAÇO DE TRABALHO</span>
          <div>
            <Building2 size={18} />
            <strong>
              {demo ? "Unidade demonstrativa" : "Minha organização"}
            </strong>
          </div>
        </div>
        <div className="ws-nav-label">OPERAÇÃO</div>
        <nav>
          {routes.map((r, i) => {
            const Icon = navIcons[r.icon];
            return (
              <a
                key={r.path}
                href={"#" + r.path + (demo ? "?demo=1" : "")}
                title={r.label}
                aria-current={route?.path === r.path ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(r.path);
                }}
                className={`${route?.path === r.path ? "ws-active" : ""} ${i === 6 ? "ws-nav-divider" : ""}`}
              >
                <Icon size={19} />
                <span>{r.label}</span>
                {r.path === "/alertas" && demo && <i aria-hidden="true">2</i>}
              </a>
            );
          })}
        </nav>
        <div className="ws-sidebar-bottom">
          <div className="ws-environment">
            <ShieldCheck size={16} />
            <span>
              {demo ? "Ambiente demonstrativo" : "Sessão autenticada"}
            </span>
          </div>
          <Button
            className="ws-collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
            aria-expanded={!collapsed}
          >
            <PanelLeftClose size={17} />
            <span>Recolher navegação</span>
          </Button>
        </div>
      </aside>
      <div className="ws-main">
        <header className="ws-topbar">
          <Button
            className="ws-mobile-trigger"
            onClick={() => setMobile(!mobile)}
            aria-label="Abrir navegação"
            aria-expanded={mobile}
          >
            <Menu size={20} />
          </Button>
          <div className="ws-breadcrumb">
            <span>Plataforma</span>
            <ChevronRight size={14} />
            <strong>{route?.label || "Página não encontrada"}</strong>
          </div>
          <div className="ws-top-actions">
            <Button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={
                theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
              }
              aria-label={
                theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
              }
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
            <Button
              title="Ver alertas"
              aria-label="Ver alertas"
              onClick={() => navigate("/alertas")}
            >
              <Bell size={19} />
            </Button>
            <div className="ws-user-container">
              <Button
                className="ws-user"
                aria-label={"Menu de " + identity}
                aria-expanded={menu}
                aria-controls="account-menu"
                onClick={() => setMenu(!menu)}
              >
                <span className="ws-avatar">
                  <UserRound size={17} />
                </span>
                <span>{identity}</span>
                <ChevronDown size={14} />
              </Button>
              {menu && (
                <div className="ws-user-menu" id="account-menu">
                  <p>{identity}</p>
                  <Button onClick={() => navigate("/configuracoes")}>
                    <Settings2 size={16} />
                    Preferências
                  </Button>
                  <Button onClick={logout}>
                    <LogOut size={16} />
                    {demo ? "Ir para login" : "Sair desta sessão"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="workspace" tabIndex={-1} className="ws-workspace-main">
          {auth === "loading" ? (
            <Skeleton />
          ) : auth === "error" ? (
            <EmptyState
              error
              title="Não foi possível verificar sua sessão"
              description="Verifique a conexão e tente novamente."
            >
              <Button onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </EmptyState>
          ) : (
            <>
              {route?.module !== "finance" && (
                <div className="ws-demo-notice">
                  <div>
                    <FlaskConical size={17} />
                    <strong>Dados de demonstração</strong>
                    <span>
                      Indicadores ilustrativos, sem leituras IoT reais.
                    </span>
                  </div>
                  <Badge>DEMO</Badge>
                </div>
              )}
              {!route && (
                <EmptyState
                  title="Página não encontrada"
                  description="Escolha um módulo na navegação ou volte à visão geral."
                >
                  <Button onClick={() => navigate("/visao-geral")}>
                    Abrir visão geral
                  </Button>
                </EmptyState>
              )}
              {demo && route?.module === "finance" && (
                <EmptyState
                  title="Financeiro protegido"
                  description="Entre com sua conta para consultar planos, assinaturas e pagamentos da organização."
                >
                  <a className="ws-button" href="/login.html">
                    Entrar na plataforma
                  </a>
                </EmptyState>
              )}
              {Object.entries(visited).map(([id, entry]) => (
                <section
                  key={id}
                  hidden={id !== key}
                  aria-label={routes.find((r) => id.startsWith(r.path))?.label}
                >
                  <Module {...entry} demo={demo} navigate={navigate} />
                </section>
              ))}
            </>
          )}
        </main>
        <footer className="ws-footer">
          <span>
            WashSense <b>·</b> Precisão em cada ciclo.
          </span>
          <span>Atlântico Preciso</span>
        </footer>
      </div>
      <div
        className={`ws-global-toast ${toast ? "ws-show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
