jest.mock('feed', () => {
  return {
    Feed: class MockFeed {
      items: any[] = [];
      addItem(item: any) {
        this.items.push(item);
      }
      rss2() {
        return '<rss><item>' + this.items.map((i) => i.title).join(',') + '</item></rss>';
      }
      atom1() {
        return '<feed><entry>' + this.items.map((i) => i.title).join(',') + '</entry></feed>';
      }
      json1() {
        return JSON.stringify({ feed: this.items.map((i) => i.title) });
      }
    },
  };
});

import { generateFeedTask, GenerateFeedConfig } from './index.js';
import * as fs from 'fs-extra';
import path from 'path';
import type { SkierItem, TaskContext } from '../../types.js';

describe('generateFeedTask', () => {
  const testOutDir = path.join(__dirname, 'testAssets', 'out');
  const ctx: TaskContext = {
    debug: false,
    globals: {},
    logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn() },
  };

  const articles: SkierItem[] = [
    {
      section: 'blog',
      itemName: 'test-post',
      itemPath: '/fake/path/test-post.md',
      outPath: '/fake/path/test-post.html',
      relativePath: 'blog/test-post.html',
      type: 'md',
      date: '2024-01-01T00:00:00.000Z',
      dateObj: new Date('2024-01-01T00:00:00.000Z'),
      dateDisplay: '1 January 2024',
      title: 'Test Post',
      excerpt: 'Excerpt for test post',
      body: '<p>This is a test post.</p>',
      link: '/blog/test-post.html',
    },
  ];

  const site = {
    title: 'Test Blog',
    description: 'A test blog feed',
    id: 'https://example.com/',
    link: 'https://example.com/',
    language: 'en',
    favicon: 'https://example.com/favicon.ico',
    copyright: 'Copyright Test',
    feedLinks: {
      json: 'https://example.com/feed.json',
      atom: 'https://example.com/atom.xml',
    },
    author: {
      name: 'Test Author',
      email: 'author@example.com',
      link: 'https://example.com/author',
    },
  };

  beforeAll(async () => {
    await fs.remove(testOutDir);
    await fs.ensureDir(testOutDir);
  });

  afterAll(async () => {
    await fs.remove(testOutDir);
  });

  it('generates RSS, Atom, and JSON feeds in the output directory', async () => {
    const config: GenerateFeedConfig = {
      articles,
      outDir: testOutDir,
      site,
    };
    const task = generateFeedTask(config);
    const result = await task.run(config, ctx);
    // Check that output files exist
    expect(await fs.pathExists(result.rssPath!)).toBe(true);
    expect(await fs.pathExists(result.atomPath!)).toBe(true);
    expect(await fs.pathExists(result.jsonPath!)).toBe(true);
    // Optionally, check that contents include expected strings
    const rss = await fs.readFile(result.rssPath!, 'utf8');
    expect(rss).toContain('<rss');
    expect(rss).toContain('Test Post');
    const atom = await fs.readFile(result.atomPath!, 'utf8');
    expect(atom).toContain('<feed');
    expect(atom).toContain('Test Post');
    const json = await fs.readFile(result.jsonPath!, 'utf8');
    expect(json).toContain('Test Post');
    expect(json).toContain('feed');
  });
});
