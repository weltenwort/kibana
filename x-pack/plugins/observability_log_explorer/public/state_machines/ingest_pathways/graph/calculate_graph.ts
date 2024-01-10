/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElementDefinition } from 'cytoscape';
import { DataStream, IngestPathwaysData } from '../types';

export const calculateGraph = ({
  dataStreams,
}: IngestPathwaysData): { elements: ElementDefinition[] } => {
  const elements: ElementDefinition[] = Object.values(dataStreams).map((dataStream) => {
    return {
      group: 'nodes',
      data: {
        id: getDataStreamElementId(dataStream),
      },
    };
  });

  return {
    elements,
  };
};

const getDataStreamElementId = ({ id }: DataStream) => `datastream-${id}`;
