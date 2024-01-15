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
import { IngestPathwaysContext, IngestPathwaysServices } from '../ingest_pathways_state_machine';

type LoadSignalDataResult = IngestPathwaysServices['loadSignalData']['data'];

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
  }: IngestPathwaysContext): Promise<LoadSignalDataResult> => {
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
              aggregations: {
                agent: {
                  top_metrics: {
                    metrics: [
                      {
                        field: 'agent.name',
                      },
                      {
                        field: 'agent.type',
                      },
                      {
                        field: 'agent.version',
                      },
                    ],
                    sort: {
                      '@timestamp': 'desc',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const { rawResponse } = await lastValueFrom(search(request));

    const response = decodeOrThrow(signalResponseRT)(rawResponse);

    return response.aggregations.relations.buckets.reduce<LoadSignalDataResult>(
      (
        currentData,
        {
          key: { agentId: unsafeAgentId, dataStreamType, dataStreamDataset, dataStreamNamespace },
          doc_count: signalCount,
          agent,
        }
      ) => {
        const dataStreamId = `${dataStreamType}-${dataStreamDataset}-${dataStreamNamespace}`;
        if (currentData.dataStreams[dataStreamId] == null) {
          currentData.dataStreams[dataStreamId] = {
            type: 'dataStreamStub',
            id: dataStreamId,
          };
        }

        const agentMetadata = agent.top[0]?.metrics;
        const agentId = `${agentMetadata['agent.type'] ?? 'unknown'}-${unsafeAgentId}`;
        const previousAgent = currentData.agents[agentId];

        if (previousAgent == null) {
          currentData.agents[agentId] = {
            id: agentId,
            type: agentMetadata['agent.type'] ?? 'unknown',
            name: agentMetadata['agent.name'] ?? agentId,
            version: agentMetadata['agent.version'] ?? 'unknown',
            shipsTo: [
              {
                dataStreamId,
                signalCount,
              },
            ],
          };
        } else {
          currentData.agents[agentId] = {
            ...previousAgent,
            shipsTo: [
              ...previousAgent.shipsTo,
              {
                dataStreamId,
                signalCount,
              },
            ],
          };
        }

        return currentData;
      },
      {
        dataStreams: {},
        agents: {},
      }
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
          agent: rt.strict({
            top: rt.array(
              rt.strict({
                metrics: rt.strict({
                  'agent.name': rt.union([rt.string, rt.null]),
                  'agent.type': rt.union([rt.string, rt.null]),
                  'agent.version': rt.union([rt.string, rt.null]),
                }),
              })
            ),
          }),
        })
      ),
    }),
  }),
});
