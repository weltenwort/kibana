import PropTypes from 'prop-types';
import React from 'react';

import { KuiButton } from 'ui_framework/components';

import './document_table_detail_row_actions.css';


export function DocumentTableDetailRowActions({ row }) {
  return (
    <div className="documentTable__detailRowActions">
      <KuiButton
        buttonType="secondary"
        className="kuiButton--small"
        data-test-subj="docTableRowAction"
        href={`#/doc/${row.indexPattern.id}/${row.document._index}/${row.document._type}/?id=${row.id}`}
      >
        View single document
      </KuiButton>
    </div>
  );
}

DocumentTableDetailRowActions.propTypes = {
  row: PropTypes.object,
};
