import React, { Component } from 'react';
import { Dropdown } from 'semantic-ui-react';

import './ServiceDropdown.css';

export default class ServiceDropdown extends Component {
  state = {
    value: ''
  };
  render() {
    const { 
      options, 
      wide,
      onSelected
    } = this.props;
    return (
      <div
        id="service-dropdown"
        style={{
          fontSize: 12,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginRight: 10
        }}
      >
        <Dropdown
          ref={dropdown => this.dropdown = dropdown }
          deburr
          options={options}
          placeholder={wide ? 'Add Service' : 'Service'}
          search
          selection
          selectOnBlur={false}
          onChange={(ev, { value }) => 
            this.setState({ value })
          }
          onClose={(ev, data) => {
            // TODO: needed due to an issue with semantic-ui
            // otherwise the close event arrives when then change 
            // from the onChange handler is not yet set
            setTimeout(
              () => {
                const { value } = this.state;
                if (value) {
                  onSelected(value);
                  this.dropdown.clearValue();
                }
              }, 
              0
            );
          }}
          compact={!wide}
        />
      </div>
    );
  }
}