import React, { Component } from 'react';
import {
  Checkbox
} from 'semantic-ui-react';

import InputField from '../../components/shared/InputField';
import SelectorField from '../../components/shared/SelectorField';
import ServiceUI from '../../runtime/services/ServiceUI';
// import { s, t } from '../../styles';

export default class IngressUI extends Component {
  state = {
    op: '',
    path: '',
    redirect: ''
  };

  onInit = conf => {
    const op = conf && conf.op && conf.op.toUpperCase();
    const path = conf && conf.path;
    const query = conf && conf.selector && conf.selector.query;
    const active = conf && conf.active;
    const redirect = conf && conf.redirect;
    this.setState({
      op: op || 'GET',
      path: path || '',
      selector: {
        query: query
      },
      active,
      redirect: redirect || '',
    });
  }

  onNotification = (service, notification) => {
    console.log('Ingress received a notification', notification);
  }

  
  renderMain = service => {
    const { userId } = this.props;
    const { 
      op,
      path,
      redirect,
      active
    } = this.state;

    return (
      <div 
        style={{ 
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <SelectorField
          label="Method"
          options={{
            GET: 'GET',
            POST: 'POST',
            DELETE: 'DELETE',
            PUT: 'PUT',
          }}
          value={op}
          onChange={(_ev, { value }) => 
            this.setState({ op: value, active: false })
          }
          />
          <InputField
            label="Path"
            value={path}
            onChange={(_, {value}) => 
              this.setState({ path: value, active: false })
            }
          />
           <InputField
            label="Redirect"
            value={redirect}
            onChange={(_, {value}) => 
              this.setState({ redirect: value, active: false })
            }
          />
          <Checkbox
            toggle
            label="Active"
            style={{ padding: '5px 5px' }}
            onChange={async (_, { checked }) => {
              this.setState(
                { active: checked },
                this.sendConfig
              )
            }}
            checked={this.state.active}
            disabled={!this.state.op || !this.state.path}
          />
          {
            active && op === 'GET' &&  (
              <a
                href={`/api/${userId}/${service.board}/${this.state.path}?key=value`}
                target="blank"
                style={{
                  color: 'black',
                  padding: 5
                }}
              >
                Click to test
              </a>
            )
        }
        </div>     
   );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[
          { name: 'main', render: this.renderMain }
        ]}
      />
    );
  }
}
