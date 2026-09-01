import ReactMarkdown from "react-markdown";
import type { Artifact } from "@/lib/types";

export function ArtifactCard({ artifact, open = false }: { artifact: Artifact; open?: boolean }) {
  return (
    <details className="border border-line-strong bg-card" open={open}>
      <summary className="cursor-pointer list-none px-4 py-3">
        <p className="font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">Document</p>
        <p className="mt-1 font-semibold text-foreground">{artifact.title}</p>
      </summary>
      <div className="border-t border-border px-4 pb-4">
        <ReactMarkdown
          components={{
            a: ({ children, href }) => (
              <a className="font-medium text-primary underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
            h1: ({ children }) => <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em]">{children}</h3>,
            h2: ({ children }) => <h4 className="mt-5 text-base font-semibold">{children}</h4>,
            h3: ({ children }) => <h5 className="mt-4 text-sm font-semibold">{children}</h5>,
            li: ({ children }) => <li className="ml-5 list-disc pl-1 text-sm leading-6">{children}</li>,
            ol: ({ children }) => <ol className="mt-2 space-y-1">{children}</ol>,
            p: ({ children }) => <p className="mt-3 text-sm leading-6 text-foreground">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            ul: ({ children }) => <ul className="mt-2 space-y-1">{children}</ul>,
          }}
        >
          {artifact.content}
        </ReactMarkdown>
      </div>
    </details>
  );
}
