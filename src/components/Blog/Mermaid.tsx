import { useEffect, useRef, useState } from 'react';

interface Props {
  chart: string;
  /**
   * Optional Mermaid config overrides. Sensible defaults are provided so
   * most callers can just pass the `chart` string.
   */
  config?: Record<string, unknown>;
  /** Caption rendered below the diagram (optional). */
  caption?: string;
}

// Singleton loader — load Mermaid from jsDelivr exactly once.
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mermaid can only run in the browser'));
  }
  if (mermaidPromise) return mermaidPromise;

  mermaidPromise = new Promise((resolve, reject) => {
    // Inject the official Mermaid script from jsDelivr if it is not already
    // present on the page (e.g. loaded earlier by another instance).
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mermaid-loader="1"]',
    );
    const onReady = () => {
      // The script tag exposes `window.mermaid` once executed.
      const mermaid = (window as unknown as { mermaid?: typeof import('mermaid').default })
        .mermaid;
      if (!mermaid) {
        reject(new Error('Mermaid global not found after script load'));
        return;
      }
      resolve(mermaid);
    };

    if (existing) {
      if ((window as unknown as { mermaid?: unknown }).mermaid) onReady();
      else existing.addEventListener('load', onReady, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    script.defer = true;
    script.dataset.mermaidLoader = '1';
    script.onload = onReady;
    script.onerror = () => reject(new Error('Failed to load Mermaid from CDN'));
    document.head.appendChild(script);
  });

  return mermaidPromise;
}

export default function Mermaid({ chart, config, caption }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);
  // Increments on theme change so the render effect re-runs.
  const [themeToken, setThemeToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const isDark = () =>
      document.documentElement.classList.contains('dark');

    const render = async () => {
      try {
        const mermaid = await loadMermaid();
        // Pick a theme that matches the cold-tech palette.
        const themeVars = isDark()
          ? {
              background: 'transparent',
              primaryColor: '#0c1018',
              primaryTextColor: '#c9d1d9',
              primaryBorderColor: '#00e5ff',
              lineColor: '#00e5ff',
              secondaryColor: '#0c121e',
              tertiaryColor: '#06080d',
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
            }
          : {
              background: 'transparent',
              primaryColor: '#ffffff',
              primaryTextColor: '#1a1f2e',
              primaryBorderColor: '#0091ae',
              lineColor: '#0091ae',
              secondaryColor: '#f1f4f9',
              tertiaryColor: '#f5f7fa',
              fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
            };

        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          themeVariables: themeVars,
          ...config,
        });

        // Use a stable id so re-renders of the same chart don't accumulate SVGs.
        const id = `mmd-${Math.random().toString(36).slice(2, 10)}`;
        const { svg } = await mermaid.render(id, chart.trim());
        if (!cancelled) {
          setRenderedSvg(svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setRenderedSvg(null);
        }
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, config, themeToken]);

  // Re-render when the user toggles the theme.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new MutationObserver(() => {
      setThemeToken((t) => t + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  if (error) {
    return (
      <figure className="my-6">
        <div
          className="rounded border p-4 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-code-bg)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <p className="mb-2 font-mono text-xs uppercase tracking-wider opacity-70">
            Mermaid render error — showing source
          </p>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
            <code>{chart}</code>
          </pre>
          <p className="mt-2 text-xs opacity-60">{error}</p>
        </div>
        {caption ? (
          <figcaption
            className="mt-2 text-center text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <figure className="my-6">
      <div
        ref={containerRef}
        className="mermaid-container flex justify-center overflow-x-auto rounded border p-4"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}
        // Mermaid-generated SVG is trusted; injecting via innerHTML keeps the
        // call site simple and avoids re-implementing the renderer.
        dangerouslySetInnerHTML={{ __html: renderedSvg ?? '' }}
      />
      {caption ? (
        <figcaption
          className="mt-2 text-center text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
