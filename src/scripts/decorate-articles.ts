/**
 * 文章内容装饰脚本：
 *  1. 绑定 [data-ai-*] 元素的点击事件，统一派发 'ai:open' 事件
 *  2. 给文章内所有 <pre><code> 注入 🤖 按钮（CodeAsk）
 *  3. 给 Mermaid 图容器注入 🤖 按钮（MermaidAsk）—— 已由 Mermaid.tsx 内部处理
 *
 * 通过 <script src="..."> 引入，IIFE 自动执行。
 */
(function () {
  if (typeof window === 'undefined') return;

  const dispatchAiOpen = (detail: {
    template: 'explain' | 'translate' | 'summarize' | 'codeExplain' | 'interview' | 'mermaidExplain';
    payload: string;
    anchor?: { x: number; y: number };
  }) => {
    window.dispatchEvent(new CustomEvent('ai:open', { detail }));
  };

  /**
   * 1. 绑定所有 .ai-ask-btn（来自 <AIAsk> 组件）的点击
   */
  const bindAiAskButtons = () => {
    document.querySelectorAll<HTMLButtonElement>('.ai-ask-btn[data-ai-template][data-ai-payload]').forEach((btn) => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = btn.getBoundingClientRect();
        const template = btn.dataset.aiTemplate as 'interview';
        const payload = btn.dataset.aiPayload || '';
        if (!payload) return;
        dispatchAiOpen({
          template,
          payload,
          anchor: { x: rect.left + rect.width / 2, y: rect.bottom },
        });
      });
    });
  };

  /**
   * 2. 给 <pre> 块注入 🤖 CodeAsk 按钮（如果有代码则添加）
   */
  const decorateCodeBlocks = () => {
    document.querySelectorAll<HTMLPreElement>('article pre, .prose pre, .post-content pre').forEach((pre) => {
      if (pre.dataset.aiDecorated === '1') return;
      pre.dataset.aiDecorated = '1';
      // 确保 pre 是 relative 定位
      const cs = window.getComputedStyle(pre);
      if (cs.position === 'static') {
        pre.style.position = 'relative';
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-code-ask-btn';
      const isEn = document.documentElement.lang === 'en';
      btn.textContent = isEn ? '🤖 AI' : '🤖 AI';
      btn.title = isEn ? 'AI analyze this code' : '让 AI 解析这段代码';
      btn.setAttribute('aria-label', btn.title);
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = pre.querySelector('code')?.textContent || pre.textContent || '';
        const truncated = code.length > 8000 ? code.slice(0, 8000) + '\n…（截断）' : code;
        const rect = pre.getBoundingClientRect();
        dispatchAiOpen({
          template: 'codeExplain',
          payload: truncated,
          anchor: { x: rect.left + rect.width / 2, y: rect.bottom },
        });
      });
      pre.appendChild(btn);
    });
  };

  /**
   * 3. 给 Mermaid 容器注入 🤖 按钮（Mermaid 自身的容器 class 为 .mermaid-container）
   *    Mermaid.tsx 内部其实已经处理了，但为了 fallback 我们也加一份。
   */
  const decorateMermaid = () => {
    document.querySelectorAll<HTMLElement>('.mermaid-container[data-chart]').forEach((el) => {
      if (el.dataset.aiMermaidBound === '1') return;
      el.dataset.aiMermaidBound = '1';
      const chart = el.dataset.chart || '';
      if (!chart) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-mermaid-ask-btn';
      btn.textContent = '🤖';
      btn.title = '让 AI 解析这个图表';
      btn.setAttribute('aria-label', btn.title);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = el.getBoundingClientRect();
        dispatchAiOpen({
          template: 'mermaidExplain',
          payload: chart,
          anchor: { x: rect.left + rect.width / 2, y: rect.bottom },
        });
      });
      el.appendChild(btn);
    });
  };

  const decorateAll = () => {
    bindAiAskButtons();
    decorateCodeBlocks();
    decorateMermaid();
  };

  // 初次执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorateAll);
  } else {
    decorateAll();
  }

  // SPA / 视图切换后重新装饰
  window.addEventListener('astro:page-load', decorateAll);
  // DocumentMutations 也兜一下（Mermaid 是动态插入的）
  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => decorateAll());
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
