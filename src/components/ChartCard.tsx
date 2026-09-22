import { type ReactNode, useState } from 'react';

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
  numeric?: boolean[]; // right-align these columns
}

export function DataTable({ columns, rows, numeric = [] }: TableData) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c, i) => <th key={c} className={numeric[i] ? 'r' : undefined}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>{row.map((cell, i) => <td key={i} className={numeric[i] ? 'r' : undefined}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  table: TableData;
  className?: string;
  children: ReactNode;
}

/** Every chart has a table twin: the same numbers without hovering, for keyboards and screen readers. */
export function ChartCard({ title, subtitle, legend, table, className, children }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={`card chart-card ${className ?? ''}`}>
      <header className="chart-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" className="ghost-btn" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Chart' : 'Table'}
        </button>
      </header>
      {legend && !asTable && <div className="legend">{legend}</div>}
      {asTable ? <DataTable {...table} /> : children}
    </figure>
  );
}

export function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="tip" role="tooltip" style={{ left: x, top: y }}>
      {children}
    </div>
  );
}
