export const categoryColors = { Backend: 'blue', Web: 'orange', Database: 'purple', 'System Design': 'green', AI: 'pink', DevOps: 'teal' };
export const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Draft';
export const estimate = (text) => Math.max(1, Math.ceil((text || '').trim().split(/\s+/).filter(Boolean).length / 200));
export const slugify = (text) => (text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const blankForm = { title: '', slug: '', excerpt: '', category: 'Backend', author: 'ByteJournal Team', content: '', status: 'draft', featured:false, cover_color: 'blue', cover_image: '', tags: [], seo_title: '', meta_description: '', canonical_url: '' };
