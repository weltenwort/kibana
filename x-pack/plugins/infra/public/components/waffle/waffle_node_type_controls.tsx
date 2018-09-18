/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { EuiButtonEmpty, EuiFormControlLayout } from '@elastic/eui';
import React from 'react';

export class WaffleNodeTypeControls extends React.Component {
  public render() {
    return (
      <EuiFormControlLayout
        append={[
          <EuiButtonEmpty iconType="">One</EuiButtonEmpty>,
          <EuiButtonEmpty>Two</EuiButtonEmpty>,
        ]}
      />
    );
  }
}
