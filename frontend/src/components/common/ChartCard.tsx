import "./ChartCard.css";
import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  emptyMessage?: string;
  hasData?: boolean;
  children: ReactNode;
};

export default function ChartCard({ title, subtitle, emptyMessage = "No data available yet.", hasData = true, children }: ChartCardProps) {
  return (
    <article className="card chart-card">
      <div className="chart-card__header">
        <h3>{title}</h3>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {hasData ? <div className="chart-card__body">{children}</div> : <div className="chart-card__empty">{emptyMessage}</div>}
    </article>
  );
}
