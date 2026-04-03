"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MessageRendererProps {
  content: string;
  isUser: boolean;
}

export default function MessageRenderer({ content, isUser }: MessageRendererProps) {
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
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, {
          strict: false,
          throwOnError: false,
          errorColor: '#cc0000',
          trust: true,
        }]]}
        components={{
          // Customizacje dla lepszego wyświetlania
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-bold mb-3 mt-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-bold mb-2 mt-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-bold mb-2 mt-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-2 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside mb-2 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="ml-2" {...props} />
          ),
          code: ({ node, inline, ...props }: any) =>
            inline ? (
              <code
                className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono"
                {...props}
              />
            ) : (
              <code
                className="block bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-2"
                {...props}
              />
            ),
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto mb-2" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-[#2563EB] dark:border-[#3B82F6] pl-4 italic my-2 text-gray-700 dark:text-gray-300"
              {...props}
            />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-[#2563EB] dark:text-[#3B82F6]" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-4 border-gray-300 dark:border-gray-600" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-800 font-bold text-left" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
