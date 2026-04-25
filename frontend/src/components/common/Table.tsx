import "./Table.css";
import type { ReactNode } from "react";

type TableProps = {
  columns: string[];
  rows: ReactNode[][];
  compact?: boolean;
  onRowClick?: (rowIndex: number) => void;
  emptyState?: {
    title: string;
    description?: string;
  };
};

export default function Table({ columns, rows, compact = false, onRowClick, emptyState }: TableProps) {
  return (
    <div className={compact ? "table-wrap table-wrap--compact" : "table-wrap"}>
      <table className={compact ? "table table--compact" : "table"}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr 
                key={`row-${rowIndex}`} 
                onClick={() => onRowClick?.(rowIndex)}
                className={onRowClick ? "table-row--clickable" : ""}
              >
                {row.map((value, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`}>{value}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <div className="table-empty-state">
                  <strong>{emptyState?.title ?? "No records yet."}</strong>
                  {emptyState?.description ? <span>{emptyState.description}</span> : null}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
