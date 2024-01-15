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
import { IngestPipeline } from '../types';
import { INGEST_PIPELINES_PREFIX } from '../utils';

type LoadIngestPipelinesResult = IngestPathwaysServices['loadIngestPipelines']['data'];

export const loadIngestPipelines =
  ({ http }: { http: HttpStart }) =>
  async ({
    data: { ingestPipelines },
  }: IngestPathwaysContext): Promise<LoadIngestPipelinesResult> => {
    const updatedIngestPipelines: Record<string, IngestPipeline> = Object.fromEntries(
      await Promise.all(
        Object.entries(ingestPipelines).map(async ([, ingestPipeline]) => {
          const rawResponse = await http.get(`${INGEST_PIPELINES_PREFIX}/${ingestPipeline.id}`);
          const response = decodeOrThrow(ingestPipelineResponseRT)(rawResponse);

          const newIngestPipeline: IngestPipeline = {
            type: 'ingestPipeline',
            id: ingestPipeline.id,
            description: response.description,
            processors: response.processors,
          };

          return [ingestPipeline.id, newIngestPipeline] as const;
        })
      )
    );

    return updatedIngestPipelines;
  };

const ingestProcessorRT = rt.union([
  rt.strict({
    pipeline: rt.strict({
      name: rt.string,
    }),
  }),
  rt.strict({
    rename: rt.strict({
      field: rt.string,
      target_field: rt.string,
    }),
  }),
  rt.unknown,
]);

const ingestPipelineResponseRT = rt.intersection([
  rt.strict({
    name: rt.string,
    processors: rt.array(ingestProcessorRT),
  }),
  rt.exact(
    rt.partial({
      description: rt.string,
    })
  ),
]);
