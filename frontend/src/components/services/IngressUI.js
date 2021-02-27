import React, { Component } from 'react';
import {
  Checkbox
} from 'semantic-ui-react';

import InputField from '../../components/shared/InputField';
import SelectorField from '../../components/shared/SelectorField';
import ServiceUI from '../../runtime/services/ServiceUI';
import { s, t } from '../../styles';

export default class IngressUI extends Component {
  state = {
    op: '',
    path: '',
    redirect: '',
    active: false,
    wrapHeaders: false
  };

  onInit = conf => {
    const op = conf && conf.op && conf.op.toUpperCase();
    const path = conf && conf.path;
    const query = conf && conf.selector && conf.selector.query;
    const active = conf && conf.active;
    const redirect = conf && conf.redirect;
    const wrapHeaders = conf && conf.wrapHeaders;
    this.setState({
      op: op || 'GET',
      path: path || '',
      selector: {
        query: query
      },
      active,
      redirect: redirect || '',
      wrapHeaders
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
      active,
      wrapHeaders
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
          <div 
            style={{ 
              marginTop: 10,
              textAlign: 'left' 
            }}
          >
            <Checkbox
              toggle
              label="Wrap Headers"
              style={s(t.uc, t.fs12, t.m(0, 3))}
              onChange={async (_, { checked: wrapHeaders }) => {
                this.setState(
                  { wrapHeaders },
                  () => service.configure({ wrapHeaders })
                )
              }}
              checked={wrapHeaders}
              disabled={!op || !path}
            />
            <Checkbox
              toggle
              label="Active"
              style={s(t.uc, t.fs12, t.m(0, 3))}
              onChange={async (_, { checked: active }) => {
                this.setState(
                  { active },
                  () => service.configure(this.state)
                )
              }}
              checked={active}
              disabled={!op || !path}
            />
          </div>
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
