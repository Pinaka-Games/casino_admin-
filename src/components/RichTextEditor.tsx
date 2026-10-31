"use client";

import { useEffect, useRef } from "react";
import type Quill from "quill";
import "quill/dist/quill.snow.css";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Editor body height. The toolbar sits above it. */
  minHeight?: number;
}

/**
 * Rich-text editor for mail bodies.
 *
 * Drives Quill 2 directly instead of `react-quill`: that wrapper is still on
 * findDOMNode, which React 19 removed, so it throws on mount here. Quill itself
 * is framework-agnostic and only needs a container.
 *
 * Loaded dynamically because Quill touches `document` at import time and this
 * app server-renders.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  // Held in a ref so the change handler never goes stale without re-mounting
  // Quill — re-initialising it on every keystroke would lose the selection.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const Quill = (await import("quill")).default;
      if (cancelled || !containerRef.current || quillRef.current) return;

      const quill = new Quill(containerRef.current, {
        theme: "snow",
        placeholder: placeholder ?? "Write your email…",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ align: [] }],
            ["link", "blockquote"],
            ["clean"],
          ],
        },
      });

      quill.on("text-change", () => {
        const html = quill.getSemanticHTML();
        // Quill reports an "empty" document as a single empty paragraph; treat
        // that as empty so the send button's validation is honest.
        onChangeRef.current(quill.getText().trim() ? html : "");
      });

      quillRef.current = quill;

      if (value) {
        quill.clipboard.dangerouslyPasteHTML(value);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Mount-only: `value` is applied once as the initial content, and after
    // that the editor owns it. Re-running on every value change would fight
    // the user's cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External resets (Clear button, template applied) — only pushed when the
  // incoming value genuinely differs from what the editor already holds.
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const current = quill.getText().trim() ? quill.getSemanticHTML() : "";
    if (value === current) return;
    if (!value) {
      quill.setText("");
      return;
    }
    quill.clipboard.dangerouslyPasteHTML(value);
  }, [value]);

  return (
    <div className="rich-text-editor">
      <div ref={containerRef} style={{ minHeight }} />
      <style jsx global>{`
        .rich-text-editor .ql-toolbar {
          background: #242b35;
          border-color: #3b414d;
          border-radius: 6px 6px 0 0;
        }
        .rich-text-editor .ql-container {
          background: #242b35;
          border-color: #3b414d;
          border-radius: 0 0 6px 6px;
          color: #ffffff;
          font-size: 14px;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #6b7280;
          font-style: normal;
        }
        .rich-text-editor .ql-stroke {
          stroke: #cbd5e1;
        }
        .rich-text-editor .ql-fill {
          fill: #cbd5e1;
        }
        .rich-text-editor .ql-picker,
        .rich-text-editor .ql-picker-label,
        .rich-text-editor .ql-picker-options {
          color: #cbd5e1;
        }
        .rich-text-editor .ql-picker-options {
          background: #1a2030;
        }
        .rich-text-editor .ql-active .ql-stroke {
          stroke: #b93deb;
        }
        .rich-text-editor .ql-active .ql-fill {
          fill: #b93deb;
        }
      `}</style>
    </div>
  );
}
