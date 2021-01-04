import React, { Component } from 'react';

import { 
  Message, 
  Dimmer,
  Loader,
} from 'semantic-ui-react'

import { s, t } from '../styles';

export default class ReferenceTemplate extends Component {
  state = {
    state: 'initial',
    data: undefined,
  };

  componentDidMount() {
    const { url } = this.props;
    if (url) {
      this.fetchDocumentation(url);
    }
  }

  fetchDocumentation = async url => {
    this.setState({ state: 'fetching' });

    try {
      const doc = await fetch(url);
      this.setState({ 
        data: await doc.json(),
        state: 'available'
      });
    } catch(err) {
      this.setState({ state: 'missing' });
    } 
  }

  renderFetching = () => {
    return (
      <Dimmer.Dimmable dimmed={true}>
        <div 
          style={{ 
            paddingLeft: 10, 
            marginBottom: 20, 
            height: 200,
            border: 'solid 1px gray',
            borderRadius: 5,
          }}
        >
          <Dimmer active inverted>
            <Loader
              style={s(t.uc, t.ls1, t.fs12)}
              content='Retrieving data'
              inverted
            />
          </Dimmer>
        </div>
      </Dimmer.Dimmable>
    );
  }

  renderNoDocumentationAvailable = name => {
    return (
      <Message style={{ width: '100%' }} error>
        <div style={{ marginLeft: 10, fontSize: 13 }}>
          Unfortunately no further documentation for <span style={{ fontWeight: 'bold' }}>{ name }</span> exists at the the moment
        </div>
        <div style={{ marginTop: 30 }}>
          <span 
            role="img" 
            aria-label="grimacing-emoji"
            style={{ fontSize: 45 }}
          > 
            😬 
          </span>
        </div>
      </Message>
    );
  }

  render() {
    const { state, data } = this.state;
    const { name, renderFetched } = this.props;
    return(
      <div style={s(t.uc, t.ls1, t.f12, t.tc, t.m(10, 10))}>
      { 
          state === 'initial' ? false : (
            (state === 'fetching' && this.renderFetching())||
            (state === 'available' && renderFetched(data)) ||
            (state === 'missing' && this.renderNoDocumentationAvailable(name))
          )
        }
      </div>
    );
  }
}