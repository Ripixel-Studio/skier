import { generateSitemapTask, GenerateSitemapConfig } from './index.js';
import * as fs from 'fs-extra';
import path from 'path';
import type { TaskContext } from '../../types.js';

describe('generateSitemapTask', () => {
  const testOutDir = path.join(__dirname, 'testAssets', 'out');
  const testInputDir = path.join(__dirname, 'testAssets', 'input');

  const createCtx = (): TaskContext => ({
    debug: false,
    globals: {},
    logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn() },
  });

  beforeAll(async () => {
    await fs.remove(testOutDir);
    await fs.ensureDir(testOutDir);
  });

  afterAll(async () => {
    await fs.remove(testOutDir);
  });

  afterEach(async () => {
    // Clean generated sitemap between tests
    const outPath = path.join(testOutDir, 'sitemap.xml');
    if (await fs.pathExists(outPath)) {
      await fs.remove(outPath);
    }
  });

  it('generates correct sitemap.xml with clean URLs and default exclusions', async () => {
    const ctx = createCtx();
    const config: GenerateSitemapConfig = {
      scanDir: testInputDir,
      outDir: testOutDir,
      siteUrl: 'https://example.com',
    };
    const task = generateSitemapTask(config);
    await task.run(config, ctx);
    const outPath = path.join(testOutDir, 'sitemap.xml');
    const expectedPath = path.join(__dirname, 'testAssets', 'expected', 'sitemap.xml');
    expect(await fs.pathExists(outPath)).toBe(true);
    expect(await fs.pathExists(expectedPath)).toBe(true);
    const actual = (await fs.readFile(outPath, 'utf8')).replace(/\r\n/g, '\n');
    const expected = (await fs.readFile(expectedPath, 'utf8')).replace(/\r\n/g, '\n');
    // Normalize by removing all whitespace for comparison
    const normalize = (str: string) => str.replace(/\s+/g, '');
    expect(normalize(actual)).toBe(normalize(expected));
  });

  it('excludes 404.html by default', async () => {
    const ctx = createCtx();
    const config: GenerateSitemapConfig = {
      scanDir: testInputDir,
      outDir: testOutDir,
      siteUrl: 'https://example.com',
    };
    const task = generateSitemapTask(config);
    await task.run(config, ctx);
    const outPath = path.join(testOutDir, 'sitemap.xml');
    const actual = await fs.readFile(outPath, 'utf8');
    expect(actual).not.toContain('/404');
  });

  it('logs excluded files at info level', async () => {
    const ctx = createCtx();
    const config: GenerateSitemapConfig = {
      scanDir: testInputDir,
      outDir: testOutDir,
      siteUrl: 'https://example.com',
    };
    const task = generateSitemapTask(config);
    await task.run(config, ctx);
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('excluded /404.html'));
  });

  it('applies custom excludes merged with defaults', async () => {
    const ctx = createCtx();
    const config: GenerateSitemapConfig = {
      scanDir: testInputDir,
      outDir: testOutDir,
      siteUrl: 'https://example.com',
      excludes: ['admin/**'],
    };
    const task = generateSitemapTask(config);
    await task.run(config, ctx);
    const outPath = path.join(testOutDir, 'sitemap.xml');
    const actual = await fs.readFile(outPath, 'utf8');
    // Custom exclude should remove admin pages
    expect(actual).not.toContain('/admin');
    // Default exclude still applies
    expect(actual).not.toContain('/404');
    // Other pages remain
    expect(actual).toContain('/about');
    expect(actual).toContain('/contact');
  });

  it('cleans URLs correctly', async () => {
    const ctx = createCtx();
    const config: GenerateSitemapConfig = {
      scanDir: testInputDir,
      outDir: testOutDir,
      siteUrl: 'https://example.com',
    };
    const task = generateSitemapTask(config);
    await task.run(config, ctx);
    const outPath = path.join(testOutDir, 'sitemap.xml');
    const actual = await fs.readFile(outPath, 'utf8');
    // index.html → /
    expect(actual).toContain('https://example.com/');
    // about.html → /about (no .html)
    expect(actual).toContain('https://example.com/about');
    expect(actual).not.toContain('about.html');
    // blog/index.html → /blog/
    expect(actual).toContain('https://example.com/blog/');
    expect(actual).not.toContain('blog/index.html');
    // contact.html → /contact (no .html)
    expect(actual).toContain('https://example.com/contact');
    expect(actual).not.toContain('contact.html');
  });

  it('lists directory pages slash-less with trailingSlash: false', async () => {
    const ctx = createCtx();
    const config: GenerateSitemapConfig = {
      scanDir: testInputDir,
      outDir: testOutDir,
      siteUrl: 'https://example.com/',
      trailingSlash: false,
    };
    const task = generateSitemapTask(config);
    await task.run(config, ctx);
    const actual = await fs.readFile(path.join(testOutDir, 'sitemap.xml'), 'utf8');
    // The root stays `/`
    expect(actual).toContain('<loc>https://example.com/</loc>');
    // blog/index.html → /blog
    expect(actual).toContain('<loc>https://example.com/blog</loc>');
    expect(actual).not.toContain('https://example.com/blog/');
    expect(actual).toContain('<loc>https://example.com/admin</loc>');
    expect(actual).toContain('<loc>https://example.com/about</loc>');
  });
});
