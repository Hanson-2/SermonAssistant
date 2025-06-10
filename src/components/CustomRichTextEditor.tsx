import BasicRTE from './BasicRichTextEditor';
import './CustomRichTextEditor.css';

interface CustomRichTextEditorProps {
  html: string;
  onHtmlChange: (html: string) => void;
  onRefsChange?: (refs: any[]) => void;
  activeSlide?: number;
}

export default function CustomRichTextEditor({ 
  html, 
  onHtmlChange, 
  onRefsChange, 
  activeSlide 
}: CustomRichTextEditorProps) {
  return (
    <div className="custom-rich-text-editor">
      <BasicRTE
        html={html}
        onHtmlChange={onHtmlChange}
        onRefsChange={onRefsChange}
      />
    </div>
  );
}