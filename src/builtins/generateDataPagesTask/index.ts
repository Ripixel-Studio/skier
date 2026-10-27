import { ensureDir, readFileUtf8, writeFileUtf8 } from '../../utils/fileHelpers.js';
import { dirname, join } from '../../utils/pathHelpers.js';
import type { SkierGlobals, TaskDef } from '../../types.js';
import { throwTaskError, validateRequiredConfig } from '../../utils/errors.js';
import { setupHandlebarsEnvironment, type HandlebarsHelpers } from '../../utils/handlebars.js';

// #region config
export interface GenerateDataPagesConfig<Item = unknown> {
  /**
   * The array to render, one page per element. Usually a pipeline variable set
   * by an earlier task, referenced as `'${varName}'`; a literal array works too.
   * A missing variable or a non-array value renders nothing (with a warning).
   */
  items: Item[] | string;
  /** Path to the Handlebars template every page is rendered from */
  template: string;
  /** Directory containing Handlebars partials */
  partialsDir: string;
  /** Output directory; `outPath` is resolved inside it */
  outDir: string;
  /**
   * Where an item's page is written, relative to `outDir`
   * (e.g. `(p) => \`products/${p.slug}/index.html\``). Absolute paths and `..`
   * segments are rejected so data can never write outside `outDir`.
   */
  outPath: (item: Item, index: number) => string;
  /**
   * Optional: the template variables for an item's page, merged over the
   * globals. Defaults to the item itself (which must then be an object).
   * Return `null`/`undefined` to skip the item.
   */
  varsFn?: (
    item: Item,
    index: number,
    globals: SkierGlobals,
  ) =>
    | Record<string, unknown>
    | null
    | undefined
    | Promise<Record<string, unknown> | null | undefined>;
  /**
   * Optional custom Handlebars helpers, keyed by name (e.g. `{ eq: (a, b) => a === b }`).
   * Registered on this task's isolated environment only.
   */
  helpers?: HandlebarsHelpers;
}
// #endregion config

const TASK_NAME = 'generate-data-pages';

/**
 * Normalises an item's output path and refuses anything that would land
 * outside outDir (absolute, `..`, or empty). Returns the cleaned relative path.
 */
export function safeRelativeOutPath(outPath: unknown): string {
  if (typeof outPath !== 'string' || outPath.trim() === '') {
    throw new Error(`outPath must be a non-empty string, got ${JSON.stringify(outPath)}`);
  }
  if (outPath.startsWith('/') || /^[A-Za-z]:/.test(outPath) || outPath.includes('\\')) {
    throw new Error(`outPath must be relative to outDir, got ${JSON.stringify(outPath)}`);
  }
  const segments = outPath.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.length === 0 || segments.some((s) => s === '..')) {
    throw new Error(`outPath must stay inside outDir, got ${JSON.stringify(outPath)}`);
  }
  return segments.join('/');
}

/**
 * Built-in task that renders one page per element of a data array — typically
 * a global produced by an earlier task (an API export, a JSON file, a computed
 * view model) rather than files on disk. Every page uses the same template, an
 * isolated Handlebars environment with the partials (and optional helpers),
 * and the globals plus the item's own variables.
 */
export function generateDataPagesTask<Item = unknown>(
  config: GenerateDataPagesConfig<Item>,
): TaskDef<GenerateDataPagesConfig<Item>, Record<string, never>> {
  return {
    name: TASK_NAME,
    title: `Generate a page per data item from ${config.template}`,
    config,
    run: async (cfg, ctx) => {
      validateRequiredConfig(ctx, TASK_NAME, cfg, ['template', 'partialsDir', 'outDir', 'outPath']);
      if (typeof cfg.outPath !== 'function') {
        throwTaskError(ctx, TASK_NAME, 'outPath must be a function (item, index) => string.');
      }
      if (cfg.varsFn !== undefined && typeof cfg.varsFn !== 'function') {
        throwTaskError(ctx, TASK_NAME, 'varsFn must be a function when given.');
      }

      if (!Array.isArray(cfg.items)) {
        ctx.logger.warn(
          typeof cfg.items === 'string'
            ? `items '${cfg.items}' did not resolve to an array; no pages generated`
            : 'items is not an array; no pages generated',
        );
        return {};
      }

      const handlebars = await setupHandlebarsEnvironment(
        cfg.partialsDir,
        ctx.logger,
        undefined,
        cfg.helpers,
      );
      const template = handlebars.compile(await readFileUtf8(cfg.template));

      let written = 0;
      let skipped = 0;
      for (let index = 0; index < cfg.items.length; index++) {
        const item = cfg.items[index] as Item;
        let vars: Record<string, unknown> | null | undefined;
        if (cfg.varsFn) {
          vars = await cfg.varsFn(item, index, ctx.globals);
        } else if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          vars = item as Record<string, unknown>;
        } else {
          throwTaskError(
            ctx,
            TASK_NAME,
            `Item ${String(index)} is not an object; pass varsFn to map it to template variables.`,
          );
        }
        if (vars === null || vars === undefined) {
          skipped++;
          continue;
        }

        let relPath: string;
        try {
          relPath = safeRelativeOutPath(cfg.outPath(item, index));
        } catch (err) {
          throwTaskError(
            ctx,
            TASK_NAME,
            `Item ${String(index)}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        const outPath = join(cfg.outDir, relPath);

        const output = template({ ...ctx.globals, ...vars });
        await ensureDir(dirname(outPath));
        await writeFileUtf8(outPath, output);
        written++;
        ctx.logger.debug(`Generated ${outPath}`);
      }

      ctx.logger.info(
        `Generated ${String(written)} page${written === 1 ? '' : 's'} from ${cfg.template}` +
          (skipped ? ` (${String(skipped)} skipped by varsFn)` : ''),
      );
      return {};
    },
  };
}
