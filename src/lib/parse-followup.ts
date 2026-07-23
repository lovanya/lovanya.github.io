/**
 * 追问问题解析器
 * 把 AI 输出里"延伸追问"段的每个问题提取出来
 *
 * 支持格式：
 * - **问题 1**: text / 问题1: text
 * - **追问 1**: text / 追问1: text
 * - **面试官可能会问**: text / 面试官可能会问：text
 * - 1. text / - text / * text
 * - 裸问题：**如何...?**
 */

export interface FollowupQuestion {
  question: string;
  hint?: string;
}

/**
 * 从 AI 回答文本中提取追问段里的问题
 */
export function extractFollowups(text: string): FollowupQuestion[] {
  // 定位"延伸追问"或"进一步追问"段，匹配到下一个 ## 标题或文末
  const headerRe = /(?:延伸|进一步)?追问\s*[:：]?\s*\n([\s\S]*?)(?=\n##\s|$)/;
  const m = text.match(headerRe);
  if (!m || !m[1]) {
    return extractFromText(text);
  }
  return extractFromText(m[1]);
}

/**
 * 从给定文本里提取所有问题（行级匹配）
 */
function extractFromText(text: string): FollowupQuestion[] {
  const lines = text.split('\n');
  const out: FollowupQuestion[] = [];
  let current: FollowupQuestion | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // 思路提示 / 提示 / 参考 / 补充 → hint
    const hintMatch = line.match(/^[*\s]*(\*\*)?(?:思路|提示|参考|补充|备注|说明)[：:]\s*(.+?)\*?$/);
    if (hintMatch) {
      if (current) {
        current.hint = hintMatch[2];
        out.push(current);
        current = null;
      }
      continue;
    }

    // 问题/追问/面试官 N: question
    const labeledQ = line.match(/^[*\s]*(\*\*)?(?:问题|追问|面试官(?:可能会问)?|题)\s*\d*\s*[:：]\s*(.+?)(\*\*)?$/);
    if (labeledQ) {
      if (current) out.push(current);
      current = { question: labeledQ[2].trim() };
      continue;
    }

    // 列表项 + 问题（以 ？/? 结尾）
    const listQ = line.match(/^[*\s-]*(\*\*)?(.+?[？?])\*?$/);
    if (listQ) {
      const candidate = listQ[2].trim();
      if (candidate.endsWith('？') || candidate.endsWith('?')) {
        if (current) out.push(current);
        current = { question: candidate };
        continue;
      }
    }

    // 纯问题行（去 ** 后以 ？/? 结尾）
    const plain = line.replace(/\*\*/g, '').trim();
    if ((plain.endsWith('？') || plain.endsWith('?')) && plain.length <= 200) {
      if (current) out.push(current);
      current = { question: plain };
      continue;
    }
  }

  if (current) out.push(current);
  return out;
}

/**
 * 把追问问题注入 markdown 文本，转成可点击按钮 HTML
 * - 限定在"延伸追问"段内（避免误匹配主体正文里的问句）
 * - 在源 markdown 里插入 <button class="ai-followup-btn" data-fuq-q="...">...</button>
 * - marked 会原样保留 inline HTML 标签
 */
export function injectFollowupButtons(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const transformSection = (section: string): string => {
    let r = section;

    // 1) **问题 1** / **追问 2**：text（keyword 两侧 **）
    r = r.replace(
      /(\*\*)(?:问题|追问|面试官(?:可能会问)?|题)\s*(\d+)?(\*\*)\s*[:：]\s*(.+?)(?=\s*\*\*|\s*$)/gm,
      (_f, b1, _n, b2, q) => `${b1}${b2}<button type="button" class="ai-followup-btn" data-fuq-q="${escape(q.trim())}"><strong>${escape(q.trim())}</strong></button>`
    );

    // 2) **面试官可能会问：text？**（整行包在 ** 里）
    r = r.replace(
      /^\s*\*\*\s*(?:面试官(?:可能会问)?|问题|追问|题)\s*[:：]\s*(.+?[？?])\s*\*\*\s*$/gm,
      (_f, q) => `<button type="button" class="ai-followup-btn" data-fuq-q="${escape(q.trim())}"><strong>${escape(q.trim())}</strong></button>`
    );

    // 3) 带前缀的列表项：- 问题 N：如何处理？ / 1. 追问：怎么优化？
    //    剥掉前缀标签，只保留问题正文作为 button 文本
    r = r.replace(
      /^(\s*(?:[-*]\s+|\d+\.\s+))(?:问题|追问|面试官(?:可能会问)?|题)\s*\d*\s*[:：]\s*(.+?[？?])\s*$/gm,
      (_line, indent, q) => {
        const safe = escape(q.trim());
        return `${indent}<button type="button" class="ai-followup-btn" data-fuq-q="${safe}"><strong>${safe}</strong></button>`;
      }
    );

    // 4) 列表项/裸问题行（必须以 ？或？结尾）
    r = r.replace(
      /^(\s*(?:[-*]\s+|\d+\.\s+))(.+?[？?])\s*$/gm,
      (_line, indent, question) => {
        const cleaned = question.trim();
        if (!/[？?]/.test(cleaned)) return _line;
        // 跳过带标签的（已被前面规则处理过）
        if (/^(思路|提示|参考|补充|备注|说明|面试官(?:可能会问)?|题|问题|追问)\s*[:：]/.test(cleaned)) {
          return _line;
        }
        // 跳过包含 HTML 标签的（已经是按钮）
        if (/<button/.test(cleaned)) return _line;
        return `${indent}<button type="button" class="ai-followup-btn" data-fuq-q="${escape(cleaned)}"><strong>${escape(cleaned)}</strong></button>`;
      }
    );

    return r;
  };

  // 定位"延伸追问"或"进一步追问"段
  const headerRe = /((?:延伸|进一步)?追问\s*[:：]?\s*\n)([\s\S]*?)(?=\n##\s|$)/;
  const m = text.match(headerRe);
  if (!m) {
    // 没有追问段，不动原文本
    return text;
  }

  const before = text.substring(0, m.index);
  const header = m[1];
  const section = m[2];
  const after = text.substring(m.index + m[0].length);

  return before + header + transformSection(section) + after;
}