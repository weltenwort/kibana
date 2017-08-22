import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { DocumentTableDataCell } from './document_table_data_cell';


export class DocumentTableTimeCell extends React.PureComponent {
  render() {
    const { className, column, row } = this.props;
    const classes = classNames('documentTable__cell--withoutWrap', className);

    return (
      <DocumentTableDataCell
        className={classes}
        column={column}
        row={row}
      />
    );
  }
}

DocumentTableTimeCell.propTypes = {
  className: PropTypes.string,
  column: PropTypes.object,
  row: PropTypes.object,
};
