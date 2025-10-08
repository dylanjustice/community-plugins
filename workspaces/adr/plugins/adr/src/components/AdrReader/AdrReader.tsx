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

import React, { useEffect, useMemo, useState } from 'react';
import {
  InfoCard,
  Progress,
  WarningPanel,
  MarkdownContent,
  Header,
} from '@backstage/core-components';
import { discoveryApiRef, useApi } from '@backstage/core-plugin-api';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import { getAdrLocationUrl } from '@backstage-community/plugin-adr-common';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CookieAuthRefreshProvider } from '@backstage/plugin-auth-react';

import { adrDecoratorFactories } from './decorators';
import { AdrContentDecorator, AdrContentDecoratorAsync } from './types';
import { adrApiRef } from '../../api';
import useAsync from 'react-use/esm/useAsync';
import mermaid from 'mermaid';

/**
 * Component to fetch and render an ADR.
 *
 * @public
 */
export const AdrReader = (props: {
  adr: string;
  decorators?: AdrContentDecorator[];
  asyncDecorators?: AdrContentDecoratorAsync[];
}) => {
  const { adr, decorators, asyncDecorators } = props;
  const { entity } = useEntity();
  const scmIntegrations = useApi(scmIntegrationsApiRef);
  const adrApi = useApi(adrApiRef);
  const adrLocationUrl = getAdrLocationUrl(entity, scmIntegrations);
  const adrFileLocationUrl = getAdrLocationUrl(entity, scmIntegrations, adr);
  const discoveryApi = useApi(discoveryApiRef);
  const [adrContent, setAdrContent] = useState<string>('');
  const [runMermaid, setRunMermaid] = useState(true);
  const [decoratorError, setDecoratorError] = useState<Error | null>(null);
  const [mermaidErr, setMermaidErr] = useState<Error | null>(null);
  const { value, loading, error } = useAsync(
    async () => adrApi.readAdr(adrFileLocationUrl),
    [adrFileLocationUrl],
  );

  const {
    value: backendUrl,
    loading: backendUrlLoading,
    error: backendUrlError,
  } = useAsync(async () => discoveryApi.getBaseUrl('adr'), []);

  useEffect(() => {
    if (!value?.data) {
      setAdrContent('');
      return;
    }

    const adrDecorators = decorators ?? [
      adrDecoratorFactories.createRewriteRelativeLinksDecorator(),
      adrDecoratorFactories.createRewriteRelativeEmbedsDecorator(),
      adrDecoratorFactories.createFrontMatterFormatterDecorator(),
    ];
    const asyncAdrDecorators =
      asyncDecorators ??
      [
        // adrDecoratorFactories.createMermaidDiagramDecoratorAsync(),
      ];

    const processDecorators = async () => {
      let content = value.data;

      for (const decorator of asyncAdrDecorators) {
        const result = await decorator({ baseUrl: adrLocationUrl, content });
        content = result.content;
      }
      for (const decorator of adrDecorators) {
        const result = decorator({ baseUrl: adrLocationUrl, content });
        content = result.content;
      }

      setAdrContent(content); // Update state with the final content
    };

    processDecorators().catch(err => {
      setDecoratorError(err);
    });
  }, [adrLocationUrl, decorators, asyncDecorators, value]);

  useEffect(() => {
    if (!runMermaid || adrContent === '') return;
    const element = document.querySelector('code.language-text');
    if (!element) return;
    const mermaidRun = async () => {
      mermaid.run({
        querySelector: 'code.language-text',
        postRenderCallback: () => setRunMermaid(false),
        suppressErrors: true,
      });
    };
    mermaidRun().catch(err => setMermaidErr(Error(err)));
  }, [runMermaid, adrContent]);

  return (
    <CookieAuthRefreshProvider pluginId="adr">
      <InfoCard>
        {loading && <Progress />}

        {!loading && error && (
          <WarningPanel title="Failed to fetch ADR" message={error?.message} />
        )}

        {!backendUrlLoading && backendUrlError && (
          <WarningPanel
            title="Failed to fetch ADR images"
            message={backendUrlError?.message}
          />
        )}

        {!loading &&
          !backendUrlLoading &&
          !error &&
          !backendUrlError &&
          value?.data && (
            <>
              <MarkdownContent
                content={adrContent}
                linkTarget="_blank"
                transformImageUri={href => {
                  return `${backendUrl}/image?url=${href}`;
                }}
              />
            </>
          )}
      </InfoCard>
    </CookieAuthRefreshProvider>
  );
};

AdrReader.decorators = adrDecoratorFactories;
