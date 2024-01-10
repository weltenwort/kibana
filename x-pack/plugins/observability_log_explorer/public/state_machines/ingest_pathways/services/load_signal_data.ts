/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IEsSearchRequest, ISearchGeneric, ISearchRequestParams } from '@kbn/data-plugin/common';
import { IDataStreamsStatsClient } from '@kbn/dataset-quality-plugin/public';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import * as rt from 'io-ts';
import { lastValueFrom } from 'rxjs';
import { IngestPathwaysContext } from '../ingest_pathways_state_machine';
import { IngestPathwaysData } from '../types';

export const loadSignalData =
  ({
    dataStreamsStatsClient,
    search,
  }: {
    dataStreamsStatsClient: IDataStreamsStatsClient;
    search: ISearchGeneric;
  }) =>
  async ({
    parameters: { dataStreamPattern, timeRange },
  }: IngestPathwaysContext): Promise<IngestPathwaysData> => {
    const request: IEsSearchRequest<ISearchRequestParams> = {
      params: {
        index: dataStreamPattern,
        allow_no_indices: true,
        ignore_unavailable: true,
        body: {
          size: 0,
          query: {
            bool: {
              filter: [
                {
                  exists: {
                    field: 'data_stream.type',
                  },
                },
                {
                  range: {
                    '@timestamp': {
                      gt: timeRange.from,
                      lte: timeRange.to,
                    },
                  },
                },
              ],
            },
          },
          aggregations: {
            relations: {
              composite: {
                size: 1000,
                sources: [
                  {
                    agentId: {
                      terms: {
                        field: 'agent.id',
                      },
                    },
                  },
                  {
                    dataStreamType: {
                      terms: {
                        field: 'data_stream.type',
                      },
                    },
                  },
                  {
                    dataStreamDataset: {
                      terms: {
                        field: 'data_stream.dataset',
                      },
                    },
                  },
                  {
                    dataStreamNamespace: {
                      terms: {
                        field: 'data_stream.namespace',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    };

    console.log(request);

    const { rawResponse } = await lastValueFrom(search(request));

    console.log(rawResponse);

    const response = decodeOrThrow(signalResponseRT)(rawResponse);

    return response.aggregations.relations.buckets.reduce(
      (
        currentData,
        { key: { agentId, dataStreamType, dataStreamDataset, dataStreamNamespace } }
      ) => {
        const dataStreamId = `${dataStreamType}-${dataStreamDataset}-${dataStreamNamespace}`;
        if (currentData.dataStreams[dataStreamId] == null) {
          currentData.dataStreams[dataStreamId] = {
            id: dataStreamId,
          };
        }

        if (currentData.agents[agentId] == null) {
          currentData.agents[agentId] = {
            id: agentId,
          };
        }

        currentData.relations.push({
          type: 'agent-ships-to',
          agentId,
          dataStreamId,
        });

        return currentData;
      },
      {
        dataStreams: {},
        agents: {},
        relations: [],
      } as IngestPathwaysData
    );
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
        })
      ),
    }),
  }),
});
