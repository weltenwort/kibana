/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { css } from '@emotion/react';
import { useActor } from '@xstate/react';
import cytoscape, { CytoscapeOptions, EdgeSingular, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import React, { useEffect, useState } from 'react';
import { Agent, useIngestPathwaysPageStateContext } from '../../state_machines/ingest_pathways';

export const ConnectedGraphVisualization = React.memo(() => {
  const [state] = useActor(useIngestPathwaysPageStateContext());

  return <GraphVisualization graphOptions={state.context.graph} />;
});

export const GraphVisualization = React.memo(
  ({ graphOptions }: { graphOptions: CytoscapeOptions }) => {
    const [cytoscapeInstance] = useState(() => {
      cytoscape.use(dagre);
      const newCytoscapeInstance = cytoscape(initialGraphOptions);
      return newCytoscapeInstance;
    });

    useEffect(() => {
      cytoscapeInstance.json(graphOptions);
      cytoscapeInstance.layout(initialGraphOptions.layout!).run();
    }, [cytoscapeInstance, graphOptions]);

    return (
      <div
        css={graphStyles}
        ref={(elem) => {
          if (elem != null) {
            cytoscapeInstance.mount(elem);
          } else {
            cytoscapeInstance.unmount();
          }
        }}
      />
    );
  }
);

const initialGraphOptions: CytoscapeOptions & { layout: Record<string, any> } = {
  elements: [],
  style: [
    {
      selector: '*',
      style: {
        'font-size': '12px',
      },
    },
    {
      selector: 'node.agent',
      style: {
        label: (elem: NodeSingular) => {
          const agent = elem.data('agent');
          return `${agent.name}\n${agent.type} ${agent.version}`;
        },
        'text-wrap': 'wrap',
        shape: 'ellipse',
        'text-valign': 'center',
        'text-halign': 'left',
      },
    },
    {
      selector: 'node.dataStream',
      style: {
        label: 'data(dataStream.id)',
        shape: 'hexagon',
        'text-valign': 'center',
        'text-halign': 'right',
      },
    },
    {
      selector: 'node.ingestPipeline',
      style: {
        label: 'data(ingestPipeline.id)',
        shape: 'diamond',
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1,
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge.shipsTo',
      style: {
        'target-arrow-shape': 'chevron',
        'target-arrow-fill': 'filled',
      },
    },
    {
      selector: 'edge.agentShipsTo',
      style: {
        // label: 'data(shipsTo.signalCount)',
        width: (edge: EdgeSingular) => {
          const agent: Agent = edge.data('agent');
          const totalSignalCount = agent.shipsTo.reduce(
            (accumulatedSignalCount, { signalCount }) => accumulatedSignalCount + signalCount,
            0
          );
          return 1 + (9.0 / totalSignalCount) * edge.data('shipsTo').signalCount;
        },
      },
    },
  ],
  layout: {
    name: 'dagre',
    rankDir: 'LR',
    rankSep: 300,
    nodeSep: 30,
    ranker: 'longest-path',
  },
};

const graphStyles = css({
  flex: '1 0 0%',
  alignSelf: 'stretch',
});
