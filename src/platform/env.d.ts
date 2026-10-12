/// <reference types="vite/client" />
declare module "*.js" {
  const mount: (document: Document, location: unknown, window: Window) => void;
  export default mount;
}
