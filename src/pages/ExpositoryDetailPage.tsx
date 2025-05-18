import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, updateSermonNotes, getScriptureVersesForChapter } from "../services/firebaseService";
import { Sermon } from "../components/SermonCard/SermonCard";
import { extractScriptureReferences, ScriptureReference } from "../utils/smartParseScriptureInput";
import ScriptureOverlay from "../components/ScriptureOverlay/ScriptureOverlay";
import debounce from "lodash.debounce";
import "./ExpositoryDetailPage.css";

function splitSlides(notes: string): string[] {
  return notes.split(/\n\s*---+\s*\n/).map(s => s.trim());
}

function joinSlides(slides: string[]): string {
  return slides.join("\n\n---\n\n");
}

function getReferenceLabel(ref: ScriptureReference): string {
  let label = `${ref.book} ${ref.chapter}:${ref.verse}`;
  if (ref.endChapter && ref.endVerse) {
    if (ref.endChapter === ref.chapter) {
      label += `-${ref.endVerse}`;
    } else {
      label += `-${ref.endChapter}:${ref.endVerse}`;
    }
  } else if (ref.endVerse) {
    label += `-${ref.endVerse}`;
  }
  return label;
}

export default function ExpositoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [scriptureRefs, setScriptureRefs] = useState<ScriptureReference[]>([]);
  const [activeScripture, setActiveScripture] = useState<ScriptureReference | null>(null);
  const [scriptureText, setScriptureText] = useState<string>("");
  const [showOverlay, setShowOverlay] = useState(false);
  const [slides, setSlides] = useState<string[]>([""]);
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    getSermon(id).then((data) => {
      if (data) {
        setSermon(data);
        if (data.notes && typeof data.notes === "object") {
          const orderedSlides = Object.keys(data.notes)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => data.notes![key]);
          setSlides(orderedSlides.length ? orderedSlides : [""]);
        } else {
          const initialSlides = splitSlides(data.description || "");
          setSlides(initialSlides.length ? initialSlides : [""]);
        }
      } else navigate("/dashboard");
    });
  }, [id, navigate]);

  useEffect(() => {
    setScriptureRefs(extractScriptureReferences(slides.join("\n\n")));
  }, [slides]);

  const persistSlides = useCallback(() => {
    if (!sermon) return;
    const newNotes: Record<string, string> = slides.reduce((acc, slideContent, idx) => {
      acc[String(idx)] = slideContent;
      return acc;
    }, {} as Record<string, string>);
    updateSermonNotes(sermon.id.toString(), newNotes).catch((error) =>
      console.error("Failed to save slides", error)
    );
  }, [sermon, slides]);

  const debouncedPersistSlides = useCallback(debounce(persistSlides, 500), [persistSlides]);

  function handleSlideChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const newSlides = [...slides];
    newSlides[activeSlide] = event.target.value;
    setSlides(newSlides);
    setSaveStatus("");
    debouncedPersistSlides();
  }

  async function handleSlideBlur() {
    if (!sermon) return;
    const newNotes: Record<string, string> = slides.reduce((acc, slideContent, idx) => {
      acc[String(idx)] = slideContent;
      return acc;
    }, {} as Record<string, string>);
    setSaving(true);
    try {
      await updateSermonNotes(sermon.id.toString(), newNotes);
      setSaveStatus("Saved");
    } catch {
      setSaveStatus("Error saving");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(""), 1500);
    }
  }

  function addSlide() {
    const updatedSlides = [...slides];
    updatedSlides.splice(activeSlide + 1, 0, "");
    setSlides(updatedSlides);
    setActiveSlide(activeSlide + 1);
    debouncedPersistSlides();
  }

  function deleteSlide() {
    if (slides.length <= 1) return;
    const updatedSlides = slides.filter((_, idx) => idx !== activeSlide);
    setSlides(updatedSlides);
    setActiveSlide(Math.max(activeSlide - 1, 0));
    debouncedPersistSlides();
  }

  function goToPreviousSlide() {
    if (activeSlide > 0) setActiveSlide(activeSlide - 1);
  }

  function goToNextSlide() {
    if (activeSlide < slides.length - 1) setActiveSlide(activeSlide + 1);
  }

  async function handleMiniCardClick(ref: ScriptureReference) {
    setActiveScripture(ref);
    setShowOverlay(true);
    const verses = await getScriptureVersesForChapter(ref.book, String(ref.chapter));
    let text = verses
      .filter(v => Number(v.verse) >= ref.verse && (!ref.endVerse || Number(v.verse) <= ref.endVerse))
      .sort((a, b) => Number(a.verse) - Number(b.verse))
      .map(v => `${ref.book} ${ref.chapter}:${v.verse} ${v.text}`)
      .join("\n");
    setScriptureText(text);
  }

  if (!sermon) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="expository-detail-root">
      {/* Sticky title/date/desc banner */}
      <div className="expository-sticky-banner">
        <div className="expository-banner-row">
          <h1 className="expository-banner-title">{sermon.title}</h1>
          <span className="expository-banner-date">{sermon.date}</span>
        </div>
        <div className="expository-banner-desc">{sermon.description?.slice(0, 120)}</div>
      </div>
      {/* Sticky scripture mini-cards banner */}
      <div className="expository-scripture-banner">
        {scriptureRefs.map((ref, i) => (
          <button
            key={i}
            className="expository-mini-card"
            onClick={() => handleMiniCardClick(ref)}
          >
            {getReferenceLabel(ref)}
          </button>
        ))}
      </div>
      {/* Notes as single centered slide with navigation arrows, add, and delete controls */}
      <div className="slide-editor-row">
        {/* Left controls */}
        <div className="slide-editor-side-controls">
          {activeSlide > 0 && (
            <button className="nav-arrow left" onClick={goToPreviousSlide}>&lt;</button>
          )}
          <button className="add-slide-button left" onClick={addSlide} title="Add Slide Left">+</button>
        </div>
        {/* Slide box */}
        <div className="slide-container slide-editor-center">
          <textarea
            className="slide-editor-textarea"
            value={slides[activeSlide]}
            onChange={handleSlideChange}
            onBlur={handleSlideBlur}
            placeholder="Enter notes for this slide..."
          />
          <button className="slide-delete-btn" onClick={deleteSlide} title="Delete Slide">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 7.5V14.5M10 7.5V14.5M13.5 7.5V14.5M3.5 5.5H16.5M8.5 3.5H11.5C12.0523 3.5 12.5 3.94772 12.5 4.5V5.5H7.5V4.5C7.5 3.94772 7.94772 3.5 8.5 3.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="expository-slide-status">
            {saving ? <span className="saving">Saving...</span> : saveStatus && <span className="saved">{saveStatus}</span>}
          </div>
        </div>
        {/* Right controls */}
        <div className="slide-editor-side-controls">
          <button className="add-slide-button right" onClick={addSlide} title="Add Slide Right">+</button>
          {activeSlide < slides.length - 1 && (
            <button className="nav-arrow right" onClick={goToNextSlide}>&gt;</button>
          )}
        </div>
      </div>
      {/* Scripture overlay */}
      {showOverlay && activeScripture && (
        <ScriptureOverlay
          reference={getReferenceLabel(activeScripture)}
          content={scriptureText || "Loading..."}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}
