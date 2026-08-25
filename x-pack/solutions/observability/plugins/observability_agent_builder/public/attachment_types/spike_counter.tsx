/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiPanel, EuiText } from '@elastic/eui';
import type { AttachmentUIDefinition } from '@kbn/agent-builder-browser';
import { ActionButtonType } from '@kbn/agent-builder-browser/attachments';
import type { Attachment } from '@kbn/agent-builder-common/attachments';

export interface SpikeCounterAttachmentData {
  count: number;
  label: string;
  attachmentLabel?: string;
}

type SpikeCounterAttachment = Attachment<string, SpikeCounterAttachmentData>;

const SpikeCounterContent = ({ attachment }: { attachment: SpikeCounterAttachment }) => {
  const { count, label } = attachment.data;
  const { version, versionCount } = attachment.versionData ?? {};

  return (
    <EuiPanel hasShadow={false} hasBorder={false} paddingSize="m">
      {/* Inline attachments render inside a markdown <p>, so no block elements here. */}
      <EuiText size="s">
        <span>
          {label} count <strong>{count}</strong> (rendered v{version} of {versionCount})
        </span>
      </EuiText>
    </EuiPanel>
  );
};

export const createSpikeCounterUiDefinition =
  (): AttachmentUIDefinition<SpikeCounterAttachment> => ({
    getLabel: (attachment) => attachment.data?.attachmentLabel ?? 'Spike counter',
    getIcon: () => 'number',
    renderInlineContent: (props) => <SpikeCounterContent attachment={props.attachment} />,
    getActionButtons: ({ attachment, updateContent }) => [
      {
        label: 'Increment',
        icon: 'plusInCircle',
        type: ActionButtonType.PRIMARY,
        handler: async () => {
          const startedAt = performance.now();
          await updateContent?.({ ...attachment.data, count: attachment.data.count + 1 });
          // eslint-disable-next-line no-console
          console.log('[spike_counter] updateContent roundtrip', {
            ms: performance.now() - startedAt,
            from: attachment.data.count,
            renderedVersion: attachment.versionData?.version,
          });
        },
      },
    ],
  });
