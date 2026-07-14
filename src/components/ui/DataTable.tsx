import type { HTMLAttributes, ReactNode } from "react";

export interface Column<Row> {
  key: string;
  label: ReactNode;
  width?: number | string;
  render?: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> extends HTMLAttributes<HTMLDivElement> {
  columns: Column<Row>[];
  rows: Row[];
  maxHeight?: number | string | null;
  /** When provided, each row becomes clickable and invokes this on click. */
  onRowClick?: (row: Row) => void;
  /**
   * Use a fixed table layout so `width`s are honoured exactly and columns don't
   * stretch to fill. Add a trailing width-less column to soak up the slack.
   */
  fixed?: boolean;
}

/** Data table with sticky uppercase header. columns: [{key, label, width?, render?(row)}]. */
export function DataTable<Row extends { id?: string | number }>({
  columns,
  rows,
  maxHeight = null,
  onRowClick,
  fixed = false,
  className = "",
  style,
  ...rest
}: DataTableProps<Row>) {
  return (
    <div
      className={`gv-table-wrap ${className}`}
      style={{ maxHeight: maxHeight ?? undefined, ...style }}
      {...rest}
    >
      <table className="gv-table" style={fixed ? { tableLayout: "fixed" } : undefined}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: "pointer" } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
