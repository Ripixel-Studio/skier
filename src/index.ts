export * from './builtins/prepareOutputTask/index.js';
export * from './builtins/bundleCssTask/index.js';
export * from './builtins/copyStaticTask/index.js';
export * from './builtins/setGlobalFromMarkdownTask/index.js';
export * from './builtins/setGlobalsTask/index.js';
export * from './builtins/generateItemsTask/index.js';
export * from './builtins/generateFeedTask/index.js';
export * from './builtins/generatePagesTask/index.js';
export * from './builtins/generateDataPagesTask/index.js';
export * from './builtins/generateSitemapTask/index.js';
export * from './builtins/generatePaginatedItemsTask/index.js';
export * from './builtins/generateNavDataTask/index.js';
export * from './builtins/generateSearchIndexTask/index.js';
// Add any new built-ins here as needed

// Core task-authoring contract: TaskDef, TaskContext, Logger, SkierItem,
// SkierGlobals. Surfaced from the package root so custom tasks can be typed with
// `import type { TaskDef, TaskContext } from 'skier'` (see docs/api-reference).
export * from './types.js';
