import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';

const Tooltip = ({ content, children, className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [style, setStyle] = useState({});
    const triggerRef = useRef(null);

    const updatePosition = () => {
        if (!triggerRef.current || !content) return;

        const rect = triggerRef.current.getBoundingClientRect();
        const gap = 8; // Space between element and tooltip

        let transform = 'translate(-50%, -100%)';
        let top = rect.top - gap;
        let left = rect.left + (rect.width / 2);

        // Check top boundary
        if (top < 50) {
            // Flip to bottom
            top = rect.bottom + gap;
            transform = 'translate(-50%, 0)';
        }

        // Check right boundary (simplistic)
        if (left > window.innerWidth - 100) {
            // shifting logic if needed, but centering usually works unless edge
        }

        setStyle({
            top,
            left,
            transform
        });
    };

    const handleMouseEnter = () => {
        updatePosition();
        setIsVisible(true);
    };

    const handleMouseLeave = () => {
        setIsVisible(false);
    };

    if (!content) return <div className={className}>{children}</div>;

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={className}
            >
                {children}
            </div>
            {isVisible && ReactDOM.createPortal(
                <div
                    className="fixed z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded shadow-xl max-w-sm break-words pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        ...style,
                        position: 'fixed'
                    }}
                >
                    {content}
                    {/* Arrow (optional, tricky with flipping) */}
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
