import Handlebars from 'handlebars';
import { readdir, readFileUtf8 } from './fileHelpers.js';
import { extname, basename, join } from './pathHelpers.js';
import type { Logger } from '../types.js';

/**
 * Creates an isolated Handlebars environment with task-specific helpers and partials.
 * This prevents global state pollution between tasks.
 */
export function createHandlebarsEnvironment(): typeof Handlebars {
  return Handlebars.create();
}

/**
 * Registers partials from a directory into a Handlebars environment.
 */
export async function registerPartials(
  handlebars: typeof Handlebars,
  partialsDir: string,
  extensions: string[] = ['.hbs', '.html'],
): Promise<string[]> {
  const files = await readdir(partialsDir);
  const partialFiles = files.filter((f) => extensions.includes(extname(f)));
  const registered: string[] = [];

  for (const file of partialFiles) {
    const ext = extname(file);
    const partialName = basename(file, ext);
    const partialPath = join(partialsDir, file);
    const partialContent = await readFileUtf8(partialPath);
    handlebars.registerPartial(partialName, partialContent);
    registered.push(partialName);
  }

  return registered;
}

/**
 * Registers a warning helper for missing variables in templates.
 * Logs warnings when templates reference undefined variables.
 */
export function registerMissingVariableWarning(
  handlebars: typeof Handlebars,
  logger: Logger,
): void {
  // Store original lookupProperty
  const utils = handlebars as unknown as {
    Utils: {
      lookupProperty: (parent: unknown, propertyName: string) => unknown;
    };
  };
  const origLookupProperty = utils.Utils.lookupProperty;

  utils.Utils.lookupProperty = function (parent: unknown, propertyName: string): unknown {
    if (
      parent == null ||
      typeof parent !== 'object' ||
      !(propertyName in (parent as Record<string, unknown>))
    ) {
      if (typeof propertyName === 'string' && propertyName !== '__proto__') {
        logger.warn(`Template references missing variable '{{${propertyName}}}'`);
      }
    }
    return origLookupProperty.call(this, parent, propertyName);
  };
}

/**
 * Registers a safe #each helper that warns on undefined/non-iterable values.
 */
export function registerSafeEachHelper(handlebars: typeof Handlebars, logger: Logger): void {
  const origEachHelper = handlebars.helpers['each'];
  if (!origEachHelper) return;

  handlebars.unregisterHelper('each');
  handlebars.registerHelper(
    'each',
    function (
      this: unknown,
      context: unknown,
      options: Handlebars.HelperOptions,
    ): Handlebars.SafeString | string {
      if (context == null || (typeof context !== 'object' && !Array.isArray(context))) {
        logger.warn(`#each attempted on undefined or non-iterable variable.`);
        return '';
      }
      return origEachHelper.call(this, context, options) as string;
    },
  );
}

/**
 * Custom Handlebars helpers a task registers on its isolated environment,
 * keyed by helper name (e.g. `{ eq: (a, b) => a === b }`).
 */
export type HandlebarsHelpers = Record<string, Handlebars.HelperDelegate>;

/**
 * Registers custom helpers into a Handlebars environment.
 */
export function registerHelpers(handlebars: typeof Handlebars, helpers?: HandlebarsHelpers): void {
  for (const [name, fn] of Object.entries(helpers ?? {})) {
    handlebars.registerHelper(name, fn);
  }
}

/**
 * Sets up a fully configured Handlebars environment with:
 * - Partials registered from a directory
 * - Missing variable warnings
 * - Safe #each helper
 * - Any custom helpers passed in
 */
export async function setupHandlebarsEnvironment(
  partialsDir: string,
  logger: Logger,
  partialExtensions: string[] = ['.hbs', '.html'],
  helpers?: HandlebarsHelpers,
): Promise<typeof Handlebars> {
  const handlebars = createHandlebarsEnvironment();

  await registerPartials(handlebars, partialsDir, partialExtensions);
  registerMissingVariableWarning(handlebars, logger);
  registerSafeEachHelper(handlebars, logger);
  registerHelpers(handlebars, helpers);

  return handlebars;
}
