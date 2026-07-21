// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Lightweight WYSIWYG editor for CPA report letters.
//
// The app ships no rich-text library, and engagement letters are just
// paragraphs + a signature block, so this is a small contenteditable surface
// with a fixed toolbar (bold / italic / underline, bullet + numbered lists,
// left / center / right align) plus an "Insert variable" menu that drops a
// {{token}} at the caret. Emits HTML via onChange; no external dependency.

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, ChevronDown, ImagePlus } from 'lucide-react';

// Images are inlined into the letter body as data URIs (self-contained, no
// external fetch when the letter is rendered to PDF). Cap the source file so
// the stored HTML / generated PDF stays reasonable — logos/signatures, not
// full-page scans.
const MAX_IMAGE_BYTES = 1_000_000;

export interface EditorVariable {
  key: string;
  label: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  variables: EditorVariable[];
  ariaLabel?: string;
}

function exec(command: string, arg?: string) {
  // execCommand is deprecated but remains the simplest cross-browser way to
  // drive a contenteditable toolbar; adequate for a paragraph-and-signature
  // letter editor. Focus first so the command targets the editor selection.
  document.execCommand(command, false, arg);
}

export function RichTextEditor({ value, onChange, variables, ariaLabel }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState('');

  // Sync external value into the DOM only when it diverges and the editor is
  // not focused, so typing (which already updates the DOM) never resets caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    exec(command, arg);
    emit();
  };

  const insertVariable = (key: string) => {
    ref.current?.focus();
    exec('insertText', `{{${key}}}`);
    setMenuOpen(false);
    emit();
  };

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImgError('Please choose an image file.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImgError('Image is too large (max 1 MB). Resize it and try again.'); return; }
    setImgError('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      ref.current?.focus();
      exec('insertHTML', `<img src="${dataUrl}" style="max-width:100%;height:auto;" alt="" />`);
      emit();
    };
    reader.onerror = () => setImgError('Could not read the image file.');
    reader.readAsDataURL(file);
  };

  const btn = 'p-1.5 rounded hover:bg-gray-100 text-gray-700';

  return (
    <div className="border border-gray-300 rounded-lg overflow-visible">
      <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <button type="button" className={btn} onClick={() => run('bold')} aria-label="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => run('italic')} aria-label="Italic"><Italic className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => run('underline')} aria-label="Underline"><Underline className="h-4 w-4" /></button>
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" className={btn} onClick={() => run('insertUnorderedList')} aria-label="Bullet list"><List className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => run('insertOrderedList')} aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></button>
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" className={btn} onClick={() => run('justifyLeft')} aria-label="Align left"><AlignLeft className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => run('justifyCenter')} aria-label="Align center"><AlignCenter className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={() => run('justifyRight')} aria-label="Align right"><AlignRight className="h-4 w-4" /></button>
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" className={btn} onClick={() => fileRef.current?.click()} aria-label="Insert image"><ImagePlus className="h-4 w-4" /></button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-sm text-gray-700 border border-gray-300"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Insert variable"
          >
            Insert variable <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
              {variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex flex-col"
                  onMouseDown={(e) => { e.preventDefault(); insertVariable(v.key); }}
                >
                  <span>{v.label}</span>
                  <span className="text-xs text-gray-400 font-mono">{`{{${v.key}}}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel ?? 'Letter body'}
        onInput={emit}
        onBlur={emit}
        className="min-h-[260px] px-4 py-3 text-sm text-gray-900 focus:outline-none leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_img]:max-w-full [&_img]:h-auto"
      />
      {imgError && (
        <p className="px-4 pb-2 text-xs text-red-600">{imgError}</p>
      )}
    </div>
  );
}
