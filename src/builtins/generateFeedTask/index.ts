import { Feed } from 'feed';
import { ensureDir, writeFileUtf8 } from '../../utils/fileHelpers.js';
import { dirname, join } from '../../utils/pathHelpers.js';
import type { SkierItem, TaskDef } from '../../types.js';

// #region article
/**
 * One feed entry. A `SkierItem` from generateItemsTask already fits; data from
 * elsewhere only needs `title`, `link`, a valid `dateObj` and one of `body`/`excerpt`.
 */
export interface FeedArticle extends Partial<Omit<SkierItem, 'title' | 'link'>> {
  title: string;
  /** URL of the entry's page; a site-relative link is resolved against `site.link` */
  link: string;
  /** Required: last-updated date of the entry (Atom `<updated>`, RSS `<pubDate>`) */
  dateObj?: Date;
  /** HTML content; omitted from the feed when absent */
  body?: string;
  /** Summary; falls back to `body` */
  excerpt?: string;
  /** Stable entry id (Atom `<id>`, a URL); defaults to `link` */
  id?: string;
  /** First-published date (Atom `<published>`); feeds are sorted by it when set, else by `dateObj` */
  publishedObj?: Date;
  /** Entry categories (Atom `<category term label>`) */
  categories?: { term: string; name?: string }[];
}
// #endregion article

// #region config
export interface GenerateFeedConfig {
  articles: FeedArticle[];
  outDir: string;
  site: {
    title: string;
    description?: string;
    id: string;
    link: string;
    language?: string;
    favicon?: string;
    copyright?: string;
    feedLinks?: {
      json?: string;
      atom?: string;
      rss?: string;
    };
    author?: {
      name: string;
      email?: string;
      link?: string;
    };
    /** Feed-level `<updated>`; defaults to the build time */
    updated?: Date;
    /** Feed `<generator>`; defaults to the feed library's own, `false` omits it */
    generator?: string | false;
  };
  /**
   * Which formats to write and where, relative to `outDir`. Defaults to all
   * three: `{ rss: 'rss.xml', atom: 'atom.xml', json: 'json.json' }`. When
   * given, only the listed formats are written (e.g. `{ atom: 'life/feed.xml' }`).
   */
  outputs?: {
    rss?: string;
    atom?: string;
    json?: string;
  };
}
// #endregion config

const DEFAULT_OUTPUTS = { rss: 'rss.xml', atom: 'atom.xml', json: 'json.json' } as const;

/** Resolves a possibly site-relative URL against the site link. */
function absoluteUrl(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

const isValidDate = (d: unknown): d is Date => d instanceof Date && !isNaN(d.getTime());

export function generateFeedTask(
  config: GenerateFeedConfig,
): TaskDef<GenerateFeedConfig, { rssPath?: string; jsonPath?: string; atomPath?: string }> {
  return {
    name: 'generate-feed',
    title: 'Generate RSS/Atom/JSON Feeds',
    config,
    run: async (cfg, ctx) => {
      const logger = ctx.logger;
      const feed = new Feed({
        title: cfg.site.title,
        description: cfg.site.description,
        id: cfg.site.id,
        link: cfg.site.link,
        language: cfg.site.language,
        favicon: cfg.site.favicon,
        copyright: cfg.site.copyright,
        feedLinks: cfg.site.feedLinks,
        author: cfg.site.author,
        ...(cfg.site.updated !== undefined ? { updated: cfg.site.updated } : {}),
        ...(cfg.site.generator !== undefined ? { generator: cfg.site.generator } : {}),
      });
      // Newest first: by publishedObj when an article has one, else dateObj
      const sortDate = (a: FeedArticle) => a.publishedObj ?? a.dateObj;
      const sortedArticles = [...cfg.articles].sort((a, b) => {
        const da = sortDate(a);
        const db = sortDate(b);
        if (!da || !db) return 0;
        return db.getTime() - da.getTime();
      });
      sortedArticles.forEach((article, i) => {
        if (!article.title || !article.link || !(article.body || article.excerpt)) {
          throw new Error(
            `[skier/generateRssFeed] Article at index ${i} is missing required fields (title, link, body or excerpt)`,
          );
        }
        if (!isValidDate(article.dateObj)) {
          throw new Error(
            `[skier/generateRssFeed] Article '${article.title}' is missing a valid dateObj. Ensure your itemised task outputs a valid dateObj for each item.`,
          );
        }
        if (article.publishedObj !== undefined && !isValidDate(article.publishedObj)) {
          throw new Error(
            `[skier/generateRssFeed] Article '${article.title}' has an invalid publishedObj.`,
          );
        }
        // feed v6 parses every link/id as a URL, so a site-relative link (as
        // generateItemsTask produces) is resolved against site.link.
        const link = absoluteUrl(article.link, cfg.site.link);
        feed.addItem({
          title: article.title,
          id: article.id ? absoluteUrl(article.id, cfg.site.link) : link,
          link,
          description: article.excerpt || article.body,
          content: article.body,
          date: article.dateObj,
          ...(article.publishedObj ? { published: article.publishedObj } : {}),
          ...(article.categories?.length ? { category: article.categories } : {}),
          ...(cfg.site.author ? { author: [cfg.site.author] } : {}),
        });
      });

      const outputs = cfg.outputs ?? DEFAULT_OUTPUTS;
      const result: { rssPath?: string; jsonPath?: string; atomPath?: string } = {};
      const write = async (file: string, content: string) => {
        const outPath = join(cfg.outDir, file);
        await ensureDir(dirname(outPath));
        await writeFileUtf8(outPath, content);
        return outPath;
      };
      await ensureDir(cfg.outDir);
      if (outputs.rss) {
        result.rssPath = await write(outputs.rss, feed.rss2());
        logger.debug(`Wrote RSS feed to ${result.rssPath}`);
      }
      if (outputs.json) {
        result.jsonPath = await write(outputs.json, feed.json1());
        logger.debug(`Wrote JSON feed to ${result.jsonPath}`);
      }
      if (outputs.atom) {
        result.atomPath = await write(outputs.atom, feed.atom1());
        logger.debug(`Wrote Atom feed to ${result.atomPath}`);
      }
      return result;
    },
  };
}
