/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElementDefinition } from 'cytoscape';
import { Agent, DataStream, IngestPathwaysData, Relation } from '../types';

export const calculateGraph = ({
  agents,
  dataStreams,
  relations,
}: IngestPathwaysData): { elements: ElementDefinition[] } => {
  const dataStreamElements = Object.values(dataStreams).flatMap(convertDataStreamToGraphElements);
  const agentElements = Object.values(agents).flatMap(convertAgentToGraphElements);
  const relationElements = relations.flatMap(
    convertRelationToGraphElements({ agents, dataStreams })
  );

  return {
    elements: [...dataStreamElements, ...agentElements, ...relationElements],
  };
};

const convertDataStreamToGraphElements = (dataStream: DataStream): ElementDefinition[] => [
  {
    group: 'nodes',
    classes: 'dataStream',
    data: {
      id: getDataStreamElementId(dataStream),
      dataStream,
    },
  },
];

const convertAgentToGraphElements = (agent: Agent): ElementDefinition[] => [
  {
    group: 'nodes',
    classes: 'agent',
    data: {
      id: getAgentElementId(agent),
      agent,
    },
  },
];

const convertRelationToGraphElements =
  ({
    agents,
    dataStreams,
  }: {
    agents: Record<string, Agent>;
    dataStreams: Record<string, DataStream>;
  }) =>
  (relation: Relation): ElementDefinition[] => {
    if (relation.type === 'agent-ships-to-data-stream') {
      const agent = agents[relation.agentId];
      const dataStream = dataStreams[relation.dataStreamId];

      return [
        {
          group: 'edges',
          classes: 'agentShipsTo',
          data: {
            id: `relation-agent-${relation.agentId}-ships-to-dataStream-${relation.dataStreamId}`,
            source: getAgentElementId(agent),
            target: getDataStreamElementId(dataStream),
            relation,
            agent,
            dataStream,
          },
        },
      ];
    } else {
      return [];
    }
  };

const getDataStreamElementId = ({ id }: DataStream) => `dataStream-${id}`;

const getAgentElementId = ({ id }: Agent) => `agent-${id}`;
