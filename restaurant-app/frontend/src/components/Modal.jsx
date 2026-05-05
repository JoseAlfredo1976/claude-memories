export default function Modal({ title, subtitle, onClose, children, footer, size = 'md' }) {
  const maxW = size === 'lg' ? 800 : size === 'sm' ? 440 : 660;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: maxW }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} title="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
