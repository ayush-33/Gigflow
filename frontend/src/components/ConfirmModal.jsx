import { useEffect, useRef } from "react";
import "../styles/ConfirmModal.css";

/**
 * ConfirmModal — replaces window.confirm() and window.alert() everywhere.
 *
 * Usage:
 *   const [modal, setModal] = useState(null);
 *
 *   // Confirm dialog:
 *   setModal({
 *     type: "confirm",                  // or "alert" | "success" | "danger"
 *     title: "Delete this gig?",
 *     body: "This cannot be undone.",
 *     confirmLabel: "Delete",           // optional, default "Confirm"
 *     onConfirm: () => handleDelete(),
 *   });
 *
 *   <ConfirmModal modal={modal} onClose={() => setModal(null)} />
 */
export default function ConfirmModal({ modal, onClose }) {
  const cancelRef = useRef(null);

  // Focus trap — focus Cancel on open
  useEffect(() => {
    if (modal) setTimeout(() => cancelRef.current?.focus(), 50);
  }, [modal]);

  // Close on Escape
  useEffect(() => {
    if (!modal) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modal, onClose]);

  if (!modal) return null;

  const isAlert   = modal.type === "alert" || modal.type === "success";
  const isDanger  = modal.type === "danger" || modal.type === "confirm";
  const icon      = {
    confirm: "⚠️",
    danger:  "🗑",
    alert:   "ℹ️",
    success: "✅",
  }[modal.type] || "⚠️";

  const handleConfirm = () => {
    onClose();
    modal.onConfirm?.();
  };

  return (
    <div
      className="cm-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cm-title"
    >
      <div className="cm-card" onClick={(e) => e.stopPropagation()}>
        <div className={`cm-icon-wrap cm-icon-${modal.type || "confirm"}`}>
          {icon}
        </div>

        <h2 className="cm-title" id="cm-title">{modal.title}</h2>

        {modal.body && (
          <p className="cm-body">{modal.body}</p>
        )}

        <div className="cm-actions">
          {!isAlert && (
            <button
              ref={cancelRef}
              className="cm-btn cm-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button
            className={`cm-btn ${isDanger ? "cm-danger" : "cm-primary"}`}
            onClick={handleConfirm}
            autoFocus={isAlert}
          >
            {modal.confirmLabel || (isAlert ? "OK" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}