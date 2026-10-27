---
title: generateDataPagesTask
section: Task Reference
subcategory: Content
order: 4
---

# generateDataPagesTask

Render one HTML page per element of a data array — typically a pipeline variable an earlier task produced.

---

## When to Use

✅ Use `generateDataPagesTask` when:
- Pages come from data rather than files on disk: an API export, a JSON feed, a computed view model
- Each element needs its own detail page (`/products/<slug>`, `/events/<id>`)
- A custom task fetches or shapes the data and you want Skier to do the rendering

❌ Use something else when:
- Each page is a Markdown file → [generateItemsTask](./generateItemsTask.md)
- You want a *listing* split across pages → [generatePaginatedItemsTask](./generatePaginatedItemsTask.md)
- The page is a standalone template → [generatePagesTask](./generatePagesTask.md)

---

## Quick Start

```js
// An earlier task returns { products: [{ slug: 'hammer', name: 'Hammer' }, ...] }
generateDataPagesTask({
  items: '${products}',
  template: 'src/templates/product.html',
  partialsDir: 'src/partials',
  outDir: 'public',
  outPath: (product) => `products/${product.slug}/index.html`,
})
```

**Output:**
```
public/
└── products/
    ├── hammer/index.html
    └── apple/index.html
```

---

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `items` | array/string | ✅ | The data array, usually a `${varName}` reference |
| `template` | string | ✅ | Handlebars template every page is rendered from |
| `partialsDir` | string | ✅ | Directory with shared partials |
| `outDir` | string | ✅ | Output directory |
| `outPath` | function | ✅ | `(item, index) => string` — the page's path relative to `outDir` |
| `varsFn` | function | | `(item, index, globals) => vars` — the page's template variables; defaults to the item itself. Return `null` to skip an item |
| `helpers` | object | | Custom Handlebars helpers, keyed by name |

---

## Type signature

The exact `GenerateDataPagesConfig` interface, transcluded from source so it stays in step with the shipping code:

@include src/builtins/generateDataPagesTask/index.ts region="config"

> Every task's config type together: [API Reference → Config Interfaces](../api-reference/config-interfaces.md).

---

## Template Variables

Each page renders with all globals plus the item's variables, the item winning on a name clash:

```handlebars
<title>{{name}} | {{siteTitle}}</title>
<h1>{{name}}</h1>
{{> price}}
```

With `varsFn` you can map items that are not template-shaped, or skip some:

```js
generateDataPagesTask({
  items: '${events}',
  template: 'src/templates/event.html',
  partialsDir: 'src/partials',
  outDir: 'public',
  outPath: (event) => `events/${event.id}.html`,
  varsFn: (event, index, globals) =>
    event.cancelled ? null : { event, pageTitle: `${event.name} | ${globals.siteTitle}` },
})
```

---

## Helpers

Templates get Skier's usual environment (partials, `#if`, `#each`, …). Add your own helpers per task:

```js
generateDataPagesTask({
  // ...
  helpers: {
    eq: (a, b) => a === b,
  },
})
```

```handlebars
{{#if (eq kind "tool")}}<span class="badge">tool</span>{{/if}}
```

---

## Safety

`outPath` must be relative: an absolute path or a `..` segment fails the task, so data can never write outside `outDir`. If `items` does not resolve to an array (for example the variable was never set), the task warns and writes nothing.

---

## Pairing with a data task

The usual shape is a small custom task that fetches or shapes data into a global, followed by this builtin:

```js
export const tasks = [
  {
    name: 'load-products',
    config: {},
    run: async () => ({ products: await loadProducts() }),
  },
  generateDataPagesTask({
    items: '${products}',
    template: 'src/templates/product.html',
    partialsDir: 'src/partials',
    outDir: 'public',
    outPath: (p) => `products/${p.slug}/index.html`,
  }),
];
```

---

## Related Tasks

- [generatePagesTask](./generatePagesTask.md) — Standalone templates
- [generateItemsTask](./generateItemsTask.md) — Pages from Markdown files
- [generateFeedTask](./generateFeedTask.md) — Feeds from the same data
