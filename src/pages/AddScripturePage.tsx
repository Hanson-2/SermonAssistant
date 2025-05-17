import React, { useState } from "react";
import { saveScriptureVerses } from "../services/firebaseService";
import { parseScriptureChapterInput } from "../services/scriptureParser";
import "./AddScripturePage.css";

const TRANSLATION_GROUPS = [
  {
    label: 'Common English',
    options: [
      { value: 'EXB', label: 'Expanded Bible (EXB)' },
      { value: 'ESV', label: 'English Standard Version (ESV)' },
      { value: 'KJV', label: 'King James Version (KJV)' },
      { value: 'NIV', label: 'New International Version (NIV)' },
      { value: 'NKJV', label: 'New King James Version (NKJV)' },
      { value: 'NASB', label: 'New American Standard Bible (NASB)' },
      { value: 'CSB', label: 'Christian Standard Bible (CSB)' },
      { value: 'NLT', label: 'New Living Translation (NLT)' },
      { value: 'NRSV', label: 'New Revised Standard Version (NRSV)' },
      { value: 'AMP', label: 'Amplified Bible (AMP)' },
      { value: 'MSG', label: 'The Message (MSG)' },
      { value: 'CEV', label: 'Contemporary English Version (CEV)' },
      { value: 'GNT', label: 'Good News Translation (GNT)' },
      { value: 'WEB', label: 'World English Bible (WEB)' },
      { value: 'Other', label: 'Other' },
    ],
  },
  {
    label: 'Catholic',
    options: [
      { value: 'NABRE', label: 'New American Bible Revised Edition (NABRE)' },
      { value: 'DRA', label: 'Douay-Rheims (DRA)' },
      { value: 'RSVCE', label: 'Revised Standard Version Catholic Edition (RSVCE)' },
      { value: 'JB', label: 'Jerusalem Bible (JB)' },
    ],
  },
  {
    label: 'Orthodox',
    options: [
      { value: 'OSB', label: 'Orthodox Study Bible (OSB)' },
      { value: 'Brenton', label: 'Brenton Septuagint (Brenton)' },
    ],
  },
  {
    label: 'Jewish',
    options: [
      { value: 'JPS', label: 'Jewish Publication Society (JPS)' },
      { value: 'CJB', label: 'Complete Jewish Bible (CJB)' },
      { value: 'Tanakh', label: 'Tanakh (JPS 1985)' },
    ],
  },
];

export default function AddScripturePage() {
  const [input, setInput] = useState("");
  const [parsedVerses, setParsedVerses] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [translation, setTranslation] = useState("EXB");

  const handleParse = () => {
    try {
      const results = parseScriptureChapterInput(input).map(v => ({ ...v, translation }));
      setParsedVerses(results);
      setError("");
    } catch (err: any) {
      setError(err.message);
      setParsedVerses([]);
    }
  };

  const handleSubmit = async () => {
    await saveScriptureVerses(parsedVerses);
    alert("Scriptures added successfully.");
    setInput("");
    setParsedVerses([]);
  };

  return (
    <div className="add-scripture-layout">
      <h1 className="add-scripture-title">Add Scripture</h1>

      <label htmlFor="translation-select" className="add-scripture-translation-label">
        Translation:
        <select
          id="translation-select"
          value={translation}
          onChange={e => setTranslation(e.target.value)}
          className="add-scripture-translation-dropdown"
        >
          {TRANSLATION_GROUPS.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={"Paste scripture lines here, e.g.:\nJohn 3:16 For God so loved the world..."}
        rows={10}
        className="add-scripture-textarea"
      />

      {error && <p className="add-scripture-error">{error}</p>}

      <button
        onClick={handleParse}
        className="add-scripture-parse-btn"
      >
        Parse Scripture
      </button>

      {parsedVerses.length > 0 && (
        <div className="add-scripture-preview">
          <h2 className="add-scripture-preview-title">Preview</h2>
          <ul className="add-scripture-preview-list-modern">
            {parsedVerses.map((verse, index) => (
              <li key={index} className="add-scripture-preview-item-modern">
                <span className="add-scripture-ref-modern">
                  {verse.book} <b>{verse.chapter}:{verse.verse}</b>
                </span>
                <span className="add-scripture-text-modern">{verse.text}</span>
                <span className="add-scripture-translation-modern">{verse.translation}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleSubmit}
            className="add-scripture-submit-btn"
          >
            Submit All to Firebase
          </button>
        </div>
      )}
    </div>
  );
}
