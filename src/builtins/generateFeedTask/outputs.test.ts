// Covers the options that shape what is written: outputs, feed metadata, ids,
// published dates, categories, and excerpt-only articles. `feed` is ESM-only,
// so (as in index.test.ts) it is replaced by a recorder of what it was given.
const recorded: { options: Record<string, unknown>[]; items: Record<string, unknown>[] } = {
  options: [],
  items: [],
};
jest.mock('feed', () => ({
  Feed: class RecordingFeed {
    constructor(options: Record<string, unknown>) {
      recorded.options.push(options);
    }
    addItem(item: Record<string, unknown>) {
      recorded.items.push(item);
    }
    rss2() {
      return '<rss/>';
    }
    atom1() {
      return '<feed/>';
    }
    json1() {
      return '{}';
    }
  },
}));

import { generateFeedTask, GenerateFeedConfig, FeedArticle } from './index.js';
import * as fs from 'fs-extra';
import path from 'path';
import type { TaskContext } from '../../types.js';

describe('generateFeedTask outputs and article fields', () => {
  const testOutDir = path.join(__dirname, 'testAssets', 'out-real');
  const ctx: TaskContext = {
    debug: false,
    globals: {},
    logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn() },
  };
  const site: GenerateFeedConfig['site'] = {
    title: 'Training log',
    description: 'Every session',
    id: 'https://example.com/log',
    link: 'https://example.com/log',
    feedLinks: { atom: 'https://example.com/log/feed.xml' },
    author: { name: 'Jane', link: 'https://example.com/' },
    updated: new Date('2026-10-20T08:00:00Z'),
    generator: 'example-site',
  };
  const articles: FeedArticle[] = [
    {
      title: 'Older run',
      link: 'https://example.com/log/older',
      excerpt: 'Run · 5 km',
      dateObj: new Date('2026-10-20T08:00:00Z'),
      publishedObj: new Date('2026-10-01T07:00:00Z'),
      categories: [{ term: 'activity', name: 'Activity' }],
    },
    {
      title: 'Newer roundup',
      id: 'https://example.com/log/roundup/week-42',
      link: 'https://example.com/log/roundup/week-42',
      excerpt: 'Week 42 — 3 sessions',
      dateObj: new Date('2026-10-19T00:00:00Z'),
      publishedObj: new Date('2026-10-19T00:00:00Z'),
    },
  ];

  beforeEach(async () => {
    await fs.remove(testOutDir);
    recorded.options.length = 0;
    recorded.items.length = 0;
  });

  afterAll(async () => {
    await fs.remove(testOutDir);
  });

  it('writes only the listed formats, at the given paths', async () => {
    const config: GenerateFeedConfig = {
      articles,
      outDir: testOutDir,
      site,
      outputs: { atom: 'log/feed.xml' },
    };
    const task = generateFeedTask(config);
    const result = await task.run(config, ctx);
    expect(result).toEqual({ atomPath: path.join(testOutDir, 'log', 'feed.xml') });
    expect(await fs.pathExists(path.join(testOutDir, 'rss.xml'))).toBe(false);
    expect(await fs.pathExists(path.join(testOutDir, 'atom.xml'))).toBe(false);
    expect(await fs.pathExists(path.join(testOutDir, 'json.json'))).toBe(false);

    expect(await fs.readFile(result.atomPath!, 'utf8')).toBe('<feed/>');

    // Feed-level metadata is handed to the library as given
    expect(recorded.options[0]).toMatchObject({
      title: 'Training log',
      id: 'https://example.com/log',
      updated: new Date('2026-10-20T08:00:00Z'),
      generator: 'example-site',
      feedLinks: { atom: 'https://example.com/log/feed.xml' },
    });
    // Sorted by publishedObj: the roundup (published 19 Oct) before the run (1 Oct)
    expect(recorded.items.map((i) => i.title)).toEqual(['Newer roundup', 'Older run']);
    expect(recorded.items[1]).toEqual({
      title: 'Older run',
      id: 'https://example.com/log/older',
      link: 'https://example.com/log/older',
      description: 'Run · 5 km',
      content: undefined,
      date: new Date('2026-10-20T08:00:00Z'),
      published: new Date('2026-10-01T07:00:00Z'),
      category: [{ term: 'activity', name: 'Activity' }],
      author: [{ name: 'Jane', link: 'https://example.com/' }],
    });
    expect(recorded.items[0]!.id).toBe('https://example.com/log/roundup/week-42');
    expect(recorded.items[0]).not.toHaveProperty('category');
  });

  it('leaves updated and generator to the library when not set', async () => {
    const { updated: _u, generator: _g, ...plain } = site;
    const config: GenerateFeedConfig = { articles, outDir: testOutDir, site: plain };
    const task = generateFeedTask(config);
    await task.run(config, ctx);
    expect(recorded.options[0]).not.toHaveProperty('updated');
    expect(recorded.options[0]).not.toHaveProperty('generator');
  });

  it('keeps writing all three formats by default', async () => {
    const config: GenerateFeedConfig = { articles, outDir: testOutDir, site };
    const task = generateFeedTask(config);
    const result = await task.run(config, ctx);
    expect(Object.keys(result).sort()).toEqual(['atomPath', 'jsonPath', 'rssPath']);
    for (const f of ['rss.xml', 'atom.xml', 'json.json']) {
      expect(await fs.pathExists(path.join(testOutDir, f))).toBe(true);
    }
  });

  it('omits the generator with generator: false', async () => {
    const config: GenerateFeedConfig = {
      articles,
      outDir: testOutDir,
      site: { ...site, generator: false },
      outputs: { atom: 'atom.xml' },
    };
    const task = generateFeedTask(config);
    await task.run(config, ctx);
    expect(recorded.options[0]!.generator).toBe(false);
  });

  it('resolves site-relative links and ids against site.link', async () => {
    const config: GenerateFeedConfig = {
      articles: [
        {
          title: 'Relative',
          link: '/thoughts/hello.html',
          body: '<p>Hi</p>',
          dateObj: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      outDir: testOutDir,
      site: { ...site, link: 'https://example.com/' },
    };
    const task = generateFeedTask(config);
    await task.run(config, ctx);
    expect(recorded.items[0]).toMatchObject({
      id: 'https://example.com/thoughts/hello.html',
      link: 'https://example.com/thoughts/hello.html',
      content: '<p>Hi</p>',
    });
  });

  it('rejects an article with neither body nor excerpt', async () => {
    const config: GenerateFeedConfig = {
      articles: [{ title: 'Empty', link: 'https://example.com/e', dateObj: new Date() }],
      outDir: testOutDir,
      site,
      outputs: { atom: 'atom.xml' },
    };
    const task = generateFeedTask(config);
    await expect(task.run(config, ctx)).rejects.toThrow(/body or excerpt/);
  });

  it('rejects an invalid publishedObj', async () => {
    const config: GenerateFeedConfig = {
      articles: [{ ...articles[0]!, publishedObj: new Date('nope') }],
      outDir: testOutDir,
      site,
      outputs: { atom: 'atom.xml' },
    };
    const task = generateFeedTask(config);
    await expect(task.run(config, ctx)).rejects.toThrow(/invalid publishedObj/);
  });
});
