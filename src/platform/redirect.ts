import { legacyRoute } from "./routes";
const route = legacyRoute(window.location.href) || "/visao-geral";
window.location.replace("/app.html#" + route);
