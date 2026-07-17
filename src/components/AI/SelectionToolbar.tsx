import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatchAiOpen } from '../../lib/ai';

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  /** 选区是否在 <pre> 或 <code> 内（用于自动切换 codeExplain） */
  isCode: boolean;
}

const detectIsCode = (): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  let node: Node | null = sel.anchorNode;
  while (node) {
    if (node.nodeType === 1) {
      const tag = (node as Element).tagName;
      if (tag === 'PRE' || tag === 'CODE') return true;
    }
    node = node.parentNode;
  }
  return false;
};

export default function SelectionToolbar() {
  const [state, setState] = useState<MenuState>({ visible: false, x: 0, y: 0, text: '', isCode: false });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeElRef = useRef<Element | null>(null);

  const hide = useCallback(() => {
    setState((s) => (s.visible ? { ...s, visible: false } : s));
  }, []);

  useEffect(() => {
    const onMouseUp = (_e: MouseEvent) => {
      // 下一帧再读，避免 mouseup 时 selection 还没稳
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
          hide();
          return;
        }
        const text = sel.toString().trim();
        if (!text || text.length < 2) {
          hide();
          return;
        }
        // 不能超过 8000 字（Gemini 限制）
        const payload = text.length > 8000 ? text.slice(0, 8000) + '\n…（截断）' : text;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const isCode = detectIsCode();
        // 简单的位置计算：放在选区正上方（屏幕坐标）
        setState({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
          text: payload,
          isCode,
        });
      });
    };

    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.toString().trim() === '') {
        hide();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };

    const onScrollOrResize = () => hide();

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [hide]);

  const trigger = (template: 'explain' | 'translate' | 'summarize' | 'codeExplain') => {
    const anchor = { x: state.x, y: state.y + window.scrollY };
    dispatchAiOpen({ template, payload: state.text, anchor });
    hide();
    // 清空选区
    window.getSelection()?.removeAllRanges();
  };

  if (!state.visible) return null;

  const isZh = document.documentElement.lang !== 'en';

  const labels = isZh
    ? { explain: '💡 解释', translate: '🌐 翻译', summarize: '📋 总结', code: '💻 代码' }
    : { explain: '💡 Explain', translate: '🌐 Translate', summarize: '📋 Summarize', code: '💻 Code' };

  // 把菜单居中放在 state.x 处，并夹紧到屏幕内
  const totalWidth = state.isCode ? 360 : 280;
  let left = state.x - totalWidth / 2;
  if (typeof window !== 'undefined') {
    left = Math.max(8, Math.min(left, window.innerWidth - totalWidth - 8));
  }
  const top = state.y - 44; // 浮在选区上方

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        top: `${Math.max(8, top)}px`,
        left: `${left}px`,
        zIndex: 9996,
        display: 'flex',
        gap: '4px',
        padding: '5px',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-accent)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        width: `${totalWidth}px`,
        animation: 'selection-toolbar-in 0.18s ease-out',
      }}
    >
      <Bubble onClick={() => trigger('explain')}>{labels.explain}</Bubble>
      <Bubble onClick={() => trigger('translate')}>{labels.translate}</Bubble>
      <Bubble onClick={() => trigger('summarize')}>{labels.summarize}</Bubble>
      {state.isCode && (
        <>
          <div style={{ width: '1px', background: 'var(--color-border)' }} />
          <Bubble onClick={() => trigger('codeExplain')}>{labels.code}</Bubble>
        </>
      )}
    </div>
  );
}

function Bubble({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: '32px',
        padding: '0 12px',
        borderRadius: '5px',
        border: 'none',
        background: 'transparent',
        color: 'var(--color-text)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontFamily: 'JetBrains Mono, monospace',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--color-accent-dim)')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
