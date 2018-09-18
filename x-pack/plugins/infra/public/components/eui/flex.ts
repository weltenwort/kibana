/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { CommonProps, EuiFlexGroup, EuiFlexGroupProps } from '@elastic/eui';
import React, { HTMLAttributes } from 'react';

interface LocalEuiFlexGroupProps extends EuiFlexGroupProps {
  direction?: 'row' | 'column';
}

export const LocalEuiFlexGroup: React.SFC<
  CommonProps & HTMLAttributes<HTMLDivElement | HTMLSpanElement> & LocalEuiFlexGroupProps
> = EuiFlexGroup;
