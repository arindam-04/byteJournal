import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function usePublishedArticles(search = '', category = 'All', limit = 12) {
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const pageLimit = Math.min(50, Math.max(1, Number(limit) || 12));
      const params = new URLSearchParams({ page: String(page), limit: String(pageLimit) });
      if (search.trim()) params.set('q', search.trim());
      if (category !== 'All') params.set('category', category);
      const data = await api.articles(`?${params.toString()}`);
      setArticles(current => append ? [...current, ...(data.articles || [])] : (data.articles || []));
      setPagination(data.pagination || { page, limit: pageLimit, total: data.articles?.length || 0, pages: 1, hasMore: false });
    } catch (err) {
      setError(err.message || 'Unable to load articles from the API.');
      if (!append) setArticles([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, category, limit]);

  useEffect(() => {
    const timer = setTimeout(() => load(1, false), 250);
    return () => clearTimeout(timer);
  }, [load]);
  const loadMore = () => load(pagination.page + 1, true);
  return { articles, pagination, loading, loadingMore, error, loadMore, retry: () => load(1, false) };
}
