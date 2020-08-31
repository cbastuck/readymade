import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Item } from 'semantic-ui-react'

import Template from './Template';

export default class Quickstart extends Component {

  renderGroupItem = item => {
    const itemStyle = {
      width: '100%',
      marginBottom: 30,
      padding: 20,
      borderBottom: item.bottomDivider ? 'solid 1px lightgray' : 'none',
    };
    return (
      <Item style={itemStyle}>
        {
          <Item.Header 
            style={{ 
              fontSize: 14,
              letterSpacing: 4,
              textTransform: 'uppercase',
              paddingTop: 9,
              marginLeft: 10,
              width: 150
            }}
          >
            <Link to={`/docs/${item.title.toLowerCase()}`}>{item.title}</Link>
          </Item.Header>
        }
        <Item.Content style={{marginLeft: 10 }}>
          
          <Item.Description>
            {
              item.details.map((detail, idx) => 
                <div 
                  key={`detail-${item.title}-${idx}`}
                  style={{
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    margin: '5px 0px',
                  }}
                > 
                  {detail} 
                </div>
              )
            }
          </Item.Description>
        </Item.Content>
      </Item>
    );
  }

  renderClaim = claim => {
    return (
      <div
        style={{
          fontSize: 14,
          textAlign: 'left',
          margin: '5px 30px',
          color: claim.c ? 'black' : '#454f6d',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      > 
          {claim.s}{ claim.c ? ': ' : '' } 
        <span
          style={{
            fontStyle: 'italic',
            color: '#454f6d'
          }}
        >
          {claim.c}
        </span>
        <span style={{ 
          fontSize: 9, 
          marginLeft: 5,
          letterSpacing: 0,
        }}>
          { 
            claim.cite ? (
              <a 
                href={claim.link} 
                target="blank"
              > 
                [{claim.cite}] 
              </a> ) :
              '' 
            }
        </span>
      </div>
    );
  }

  renderQuickstart = () => {
    const sectionStyle = { 
      fontSize: 15, 
      textAlign: 'left',
      textTransform: 'uppercase',
      letterSpacing: 2,
    };
    
    return (
      <div>
        <h2 style={{ ...sectionStyle, margin: '40px 0px' }}>Etiquette</h2>
        <div style={{ marginBottom: 45 }}>
          { this.renderClaim({ s: 'Make stupid things!', c: '' }) }
          { this.renderClaim({ s: 'In particular', c: '“Dance to all the wrong songs”', link: 'https://www.youtube.com/watch?v=NkAe30aEG5c', cite: 'D. Sandstrom, D. Lyxzen, K. Steen, J. Brannstrom' }) }
          { this.renderClaim({ s: 'Imagine this', c: '“Wir können alles. Und Alles können wir sein”', link: 'https://www.youtube.com/watch?v=GLAHeIEzaC8', cite: 'R. Sczimarkowsi, J. Windmeier, C. Knopp, M. Ebsen, C. Peter' }) }
          { this.renderClaim({ s: 'Agree to', c: '“Nur weil es dumm aussieht, muss es das nicht sein”', link: 'https://www.youtube.com/watch?v=IIw1nP4KEHs', cite: ' K. Hamann, N. Kolodziej ' }) }
          { this.renderClaim({ s: 'With respect', c: '"To want more than is given to you”', link: 'https://www.youtube.com/watch?v=xk2CvKcJnC4', cite: 'G. Moakes, K. Okereke,  M. Tong, R. Lissackj' }) }
        </div>
        
        <h2 style={{ ...sectionStyle, margin: '30px 0px', }}>Stuff to know about</h2>
        <div style={{ textAlign: 'left' }}>
          <Item.Group link>
            { 
              this.renderGroupItem({
                title: 'Service',
                details: [
                  'Services are units that generate, transform or just accept data.',
                  'Services receive data on their input and provide data on their output.',
                  'If a Service generates data, this data is injected at its output spontaneously.',
                  'A Service may behave differently depending on its configuration.',
                  'Service configurations can be set and get at any time.'
                ],
                image: undefined, //this.renderExampleService(),
                bottomDivider: true
              }) 
            }
            { 
              this.renderGroupItem({
                title: 'Runtime',
                details: [
                  'A Runtime hosts multiple services and is responsible for the data flow.',
                  'A Runtime calls the hosted services in order from left to right.',
                  'If a Service is processed the Runtime calls the next Service forwarding the provided data.',
                  'If a Service decides to stop further processing the Runtime stops propagation',
                  'The input of the first Service of the Runtime is considered the input of the Runtime.',
                  'The output of the last Service of the Runtime is considered the output of the Runtime.',
                  'Runtimes can be running permanently or be only available on demand.',
                ],
                image: undefined, // this.renderSceneExample("Some Runtime"),
                bottomDivider: true
              }) 
            }
            { 
              this.renderGroupItem({
                title: 'Board',
                details: [
                  'A Board is scoped to a user and within scope uniquely identified by its name',
                  'A Board hosts multiple runtimes which are chained and form a workflow',
                  '',
                ],
                image: undefined, //this.renderBoardExample(), 
              })
            }
          </Item.Group>
        </div>
      </div>
    );
  }

  render() {
    return (
      <Template
        title="Quickstarter"
        isRoot={ true }
      >
        { this.renderQuickstart() } 
      </Template>
    );
  }
}