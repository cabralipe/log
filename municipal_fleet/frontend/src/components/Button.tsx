import "./Button.css";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

export const Button = ({ children, variant = "primary", ...rest }: Props) => (
  <button className={`btn ${variant}`} {...rest}>
    {children}
  </button>
);
