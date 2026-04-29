import { createPortal } from "react-dom";
import "./Modal.css";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  className?: string;
  onClose?: () => void;
  children: ReactNode;
};

export default function Modal({ open, title, className = "", onClose, children }: ModalProps) {
  if (!open) return null;

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return null;

  return createPortal(
    <div className="modal-backdrop">
      <div className={`card modal-surface ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        {title || onClose ? (
          <div className="modal-header">
            {title ? <h3>{title}</h3> : <span />}
            {onClose ? (
              <button type="button" className="modal-close-button secondary" onClick={onClose} aria-label="Close dialog">
                <X size={16} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    modalRoot
  );
}
