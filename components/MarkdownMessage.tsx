import ReactMarkdown, { type Components } from "react-markdown";

// react-markdown renders standard markdown constructs only (no raw HTML
// passthrough is enabled here, no rehype-raw plugin), so assistant output
// can't inject arbitrary HTML — it's limited to safe markdown elements.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1.5 font-serif text-lg text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1.5 font-serif text-base text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 mb-1 font-serif text-sm text-foreground first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-2 font-sans text-sm leading-relaxed text-foreground last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-0.5 pl-5 text-sm text-foreground last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-0.5 pl-5 text-sm text-foreground last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-background px-1 py-0.5 font-mono text-xs text-accent">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-background p-2 font-mono text-xs text-foreground last:mb-0">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-surface-border pl-3 text-sm text-muted-strong last:mb-0">
      {children}
    </blockquote>
  ),
};

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="max-w-none break-words">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
