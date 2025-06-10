import React, { useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { extractScriptureReferences } from "../utils/smartParseScriptureInput";
import "./EditableRichText.css";
import "../styles/edit-expository.scss";

interface Props {
  html: string;
  onHtmlChange: (html: string) => void;
  onRefsChange: (refs: any[]) => void;
}

export default function EditableRichText({ html, onHtmlChange, onRefsChange }: Props) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  const handleEditorChange = (content: string, editor: any) => {
    onHtmlChange(content);
    const text = editor.getContent({ format: "text" });
    const refs = extractScriptureReferences(text);
    onRefsChange(refs);
  };
  return (
    <div className="editor-flex-container">
      <div className="editor-toolbar-scroll">
        <div className="rich-note-toolbar">
          {/* Removed AI action and custom prompt input */}
        </div>
      </div>

      <div className="editor-area-wrapper">
        <div className="rich-note-editor">
        <Editor
          apiKey="duekh96r3p6tu822g4q168eyjs443yoz42cfbmgc6ycori7u"
          value={html}
          onEditorChange={handleEditorChange}
          init={{
            height: "calc(100% - 40px)",
            menubar: false,
            branding: false,
            skin: "oxide-dark",
            content_css: "dark",
            plugins: [
              "link",
              "lists",
              "image",
              "media",
              "table",
              "code",
              "wordcount",
            ],
            toolbar:
              "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | checklist numlist bullist indent outdent | removeformat",
            toolbar_mode: "floating",
            image_advtab: true,
            image_caption: true,
            paste_data_images: true,
            font_family_formats: `
              Andale Mono=andale mono,times;
              Arial=arial,helvetica,sans-serif;
              Arial Black=arial black,avant garde;
              Book Antiqua=book antiqua,palatino;
              Comic Sans MS=comic sans ms,sans-serif;
              Courier New=courier new,courier;
              Georgia=georgia,palatino;
              Helvetica=helvetica;
              Impact=impact,chicago;
              Symbol=symbol;
              Tahoma=tahoma,arial,helvetica,sans-serif;
              Terminal=terminal,monaco;
              Times New Roman=times new roman,times;
              Trebuchet MS=trebuchet ms,geneva;
              Verdana=verdana,geneva;
              Webdings=webdings;
              Wingdings=wingdings,zapf dingbats;
              Century Gothic=Century Gothic,AppleGothic,sans-serif;
              Franklin Gothic Medium=Franklin Gothic Medium,Arial Narrow,Arial,sans-serif;
              Candara=Candara,Calibri,Segoe,Segoe UI,Optima,Arial,sans-serif;
              Optima=Optima,Segoe,Segoe UI,Candara,Calibri,Arial,sans-serif;
              Geneva=Geneva,Verdana,sans-serif;
              Segoe UI=Segoe UI,Segoe,Tahoma,Geneva,Verdana,sans-serif;
              Calibri=Calibri,Candara,Segoe,Segoe UI,Optima,Arial,sans-serif;
              Rockwell=Rockwell,Courier Bold,Courier,Georgia,Times,Times New Roman,serif;
              Consolas=Consolas,monaco,monospace;
              Futura=Futura,Trebuchet MS,Arial,sans-serif;
              Brush Script MT=Brush Script MT,cursive;
              Roboto=Roboto,Arial,sans-serif;
              Lato=Lato,Arial,sans-serif;
              Montserrat=Montserrat,Arial,sans-serif;
              Merriweather=Merriweather,serif;
              Oswald=Oswald,Arial,sans-serif;
              Open Sans=Open Sans,Arial,sans-serif;
              Raleway=Raleway,Arial,sans-serif;
              PT Sans=PT Sans,Arial,sans-serif;
              Nunito=Nunito,Arial,sans-serif;
              Playfair Display=Playfair Display,serif;
              Source Code Pro=Source Code Pro,monospace;
              Fira Mono=Fira Mono,monospace;
              Inconsolata=Inconsolata,monospace;
              Gill Sans=Gill Sans,Gill Sans MT,Calibri,sans-serif;
              Baskerville=Baskerville,Baskerville Old Face,Hoefler Text,Garamond,Times New Roman,serif;
              Perpetua=Perpetua,Perpetua Titling MT,Times New Roman,serif;
              Copperplate=Copperplate,Copperplate Gothic Light,fantasy;
              Brush Script=Brush Script MT,cursive;
              Lucida Sans=Lucida Sans,Lucida Grande,Lucida Sans Unicode,Geneva,Verdana,sans-serif;
              Lucida Bright=Lucida Bright,Georgia,serif;
              Lucida Handwriting=Lucida Handwriting,cursive;
              Palatino=Palatino Linotype,Book Antiqua,Palatino,serif;
              Bookman=Bookman Old Style,Bookman,serif;
              Avant Garde=Avant Garde,Arial,Helvetica,sans-serif;
              Didot=Didot,Didot LT STD,Hoefler Text,Garamond,Times New Roman,serif;
              Century Schoolbook=Century Schoolbook,Georgia,serif;
              American Typewriter=American Typewriter,Georgia,serif;
              Bodoni=Bodoni MT,Didot,Didot LT STD,Hoefler Text,Garamond,Times New Roman,serif;
              Cursive=cursive;
              Fantasy=fantasy;
            `,
            setup: (editor) => {
              // Debug key events
              editor.on("keydown", (e) => {
                console.log("Key pressed:", e.keyCode);
              });
              // Enable native image resizing and dragging
              editor.on("ObjectResized", (e) => {
                console.log("Image resized:", e);
              });
              editor.on("init", () => {
                editor.getBody().addEventListener(
                  "mousedown",
                  (event) => {
                    const target = event.target as HTMLElement;
                    if (target && target.tagName === "IMG") {
                      const img = target as HTMLImageElement;
                      img.setAttribute("draggable", "true");
                      img.style.resize = "both";
                      img.style.overflow = "auto";
                      img.style.maxWidth = "100%";
                    }
                  },
                  true
                );
              });
            },
          }}        />
        </div>
      </div>

      <div className="ai-result-panel">
        {aiLoading && <p>Loading AI response...</p>}
        {!aiLoading && aiResult && (
          <>
            <h3>AI Result</h3>
            <pre>{aiResult}</pre>
          </>
        )}
      </div>
    </div>
  );
}
