/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { css } from '@emotion/react';
import { useActor } from '@xstate/react';
import cytoscape, { CytoscapeOptions } from 'cytoscape';
import React, { useEffect, useState } from 'react';
import { useIngestPathwaysPageStateContext } from '../../state_machines/ingest_pathways';

export const ConnectedGraphVisualization = React.memo(() => {
  const [state] = useActor(useIngestPathwaysPageStateContext());

  return <GraphVisualization graphOptions={state.context.graph} />;
});

export const GraphVisualization = React.memo(
  ({ graphOptions }: { graphOptions: CytoscapeOptions }) => {
    const [cytoscapeInstance] = useState(() => cytoscape(initialGraphOptions));

    useEffect(() => {
      cytoscapeInstance.json(graphOptions);
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

const initialGraphOptions: CytoscapeOptions = {
  elements: [],
  style: [
    {
      selector: 'node',
      style: {
        label: 'data(id)',
      },
    },
  ],
  layout: {
    name: 'random',
  },
};

const graphStyles = css({
  flex: '1 0 0%',
  alignSelf: 'stretch',
});
