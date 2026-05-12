import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Card({ title, description, children, footer }: CardProps) {
  return (
    <section className="card">
      {title || description ? (
        <header className="card-header">
          {title ? <h2 className="card-title">{title}</h2> : null}
          {description ? <p className="card-description">{description}</p> : null}
        </header>
      ) : null}
      <div className="card-content">{children}</div>
      {footer ? <footer className="card-footer">{footer}</footer> : null}
    </section>
  );
}
