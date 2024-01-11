/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { HttpStart } from '@kbn/core-http-browser';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import * as rt from 'io-ts';
import { IngestPathwaysContext } from '../ingest_pathways_state_machine';
import { IndexTemplate } from '../types';
import { INDEX_MANAGEMENT_PREFIX } from '../utils';

export const loadDataStreams =
  ({ http }: { http: HttpStart }) =>
  async ({
    data: { dataStreams },
  }: IngestPathwaysContext): Promise<{
    indexTemplates: Record<string, IndexTemplate>;
  }> => {
    await Promise.all(
      Object.values(dataStreams).map(async (dataStream) => {
        const rawResponse = await http.get(
          `${INDEX_MANAGEMENT_PREFIX}/data_streams/${dataStream.id}`
        );
      })
    );

    // const response = decodeOrThrow(signalResponseRT)(rawResponse);
    return {
      indexTemplates: {},
    };
  };

const signalResponseRT = rt.strict({
  aggregations: rt.strict({
    relations: rt.strict({
      buckets: rt.array(
        rt.strict({
          key: rt.strict({
            agentId: rt.string,
            dataStreamType: rt.string,
            dataStreamDataset: rt.string,
            dataStreamNamespace: rt.string,
          }),
          doc_count: rt.number,
          agent: rt.strict({
            top: rt.array(
              rt.strict({
                metrics: rt.strict({
                  'agent.name': rt.string,
                  'agent.type': rt.string,
                  'agent.version': rt.string,
                }),
              })
            ),
          }),
        })
      ),
    }),
  }),
});
