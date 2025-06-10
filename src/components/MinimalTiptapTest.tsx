import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export default function MinimalTiptapTest() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello from Tiptap!</p>',
  });

  return (
    <div style={{ background: '#222', padding: 16, borderRadius: 8, marginBottom: 24 }}>
      <h4 style={{ color: '#fff' }}>Minimal Tiptap Test</h4>
      <EditorContent editor={editor} />
    </div>
  );
}
