import React, { Component } from 'react';

import ReferenceTemplate from './ReferenceTemplate';

import { t } from '../styles';

export default class DataModelReference extends Component {
  renderProp = (key, decription) => {
    return (
      <div key={`datamodel-property-${key}`}>
        <span>
          { key }
        </span> 
        : 
        <span>
          { decription }
        </span>
      </div>
    );
  }
  
  renderFetched = (name, data) => {
    if (!data) {
      return false;
    }  
    const { properties } = data; 
    return (
      <div style={t.fill}>
        { Object.keys(properties).map(key => this.renderProp(key, properties[key])) }
      </div>
    );
  }

  render() {
    const { datamodel, name=datamodel } = this.props;
     return (
       <ReferenceTemplate 
          name={name}
          url={`/datamodelDocs/${datamodel}.json`}
          renderFetched={data => this.renderFetched(name, data)}
       />
    );
  }
}