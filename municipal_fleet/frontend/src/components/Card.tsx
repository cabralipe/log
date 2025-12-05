import "./Card.css";

type Props = {
  title: string;
  value: string | number;
  hint?: string;
};

export const Card = ({ title, value, hint }: Props) => (
  <div className="kpi-card card">
    <div className="kpi-header">
      <span>{title}</span>
      {hint && <small>{hint}</small>}
    </div>
    <strong>{value}</strong>
  </div>
);
