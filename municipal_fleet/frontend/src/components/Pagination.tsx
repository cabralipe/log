import "./Pagination.css";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
};

export const Pagination = ({ page, pageSize, total, onChange }: Props) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prev = () => onChange(Math.max(1, page - 1));
  const next = () => onChange(Math.min(pages, page + 1));

  return (
    <div className="pagination">
      <button onClick={prev} disabled={page <= 1}>
        Anterior
      </button>
      <span>
        Página {page} / {pages}
      </span>
      <button onClick={next} disabled={page >= pages}>
        Próxima
      </button>
    </div>
  );
};
