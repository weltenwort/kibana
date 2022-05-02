/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiButton } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useActor } from '@xstate/react';
import React from 'react';
import { LogsPageTemplate } from '../page_template';
import { LogStreamPageStateMachineInterpreter } from './page_providers';
import { TimePickerActor, timePickerModel } from './state_machines/time_picker_machine';

export const LogStreamPageContentStream: React.ComponentType<{
  pageStateMachineInterpreter: LogStreamPageStateMachineInterpreter;
}> = ({ pageStateMachineInterpreter }) => {
  const [state] = useActor(pageStateMachineInterpreter);

  if (!state.matches({ hasLogSource: 'hasIndices' })) {
    return null;
  }

  return (
    <LogsPageTemplate
      pageHeader={{
        pageTitle: streamTitle,
        children: <LogStreamPageToolbar timePickerActor={state.children.timePicker} />,
      }}
    >
      {`${state.toStrings()}`}
    </LogsPageTemplate>
  );
};

const streamTitle = i18n.translate('xpack.infra.logs.streamPageTitle', {
  defaultMessage: 'Stream',
});

const LogStreamPageToolbar: React.ComponentType<{
  timePickerActor: TimePickerActor;
}> = ({ timePickerActor }) => {
  const [state, send] = useActor(timePickerActor);

  return (
    <div>
      <pre>{`${state.toStrings()}`}</pre>
      <EuiButton
        onClick={() =>
          send(timePickerModel.events.CHANGE_TIME_INTERVAL({ start: 'now-2d', end: 'now-1d' }))
        }
      >
        Change time
      </EuiButton>
      <EuiButton
        onClick={() => send(timePickerModel.events.RESET_TIME_INTERVAL())}
        disabled={!state.can('RESET_TIME_INTERVAL')}
      >
        Reset time
      </EuiButton>
    </div>
  );
};

// const useChildActor = (state: State, childId: string) => {
//   return useActor(state.children[childId]);
// };
