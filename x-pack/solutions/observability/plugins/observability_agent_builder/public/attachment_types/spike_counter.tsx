/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { i18n } from '@kbn/i18n';
import { EuiPanel, EuiText } from '@elastic/eui';
import type { HttpStart } from '@kbn/core/public';
import type { AttachmentUIDefinition } from '@kbn/agent-builder-browser';
import { ActionButtonType } from '@kbn/agent-builder-browser/attachments';
import type { Attachment } from '@kbn/agent-builder-common/attachments';

export interface SpikeCounterAttachmentData {
  count: number;
  label: string;
  attachmentLabel?: string;
}

type SpikeCounterAttachment = Attachment<string, SpikeCounterAttachmentData>;

const AGENT_BUILDER_PUBLIC_API_PATH = '/api/agent_builder';

/**
 * `AttachmentRenderProps` / `GetActionButtonsParams` do not carry the conversation id,
 * so the spike reads it back off the URL. See observability-dev#6064.
 */
const getConversationIdFromUrl = (): string | undefined => {
  const match = /\/conversations\/([^/?#]+)/.exec(window.location.pathname);
  return match?.[1];
};

/** Lets the button handler tell mounted renderers to re-fetch after a write. */
const mutationListeners = new Set<() => void>();
const notifyMutation = () => mutationListeners.forEach((fn) => fn());

interface LiveVersion {
  count: number;
  version: number;
}

/**
 * Reads the attachment straight from the conversation API, bypassing the round-pinned
 * `props.attachment`. Tests whether a renderer can see current content at all.
 */
const useLiveVersion = (http: HttpStart, attachmentId: string): LiveVersion | undefined => {
  const [live, setLive] = useState<LiveVersion | undefined>();

  const refetch = useCallback(async () => {
    const conversationId = getConversationIdFromUrl();
    if (!conversationId) {
      return;
    }
    const conversation = await http.get<{
      attachments?: Array<{ id: string; versions: Array<{ version: number; data: unknown }> }>;
    }>(`${AGENT_BUILDER_PUBLIC_API_PATH}/conversations/${conversationId}`);
    const latest = conversation.attachments?.find((a) => a.id === attachmentId)?.versions.at(-1);
    if (latest) {
      setLive({
        count: (latest.data as SpikeCounterAttachmentData).count,
        version: latest.version,
      });
    }
  }, [http, attachmentId]);

  useEffect(() => {
    refetch();
    mutationListeners.add(refetch);
    return () => {
      mutationListeners.delete(refetch);
    };
  }, [refetch]);

  return live;
};

const SpikeCounterContent = ({
  attachment,
  http,
}: {
  attachment: SpikeCounterAttachment;
  http: HttpStart;
}) => {
  const { count, label } = attachment.data;
  const { version, versionCount } = attachment.versionData ?? {};
  const live = useLiveVersion(http, attachment.id);

  return (
    <EuiPanel hasShadow={false} hasBorder={false} paddingSize="m">
      {/* Inline attachments render inside a markdown <p>, so no block elements here. */}
      <EuiText size="s">
        <span>
          {label}{' '}
          {i18n.translate(
            'xpack.observabilityAgentBuilder.spikeCounterContent.span.PinnedCountLabel',
            { defaultMessage: '— pinned count' }
          )}
          <strong>{count}</strong>{' '}
          {i18n.translate('xpack.observabilityAgentBuilder.spikeCounterContent.span.vLabel', {
            defaultMessage: '(v',
          })}
          {version}{' '}
          {i18n.translate('xpack.observabilityAgentBuilder.spikeCounterContent.span.ofLabel', {
            defaultMessage: 'of',
          })}
          {versionCount}
          {i18n.translate(
            'xpack.observabilityAgentBuilder.spikeCounterContent.span.LiveCountLabel',
            { defaultMessage: ') — live count' }
          )}{' '}
          <strong>{live ? live.count : '…'}</strong>{' '}
          {i18n.translate('xpack.observabilityAgentBuilder.spikeCounterContent.span.vLabel', {
            defaultMessage: '(v',
          })}
          {live ? live.version : '…'})
        </span>
      </EuiText>
    </EuiPanel>
  );
};

export const createSpikeCounterUiDefinition = ({
  http,
}: {
  http: HttpStart;
}): AttachmentUIDefinition<SpikeCounterAttachment> => ({
  getLabel: (attachment) => attachment.data?.attachmentLabel ?? 'Spike counter',
  getIcon: () => 'number',
  renderInlineContent: (props) => <SpikeCounterContent attachment={props.attachment} http={http} />,
  getActionButtons: ({ attachment, updateOrigin }) => {
    const conversationId = getConversationIdFromUrl();
    const { label } = attachment.data;

    const increment = async () => {
      if (!conversationId) {
        // eslint-disable-next-line no-console
        console.warn('[spike_counter] no conversation id in URL, cannot PUT');
        return;
      }

      const startedAt = performance.now();
      // Read-modify-write against current content; the pinned props are stale by design.
      const conversation = await http.get<{
        attachments?: Array<{ id: string; versions: Array<{ version: number; data: unknown }> }>;
      }>(`${AGENT_BUILDER_PUBLIC_API_PATH}/conversations/${conversationId}`);
      const latest = conversation.attachments?.find((a) => a.id === attachment.id)?.versions.at(-1);
      const currentCount = (latest?.data as SpikeCounterAttachmentData | undefined)?.count ?? 0;

      const response = await http.put<{ new_version: number }>(
        `${AGENT_BUILDER_PUBLIC_API_PATH}/conversations/${conversationId}/attachments/${attachment.id}`,
        {
          body: JSON.stringify({ data: { count: currentCount + 1, label } }),
        }
      );
      notifyMutation();
      // eslint-disable-next-line no-console
      console.log('[spike_counter] PUT roundtrip', {
        ms: performance.now() - startedAt,
        newVersion: response.new_version,
        pinnedVersion: attachment.versionData?.version,
      });
    };

    return [
      {
        label: 'Increment',
        icon: 'plusInCircle',
        type: ActionButtonType.PRIMARY,
        handler: increment,
      },
      {
        label: 'Increment + invalidate',
        icon: 'refresh',
        type: ActionButtonType.SECONDARY,
        handler: async () => {
          await increment();
          // `updateOrigin` is the only client path that calls `invalidateConversation()`.
          await updateOrigin(attachment.origin ?? `spike-counter-${attachment.id}`);
        },
      },
    ];
  },
});
