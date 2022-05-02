/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useInterpret } from '@xstate/react';
import constate from 'constate';
import React, { useEffect } from 'react';
import { LogSourceStatus } from '../../../../common/http_api/log_sources';
import { ResolvedLogSourceConfiguration } from '../../../../common/log_sources';
import { useLogSourceContext } from '../../../containers/logs/log_source';
import { logStreamPageModel, logStreamPageStateMachine } from './state_machines/page_state_machine';

/**
 * top-level page provider
 */

export const LogStreamPageProvider: React.FunctionComponent = ({ children }) => {
  const { resolvedSourceConfiguration, sourceStatus } = useLogSourceContext();

  return (
    <LogStreamPageStateProvider
      logSourceConfiguration={resolvedSourceConfiguration}
      logSourceStatus={sourceStatus}
    >
      {children}
    </LogStreamPageStateProvider>
  );
};

/**
 * page state machine provider
 */

export const useLogStreamPageStateMachine = ({
  logSourceConfiguration,
  logSourceStatus,
}: {
  logSourceConfiguration?: ResolvedLogSourceConfiguration;
  logSourceStatus?: LogSourceStatus;
}) => {
  const pageStateMachineInterpreter = useInterpret(logStreamPageStateMachine, {
    devTools: true,
  });

  useEffect(() => {
    if (logSourceConfiguration != null) {
      pageStateMachineInterpreter.send(
        logStreamPageModel.events.RECEIVE_LOG_SOURCE_CONFIGURATION(logSourceConfiguration)
      );
    }
  }, [logSourceConfiguration, pageStateMachineInterpreter]);

  useEffect(() => {
    if (logSourceStatus != null) {
      pageStateMachineInterpreter.send(
        logStreamPageModel.events.RECEIVE_LOG_SOURCE_STATUS(logSourceStatus)
      );
    }
  }, [logSourceStatus, pageStateMachineInterpreter]);

  return pageStateMachineInterpreter;
};

export type LogStreamPageStateMachineInterpreter = ReturnType<typeof useLogStreamPageStateMachine>;

export const [LogStreamPageStateProvider, useLogStreamPageStateContext] = constate(
  useLogStreamPageStateMachine
);
