/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { HttpStart } from '@kbn/core-http-browser';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import * as rt from 'io-ts';
import { IngestPathwaysContext, IngestPathwaysServices } from '../ingest_pathways_state_machine';
import { IndexTemplate, IngestPipeline } from '../types';
import { INDEX_MANAGEMENT_PREFIX } from '../utils';

export const loadIndexTemplates =
  ({ http }: { http: HttpStart }) =>
  async ({
    data: { dataStreams },
  }: IngestPathwaysContext): Promise<IngestPathwaysServices['loadIndexTemplates']['data']> => {
    // load main index templates
    const mentionedIndexTemplateNames = new Set(
      Object.values(dataStreams).flatMap(({ indexTemplateId }) =>
        indexTemplateId != null ? [indexTemplateId] : []
      )
    );

    const indexTemplateInfos = Object.fromEntries(
      await Promise.all(
        Array.from(mentionedIndexTemplateNames).map(async (indexTemplateName) => {
          const rawResponse = await http
            .get(`${INDEX_MANAGEMENT_PREFIX}/index_templates/${indexTemplateName}`)
            .catch((err) => ({
              composedOf: [],
              template: {},
            }));
          return [indexTemplateName, decodeOrThrow(indexTemplateResponseRT)(rawResponse)] as const;
        })
      )
    );

    // load component templates
    const mentionedComponentTemplateNames = new Set(
      Object.values(indexTemplateInfos).flatMap(({ composedOf }) => composedOf)
    );

    const componentTemplateInfos: Record<string, ComponentTemplateInfo> = Object.fromEntries(
      await Promise.all(
        Array.from(mentionedComponentTemplateNames).map(async (componentTemplateName) => {
          const rawResponse = await http
            .get(`${INDEX_MANAGEMENT_PREFIX}/component_templates/${componentTemplateName}`)
            .catch((err) => ({
              template: {},
            }));
          return [
            componentTemplateName,
            decodeOrThrow(componentTemplateResponseRT)(rawResponse),
          ] as const;
        })
      )
    );

    // combine the index and component templates
    const indexTemplates: Record<string, IndexTemplate> = Object.fromEntries(
      Object.entries(indexTemplateInfos).map(([indexTemplateId, indexTemplateInfo]) => {
        const defaultPipeline = reduceToLastTemplateName(
          indexTemplateInfo,
          componentTemplateInfos,
          'default_pipeline'
        );
        const finalPipeline = reduceToLastTemplateName(
          indexTemplateInfo,
          componentTemplateInfos,
          'final_pipeline'
        );

        return [
          indexTemplateId,
          {
            id: indexTemplateId,
            ingestPipelineIds: [
              ...(defaultPipeline != null ? [defaultPipeline] : []),
              ...(finalPipeline != null ? [finalPipeline] : []),
            ],
          },
        ];
      })
    );

    return {
      indexTemplates,
      ingestPipelines,
    };
  };

const reduceToLastTemplateName = (
  mainIndexTemplateInfo: IndexTemplateInfo,
  availableComponentTemplateInfos: Record<string, ComponentTemplateInfo>,
  templateType: 'default_pipeline' | 'final_pipeline'
): string | undefined => {
  return [
    mainIndexTemplateInfo.template.settings?.index?.[templateType],
    ...mainIndexTemplateInfo.composedOf.map(
      (composedOfTemplateName) =>
        availableComponentTemplateInfos[composedOfTemplateName].template.settings?.index?.[
          templateType
        ]
    ),
  ].reduce<string | undefined>((lastPipelineName, currentPipelineName) => {
    return currentPipelineName ?? lastPipelineName;
  }, undefined);
};

const templateSettingsRT = rt.exact(
  rt.partial({
    settings: rt.exact(
      rt.partial({
        index: rt.exact(
          rt.partial({
            default_pipeline: rt.string,
            final_pipeline: rt.string,
          })
        ),
      })
    ),
  })
);

const indexTemplateResponseRT = rt.strict({
  composedOf: rt.array(rt.string),
  template: templateSettingsRT,
});

type IndexTemplateInfo = rt.TypeOf<typeof indexTemplateResponseRT>;

const componentTemplateResponseRT = rt.strict({
  template: templateSettingsRT,
});

type ComponentTemplateInfo = rt.TypeOf<typeof componentTemplateResponseRT>;
