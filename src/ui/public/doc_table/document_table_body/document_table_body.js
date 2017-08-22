import PropTypes from 'prop-types';
import React from 'react';

import {
  DocumentTableBodyRow,
  DocumentTableDetailRow,
} from '..';


export function DocumentTableBody({ actions, columns, rows }) {
  return (
    <tbody>
      { rows.map((row) => [
        <DocumentTableBodyRow
          actions={actions}
          columns={columns}
          key={`row-${row.id}`}
          row={row}
        />,
        ...(row.isExpanded
          ? [
            <DocumentTableDetailRow
              actions={actions}
              columns={columns}
              key={`detail-row-${row.id}`}
              row={row}
            />
          ]
          : []
        ),
      ]) }
    </tbody>
  );
}

DocumentTableBody.propTypes = {
  actions: PropTypes.objectOf(PropTypes.func),
  columns: PropTypes.arrayOf(PropTypes.object),
  rows: PropTypes.arrayOf(PropTypes.object),
};
