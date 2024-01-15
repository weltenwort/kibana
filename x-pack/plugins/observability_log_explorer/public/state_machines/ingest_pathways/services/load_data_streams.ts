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
import { DataStream } from '../types';
import { INDEX_MANAGEMENT_PREFIX } from '../utils';

type LoadDataStreamsResult = IngestPathwaysServices['loadDataStreams']['data'];

export const loadDataStreams =
  ({ http }: { http: HttpStart }) =>
  async ({ data: { dataStreams } }: IngestPathwaysContext): Promise<LoadDataStreamsResult> => {
    const updatedDataStreams: Record<string, DataStream> = Object.fromEntries(
      await Promise.all(
        Object.entries(dataStreams).map(async ([, dataStream]) => {
          const rawResponse = await http.get(
            `${INDEX_MANAGEMENT_PREFIX}/data_streams/${dataStream.id}`
          );
          const response = decodeOrThrow(dataStreamResponseRT)(rawResponse);

          const newDataStream: DataStream = {
            type: 'dataStream',
            id: dataStream.id,
            indexTemplateId: response.indexTemplateName,
          };

          return [dataStream.id, newDataStream] as const;
        })
      )
    );

    return updatedDataStreams;
  };

const dataStreamResponseRT = rt.strict({
  indexTemplateName: rt.string,
});
