import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, LoaderCircle, Inbox } from "lucide-react";
export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={"ws-button " + className} {...props}>
      {children}
    </button>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="ws-badge">{children}</span>;
}
export function Skeleton() {
  return (
    <div className="ws-loading" role="status" aria-label="Carregando módulo">
      <LoaderCircle size={22} />
      <span>Carregando seu espaço de trabalho…</span>
      <div className="ws-skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="ws-skeleton" key={i} />
        ))}
      </div>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
  error = false,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  error?: boolean;
}) {
  const Icon = error ? AlertCircle : Inbox;
  return (
    <section className="ws-empty" role={error ? "alert" : undefined}>
      <Icon size={36} />
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  );
}
