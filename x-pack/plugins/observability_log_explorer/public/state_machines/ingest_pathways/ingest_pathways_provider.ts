/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getDevToolsOptions } from '@kbn/xstate-utils';
import { useInterpret } from '@xstate/react';
import createContainer from 'constate';
import {
  createIngestPathwaysStateMachine,
  IngestPathwaysStateMachineDependencies,
} from './ingest_pathways_state_machine';

export const useIngestPathwaysPageState = (deps: IngestPathwaysStateMachineDependencies) => {
  const ingestPathwaysPageStateService = useInterpret(
    () => createIngestPathwaysStateMachine(deps),
    { devTools: getDevToolsOptions() }
  );

  return ingestPathwaysPageStateService;
};

export const [IngestPathwaysPageStateProvider, useIngestPathwaysPageStateContext] = createContainer(
  useIngestPathwaysPageState
);
