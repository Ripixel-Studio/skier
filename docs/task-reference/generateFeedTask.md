---
title: generateFeedTask
section: Task Reference
subcategory: Feeds & SEO
order: 1
---

# generateFeedTask

Generate RSS, Atom, and JSON feeds from your content.

---

## When to Use

✅ Use `generateFeedTask` when you have:
- Blog posts subscribers should follow
- News or announcements
- Podcast episodes

---

## Quick Start

```js
generateFeedTask({
  articles: '${posts}',
  outDir: 'public',
  site: {
    title: 'My Blog',
    link: 'https://example.com',
    author: { name: 'Jane Doe' },
  },
})
```

**Output:**
- `public/rss.xml` (RSS)
- `public/atom.xml` (Atom)
- `public/json.json` (JSON Feed)

---

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `articles` | string/array | ✅ | Items array or `${varName}` reference |
| `outDir` | string | ✅ | Output directory |
| `site` | object | ✅ | Feed metadata (see below) |
| `outputs` | object | | Which formats to write and where, relative to `outDir` (default: all three, see below) |

### Site Metadata

```js
{
  title: 'My Blog',                  // Feed title
  description: 'Tech thoughts',      // Feed description
  id: 'https://example.com/',        // Unique ID (often same as link)
  link: 'https://example.com/',      // Site URL (MUST be absolute)
  language: 'en',                    // ISO language code
  favicon: 'https://example.com/favicon.ico',
  copyright: '© 2024 Jane Doe',
  author: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    link: 'https://example.com/about',
  },
  feedLinks: {
    json: 'https://example.com/json.json',
    atom: 'https://example.com/atom.xml',
  },

  // Optional
  updated: new Date(),               // Feed-level <updated> (default: build time)
  generator: 'my-site',              // Feed <generator> (default: the feed library's; false omits it)
}
```

Only `title`, `id` and `link` are required.

### Outputs

By default the task writes `rss.xml`, `atom.xml` and `json.json` into `outDir`. Pass `outputs` to choose formats and paths — only the listed formats are written:

```js
generateFeedTask({
  articles: '${events}',
  outDir: 'public',
  outputs: { atom: 'events/feed.xml' },  // just Atom, at /events/feed.xml
  site: { /* ... */ },
})
```

Two feeds in one pipeline (say a blog feed and an events feed) are two `generateFeedTask`s with different `outputs`.

---

## Type signature

The exact `GenerateFeedConfig` interface, transcluded from source so it stays in step with the shipping code:

@include src/builtins/generateFeedTask/index.ts region="config"

> Every task's config type together: [API Reference → Config Interfaces](../api-reference/config-interfaces.md).

---

## Article Format

Each article needs these fields:

```js
{
  title: 'Post Title',             // Required (HTML: escape &, < in plain text)
  link: '/posts/my-post/',         // Required (relative links are resolved against site.link)
  dateObj: new Date('2024-01-15'), // Required (Date object) — the entry's <updated>
  body: '<p>HTML content</p>',     // Feed content; body or excerpt is required
  excerpt: 'Short summary',        // Summary; falls back to body

  // Optional
  id: 'https://example.com/posts/my-post', // Entry id (default: link; resolved like link)
  publishedObj: new Date('2024-01-10'),    // <published>; entries sort by it when set, else dateObj
  categories: [{ term: 'news', name: 'News' }],
}
```

Items from `generateItemsTask` already have this shape. Data from elsewhere (an API, a custom task) needs only `title`, `link`, `dateObj` and `body` or `excerpt`.

---

## Integration with generateItemsTask

The items task produces data compatible with feeds:

```js
generateItemsTask({
  itemsDir: 'src/items/posts',
  outputVar: 'posts',
  // ...
}),

generateFeedTask({
  articles: '${posts}',
  outDir: 'public',
  site: { /* ... */ },
}),
```

---

## HTML Head Links

Add feed discovery to your templates:

```handlebars
<link rel="alternate" type="application/rss+xml"
      title="RSS Feed" href="/rss.xml">
<link rel="alternate" type="application/atom+xml"
      title="Atom Feed" href="/atom.xml">
<link rel="alternate" type="application/json"
      title="JSON Feed" href="/json.json">
```

---

## Common Mistakes

❌ **Using relative site.link:**
```js
site: { link: '/blog' }  // ❌ Feed readers need absolute URLs
site: { link: 'https://example.com' }  // ✅
```

❌ **Invalid dates:**
```js
// Item date must be a Date object
dateObj: '2024-01-15'           // ❌ String
dateObj: new Date('2024-01-15') // ✅ Date object
```

---

## Related Tasks

- [generateItemsTask](./generateItemsTask.md) — Produces article arrays
- [generateSitemapTask](./generateSitemapTask.md) — For search engines
