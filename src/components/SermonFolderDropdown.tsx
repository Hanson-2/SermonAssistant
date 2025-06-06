import React, { useRef, useState } from "react";

export interface SermonFolderDropdownProps {
  folders: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export default function SermonFolderDropdown({ folders, value, onChange }: SermonFolderDropdownProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        open &&
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedLabel =
    value === null
      ? "All Folders"
      : value === "__unassigned__"
      ? "Unassigned"
      : folders.find((f) => f.id === value)?.name || "Unknown";
  return (
    <div className="custom-folder-dropdown" style={{ position: "relative", width: "100%" }}>
      <button
        ref={buttonRef}
        className="custom-folder-dropdown-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
      ><span>{selectedLabel}</span>
        <span className="custom-folder-dropdown-arrow" aria-hidden="true">▼</span>
      </button>
      {open && (        <div
          ref={listRef}
          className="custom-folder-dropdown-list"
          role="listbox"
          aria-label="Folder selection"          tabIndex={-1}
        >
          <div
            className={`custom-folder-dropdown-option${value === null ? " selected" : ""}`}
            role="option"
            aria-selected={value === null ? "true" : "false"}
            tabIndex={0}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            All Folders
          </div>
          <div
            className={`custom-folder-dropdown-option${value === "__unassigned__" ? " selected" : ""}`}
            role="option"
            aria-selected={value === "__unassigned__" ? "true" : "false"}
            tabIndex={0}
            onClick={() => {
              onChange("__unassigned__");
              setOpen(false);
            }}
          >
            Unassigned
          </div>          {folders.map((folder) => (
            <div
              key={folder.id}
              className={`custom-folder-dropdown-option${value === folder.id ? " selected" : ""}`}
              role="option"
              aria-selected={value === folder.id ? "true" : "false"}
              tabIndex={0}
              onClick={() => {
                onChange(folder.id);
                setOpen(false);
              }}
            >
              {folder.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
