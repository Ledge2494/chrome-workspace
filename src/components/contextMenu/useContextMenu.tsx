import { useState, useEffect, useRef } from 'preact/hooks';
import { ControlledMenu, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import './index.css';

import '@src/theme/dark/chrome.css';

type AnchorPoint = { x: number; y: number };

export type ContextMenuItem = { name: string; onClick: () => void };

/**
 * Hook that provides a ready-to-use ContextMenu component and a function to
 * open it at specific coordinates.
 *
 * Usage:
 * const { ContextMenu, openAt } = useContextMenu();
 * <div onContextMenu={e => { e.preventDefault(); openAt(e.clientX, e.clientY); }}>
 *   <ContextMenu />
 * </div>
 */
export default function useContextMenu() {
  const [isOpen, setOpen] = useState(false);
  const [anchorPoint, setAnchorPoint] = useState<AnchorPoint>({ x: 0, y: 0 });
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const [height, setHeight] = useState<number>(0);
  const menuRef = useRef<HTMLElement | null>(null);

  const handleContextMenu = (e: MouseEvent) => {
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
      return;
    }

    e.preventDefault();
    setAnchorPoint({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  const openAt = (show: boolean, x?: number, y?: number) => {
    if (!show) {
      setOpen(false);
      return;
    }
    if (x === undefined || y === undefined) return;
    setAnchorPoint({ x, y });
    setOpen(true);
  };

  // Measure the actual height of the rendered menu and keep it in `height`.
  // Uses ResizeObserver when available, otherwise falls back to window resize.
  useEffect(() => {
    // When closed, reset height to 0
    if (!isOpen) {
      setHeight(0);
      return;
    }

    const contextMenuEl = document.getElementById('context-menu');
    if (!contextMenuEl) return;
    menuRef.current = contextMenuEl;
    const el = menuRef.current;
    if (!el) return;

    const height = el.offsetHeight;
    setHeight(height);
  }, [isOpen, items]);

  function ContextMenu() {
    return (
      <ControlledMenu
        id='context-menu'
        menuClassName='context-menu'
        anchorPoint={anchorPoint}
        state={isOpen ? 'open' : 'closed'}
        direction='right'
        onClose={() => openAt(false)}
      >
        {items.length > 0 ? (
          items.map((it, idx) => (
            <MenuItem
              className='context-menu-item'
              key={idx}
              onClick={() => {
                try {
                  it.onClick();
                } finally {
                  openAt(false);
                }
              }}
            >
              {it.name}
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>— no actions —</MenuItem>
        )}
      </ControlledMenu>
    );
  }

  return { ContextMenu, handleContextMenu, setItems, height } as const;
}
