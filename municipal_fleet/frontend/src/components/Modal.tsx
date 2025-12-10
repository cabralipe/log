import { useEffect, useRef } from "react";
import "./Modal.css";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  id?: string;
};

export const Modal = ({ open, title, onClose, children, id }: ModalProps) => {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      closeBtnRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={`modal-overlay ${open ? "open" : ""}`} aria-hidden="true" onClick={onClose} />
      <div className="modal-container">
        <div
          className={`modal-content ${open ? "open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          id={id}
          ref={containerRef}
        >
          <div className="modal-header">
            {title ? <h3 id="modal-title">{title}</h3> : <span />}
            <button
              className="modal-close"
              aria-label="Fechar modal"
              onClick={onClose}
              ref={closeBtnRef}
            >
              ×
            </button>
          </div>
          <div className="modal-body">{children}</div>
        </div>
      </div>
    </>
  );
};
