import BasicRTE from './BasicRichTextEditor';
import './CustomRichTextEditor.css';

interface CustomRichTextEditorProps {
  html: string;
  onHtmlChange: (html: string) => void;
  onRefsChange?: (refs: any[]) => void;
  onTagSelect?: (tagName: string) => void;
  onVerseTagsSelect?: (tags: string[]) => void; // NEW: for handling multiple tags from verses
  activeSlide?: number;
  onCompositionStateChange?: (isComposing: boolean) => void; // NEW
}

export default function CustomRichTextEditor({ 
  html, 
  onHtmlChange, 
  onRefsChange,
  onTagSelect, 
  onVerseTagsSelect, // NEW
  activeSlide,
  onCompositionStateChange // NEW
}: CustomRichTextEditorProps) {
  return (
    <div className="custom-rich-text-editor">
      <BasicRTE
        html={html}
        onHtmlChange={onHtmlChange}
        onRefsChange={onRefsChange}
        onTagSelect={onTagSelect}
        onVerseTagsSelect={onVerseTagsSelect} // NEW
        onCompositionStateChange={onCompositionStateChange} // NEW
      />
    </div>
  );
}