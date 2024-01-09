/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ISearchGeneric } from '@kbn/data-plugin/common';
import { IDataStreamsStatsClient } from '@kbn/dataset-quality-plugin/public';
import { IngestPathwaysContext } from '../ingest_pathways_state_machine';
import { DataStream } from '../types';

export const loadDataStreams =
  ({
    dataStreamsStatsClient,
    search,
  }: {
    dataStreamsStatsClient: IDataStreamsStatsClient;
    search: ISearchGeneric;
  }) =>
  async ({
    parameters: { dataStreamPattern, timeRange },
  }: IngestPathwaysContext): Promise<DataStream[]> => {};
