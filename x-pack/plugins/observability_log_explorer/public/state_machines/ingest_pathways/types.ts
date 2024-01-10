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
  dataStreams: Record<string, DataStream>;
  agents: Record<string, Agent>;
  relations: Relation[];
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface DataStream {
  id: string;
}

export interface Agent {
  id: string;
}

export type Relation =
  | {
      type: 'agent-ships-to';
      agentId: string;
      dataStreamId: string;
    }
  | {
      type: 'unknown';
    };
