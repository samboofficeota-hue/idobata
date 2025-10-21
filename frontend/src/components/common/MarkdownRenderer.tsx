import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";

interface MarkdownRendererProps {
  markdown: string;
  className?: string;
}

export function MarkdownRenderer({
  markdown,
  className,
}: MarkdownRendererProps) {
  if (!markdown) {
    return null;
  }

  return (
    <div className={cn("prose prose-neutral max-w-none prose-p:my-0 prose-p:leading-8", className)}>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mb-4 font-biz" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <div className="flex items-center py-2 mb-3">
              <div className="w-1 h-6 bg-primary rounded-full mr-2" />
              <h2
                className="text-xl font-bold text-foreground font-biz leading-6"
                {...props}
              />
            </div>
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold mb-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-neutral-700 inline" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 mb-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 mb-2" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a
              className="text-primary hover:text-primary underline"
              {...props}
            />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-neutral-300 pl-4 italic my-2"
              {...props}
            />
          ),
          code: ({ node, ...props }) => (
            <code
              className="bg-neutral-100 px-1 py-0.5 rounded text-sm"
              {...props}
            />
          ),
          pre: ({ node, ...props }) => (
            <pre
              className="bg-neutral-100 p-4 rounded overflow-x-auto my-2"
              {...props}
            />
          ),
          img: ({ node, src, title, ...props }) => {
            return (
              <img
                className="max-w-full h-auto rounded my-2"
                src={src}
                alt={props.alt || title || "画像"}
                title={title}
              />
            );
          },
          table: ({ node, ...props }) => (
            <table className="w-full border-collapse mb-2" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th
              className="border border-neutral-300 p-2 bg-neutral-100"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-neutral-300 p-2" {...props} />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
