import React from 'react';
import { fontOptions } from './editorFonts';

const SimpleRichTextEditor = () => {
  return (
    <div>
      {/* ...existing editor code... */}

      {/* Font selection dropdown */}
      <label htmlFor="font-select">Font</label>
      <select id="font-select" title="Font">
        {fontOptions.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* ...existing editor code... */}
    </div>
  );
};

export default SimpleRichTextEditor;