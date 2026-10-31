import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { lowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import json from 'highlight.js/lib/languages/json';
import { AlignLeft, AlignCenter, AlignRight, Bold, Code2, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Strikethrough, Table2, Underline as UnderlineIcon, Undo2, X, Maximize2, Minimize2, PlayCircle, Type } from 'lucide-react';
import { api } from '../api';

// Keep the language registry deliberately small and useful for technical articles.
lowlight.registerLanguage('javascript', javascript);
lowlight.registerLanguage('python', python);
lowlight.registerLanguage('sql', sql);
lowlight.registerLanguage('bash', bash);
lowlight.registerLanguage('cpp', cpp);
lowlight.registerLanguage('json', json);

const LANGUAGE_OPTIONS = [
  ['plaintext', 'Plain text'], ['javascript', 'JavaScript'], ['python', 'Python'],
  ['sql', 'SQL'], ['bash', 'Bash'], ['cpp', 'C++'], ['json', 'JSON']
];

function ToolButton({ editor, action, active = false, disabled = false, label, children }) {
  return <button
    type="button"
    className={`tiptap-tool${active ? ' is-active' : ''}`}
    onClick={action}
    disabled={disabled}
    aria-label={label}
    title={label}
  >{children}</button>;
}

export default function TiptapEditor({ value, onChange, onError, placeholder = 'Start writing your article…' }) {
  const uploadInput = useRef(null);
  const changeRef = useRef(onChange);
  const errorRef = useRef(onError);
  const [fullscreen, setFullscreen] = useState(false);
  const [, refreshToolbar] = useState(0);

  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  useEffect(() => { errorRef.current = onError; }, [onError]);
  useEffect(() => {
    if (!fullscreen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [fullscreen]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: null,
              parseHTML: element => {
                const image = element.matches('img') ? element : element.querySelector('img');
                return image?.getAttribute('width') || image?.style.width || null;
              },
              renderHTML: attributes => attributes.width ? { style: `width: ${attributes.width}; max-width: 100%;` } : {}
            },
            caption: {
              default: null,
              parseHTML: element => element.querySelector('figcaption')?.textContent || null,
              renderHTML: () => ({})
            }
          };
        },
        parseHTML() {
          const readImage = element => {
            const image = element.matches('img') ? element : element.querySelector('img');
            if (!image?.getAttribute('src')) return false;
            return {
              src: image.getAttribute('src'),
              alt: image.getAttribute('alt'),
              title: image.getAttribute('title'),
              width: image.getAttribute('width') || image.style.width || null,
              caption: element.querySelector('figcaption')?.textContent || null
            };
          };
          return [
            { tag: 'figure.image', getAttrs: readImage },
            { tag: 'figure.article-image', getAttrs: readImage },
            { tag: 'img[src]', getAttrs: readImage }
          ];
        },
        renderHTML({ HTMLAttributes }) {
          const { caption, ...imageAttributes } = HTMLAttributes;
          return ['figure', { class: 'image' }, ['img', imageAttributes], ...(caption ? [['figcaption', {}, caption]] : [])];
        }
      }).configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'article-inline-image' }
      }),
      Youtube.configure({ controls: true, nocookie: true, HTMLAttributes: { class: 'article-video' } }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'article-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
      Placeholder.configure({ placeholder })
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: 'tiptap-content',
        spellcheck: 'true',
        'aria-label': 'Article body editor'
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      changeRef.current?.(currentEditor.getHTML());
      refreshToolbar(count => count + 1);
    },
    onSelectionUpdate: () => refreshToolbar(count => count + 1),
    onTransaction: () => refreshToolbar(count => count + 1)
  });

  // Article content is loaded asynchronously when an existing draft is selected.
  // Only replace editor contents when the incoming value genuinely differs.
  useEffect(() => {
    if (!editor) return;
    const nextValue = value || '<p></p>';
    if (editor.getHTML() !== nextValue) editor.commands.setContent(nextValue, false);
  }, [editor, value]);

  if (!editor) return <div className="tiptap-loading" role="status">Loading editor…</div>;

  const addLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previous = editor.getAttributes('link').href || 'https://';
    const href = window.prompt('Enter the link URL', previous);
    if (href === null) return;
    const trimmed = href.trim();
    if (!/^https?:\/\//i.test(trimmed) && !/^mailto:/i.test(trimmed)) {
      errorRef.current?.('Enter a valid http, https or mailto link.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  const uploadInlineImage = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = await api.uploadImage(file);
      const alt = window.prompt('Describe this image for accessibility', file.name) ?? file.name;
      editor.chain().focus().setImage({ src: api.assetUrl(result.url), alt }).run();
    } catch (error) {
      errorRef.current?.(error.message || 'Image upload failed.');
    }
  };

  const currentLanguage = editor.getAttributes('codeBlock').language || 'plaintext';

  return <div className={`tiptap-editor${fullscreen ? ' tiptap-editor-fullscreen' : ''}`}>
    <div className="tiptap-toolbar" role="toolbar" aria-label="Article formatting tools">
      <ToolButton editor={editor} label="Undo" disabled={!editor.can().undo()} action={() => editor.chain().focus().undo().run()}><Undo2 size={16}/></ToolButton>
      <ToolButton editor={editor} label="Redo" disabled={!editor.can().redo()} action={() => editor.chain().focus().redo().run()}><Redo2 size={16}/></ToolButton>
      <span className="tiptap-toolbar-divider" />
      <select aria-label="Paragraph style" value={editor.isActive('heading') ? `h${editor.getAttributes('heading').level}` : 'paragraph'} onChange={event => {
        const selection = event.target.value;
        if (selection === 'paragraph') editor.chain().focus().setParagraph().run();
        else editor.chain().focus().toggleHeading({ level: Number(selection.slice(1)) }).run();
      }}>
        <option value="paragraph">Paragraph</option>{[1,2,3,4,5,6].map(level => <option key={level} value={`h${level}`}>Heading {level}</option>)}
      </select>
      <span className="tiptap-toolbar-divider" />
      <ToolButton editor={editor} label="Bold" active={editor.isActive('bold')} action={() => editor.chain().focus().toggleBold().run()}><Bold size={16}/></ToolButton>
      <ToolButton editor={editor} label="Italic" active={editor.isActive('italic')} action={() => editor.chain().focus().toggleItalic().run()}><Italic size={16}/></ToolButton>
      <ToolButton editor={editor} label="Underline" active={editor.isActive('underline')} action={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={16}/></ToolButton>
      <ToolButton editor={editor} label="Strikethrough" active={editor.isActive('strike')} action={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16}/></ToolButton>
      <ToolButton editor={editor} label="Insert or remove link" active={editor.isActive('link')} action={addLink}><Link2 size={16}/></ToolButton>
      <span className="tiptap-toolbar-divider" />
      <ToolButton editor={editor} label="Bulleted list" active={editor.isActive('bulletList')} action={() => editor.chain().focus().toggleBulletList().run()}><List size={16}/></ToolButton>
      <ToolButton editor={editor} label="Numbered list" active={editor.isActive('orderedList')} action={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16}/></ToolButton>
      <ToolButton editor={editor} label="Blockquote" active={editor.isActive('blockquote')} action={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={16}/></ToolButton>
      <ToolButton editor={editor} label="Horizontal rule" action={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={16}/></ToolButton>
      <ToolButton editor={editor} label="Align left" active={editor.isActive({ textAlign: 'left' })} action={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={16}/></ToolButton>
      <ToolButton editor={editor} label="Align center" active={editor.isActive({ textAlign: 'center' })} action={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={16}/></ToolButton>
      <ToolButton editor={editor} label="Align right" active={editor.isActive({ textAlign: 'right' })} action={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={16}/></ToolButton>
      <span className="tiptap-toolbar-divider" />
      <ToolButton editor={editor} label="Insert image" action={() => uploadInput.current?.click()}><ImagePlus size={16}/></ToolButton>
      <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={uploadInlineImage}/>
      <select aria-label="Image width" value={editor.getAttributes('image').width || '100%'} disabled={!editor.isActive('image')} onChange={event => editor.chain().focus().updateAttributes('image', { width: event.target.value }).run()}>
        <option value="100%">Image 100%</option><option value="75%">Image 75%</option><option value="50%">Image 50%</option><option value="auto">Image auto</option>
      </select>
      <ToolButton editor={editor} label="Edit image caption" disabled={!editor.isActive('image')} action={() => { const caption = window.prompt('Image caption', editor.getAttributes('image').caption || ''); if (caption !== null) editor.chain().focus().updateAttributes('image', { caption: caption.trim() || null }).run(); }}><Type size={16}/></ToolButton>
      <ToolButton editor={editor} label="Embed YouTube video" action={() => { const url = window.prompt('Paste a YouTube video URL'); if (!url) return; if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url.trim())) { errorRef.current?.('Enter a valid YouTube or youtu.be URL.'); return; } editor.commands.setYoutubeVideo({ src: url.trim(), width: 640, height: 360 }); }}><PlayCircle size={16}/></ToolButton>
      <ToolButton editor={editor} label="Insert table" action={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16}/></ToolButton>
      <ToolButton editor={editor} label="Insert code block" active={editor.isActive('codeBlock')} action={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 size={16}/></ToolButton>
      <select aria-label="Code language" value={currentLanguage} onChange={event => editor.chain().focus().setCodeBlock({ language: event.target.value === 'plaintext' ? null : event.target.value }).run()}>
        {LANGUAGE_OPTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
      <ToolButton editor={editor} label="Fullscreen writing mode" action={() => setFullscreen(value => !value)}>{fullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</ToolButton>
      {fullscreen && <ToolButton editor={editor} label="Close fullscreen" action={() => setFullscreen(false)}><X size={16}/></ToolButton>}
    </div>
    <div className="tiptap-table-tools" aria-label="Table controls">
      <span>Table:</span>
      <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.isActive('table')}>Add row</button>
      <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.isActive('table')}>Add column</button>
      <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.isActive('table')}>Delete row</button>
      <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.isActive('table')}>Delete table</button>
    </div>
    <EditorContent editor={editor}/>
    {fullscreen && <div className="tiptap-fullscreen-hint">Fullscreen writing mode · Press Esc to exit</div>}
  </div>;
}
