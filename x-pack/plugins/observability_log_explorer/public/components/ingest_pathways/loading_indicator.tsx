/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiBadge } from '@elastic/eui';
import { useActor } from '@xstate/react';
import React from 'react';
import { useIngestPathwaysPageStateContext } from '../../state_machines/ingest_pathways';

export const ConnectedLoadingIndicator = React.memo(() => {
  const [state] = useActor(useIngestPathwaysPageStateContext());

  return <EuiBadge color="hollow">{`${state.value}`}</EuiBadge>;
});
