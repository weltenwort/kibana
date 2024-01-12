/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElementDefinition } from 'cytoscape';
import {
  Agent,
  DataStreamEntry,
  IndexTemplate,
  IngestPathwaysData,
  IngestPipelineEntry,
} from '../types';

export const calculateGraph = ({
  agents,
  dataStreams,
  indexTemplates,
  ingestPipelines,
}: IngestPathwaysData): { elements: ElementDefinition[] } => {
  const dataStreamElements = Object.values(dataStreams).flatMap(convertDataStreamToGraphElements);
  const agentElements = Object.values(agents).flatMap(
    convertAgentToGraphElements({ dataStreams, indexTemplates })
  );
  const ingestPipelineElements = Object.values(ingestPipelines).flatMap(
    convertIngestPipelineToGraphElements
  );

  return {
    elements: [...dataStreamElements, ...agentElements, ...ingestPipelineElements],
  };
};

const convertDataStreamToGraphElements = (dataStream: DataStreamEntry): ElementDefinition[] => [
  {
    group: 'nodes',
    classes: 'dataStream',
    data: {
      id: getDataStreamElementId(dataStream),
      dataStream,
    },
  },
];

const convertAgentToGraphElements =
  ({
    dataStreams,
    indexTemplates,
  }: {
    dataStreams: Record<string, DataStreamEntry>;
    indexTemplates: Record<string, IndexTemplate>;
  }) =>
  (agent: Agent): ElementDefinition[] =>
    [
      {
        group: 'nodes',
        classes: 'agent',
        data: {
          id: getAgentElementId(agent),
          agent,
        },
      },
      ...agent.shipsTo.flatMap((shipsTo): ElementDefinition[] => {
        const dataStream = dataStreams[shipsTo.dataStreamId];
        const source = getAgentElementId(agent);
        const target = getDataStreamElementId({
          type: 'dataStreamStub',
          id: shipsTo.dataStreamId,
        });
        const agentDataStreamEdge: ElementDefinition = {
          group: 'edges',
          classes: 'shipsTo agentShipsTo',
          data: {
            id: `relation-${source}-ships-to-${target}`,
            source,
            target,
            agent,
            shipsTo,
          },
        };

        if (dataStream.type === 'dataStream') {
          const indexTemplate = indexTemplates[dataStream.indexTemplateId];

          return indexTemplate.ingestPipelineIds.reduce<ElementDefinition[]>(
            (edges, ingestPipelineId, ingestPipelineIndex, ingestPipelineIds) => {
              const lastEdge = edges[edges.length - 1];
              const leadingEdges = edges.slice(0, -1);

              const ingestPipelineElementId = getIngestPipelineElementId({
                type: 'ingestPipelineStub',
                id: ingestPipelineId,
              });

              const splitEdges: ElementDefinition[] = [
                {
                  group: 'edges',
                  classes: lastEdge.classes,
                  data: {
                    id: `relation-${lastEdge.data.source}-ships-to-${ingestPipelineElementId}`,
                    source: lastEdge.data.source,
                    target: ingestPipelineElementId,
                    shipsTo: lastEdge.data.shipsTo,
                    agent,
                  },
                },
                {
                  group: 'edges',
                  classes: 'shipsTo',
                  data: {
                    id: `relation-${ingestPipelineElementId}-ships-to-${lastEdge.data.target}`,
                    source: ingestPipelineElementId,
                    target: lastEdge.data.target,
                    shipsTo: {},
                    agent,
                  },
                },
              ];

              return [...leadingEdges, ...splitEdges];
            },
            [agentDataStreamEdge]
          );
        } else {
          return [agentDataStreamEdge];
        }
      }),
    ];

const convertIngestPipelineToGraphElements = (
  ingestPipeline: IngestPipelineEntry
): ElementDefinition[] => [
  {
    group: 'nodes',
    classes: 'ingestPipeline',
    data: {
      id: getIngestPipelineElementId(ingestPipeline),
      ingestPipeline,
    },
  },
];

const getDataStreamElementId = ({ id }: DataStreamEntry) => `dataStream-${id}`;

const getAgentElementId = ({ id }: Agent) => `agent-${id}`;

const getIngestPipelineElementId = ({ id }: IngestPipelineEntry) => `ingestPipeline-${id}`;
