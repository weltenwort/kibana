import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { DocumentTableCell } from './document_table_cell';


export class DocumentTableExpandCell extends React.PureComponent {
  render() {
    const { actions, className, row } = this.props;
    const classes = classNames('documentTable__cell--expandToggle', className);
    const iconClasses = classNames('kuiIcon',
      (row.isExpanded ? 'fa-caret-down' : 'fa-caret-right'),
    );

    return (
      <DocumentTableCell className={classes}>
        <button
          className="kuiMicroButton"
          onClick={() => actions.toggleRowExpanded(row.id)}
        >
          <span className={iconClasses} />
        </button>
      </DocumentTableCell>
    );
  }
}

DocumentTableExpandCell.propTypes = {
  actions: PropTypes.objectOf(PropTypes.func),
  className: PropTypes.string,
  row: PropTypes.object,
};
