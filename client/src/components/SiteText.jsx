import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Children, isValidElement } from 'react';
import { api } from '../api';

const SiteContentContext = createContext(null);

export function SiteContentProvider({ initialContent = {}, children }) {
  const [content, setContent] = useState(initialContent);
  const [adminUser, setAdminUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [activeText, setActiveText] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const canEdit = ['super_admin', 'admin'].includes(adminUser?.role);

  useEffect(() => setContent(initialContent || {}), [initialContent]);
  useEffect(() => {
    if (activeText) textareaRef.current?.focus();
  }, [activeText]);
  useEffect(() => {
    if (!canEdit) {
      setEditMode(false);
      setActiveText(null);
    }
  }, [canEdit]);

  function toggleEditMode() {
    if (!canEdit) return;
    if (editMode) setActiveText(null);
    setEditMode(!editMode);
    setError('');
  }

  function openTextEditor(key, currentValue) {
    if (!editMode || !canEdit) return;
    setActiveText({ key, currentValue });
    setDraft(currentValue);
    setError('');
  }

  function cancelTextEdit() {
    setActiveText(null);
    setError('');
  }

  async function saveTextEdit(event) {
    event?.preventDefault();
    if (!activeText || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.updateSiteText(activeText.key, draft);
      setContent(current => ({ ...current, [activeText.key]: draft }));
      setActiveText(null);
    } catch (saveError) {
      setError(saveError.message || 'Could not save this text.');
    } finally {
      setSaving(false);
    }
  }

  const value = { content, canEdit, editMode, toggleEditMode, setAdminUser, openTextEditor };
  return <SiteContentContext.Provider value={value}>
    {children}
    {editMode && <>
      {activeText ? <form className="site-text-editor" role="dialog" aria-modal="false" aria-label="Edit website text" onSubmit={saveTextEdit}>
        <label htmlFor="site-text-editor-value">Edit this text</label>
        <textarea ref={textareaRef} id="site-text-editor-value" value={draft} maxLength={10000} rows={4} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') cancelTextEdit(); if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) saveTextEdit(event); }}/>
        {error && <p role="alert">{error}</p>}
        <div className="site-text-editor-actions">
          <button type="button" className="site-text-cancel" onClick={cancelTextEdit} disabled={saving}>Cancel</button>
          <button type="submit" className="site-text-save" disabled={saving}>{saving ? 'Saving…' : 'Save text'}</button>
        </div>
        <small>Ctrl+Enter saves · Esc cancels</small>
      </form> : <div className="site-edit-hint" role="status">Edit mode is on. Select any outlined text to change it.</div>}
    </>}
  </SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext) || {
    content: {}, canEdit: false, editMode: false, toggleEditMode: () => {}, setAdminUser: () => {}, openTextEditor: () => {}
  };
}

export function useSiteTextValue(id, defaultValue = '') {
  const { content, editMode, openTextEditor } = useSiteContent();
  const value = Object.prototype.hasOwnProperty.call(content, id) ? content[id] : defaultValue;
  function onClick(event) {
    if (!editMode || !id) return;
    event.preventDefault();
    event.stopPropagation();
    openTextEditor(id, value);
  }
  return {
    value,
    onClick: editMode ? onClick : undefined,
    readOnly: editMode,
    'data-site-text-editable': editMode ? 'true' : undefined
  };
}

function plainText(children) {
  return Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (isValidElement(child)) return plainText(child.props.children);
    return '';
  }).join('');
}

export function SiteText({ id, as: Tag = 'span', className = '', children, onClick, onKeyDown, ...props }) {
  const { content, editMode, openTextEditor } = useSiteContent();
  const defaultText = plainText(children);
  const text = Object.prototype.hasOwnProperty.call(content, id) ? content[id] : defaultText;
  const editable = editMode && Boolean(id);
  function activate(event) {
    if (!editable) { onClick?.(event); return; }
    event.preventDefault();
    event.stopPropagation();
    openTextEditor(id, text);
  }
  function activateFromKeyboard(event) {
    if (!editable) { onKeyDown?.(event); return; }
    if (event.key === 'Enter' || event.key === ' ') activate(event);
    else onKeyDown?.(event);
  }
  const classes = [className, editable ? 'site-text-editable' : ''].filter(Boolean).join(' ');
  return <Tag {...props} className={classes || undefined} onClick={editable ? activate : onClick} onKeyDown={editable ? activateFromKeyboard : onKeyDown}
    role={editable ? 'button' : props.role} tabIndex={editable ? 0 : props.tabIndex} title={editable ? 'Click to edit this text' : props.title}>
    {Object.prototype.hasOwnProperty.call(content, id) ? text : children}
  </Tag>;
}
