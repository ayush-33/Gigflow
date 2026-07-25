import React, { useEffect, useRef } from "react";
import "../styles/Modal.css";

export default function Modal({ isOpen, onClose, title, children, maxWidth = "450px" }) {
  const modalRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Trap focus inside modal
  useEffect(() => {
    if (!isOpen) return;

    const modalElement = modalRef.current;
    if (!modalElement) return;

    // Save active element to refocus on close
    const previousActiveElement = document.activeElement;

    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (firstElement) {
      firstElement.focus();
    }

    const handleTabTrap = (e) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    modalElement.addEventListener("keydown", handleTabTrap);

    // Disable main page scrolling
    document.body.style.overflow = "hidden";

    return () => {
      modalElement.removeEventListener("keydown", handleTabTrap);
      document.body.style.overflow = "";
      if (previousActiveElement) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="shared-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="shared-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
        ref={modalRef}
      >
        <div className="shared-modal-header">
          <h3 className="shared-modal-title">{title}</h3>
          <button type="button" className="shared-modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>
        <div className="shared-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
