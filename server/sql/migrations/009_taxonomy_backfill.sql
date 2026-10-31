-- ByteJournal migration 009: seed normalized taxonomy from the legacy article fields.
-- Additive and repeatable; article category/tag columns remain authoritative for compatibility.
WITH source_names AS (
  SELECT DISTINCT trim(category) AS name FROM articles WHERE trim(category) <> ''
), slugged AS (
  SELECT name, regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') AS base
  FROM source_names
), ranked AS (
  SELECT name, base, row_number() OVER (PARTITION BY base ORDER BY name) AS ordinal FROM slugged
)
INSERT INTO categories(name, slug)
SELECT name, left(COALESCE(NULLIF(base, ''), 'category') || CASE WHEN ordinal=1 THEN '' ELSE '-' || ordinal END, 120)
FROM ranked ON CONFLICT (slug) DO NOTHING;

WITH source_names AS (
  SELECT DISTINCT trim(item.tag) AS name FROM articles a CROSS JOIN LATERAL unnest(a.tags) AS item(tag) WHERE trim(item.tag) <> ''
), slugged AS (
  SELECT name, regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') AS base
  FROM source_names
), ranked AS (
  SELECT name, base, row_number() OVER (PARTITION BY base ORDER BY name) AS ordinal FROM slugged
)
INSERT INTO tags(name, slug)
SELECT name, left(COALESCE(NULLIF(base, ''), 'tag') || CASE WHEN ordinal=1 THEN '' ELSE '-' || ordinal END, 100)
FROM ranked ON CONFLICT (slug) DO NOTHING;

INSERT INTO article_categories(article_id, category_id, is_primary)
SELECT a.id, c.id, TRUE FROM articles a JOIN categories c ON lower(trim(a.category))=lower(c.name)
WHERE NOT EXISTS (SELECT 1 FROM article_categories existing WHERE existing.article_id=a.id)
ON CONFLICT (article_id, category_id) DO NOTHING;

INSERT INTO article_tags(article_id, tag_id)
SELECT DISTINCT a.id, t.id FROM articles a CROSS JOIN LATERAL unnest(a.tags) AS item(article_tag)
JOIN tags t ON lower(trim(item.article_tag))=lower(t.name)
ON CONFLICT (article_id, tag_id) DO NOTHING;
