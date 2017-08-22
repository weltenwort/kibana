import PropTypes from 'prop-types';
import React from 'react';

import {
  DocumentTable,
  DocumentTableHeader,
  DocumentTableBody,
} from 'ui/doc_table';


export function DiscoverDocumentTable({ actions, columns, rows }) {
  return (
    <DocumentTable>
      <DocumentTableHeader
        actions={actions}
        columns={columns}
      />
      <DocumentTableBody
        actions={actions}
        columns={columns}
        rows={rows}
      />
    </DocumentTable>
  );
}

DiscoverDocumentTable.propTypes = {
  actions: PropTypes.objectOf(PropTypes.func),
  columns: PropTypes.arrayOf(PropTypes.object),
  rows: PropTypes.arrayOf(PropTypes.object),
};
