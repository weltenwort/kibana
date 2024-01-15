/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IngestPathwaysData } from './types';

export const INDEX_MANAGEMENT_PREFIX = '/api/index_management';
export const INGEST_PIPELINES_PREFIX = '/api/ingest_pipelines';

export const mergeIngestPathwaysData = (
  firstData: IngestPathwaysData,
  secondData: Partial<IngestPathwaysData>
): IngestPathwaysData => ({
  agents: { ...firstData.agents, ...(secondData.agents ?? {}) },
  dataStreams: { ...firstData.dataStreams, ...(secondData.dataStreams ?? {}) },
  indexTemplates: { ...firstData.indexTemplates, ...(secondData.indexTemplates ?? {}) },
  ingestPipelines: { ...firstData.ingestPipelines, ...(secondData.ingestPipelines ?? {}) },
});
