"use client";

import { memo } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MessageRendererProps {
  content: string;
  isUser: boolean;
}

// Pluginy i komponenty na poziomie modułu — stałe referencje, więc ReactMarkdown
// nie dostaje "nowych" propsów przy każdym renderze rodzica.
const REMARK_PLUGINS: Options["remarkPlugins"] = [remarkMath, remarkGfm];

// trust: false — treść pochodzi z AI (i pośrednio od użytkownika), więc nie
// pozwalamy KaTeX-owi na \href, \url, \htmlClass, \htmlData itp. (wektor XSS /
// phishingu przez spreparowane linki). Brak rehype-raw = surowy HTML z markdown
// nie jest renderowany.
const REHYPE_PLUGINS: Options["rehypePlugins"] = [
  [
    rehypeKatex,
    {
      strict: false,
      throwOnError: false,
      errorColor: "#cc0000",
      trust: false,
    },
  ],
];

const COMPONENTS: Components = {
  h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3 mt-4" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
  h3: ({ node, ...props }) => <h3 className="text-base font-bold mb-2 mt-2" {...props} />,
  p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
  li: ({ node, ...props }) => <li className="ml-2" {...props} />,
  // react-markdown v10 nie przekazuje już `inline` — blok rozpoznajemy po
  // klasie języka (```lang) albo znaku nowej linii w treści.
  code: ({ node, className, children, ...props }) => {
    const isBlock = /language-/.test(className || "") || String(children ?? "").includes("\n");
    // Tło, padding i przewijanie bloku daje <pre> niżej — tu bez drugiej "ramki".
    return isBlock ? (
      <code className={`block text-xs font-mono ${className || ""}`} {...props}>
        {children}
      </code>
    ) : (
      <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ node, ...props }) => (
    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto mb-2" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="border-l-4 border-[#2563EB] dark:border-[#3B82F6] pl-4 italic my-2 text-gray-700 dark:text-gray-300"
      {...props}
    />
  ),
  strong: ({ node, ...props }) => <strong className="font-bold text-[#2563EB] dark:text-[#3B82F6]" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-4 border-gray-300 dark:border-gray-600" {...props} />,
  // Linki z odpowiedzi AI: zawsze w nowej karcie, bez dostępu do window.opener.
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-800 font-bold text-left"
      {...props}
    />
  ),
  td: ({ node, ...props }) => <td className="border border-gray-300 dark:border-gray-600 px-3 py-2" {...props} />,
};

function MessageRenderer({ content, isUser }: MessageRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : "dark:prose-invert"}`}>
      <style jsx global>{`
        /* KaTeX math rendering fixes */
        .katex { font-size: 1.1em; }
        .katex-display {
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.5rem 0;
        }
        .katex .katex-html {
          white-space: normal;
        }
        /* Dark mode KaTeX fix */
        .dark .katex {
          color: #e0e0e0 !important;
        }
        .dark .katex .mord,
        .dark .katex .mbin,
        .dark .katex .mrel,
        .dark .katex .mop,
        .dark .katex .mopen,
        .dark .katex .mclose,
        .dark .katex .mpunct {
          color: #e0e0e0 !important;
        }
      `}</style>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// memo: przeliczenie markdown+KaTeX tylko gdy zmieni się treść wiadomości.
export default memo(MessageRenderer);
