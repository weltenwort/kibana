/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { i18n } from '@kbn/i18n';
import type { HttpStart } from '@kbn/core/public';
import type { AttachmentServiceStartContract } from '@kbn/agent-builder-browser';
import type { ChartsPluginStart } from '@kbn/charts-plugin/public';
import type { Attachment } from '@kbn/agent-builder-common/attachments';
import { OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID } from '../../../common/constants';
import { LogExplorationAttachment } from './log_exploration_attachment';
import { createFetchLogExplorationView } from './fetch_log_exploration_view';

type LogExplorationUnknownAttachment = Attachment<string, unknown>;

export const registerLogExplorationAttachmentType = ({
  attachments,
  charts,
  http,
}: {
  attachments: AttachmentServiceStartContract;
  charts: ChartsPluginStart;
  http: HttpStart;
}) => {
  const fetchView = createFetchLogExplorationView(http);

  attachments.addAttachmentType<LogExplorationUnknownAttachment>(
    OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID,
    {
      getLabel: () =>
        i18n.translate('xpack.observabilityAgentBuilder.attachments.logExploration.label', {
          defaultMessage: 'Log exploration',
        }),
      getIcon: () => 'pattern',
      getHeader: ({ attachment }) => {
        const { version, versionCount } = attachment.versionData ?? {};
        const isSuperseded =
          version !== undefined && versionCount !== undefined && version < versionCount;
        return {
          badges: isSuperseded
            ? [
                {
                  label: i18n.translate(
                    'xpack.observabilityAgentBuilder.attachments.logExploration.supersededBadge',
                    { defaultMessage: 'Superseded' }
                  ),
                  color: 'hollow',
                  iconType: 'clock',
                },
              ]
            : undefined,
        };
      },
      renderInlineContent: (props, callbacks) => (
        <LogExplorationAttachment
          attachment={props.attachment}
          charts={charts}
          fetchView={fetchView}
          updateContent={callbacks?.updateContent}
          submitMessage={callbacks?.submitMessage}
          registerActionButtons={callbacks?.registerActionButtons}
        />
      ),
    }
  );
};
