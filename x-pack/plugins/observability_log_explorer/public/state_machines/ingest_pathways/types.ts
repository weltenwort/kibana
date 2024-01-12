/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export interface IngestPathwaysParameters {
  timeRange: TimeRange;
  dataStreamPattern: string;
}

export interface IngestPathwaysData {
  dataStreams: Record<string, DataStreamEntry>;
  agents: Record<string, Agent>;
  indexTemplates: Record<string, IndexTemplate>;
  ingestPipelines: Record<string, IngestPipelineEntry>;
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface DataStreamStub {
  type: 'dataStreamStub';
  id: string;
}

export interface DataStream {
  type: 'dataStream';
  id: string;
  indexTemplateId: string;
}

export type DataStreamEntry = DataStream | DataStreamStub;

export interface IndexTemplate {
  id: string;
  ingestPipelineIds: string[];
}

export interface IngestPipelineStub {
  type: 'ingestPipelineStub';
  id: string;
}

export interface IngestPipeline {
  type: 'ingestPipeline';
  id: string;
}

export type IngestPipelineEntry = IngestPipeline | IngestPipelineStub;

export interface Agent {
  id: string;
  type: string;
  name: string;
  version: string;
  shipsTo: Array<{
    dataStreamId: string;
    signalCount: number;
  }>;
}
