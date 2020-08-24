import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Container,
  Item,
} from 'semantic-ui-react'

import Template from './Template';

export default class Quickstart extends Component {

  renderGroupItem = item => {
    const itemStyle = {
      width: '100%',
      marginTop: 20,
      padding: 10,
      borderBottom: item.bottomDivider ? 'solid 1px lightgray' : 'none',
    };
    const itemImageStyle = {
      marginTop: 40, 
      minWidth: 150,
      marginLeft: 10,
    };
    return (
      <Item style={itemStyle}>
        <div style={itemImageStyle}> { item.image}  </div>
        <Item.Content>
          <Item.Header 
            style={{ 
              fontSize: 14,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            <Link to={`/docs/${item.title.toLowerCase()}`}>{item.title}</Link>
          </Item.Header>
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
          margin: '5px 5%',
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
        <span style={{ fontSize: 10 }}>
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
      margin: '20px 0px',
    };
    
    return (
      <div>
        <h2 style={sectionStyle}>Etiquette</h2>
        <div style={{ marginBottom: 35 }}>
          { this.renderClaim({ s: 'Make stupid things!', c: '' }) }
          { this.renderClaim({ s: 'In particular', c: '“Dance to all the wrong songs”', link: 'https://www.youtube.com/watch?v=NkAe30aEG5c', cite: 'D. Sandstrom, D. Lyxzen, K. Steen, J. Brannstrom' }) }
          { this.renderClaim({ s: 'Imagine this', c: '“Wir können alles. Und Alles können wir sein”', link: 'https://www.youtube.com/watch?v=GLAHeIEzaC8', cite: 'R. Sczimarkowsi, J. Windmeier, C. Knopp, M. Ebsen, C. Peter' }) }
          { this.renderClaim({ s: 'Agree to', c: '“Nur weil es dumm aussieht, muss es das nicht sein”', link: 'https://www.youtube.com/watch?v=IIw1nP4KEHs', cite: ' K. Hamann, N. Kolodziej ' }) }
          { this.renderClaim({ s: 'Demand', c: 'Give me grace and dancing feet And the power to impress”', link: 'https://www.youtube.com/watch?v=xk2CvKcJnC4', cite: 'G. Moakes, K. Okereke,  M. Tong, R. Lissackj' }) }
        </div>
        
        <h2 style={sectionStyle}>Stuff to know about</h2>
        <div style={{ textAlign: 'left' }}>
          <Item.Group link>
            { 
              this.renderGroupItem({
                title: 'Service',
                details: [
                  'Services are units that generate data, modify data or just accept it.',
                  'Services accept data at their input and provide data at their output.',
                  'When services produce data, they sponateously inject that data at their output.',
                  'Services accept a configuration that specifies the mode the are running in.',
                  'Services can provide their current configuration to restore it later.'
                ],
                image: <p> → ☐ → </p>,
                bottomDivider: true
              }) 
            }
            { 
              this.renderGroupItem({
                title: 'Chain',
                details: [
                  'Workflows consist of subsequent services arranged in a chain.',
                  'Data flows through the chain from left to right.',
                  'A service can decide to stop further processing of the chain',
                  'If a service in a chain sponateously emits data, subsequent services in the chain are triggered.',
                  'Chains might contain a feedback loop',
                  'A Chain needs a runtime to exist.'
                ],
                image: <p> → ☐ → ☐ → </p>,
                bottomDivider: true
              })
            }
            { 
              this.renderGroupItem({
                title: 'Runtime',
                details: [
                  'The runtime keeps services and chains together.',
                  'The output of the last service in a runtime becomes the output of the whole runtime.',
                  'Multiple runtimes can be chained after each other.',
                  'The output of a runtome becomes gets feeded into the subsequent runtime.',
                  'Injecting data into a runtime means calling the first service of the runtime with that data.',
                  'The runtime defines the running order if the services.',
                  'Runtimes can be living in the browser only or on a server.',
                  'Runtimes living in the browser are only active while the browser is open.',
                  'Runtimes living on a server are always on.',
                ],
                image: (
                  <div>
                    <p> ( ☐ → ☐ ) → </p>
                    <p> → ( ☐ → ☐ ) </p>
                  </div>
                ),
                bottomDivider: true
              }) 
            }
            { 
              this.renderGroupItem({
                title: 'Board',
                details: [
                  'Board is the home for all runtimes',
                  'It belongs to a user',
                ],
                image: (
                  <div>
                    Board
                  </div>
                )
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