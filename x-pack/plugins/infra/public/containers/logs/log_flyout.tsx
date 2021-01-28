/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import createContainer from 'constate';
import * as rt from 'io-ts';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  createKbnUrlStateStorage,
  createStateContainer,
  syncState,
} from '../../../../../../src/plugins/kibana_utils/public';
import { decodeOrThrow } from '../../../common/runtime_types';

export enum FlyoutVisibility {
  hidden = 'hidden',
  visible = 'visible',
}

const logEntryFlyoutStateRT = rt.type({
  logEntry: rt.union([
    rt.intersection([
      rt.type({
        id: rt.string,
        index: rt.string,
      }),
      rt.partial({
        focus: rt.boolean,
      }),
    ]),
    rt.null,
  ]),
});
export type LogEntryFlyoutState = rt.TypeOf<typeof logEntryFlyoutStateRT>;

const initialLogEntryFlyoutState: LogEntryFlyoutState = {
  logEntry: null,
};

export const useLogFlyout = () => {
  const [stateContainer] = useState(() =>
    createStateContainer(
      initialLogEntryFlyoutState,
      {
        openFlyout: (state: LogEntryFlyoutState) => (
          index: string,
          logEntryId: string,
          focus: boolean = false
        ) => ({
          ...state,
          logEntry: {
            focus,
            id: logEntryId,
            index,
          },
        }),
        closeFlyout: (state: LogEntryFlyoutState) => () => ({ ...state, logEntry: null }),
      },
      {
        isFlyoutOpen: (state: LogEntryFlyoutState) => () => state.logEntry != null,
        logEntryId: (state: LogEntryFlyoutState) => () => state.logEntry?.id,
        index: (state: LogEntryFlyoutState) => () => state.logEntry?.index,
        focus: (state: LogEntryFlyoutState) => () => state.logEntry?.focus,
      }
    )
  );
  const { selectors, transitions } = stateContainer;

  const history = useHistory();

  useEffect(() => {
    const { start, stop } = syncState({
      storageKey: 'logEntryFlyout',
      stateContainer: {
        ...stateContainer,
        set: (newState) => {
          try {
            stateContainer.set(decodeOrThrow(logEntryFlyoutStateRT)(newState));
          } catch {
            stateContainer.transitions.closeFlyout();
          }
        },
      },
      stateStorage: createKbnUrlStateStorage({ history, useHash: false }),
    });

    start();

    return stop;
  }, [history, stateContainer]);

  return {
    isFlyoutOpen: selectors.isFlyoutOpen(),
    closeFlyout: transitions.closeFlyout,
    openFlyout: transitions.openFlyout,
    logEntryId: selectors.logEntryId(),
    index: selectors.index(),
    focus: selectors.focus(),
  };
};

export const [LogEntryFlyoutProvider, useLogEntryFlyoutContext] = createContainer(useLogFlyout);

// export const WithFlyoutOptionsUrlState = () => {
//   const {
//     isFlyoutOpen,
//     openFlyout,
//     closeFlyout,
//     logEntryId,
//     setLogEntryId,
//     surroundingLogsId,
//     setSurroundingLogsId,
//   } = useLogEntryFlyoutContext();

//   return (
//     <UrlStateContainer
//       urlState={{
//         flyoutVisibility: isFlyoutOpen ? FlyoutVisibility.visible : FlyoutVisibility.hidden,
//         logEntryId,
//         surroundingLogsId,
//       }}
//       urlStateKey="flyoutOptions"
//       mapToUrlState={mapToUrlState}
//       onChange={(newUrlState) => {
//         if (newUrlState && newUrlState.logEntryId) {
//           setLogEntryId(newUrlState.logEntryId);
//         }
//         if (newUrlState && newUrlState.surroundingLogsId) {
//           setSurroundingLogsId(newUrlState.surroundingLogsId);
//         }
//         if (newUrlState && newUrlState.flyoutVisibility === FlyoutVisibility.visible) {
//           openFlyout();
//         }
//         if (newUrlState && newUrlState.flyoutVisibility === FlyoutVisibility.hidden) {
//           closeFlyout();
//         }
//       }}
//       onInitialize={(initialUrlState) => {
//         if (initialUrlState && initialUrlState.logEntryId) {
//           setLogEntryId(initialUrlState.logEntryId);
//         }
//         if (initialUrlState && initialUrlState.surroundingLogsId) {
//           setSurroundingLogsId(initialUrlState.surroundingLogsId);
//         }
//         if (initialUrlState && initialUrlState.flyoutVisibility === FlyoutVisibility.visible) {
//           openFlyout();
//         }
//         if (initialUrlState && initialUrlState.flyoutVisibility === FlyoutVisibility.hidden) {
//           closeFlyout();
//         }
//       }}
//     />
//   );
// };

// const mapToUrlState = (value: any): LogEntryFlyoutState | undefined =>
//   value
//     ? {
//         logEntryId: mapToFlyoutIdState(value.flyoutId),
//         flyoutVisibility: mapToFlyoutVisibilityState(value.flyoutVisibility),
//         surroundingLogsId: mapToSurroundingLogsIdState(value.surroundingLogsId),
//       }
//     : undefined;

// const mapToFlyoutIdState = (subject: any) => {
//   return subject && isString(subject) ? subject : undefined;
// };
// const mapToSurroundingLogsIdState = (subject: any) => {
//   return subject && isString(subject) ? subject : undefined;
// };
// const mapToFlyoutVisibilityState = (subject: any) => {
//   if (subject) {
//     if (subject === 'visible') {
//       return FlyoutVisibility.visible;
//     }
//     if (subject === 'hidden') {
//       return FlyoutVisibility.hidden;
//     }
//   }
// };
