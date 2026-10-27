import { generateDataPagesTask, GenerateDataPagesConfig, safeRelativeOutPath } from './index.js';
import * as fs from 'fs-extra';
import path from 'path';
import type { TaskContext } from '../../types.js';

interface Product {
  slug: string;
  name: string;
  kind: string;
}

describe('generateDataPagesTask', () => {
  const testOutDir = path.join(__dirname, 'testAssets', 'out');
  const template = path.join(__dirname, 'testAssets', 'template.html');
  const partialsDir = path.join(__dirname, 'testAssets', 'partials');
  const products: Product[] = [
    { slug: 'hammer', name: 'Hammer', kind: 'tool' },
    { slug: 'apple', name: 'Apple', kind: 'food' },
  ];
  const helpers = { eq: (a: unknown, b: unknown) => a === b };

  const createCtx = (globals: Record<string, unknown> = {}): TaskContext => ({
    debug: false,
    globals: { siteTitle: 'Shop', ...globals },
    logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn() },
  });

  const read = (rel: string) => fs.readFile(path.join(testOutDir, rel), 'utf8');

  beforeEach(async () => {
    await fs.remove(testOutDir);
  });

  afterAll(async () => {
    await fs.remove(testOutDir);
  });

  it('writes one page per item at outPath, with globals, item vars, partials and helpers', async () => {
    const config: GenerateDataPagesConfig<Product> = {
      items: products,
      template,
      partialsDir,
      outDir: testOutDir,
      outPath: (p) => `products/${p.slug}/index.html`,
      helpers,
    };
    const task = generateDataPagesTask(config);
    await task.run(config, createCtx());

    const hammer = await read('products/hammer/index.html');
    expect(hammer).toContain('<title>Hammer | Shop</title>');
    expect(hammer).toContain('<header>Shop</header>');
    expect(hammer).toContain('<p class="tool">a tool</p>');
    const apple = await read('products/apple/index.html');
    expect(apple).toContain('<h1>Apple</h1>');
    expect(apple).not.toContain('class="tool"');
  });

  it('lets item variables override globals of the same name', async () => {
    const config: GenerateDataPagesConfig<Product> = {
      items: [{ slug: 'x', name: 'X', kind: 'tool' }],
      template,
      partialsDir,
      outDir: testOutDir,
      outPath: (p) => `${p.slug}.html`,
      varsFn: (p) => ({ ...p, siteTitle: 'Override' }),
      helpers,
    };
    const task = generateDataPagesTask(config);
    await task.run(config, createCtx());
    expect(await read('x.html')).toContain('<title>X | Override</title>');
  });

  it('maps items through varsFn and skips those it returns null for', async () => {
    const ctx = createCtx();
    const config: GenerateDataPagesConfig<string> = {
      items: ['one', 'skip', 'two'],
      template,
      partialsDir,
      outDir: testOutDir,
      outPath: (s, i) => `${String(i)}-${s}.html`,
      varsFn: (s, _i, globals) =>
        s === 'skip' ? null : { name: `${s} of ${String(globals.siteTitle)}`, kind: 'x' },
      helpers,
    };
    const task = generateDataPagesTask(config);
    await task.run(config, ctx);
    expect(await read('0-one.html')).toContain('<h1>one of Shop</h1>');
    expect(await read('2-two.html')).toContain('<h1>two of Shop</h1>');
    expect(await fs.pathExists(path.join(testOutDir, '1-skip.html'))).toBe(false);
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('1 skipped'));
  });

  it('warns and writes nothing when items did not resolve to an array', async () => {
    const ctx = createCtx();
    const config = {
      items: undefined as unknown as Product[],
      template,
      partialsDir,
      outDir: testOutDir,
      outPath: (p: Product) => `${p.slug}.html`,
    };
    const task = generateDataPagesTask(config);
    await expect(task.run(config, ctx)).resolves.toEqual({});
    expect(ctx.logger.warn).toHaveBeenCalled();
    expect(await fs.pathExists(testOutDir)).toBe(false);
  });

  it('refuses an outPath that escapes outDir', async () => {
    const config: GenerateDataPagesConfig<Product> = {
      items: [{ slug: '../escape', name: 'E', kind: 'x' }],
      template,
      partialsDir,
      outDir: testOutDir,
      outPath: (p) => `${p.slug}/index.html`,
      helpers,
    };
    const task = generateDataPagesTask(config);
    await expect(task.run(config, createCtx())).rejects.toThrow(/stay inside outDir/);
  });

  it('throws when an item is not an object and there is no varsFn', async () => {
    const config: GenerateDataPagesConfig<number> = {
      items: [1],
      template,
      partialsDir,
      outDir: testOutDir,
      outPath: () => 'one.html',
    };
    const task = generateDataPagesTask(config);
    await expect(task.run(config, createCtx())).rejects.toThrow(/varsFn/);
  });

  it('throws on missing required config', async () => {
    const config = {
      items: [],
      template,
      partialsDir,
      outDir: testOutDir,
    } as unknown as GenerateDataPagesConfig;
    const task = generateDataPagesTask(config);
    await expect(task.run(config, createCtx())).rejects.toThrow(/outPath/);
  });
});

describe('safeRelativeOutPath', () => {
  it('normalises relative paths', () => {
    expect(safeRelativeOutPath('a/b/index.html')).toBe('a/b/index.html');
    expect(safeRelativeOutPath('./a//b.html')).toBe('a/b.html');
  });
  it.each(['', '/etc/passwd', '../x.html', 'a/../../x.html', 'a\\b.html', 'C:/x.html'])(
    'rejects %p',
    (p) => {
      expect(() => safeRelativeOutPath(p)).toThrow();
    },
  );
});
