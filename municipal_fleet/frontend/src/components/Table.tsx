import "./Table.css";

type Column<T> = { key: keyof T; label: string; render?: (row: T) => React.ReactNode };

type Props<T> = {
  columns: Column<T>[];
  data: T[];
};

export function Table<T extends { id: number | string }>({ columns, data }: Props<T>) {
  return (
    <div className="table card">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={String(col.key)}>{col.render ? col.render(row) : (row[col.key] as React.ReactNode)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
