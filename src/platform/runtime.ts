import { config, client } from "./supabase";
import * as sdk from "@supabase/supabase-js";
import { legacyRoute } from "./routes";
export function context(
  root: HTMLElement,
  url: URL,
  navigate: (path: string) => void,
) {
  // Retain the original controllers without global selectors or duplicate IDs
  // leaking across cached modules. DOM modules keep form/filter state in memory.
  const documentProxy = new Proxy(document, {
    get(target, property) {
      if (property === "querySelector") return root.querySelector.bind(root);
      if (property === "querySelectorAll")
        return root.querySelectorAll.bind(root);
      if (property === "getElementById")
        return (id: string) => root.querySelector("#" + CSS.escape(id));
      if (property === "body") return root;
      if (property === "addEventListener")
        return root.addEventListener.bind(root);
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const locationProxy = {
    search: url.search,
    hash: url.hash,
    origin: window.location.origin,
    get href() {
      return url.href;
    },
    set href(value: string) {
      const route = legacyRoute(value);
      route ? navigate(route) : window.location.assign(value);
    },
    reload() {
      window.location.reload();
    },
  };
  const windowProxy = new Proxy(window, {
    get(target, property) {
      if (property === "supabase") return sdk;
      if (property === "washsenseSupabase") return client;
      if (property === "WASHSENSE_SUPABASE") return config;
      if (property === "location") return locationProxy;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return [documentProxy, locationProxy, windowProxy] as const;
}
export function enhance(root: HTMLElement, navigate: (path: string) => void) {
  root.addEventListener("click", (event) => {
    const clicked = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    const card = clicked?.closest<HTMLElement>("[data-detail]");
    if (clicked && card && clicked !== card && card.matches(".alert")) {
      const query = new URLSearchParams({
        view: card.dataset.detail || "alertas",
      });
      if (card.dataset.id) query.set("id", card.dataset.id);
      const path = legacyRoute("details.html?" + query);
      if (path) navigate(path);
    }
    const target = (event.target as Element).closest(
      "a[href], [data-back], [data-route]",
    );
    if (!target) return;
    if (target.hasAttribute("data-route")) {
      navigate(target.getAttribute("data-route")!);
      return;
    }
    if (target.hasAttribute("data-back")) {
      history.back();
      return;
    }
    const href = target.getAttribute("href");
    const path = href && legacyRoute(href);
    if (
      path &&
      !(event as MouseEvent).ctrlKey &&
      !(event as MouseEvent).metaKey
    ) {
      event.preventDefault();
      navigate(path);
    }
  });
  // Existing cards become keyboard-operable controls, including dynamic content.
  let activeModal: HTMLElement | null = null;
  let previousFocus: HTMLElement | null = null;
  const tooltip = document.createElement("div");
  tooltip.className = "ws-module-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  root.appendChild(tooltip);
  function showTooltip(event: Event) {
    const el = (event.target as Element).closest<HTMLElement>("[data-tip]");
    if (!el) return;
    const text = document.createElement("div");
    text.innerHTML = el.dataset.tip || "";
    tooltip.textContent = text.textContent;
    tooltip.hidden = false;
    const rect = el.getBoundingClientRect();
    tooltip.style.left =
      Math.max(12, Math.min(innerWidth - 280, rect.left)) + "px";
    tooltip.style.top = Math.min(innerHeight - 100, rect.bottom + 10) + "px";
  }
  root.addEventListener("mouseover", showTooltip);
  root.addEventListener("focusin", showTooltip);
  root.addEventListener("mouseout", () => {
    tooltip.hidden = true;
  });
  root.addEventListener("focusout", () => {
    tooltip.hidden = true;
  });
  const observer = new MutationObserver(accessible);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  function accessible() {
    root.querySelectorAll<HTMLElement>(".table-wrap, .paper").forEach((el) => {
      el.tabIndex = 0;
      el.setAttribute(
        "aria-label",
        el.classList.contains("paper")
          ? "Visualização do relatório"
          : "Tabela de dados",
      );
    });
    const modal = root.querySelector<HTMLElement>(
      ".modal.show, .modal.open, .billing-modal.show, .billing-modal.open",
    );
    if (modal && modal !== activeModal) {
      previousFocus = document.activeElement as HTMLElement;
      activeModal = modal;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute(
        "aria-label",
        modal.querySelector("h3, h2")?.textContent || "Confirmar operação",
      );
      modal.querySelector<HTMLElement>("input, button, select")?.focus();
    } else if (!modal && activeModal) {
      activeModal = null;
      previousFocus?.focus();
    }
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input:not([type=hidden]), select",
      )
      .forEach((el) => {
        if (el.labels?.length || el.hasAttribute("aria-label")) return;
        const label =
          el.closest(".field, .form-group, td")?.querySelector("span, small")
            ?.textContent ||
          el.getAttribute("placeholder") ||
          el.id ||
          "Valor";
        el.setAttribute("aria-label", label);
      });
    root
      .querySelectorAll<HTMLElement>("[data-detail], [data-reservoir]")
      .forEach((el) => {
        if (el.tagName === "BUTTON" || el.tagName === "A") return;
        if (el.querySelector("button, a, input, select")) {
          el.removeAttribute("role");
          el.removeAttribute("tabindex");
          el.querySelectorAll("button").forEach((button) => {
            if (!button.hasAttribute("aria-label"))
              button.setAttribute(
                "aria-label",
                button.textContent?.trim() === "›"
                  ? "Abrir " +
                      (el.querySelector("strong")?.textContent || "detalhes")
                  : button.textContent || "Abrir detalhes",
              );
          });
          return;
        }
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.setAttribute(
          "aria-label",
          el.querySelector("strong")?.textContent || "Abrir detalhes",
        );
      });
    root.querySelectorAll<HTMLElement>('[id="toast"]').forEach((el) => {
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
    });
  }
  root.addEventListener("keydown", (event) => {
    const el = event.target as HTMLElement;
    if (activeModal && event.key === "Escape") {
      activeModal
        .querySelector<HTMLButtonElement>("#closeModal, #cancelModal")
        ?.click();
      tooltip.hidden = true;
    }
    if (activeModal && event.key === "Tab") {
      const items = [
        ...activeModal.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
        ),
      ].filter((el) => el.getClientRects().length);
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && el === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && el === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (
      (event.key === "Enter" || event.key === " ") &&
      el.matches(
        '[role="button"][data-detail], [role="button"][data-reservoir]',
      )
    ) {
      event.preventDefault();
      el.click();
    }
  });
  accessible();
  return () => observer.disconnect();
}
