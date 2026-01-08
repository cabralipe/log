import "./Button.css";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
};

export const Button = ({ children, variant = "primary", fullWidth, size = "md", className = "", ...rest }: Props) => (
  <button
    className={`btn ${variant} ${size} ${fullWidth ? "full-width" : ""} ${className}`}
    {...rest}
  >
    {children}
  </button>
);
