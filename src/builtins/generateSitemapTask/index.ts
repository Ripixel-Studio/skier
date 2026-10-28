import { TaskDef } from '../../types.js';
import { ensureDir, writeFileUtf8, findFilesRecursive } from '../../utils/fileHelpers.js';
import { join } from '../../utils/pathHelpers.js';
import { throwTaskError, validateRequiredConfig } from '../../utils/errors.js';

/** Default glob patterns excluded from the sitemap */
const DEFAULT_EXCLUDES = ['404.html', '404/**'];

// #region config
export interface GenerateSitemapConfig {
  /** Directory to scan for .html files */
  scanDir: string;
  /** Directory to output sitemap file to */
  outDir: string;
  /** (Optional) site base URL for <loc> tags */
  siteUrl?: string;
  /** (Optional) glob patterns to exclude from sitemap. Merged with defaults (404.html, 404/**). */
  excludes?: string[];
  /**
   * (Optional) whether directory pages (`foo/index.html`) are listed with a
   * trailing slash (`/foo/`, the default) or without one (`/foo`). Set `false`
   * for hosts that serve slash-less URLs (e.g. Firebase `trailingSlash: false`),
   * so the sitemap does not list URLs that redirect. The site root is always `/`.
   */
  trailingSlash?: boolean;
}
// #endregion config

/**
 * Test whether a relative path matches a simple glob pattern.
 * Supports `**` (any path segments), `*` (any filename chars), and literal matching.
 */
function matchesGlob(relPath: string, pattern: string): boolean {
  // Normalise: strip leading slashes from both
  const norm = relPath.replace(/^\/+/, '');
  const pat = pattern.replace(/^\/+/, '');

  // Convert glob to regex
  const regexStr = pat
    .split('**')
    .map((segment) =>
      segment
        .split('*')
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');

  return new RegExp(`^${regexStr}$`).test(norm);
}

/**
 * Clean a relative HTML path into a sitemap-friendly URL.
 * - `index.html` → `/`
 * - `foo/index.html` → `/foo/` (or `/foo` with `trailingSlash: false`)
 * - `about.html` → `/about`
 */
function cleanUrl(relPath: string, trailingSlash = true): string {
  let url = '/' + relPath.replace(/^\/+/, '');

  // Handle index.html → directory root
  if (url === '/index.html') {
    return '/';
  }
  if (url.endsWith('/index.html')) {
    return url.slice(0, -(trailingSlash ? 'index.html' : '/index.html').length);
  }

  // Strip .html extension
  if (url.endsWith('.html')) {
    return url.slice(0, -'.html'.length);
  }

  return url;
}

export function generateSitemapTask(
  config: GenerateSitemapConfig,
): TaskDef<GenerateSitemapConfig, Record<string, never>> {
  return {
    name: 'generate-sitemap',
    title: `Generate sitemap.xml in ${config.scanDir}`,
    config,
    run: async (cfg, ctx) => {
      validateRequiredConfig(ctx, 'generate-sitemap', cfg, ['scanDir', 'outDir']);

      try {
        await ensureDir(cfg.scanDir);

        // Use findFilesRecursive to collect all .html files
        const allHtmlFiles = await findFilesRecursive(cfg.scanDir, '.html');

        // Convert to relative paths from scanDir
        const htmlFiles = allHtmlFiles.map((f) =>
          f.startsWith(cfg.scanDir) ? f.slice(cfg.scanDir.length).replace(/^\/+/, '') : f,
        );

        // Merge user excludes with defaults
        const excludePatterns = [...DEFAULT_EXCLUDES, ...(cfg.excludes ?? [])];

        // Filter out excluded files
        const excluded: { file: string; pattern: string }[] = [];
        const includedFiles = htmlFiles.filter((relPath) => {
          for (const pattern of excludePatterns) {
            if (matchesGlob(relPath, pattern)) {
              excluded.push({ file: relPath, pattern });
              return false;
            }
          }
          return true;
        });

        // Log excluded files
        for (const { file, pattern } of excluded) {
          ctx.logger.info(`Sitemap: excluded /${file} (matched pattern: ${pattern})`);
        }

        if (includedFiles.length === 0) {
          ctx.logger.warn('No HTML files found in outDir for sitemap generation.');
        }

        const sitemapEntries = includedFiles
          .map((relPath) => {
            const url = cleanUrl(relPath, cfg.trailingSlash !== false);
            const loc = cfg.siteUrl ? `${cfg.siteUrl.replace(/\/$/, '')}${url}` : url;
            return `<url><loc>${loc}</loc></url>`;
          })
          .join('\n    ');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n    ${sitemapEntries}\n</urlset>\n`;
        const outPath = join(cfg.outDir, 'sitemap.xml');
        await writeFileUtf8(outPath, xml);
        ctx.logger.debug(
          `Generated sitemap.xml at ${outPath} with ${includedFiles.length} URLs (${excluded.length} excluded)`,
        );

        return {};
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('[skier/')) {
          throw err;
        }
        throwTaskError(
          ctx,
          'generate-sitemap',
          'Failed to generate sitemap',
          err instanceof Error ? err : undefined,
        );
      }
    },
  };
}
