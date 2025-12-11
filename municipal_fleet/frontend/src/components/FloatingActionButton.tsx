import { Plus } from "lucide-react";
import "./FloatingActionButton.css";

interface FloatingActionButtonProps {
  onClick: () => void;
  "aria-label": string;
  icon?: React.ReactNode;
  ariaControls?: string;
  ariaExpanded?: boolean;
}

export const FloatingActionButton = ({ onClick, "aria-label": ariaLabel, icon, ariaControls, ariaExpanded }: FloatingActionButtonProps) => {
  return (
    <button
      type="button"
      className="fab-button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      role="button"
    >
      {icon ?? <Plus size={24} />}
    </button>
  );
};
