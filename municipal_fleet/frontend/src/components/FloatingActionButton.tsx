import { Plus } from "lucide-react";
import "./FloatingActionButton.css";

interface FloatingActionButtonProps {
  onClick: () => void;
  "aria-label": string;
}

export const FloatingActionButton = ({ onClick, "aria-label": ariaLabel }: FloatingActionButtonProps) => {
  return (
    <button
      type="button"
      className="fab-button"
      onClick={onClick}
      aria-label={ariaLabel}
      role="button"
    >
      <Plus size={24} />
    </button>
  );
};