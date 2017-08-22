import PropTypes from 'prop-types';
import React from 'react';

import { DocumentViewer } from 'ui/doc_viewer';
import { DocumentTableDetailRowActions } from '..';


export class DocumentTableDetailRow extends React.PureComponent {
  render() {
    const { columns, row } = this.props;

    return (
      <tr className="documentTable__row">
        <td colSpan={columns.length + 1}>
          <DocumentTableDetailRowActions row={row} />
          <DocumentViewer />
        </td>
      </tr>
    );
  }
}

DocumentTableDetailRow.propTypes = {
  actions: PropTypes.objectOf(PropTypes.func),
  columns: PropTypes.arrayOf(PropTypes.object),
  row: PropTypes.object,
};
