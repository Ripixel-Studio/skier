---
title: Config Interfaces
section: API Reference
order: 3
---

# Config Interfaces

The exported configuration type for every built-in task, in one place. Each
factory takes exactly the object shown here. Every block is transcluded from the
task's own source, so it's always in step with the shipping code — for the full
option-by-option prose, follow the link to the task's
[Task Reference](../task-reference/index.md) page.

```ts
import type {
  PrepareOutputConfig,
  SetGlobalsConfig,
  SetGlobalFromMarkdownConfig,
  GeneratePagesConfig,
  GenerateItemsConfig,
  GeneratePaginatedItemsConfig,
  GenerateFeedConfig,
  GenerateSitemapConfig,
  GenerateSearchIndexConfig,
  GenerateNavDataConfig,
  BundleCssConfig,
  CopyStaticConfig,
} from 'skier';
```

---

## Setup

### PrepareOutputConfig

For [`prepareOutputTask`](../task-reference/prepareOutputTask.md):

@include src/builtins/prepareOutputTask/index.ts region="config"

---

## Globals

### SetGlobalsConfig

For [`setGlobalsTask`](../task-reference/setGlobalsTask.md):

@include src/builtins/setGlobalsTask/index.ts region="config"

### SetGlobalFromMarkdownConfig

For [`setGlobalFromMarkdownTask`](../task-reference/setGlobalFromMarkdownTask.md):

@include src/builtins/setGlobalFromMarkdownTask/index.ts region="config"

---

## Content

### GeneratePagesConfig

For [`generatePagesTask`](../task-reference/generatePagesTask.md):

@include src/builtins/generatePagesTask/index.ts region="config"

### GenerateItemsConfig

For [`generateItemsTask`](../task-reference/generateItemsTask.md):

@include src/builtins/generateItemsTask/index.ts region="config"

### GeneratePaginatedItemsConfig

For [`generatePaginatedItemsTask`](../task-reference/generatePaginatedItemsTask.md):

@include src/builtins/generatePaginatedItemsTask/index.ts region="config"

### GenerateDataPagesConfig

For [`generateDataPagesTask`](../task-reference/generateDataPagesTask.md):

@include src/builtins/generateDataPagesTask/index.ts region="config"

---

## Feeds & SEO

### GenerateFeedConfig

For [`generateFeedTask`](../task-reference/generateFeedTask.md):

@include src/builtins/generateFeedTask/index.ts region="config"

### GenerateSitemapConfig

For [`generateSitemapTask`](../task-reference/generateSitemapTask.md):

@include src/builtins/generateSitemapTask/index.ts region="config"

### GenerateSearchIndexConfig

For [`generateSearchIndexTask`](../task-reference/generateSearchIndexTask.md):

@include src/builtins/generateSearchIndexTask/index.ts region="config"

### GenerateNavDataConfig

For [`generateNavDataTask`](../task-reference/generateNavDataTask.md):

@include src/builtins/generateNavDataTask/index.ts region="config"

---

## Assets

### BundleCssConfig

For [`bundleCssTask`](../task-reference/bundleCssTask.md):

@include src/builtins/bundleCssTask/index.ts region="config"

### CopyStaticConfig

For [`copyStaticTask`](../task-reference/copyStaticTask.md):

@include src/builtins/copyStaticTask/index.ts region="config"

---

## Related

- [Task Contract](./task-contract.md) — the `TaskDef` these factories return.
- [Core Types](./core-types.md) — the data types configs reference (`SkierItem`,
  `SkierGlobals`, and produced types).
- [Task Reference](../task-reference/index.md) — full per-task documentation.
