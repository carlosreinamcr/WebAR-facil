/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';

export function englishApiMarkdown(api) {
  return '# Generated public API\n\nGenerated from the public exports and TypeScript declarations. Relative imports retain their original context. The standalone script also exposes the THREE namespace.\n\n'
    + '| Export | Kind | Entry points |\n| --- | --- | --- |\n'
    + api.exports.map(item => '| `' + item.name + '` | ' + (item.typeOnly ? 'Type' : 'Value and/or type') + ' | ' + item.entrypoints.map(entry => '`' + entry + '`').join(', ') + ' |').join('\n')
    + '\n\nSee [WebAREngine](api-engine.md) and [the advanced API](advanced.md) for integration guidance.\n\n'
    + api.declarations.map(({file, code}) => '## ' + file + '\n\n```ts\n' + code.replace(/\/\*\*[\s\S]*?\*\/\s*/g, '').trimEnd() + '\n```\n').join('\n');
}

export function prepareEnglishManual(spanishIndex, sources, api) {
  const chapters = new Map();
  for (const source of sources) {
    for (const [, name, content] of source.matchAll(/^<!-- chapter:([\w-]+) -->\r?\n([\s\S]*?)(?=^<!-- chapter:|(?![\s\S]))/gm)) {
      assert.ok(!chapters.has(name), 'Duplicate English chapter: ' + name);
      chapters.set(name, content.trim() + '\n');
    }
  }
  chapters.set('api-generated', englishApiMarkdown(api));
  const pages = spanishIndex.map(({href}) => {
    const name = href === 'index.html' ? 'README' : href.replace(/\.html$/, '');
    const markdown = chapters.get(name);
    assert.ok(markdown, 'Missing English chapter: ' + name);
    return {name, href, markdown, title: markdown.match(/^# (.+)$/m)[1]};
  });
  assert.equal(chapters.size, pages.length, 'Unexpected English chapter');
  return pages;
}

export function englishManualHtml(shell, pages, page) {
  const md = new MarkdownIt();
  const escape = md.utils.escapeHtml;
  md.renderer.rules.link_open = (tokens, i, options, env, self) => {
    const href = tokens[i].attrGet('href');
    if (href && !/^(?:[a-z]+:|\/\/)/i.test(href)) {
      tokens[i].attrSet('href', href.replace(/(^|\/)README\.md(?=$|#)/, '$1index.html').replace(/\.md(?=$|#)/, '.html'));
    }
    return self.renderToken(tokens, i, options);
  };
  md.renderer.rules.heading_open = (tokens, i, options, env, self) => {
    const base = tokens[i+1].content.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const count = env.headings.get(base) ?? 0;
    env.headings.set(base, count + 1);
    tokens[i].attrSet('id', base + (count ? '-' + count : ''));
    return self.renderToken(tokens, i, options);
  };
  const nav = pages.map(entry => '<a href="' + entry.href + '">' + escape(entry.title) + '</a>').join('\n');
  return shell
    .replace(/<title>.*?<\/title>/, () => '<title>' + escape(page.title) + ' · WebAR Fácil</title>')
    .replace(/(<nav\b[^>]*>)[\s\S]*?(<\/nav>)/, (_, open, close) => open + nav + close)
    .replace(/(<main id="content">)[\s\S]*?(<footer>)/, (_, open, footer) =>
      open + md.render(page.markdown, {headings:new Map()}) + footer)
    .replace('href="README.md"', 'href="' + page.name + '.md"')
    .replace('href="../index.html" lang="es"', 'href="../' + page.href + '" lang="es"');
}

export function expandEnglishText(file, content, pages) {
  const heading = '\n## English documentation\n\n';
  const start = content.indexOf(heading);
  assert.ok(start >= 0, file);
  const prefix = content.slice(0, start + heading.length);
  if (file === 'llms-full.txt') {
    return prefix + pages.map(page => '---\nSource: docs/en/' + page.name + '.md\n\n' + page.markdown).join('\n');
  }
  const contract = content.indexOf('\n## Contrato estructurado', start);
  assert.ok(contract >= 0, file);
  return prefix + pages.map(page => '- [' + page.title + '](docs/en/' + page.name + '.md)').join('\n') + '\n' + content.slice(contract);
}
