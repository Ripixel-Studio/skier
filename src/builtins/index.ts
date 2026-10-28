// skier built-in task factories (exports only)
export { copyStaticTask, CopyStaticConfig } from './copyStaticTask/index.js';
export { bundleCssTask, BundleCssConfig } from './bundleCssTask/index.js';
export { generateSitemapTask, GenerateSitemapConfig } from './generateSitemapTask/index.js';
export { generatePagesTask, GeneratePagesConfig } from './generatePagesTask/index.js';
export {
  generateDataPagesTask,
  GenerateDataPagesConfig,
  safeRelativeOutPath,
} from './generateDataPagesTask/index.js';
export { generateItemsTask, GenerateItemsConfig } from './generateItemsTask/index.js';
export { prepareOutputTask, PrepareOutputConfig } from './prepareOutputTask/index.js';
export { generateFeedTask, GenerateFeedConfig, FeedArticle } from './generateFeedTask/index.js';
export {
  setGlobalFromMarkdownTask,
  SetGlobalFromMarkdownConfig,
} from './setGlobalFromMarkdownTask/index.js';
export { setGlobalsTask, SetGlobalsConfig } from './setGlobalsTask/index.js';
export {
  generatePaginatedItemsTask,
  GeneratePaginatedItemsConfig,
  PaginationMeta,
} from './generatePaginatedItemsTask/index.js';
export {
  generateNavDataTask,
  GenerateNavDataConfig,
  NavData,
  NavSection,
  NavItem,
} from './generateNavDataTask/index.js';
export {
  generateSearchIndexTask,
  GenerateSearchIndexConfig,
  SearchIndex,
  SearchIndexEntry,
  SearchHeading,
} from './generateSearchIndexTask/index.js';
