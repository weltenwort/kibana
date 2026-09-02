/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ToolHandlerContext } from '@kbn/agent-builder-server';
import type {
  LogExplorationData,
  LogExplorationLoopState,
  LogExplorationTimeRange,
} from '../../common/log_exploration';
import { OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID } from '../../common';

type Attachments = ToolHandlerContext['attachments'];

export const readCurrentData = (attachments: Attachments): LogExplorationData | undefined => {
  const existing = attachments
    .getActive()
    .find((a) => a.type === OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID);

  if (!existing) {
    return undefined;
  }

  return existing.versions.find((v) => v.version === existing.current_version)
    ?.data as LogExplorationData;
};

/**
 * Loop state belongs to the user, so a tool re-running a query must never reset it.
 */
export const getLoopState = (attachments: Attachments): Partial<LogExplorationLoopState> => {
  const current = readCurrentData(attachments);
  if (!current) {
    return {};
  }
  return {
    mutedPatterns: current.mutedPatterns,
    timeRange: current.timeRange,
    baselineEpoch: current.baselineEpoch,
  };
};

/**
 * Reconciles a range the model asked for against the one the user set in the view.
 *
 * The user's range wins while the model stays silent, but an explicit request must win outright:
 * otherwise the first emitted range is permanent and the agent can never widen a window that
 * returned nothing.
 */
export const resolveRange = (
  requested: { start?: string; end?: string },
  current: LogExplorationTimeRange | undefined,
  fallback: LogExplorationTimeRange
): LogExplorationTimeRange => {
  if (requested.start || requested.end) {
    const base = current ?? fallback;
    return { start: requested.start ?? base.start, end: requested.end ?? base.end };
  }
  return current ?? fallback;
};

/**
 * Emits the single log exploration attachment for the conversation: creates it on the first tool
 * call, updates it in place on every later one so both views share one id and one loop state.
 */
export const emitLogExplorationAttachment = async (
  attachments: Attachments,
  data: LogExplorationData
): Promise<string> => {
  const existing = attachments
    .getActive()
    .find((a) => a.type === OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID);

  const description =
    data.type === 'pattern-table' ? 'Log patterns' : 'Log volume vs. baseline epoch';

  if (existing) {
    await attachments.update(existing.id, { data, description });
    return existing.id;
  }

  const added = await attachments.add({
    type: OBSERVABILITY_LOG_EXPLORATION_ATTACHMENT_TYPE_ID,
    data,
    description,
  });

  return added.id;
};

/**
 * Puts emitted attachment ids on the tool result so the agent can render them with
 * `<render_attachment id="..." />` without the payload passing through the model.
 */
export const injectAttachmentIds = <T extends { results: Array<{ data?: unknown }> }>(
  toolResult: T,
  attachmentIds: string[]
): T => {
  if (attachmentIds.length === 0 || !toolResult.results?.[0]) {
    return toolResult;
  }
  const [first, ...rest] = toolResult.results;
  const existingData = (first.data ?? {}) as Record<string, unknown>;
  return {
    ...toolResult,
    results: [{ ...first, data: { ...existingData, attachment_ids: attachmentIds } }, ...rest],
  };
};
