const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const assetUrl = (path) => !path ? '' : (/^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`);

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.error || `Request failed (${response.status})`); error.status = response.status; throw error; }
  return body;
}

export const api = {
  assetUrl,
  health: () => request('/health'),
  uploadImage: async (file) => { const fd = new FormData(); fd.append('image', file); const r = await fetch(`${API_BASE}/api/admin/upload`, { method: 'POST', credentials: 'include', body: fd }); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || 'Upload failed'); return b; },
  articles: (params = '') => request(`/articles${params}`),
  popularArticles: (limit = 4) => request(`/articles/popular?limit=${encodeURIComponent(limit)}`),
  featuredArticles: (limit = 1) => request(`/articles/featured?limit=${encodeURIComponent(limit)}`),
  categories: () => request('/categories'),
  tags: () => request('/tags'),
  stats: () => request('/admin/stats'),
  article: (slug) => request(`/articles/${encodeURIComponent(slug)}`),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  logout: () => request('/auth/logout', { method: 'POST', body: '{}' }),
  me: () => request('/auth/me'),
  savedArticles: () => request('/account/saved-articles'),
  saveArticle: (id) => request(`/account/saved-articles/${encodeURIComponent(id)}`, { method: 'POST', body: '{}' }),
  unsaveArticle: (id) => request(`/account/saved-articles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  profile: () => request('/auth/profile'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  adminArticles: () => request('/admin/articles'),
  createArticle: (data) => request('/admin/articles', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id, data) => request(`/admin/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArticle: (id) => request(`/admin/articles/${id}`, { method: 'DELETE' }),
  submitArticle: (id) => request(`/admin/articles/${id}/submit`, { method: 'POST', body: '{}' }),
  reviewArticle: (id, action, comment = '') => request(`/admin/articles/${id}/review`, { method: 'POST', body: JSON.stringify({ action, comment }) }),
  articleReviews: (id) => request(`/admin/articles/${id}/reviews`),
  addReviewComment: (id, body) => request(`/admin/articles/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  dashboard: () => request('/admin/dashboard'),
  media: () => request('/admin/media'),
  deleteMedia: (id) => request(`/admin/media/${id}`, { method: 'DELETE' }),
  adminCategories: () => request('/admin/categories'),
  createCategory: (data) => request('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/admin/categories/${id}`, { method: 'DELETE' }),
  adminTags: () => request('/admin/tags'),
  createTag: (data) => request('/admin/tags', { method: 'POST', body: JSON.stringify(data) }),
  updateTag: (id, data) => request(`/admin/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTag: (id) => request(`/admin/tags/${id}`, { method: 'DELETE' }),
  authorRequests: (params = {}) => request(`/admin/author-requests?${new URLSearchParams(params).toString()}`),
  submitAuthorApplication: (data) => request('/author-requests', { method: 'POST', body: JSON.stringify(data) }),
  newsletterSubscribe: (email, consent) => request('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email, consent, source: 'footer' }) }),
  sendContactMessage: (data) => request('/contact', { method: 'POST', body: JSON.stringify(data) }),
  updateAuthorRequest: (id, data) => request(`/admin/author-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  invitations: () => request('/admin/invitations'),
  createInvitation: (email, role) => request('/admin/invitations', { method: 'POST', body: JSON.stringify({ email, role }) }),
  testEmail: () => request('/admin/email/test', { method: 'POST' }),
  resendInvitation: (id) => request(`/admin/invitations/${id}/resend`, { method: 'POST', body: '{}' }),
  revokeInvitation: (id) => request(`/admin/invitations/${id}/revoke`, { method: 'POST', body: '{}' }),
  users: () => request('/admin/users'),
  updateUser: (id, data) => request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  settings: () => request('/settings'),
  adminAppearance: () => request('/admin/settings/appearance'),
  adminPages: () => request('/admin/settings/pages'),
  author: (id) => request(`/authors/${id}`),
  updateAppearance: (data) => request('/admin/settings/appearance', { method: 'PUT', body: JSON.stringify(data) }),
  publishAppearance: () => request('/admin/settings/appearance/publish', { method: 'POST', body: '{}' }),
  updatePages: (data) => request('/admin/settings/pages', { method: 'PUT', body: JSON.stringify(data) }),
  publishPages: () => request('/admin/settings/pages/publish', { method: 'POST', body: '{}' }),
  acceptInvitation: (token, name, password) => request('/invitations/accept', { method: 'POST', body: JSON.stringify({ token, name, password }) })
};
