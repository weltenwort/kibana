/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiCode, EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import React from 'react';
import styled from '@emotion/styled';

import { EMPTY_PLACEHOLDER } from '../../../../../constants';
import { codeDangerCss } from '../../../../../styles';
import type { UnallowedValueCount } from '../../../../../types';

const IndexInvalidValueFlexItem = styled(EuiFlexItem)`
  margin-bottom: ${({ theme }) => theme.euiTheme.size.xs};
`;

interface Props {
  indexInvalidValues: UnallowedValueCount[];
}

const IndexInvalidValuesComponent: React.FC<Props> = ({ indexInvalidValues }) =>
  indexInvalidValues.length === 0 ? (
    <EuiCode data-test-subj="emptyPlaceholder">{EMPTY_PLACEHOLDER}</EuiCode>
  ) : (
    <EuiFlexGroup data-test-subj="indexInvalidValues" direction="column" gutterSize="none">
      {indexInvalidValues.map(({ fieldName, count }, i) => (
        <IndexInvalidValueFlexItem grow={false} key={`${fieldName}_${i}`}>
          <div>
            <EuiCode css={codeDangerCss}>{fieldName}</EuiCode>{' '}
            <span>
              {'('}
              {count}
              {')'}
            </span>
          </div>
        </IndexInvalidValueFlexItem>
      ))}
    </EuiFlexGroup>
  );

IndexInvalidValuesComponent.displayName = 'IndexInvalidValuesComponent';

export const IndexInvalidValues = React.memo(IndexInvalidValuesComponent);
