/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import React from 'react';
import { LogsPageTemplate } from '../page_template';

export const LogStreamPageContentMissingIndices = () => {
  return (
    <LogsPageTemplate
      hasData={false}
      pageHeader={{
        pageTitle: streamTitle,
      }}
    />
  );
};

const streamTitle = i18n.translate('xpack.infra.logs.streamPageTitle', {
  defaultMessage: 'Stream',
});
