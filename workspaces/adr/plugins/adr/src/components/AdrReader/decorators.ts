/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { parseMadrWithFrontmatter } from '@backstage-community/plugin-adr-common';
import { AdrContentDecorator, AdrContentDecoratorAsync } from './types';
import mermaid from 'mermaid';

/**
 *
 * Factory for creating default ADR content decorators. The adrDecoratorFactories
 * symbol is not directly exported, but through the AdrReader.decorators field.
 * @public
 */
export const adrDecoratorFactories = Object.freeze({
  /**
   * Rewrites relative Markdown links as absolute links.
   */
  createRewriteRelativeLinksDecorator(): AdrContentDecorator {
    return ({ baseUrl, content }) => ({
      content: content.replace(
        /\[([^\[\]]*)\]\((?!https?:\/\/)(.*?)(\.md)\)/gim,
        `[$1](${baseUrl}/$2$3)`,
      ),
    });
  },
  /**
   * Rewrites relative Markdown embeds using absolute URLs.
   */
  createRewriteRelativeEmbedsDecorator(): AdrContentDecorator {
    return ({ baseUrl, content }) => ({
      content: content.replace(
        /!\[([^\[\]]*)\]\((?!https?:\/\/)(.*?)(\.png|\.jpg|\.jpeg|\.gif|\.webp)(.*)\)/gim,
        `![$1](${baseUrl}/$2$3$4)`,
      ),
    });
  },
  /**
   * Formats YAML front-matter into a table format (if any exists in the markdown document)
   */
  createFrontMatterFormatterDecorator(): AdrContentDecorator {
    return ({ content }) => {
      const parsedFrontmatter = parseMadrWithFrontmatter(content);
      let table = '';
      const attrs = parsedFrontmatter.attributes;
      if (Object.keys(attrs).length > 0) {
        const stripNewLines = (val: unknown) =>
          String(val).replaceAll('\n', '<br/>');
        const row = (vals: string[]) => `|${vals.join('|')}|\n`;
        table = `${row(Object.keys(attrs))}`;
        table += `${row(Object.keys(attrs).map(() => '---'))}`;
        table += `${row(Object.values(attrs).map(stripNewLines))}\n\n`;
      }
      return { content: table + parsedFrontmatter.content };
    };
  },
  /**
   * Formats mermaid code fences as mermaidjs rendered diagrams
   * @returns
   */
  createMermaidDiagramDecorator(): AdrContentDecorator {
    return ({ content }) => {
      const value = preprocessAdrContent(content);
      return { content: value };
    };
  },

  createMermaidDiagramDecoratorAsync(): AdrContentDecoratorAsync {
    return async (adrInfo: { baseUrl: string; content: string }) => {
      const value = await preprocessAdrContentAsync(adrInfo.content);
      return { content: value };
    };
  },
});

async function preprocessAdrContentAsync(content: string): Promise<string> {
  const regex = /```mermaid\s([\s\S]*?)```/g;
  const matches = [...content.matchAll(regex)];

  let replacedContent = content;

  for (const match of matches) {
    const [fullMatch, _] = match;

    try {
      await mermaid.run({ querySelector: 'pre.mermaid' });
      replacedContent = replacedContent.replace(fullMatch, '');
    } catch (error) {
      return content;
    }
  }

  return replacedContent;
}

function preprocessAdrContent(content: string): string {
  const regex = /```mermaid\s([\s\S]*?)```/g;
  const matches = [...content.matchAll(regex)];

  let replacedContent = content;

  for (const match of matches) {
    const [fullMatch, diagramCode] = match;

    const diagramBlock = [
      "\\<pre class='mermaid'\\>",
      diagramCode,
      '\\</pre\\>',
    ].join('\n');
    replacedContent = replacedContent.replace(fullMatch, diagramBlock);
  }

  return replacedContent;
}
