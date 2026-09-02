/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EuiCallOut, EuiFlexGroup, EuiFlexItem, EuiSpacer } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { ChartsPluginStart } from '@kbn/charts-plugin/public';
import type { Attachment } from '@kbn/agent-builder-common/attachments';
import { ActionButtonType, type ActionButton } from '@kbn/agent-builder-browser/attachments';
import type { LogExplorationData } from '../../../common/log_exploration';
import { logExplorationDataSchema } from '../../../common/log_exploration';
import { useLogExplorationState } from './use_log_exploration_state';
import { ExplorationControls } from './exploration_controls';
import { PatternTable } from './pattern_table';
import { BaselineHistogram } from './baseline_histogram';

export interface LogExplorationAttachmentProps {
  attachment: Attachment<string, unknown>;
  charts: ChartsPluginStart;
  updateContent?: (data: unknown, description?: string) => Promise<void>;
  submitMessage?: (message: string) => void;
  registerActionButtons?: (buttons: ActionButton[]) => void;
}

export const LogExplorationAttachment: React.FC<LogExplorationAttachmentProps> = ({
  attachment,
  charts,
  updateContent,
  submitMessage,
  registerActionButtons,
}) => {
  const parsed = useMemo(
    () => logExplorationDataSchema.safeParse(attachment.data),
    [attachment.data]
  );
  const [persistError, setPersistError] = useState<string | null>(null);

  // Rounds pin their own version, so an older round renders stale data. Writing from it would derive
  // a payload from that stale base and clobber everything since, so writes are disabled. Agent-turn
  // actions stay available: they only send a prompt, and the agent reads live state.
  const { version, versionCount } = attachment.versionData ?? {};
  const isReadOnly = version !== undefined && versionCount !== undefined && version < versionCount;

  const onPersistError = useCallback((error: Error) => setPersistError(error.message), []);

  const { data, dispatch, flushPendingWrites } = useLogExplorationState({
    initialData: (parsed.success ? parsed.data : EMPTY_DATA) as LogExplorationData,
    updateContent,
    onPersistError,
  });

  const startTurn = useCallback(
    async (message: string) => {
      // The turn remounts this subtree from server state, so pending writes must land first.
      await flushPendingWrites();
      submitMessage?.(message);
    },
    [flushPendingWrites, submitMessage]
  );

  useEffect(() => {
    if (!registerActionButtons || !submitMessage) {
      return;
    }
    registerActionButtons([
      {
        label: i18n.translate('xpack.observabilityAgentBuilder.logExploration.summarizeLabel', {
          defaultMessage: 'Summarize remaining patterns',
        }),
        icon: 'sparkles',
        type: ActionButtonType.PRIMARY,
        handler: () =>
          startTurn('Summarize the remaining un-muted log patterns with their current counts.'),
      },
    ]);
    // Re-register on every state change so the handler closes over current state, not stale state.
  }, [registerActionButtons, submitMessage, startTurn, data]);

  const onInvestigate = useCallback(
    (pattern: string) => startTurn(`Investigate why the log pattern "${pattern}" is occurring.`),
    [startTurn]
  );

  if (!parsed.success) {
    return (
      <EuiCallOut
        announceOnMount
        color="danger"
        iconType="error"
        size="s"
        title={i18n.translate('xpack.observabilityAgentBuilder.logExploration.invalidPayload', {
          defaultMessage: 'This log exploration view could not be rendered',
        })}
      >
        {parsed.error.message}
      </EuiCallOut>
    );
  }

  return (
    <EuiFlexGroup direction="column" gutterSize="s" css={{ padding: 12 }}>
      <EuiFlexItem grow={false}>
        <ExplorationControls data={data} dispatch={dispatch} isReadOnly={isReadOnly} />
      </EuiFlexItem>
      {persistError && (
        <EuiFlexItem grow={false}>
          <EuiCallOut
            announceOnMount
            color="warning"
            size="s"
            title={i18n.translate('xpack.observabilityAgentBuilder.logExploration.persistFailed', {
              defaultMessage: 'Could not save that change. The view has been reverted.',
            })}
          />
        </EuiFlexItem>
      )}
      <EuiFlexItem grow={false}>
        {data.type === 'pattern-table' ? (
          <PatternTable
            data={data}
            dispatch={dispatch}
            charts={charts}
            onInvestigate={onInvestigate}
            isReadOnly={isReadOnly}
          />
        ) : (
          <BaselineHistogram
            data={data}
            dispatch={dispatch}
            charts={charts}
            isReadOnly={isReadOnly}
          />
        )}
      </EuiFlexItem>
      <EuiSpacer size="xs" />
    </EuiFlexGroup>
  );
};

const EMPTY_DATA: LogExplorationData = {
  type: 'pattern-table',
  index: '',
  messageField: 'message',
  timeRange: { start: 'now-1h', end: 'now' },
  mutedPatterns: [],
  patterns: [],
  generatedAt: '',
};
