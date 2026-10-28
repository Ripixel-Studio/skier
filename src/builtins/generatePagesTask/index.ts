import { ensureDir, readdir, readFileUtf8, writeFileUtf8 } from '../../utils/fileHelpers.js';
import { join, extname, basename } from '../../utils/pathHelpers.js';
import { marked } from 'marked';
import hljs from 'highlight.js';
import type { TaskDef } from '../../types.js';
import { validateRequiredConfig } from '../../utils/errors.js';
import { setupHandlebarsEnvironment, type HandlebarsHelpers } from '../../utils/handlebars.js';

const renderer = new marked.Renderer();
renderer.code = (code, infostring) => {
  const lang = (infostring || '').match(/\S*/)?.[0];
  if (lang && hljs.getLanguage(lang)) {
    const highlighted = hljs.highlight(code, { language: lang }).value;
    return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
  }
  const auto = hljs.highlightAuto(code).value;
  return `<pre><code class="hljs">${auto}</code></pre>`;
};
marked.setOptions({ renderer });

/**
 * The default variables provided to every page template in generatePagesTask.
 * Extended with index signature to allow globals and additional vars.
 */
export interface HtmlRenderVars extends Record<string, unknown> {
  /** The filename of the page (without extension) */
  currentPage: string;
  /** The filename of the page (with extension) */
  currentPagePath: string;
}

// #region config
export interface GeneratePagesConfig {
  pagesDir: string;
  partialsDir: string;
  outDir: string;
  /**
   * Extension to scan for in pagesDir (e.g., '.html', '.hbs'). Defaults to '.html'.
   */
  pageExt?: string;
  /**
   * Optional function to inject additional variables into the render context for each page.
   * Receives all innate HtmlRenderVars.
   */
  additionalVarsFn?: (
    args: HtmlRenderVars,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /**
   * Optional custom Handlebars helpers, keyed by name (e.g. `{ eq: (a, b) => a === b }`).
   * Registered on this task's isolated environment only.
   */
  helpers?: HandlebarsHelpers;
}
// #endregion config

/**
 * Built-in HTML generation task for Skier: supports partials, variables, and per-page metadata.
 * Uses an isolated Handlebars environment to prevent global state pollution.
 */
export function generatePagesTask(
  config: GeneratePagesConfig,
): TaskDef<GeneratePagesConfig, Record<string, never>> {
  return {
    name: 'generate-pages',
    title: `Generate HTML pages from ${config.pagesDir} with partials from ${config.partialsDir}`,
    config,
    run: async (cfg, ctx) => {
      // Validate required config
      validateRequiredConfig(ctx, 'generate-pages', cfg, ['pagesDir', 'partialsDir', 'outDir']);

      // Create isolated Handlebars environment
      const handlebars = await setupHandlebarsEnvironment(
        cfg.partialsDir,
        ctx.logger,
        undefined,
        cfg.helpers,
      );

      await ensureDir(cfg.outDir);
      const pageExt = cfg.pageExt || '.html';
      const pageFiles = (await readdir(cfg.pagesDir)).filter((f) => extname(f) === pageExt);

      for (const file of pageFiles) {
        const pageName = basename(file, pageExt);
        const pagePath = join(cfg.pagesDir, file);
        const pageContent = await readFileUtf8(pagePath);
        const outPath = join(cfg.outDir, pageName + '.html');

        let renderVars: HtmlRenderVars = {
          ...ctx.globals,
          currentPage: pageName,
          currentPagePath: file,
        };

        if (typeof cfg.additionalVarsFn === 'function') {
          const additional = await cfg.additionalVarsFn({ ...renderVars });
          if (additional && typeof additional === 'object') {
            renderVars = { ...renderVars, ...additional };
          }
        }

        const template = handlebars.compile(pageContent);
        const output = template(renderVars);
        await writeFileUtf8(outPath, output);
        ctx.logger.debug(`Generated ${outPath}`);
      }

      return {};
    },
  };
}
