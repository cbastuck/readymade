import React, { Component } from 'react';

import { Link } from 'react-router-dom';
import { Item } from 'semantic-ui-react'

import Sketch from './Sketch';
import Template from './Template';
import { s, t } from '../../styles';

export default class Quickstart extends Component {

  renderGroupItem = item => {
    const itemStyle = {
      width: '100%',
      marginBottom: 10,
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
              minWidth: 150,
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
                    // margin: '5px 0px',
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
        { 
          claim.link ? 
            (
               <a 
                href={claim.link} 
                target="blank"
              > 
                {claim.c}
              </a>
            ) : (
              <span
                style={{ color: '#4183c4', fontStyle: 'initial' }}
              >
                { claim.c }
              </span>
            )
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
        <h2 style={{ ...sectionStyle, margin: '30px 0px' }}>Etiquette</h2>
        <div style={{ marginBottom: 35 }}>
          { this.renderClaim({ s: 'Please', c: 'Make stupid things!' }) }
          { this.renderClaim({ s: 'In particular', c: '“Dance to all the wrong songs”', link: 'https://www.youtube.com/watch?v=NkAe30aEG5c', cite: 'D. Sandstrom, D. Lyxzen, K. Steen, J. Brannstrom' }) }
          { this.renderClaim({ s: 'Because', c: '"Da fehlen Rebellen, da fehlen Dilettanten”', link: 'https://www.youtube.com/watch?v=58ShJinuHTg', cite: 'Kapelle Petra' }) }
          { this.renderClaim({ s: 'Acknowledge', c: '“Wir können alles. Und Alles können wir sein”', link: 'https://www.youtube.com/watch?v=GLAHeIEzaC8', cite: 'R. Sczimarkowsi, J. Windmeier, C. Knopp, M. Ebsen, C. Peter' }) }
          { this.renderClaim({ s: 'Understand', c: '“Nur weil es dumm aussieht, muss es das nicht sein”', link: 'https://www.youtube.com/watch?v=IIw1nP4KEHs', cite: ' K. Hamann, N. Kolodziej ' }) }
          { this.renderClaim({ s: 'With respect', c: '"To want more than is given to you”', link: 'https://www.youtube.com/watch?v=xk2CvKcJnC4', cite: 'G. Moakes, K. Okereke,  M. Tong, R. Lissackj' }) }
          { this.renderClaim({ s: 'Knowing', c: '"I can\'t do this all on my own”', link: 'https://www.youtube.com/watch?v=SBl2l3GIFD4', cite: 'Lazlo Bane' }) }
        </div>  
        <h1 style={s(t.tc, t.uc, t.ls1, t.fs12, t.it, { color: '#4183c4' })}>
            <span style={t.fs16}>Do. </span> 
            <span style={t.fs20}>Be curious!</span> 
            <a href="https://cbastuck.de" target="blank">
              <span style={t.fs9}> talk.</span>
            </a>
        </h1>
        
        <h2 style={{ ...sectionStyle, marginTop: 30, marginBottom: 20 }}>Stuff to know about</h2>
        <div style={s(t.uc, t.fs12, t.ls2, { textAlign: 'left' })}>
          <div style={{ marginBottom: 10 }}>
            There are three "things" that your need to know about. They are
            the basic building blocks, ordered by what consists of what: Board - Runtime - Service.
          </div>
          <div style={{ margin: 5 }}>
            <Sketch />
          </div>
          <div>
            Think 
            of Board a sheet of paper, a Runtime as a line on the paper and Services as the words a line
            consists of. Together the building blocks provide some behavior, comparable to a story that piece 
            of papar might tell.

            Start experimenting with logic
          </div>
          <Item.Group link>
          { 
              this.renderGroupItem({
                title: 'Board',
                details: [
                  'A Board is the topmost building block. Everything happens on a Board',
                  'A Board is identified by a name',
                  'A Board owns and manages an arbitrary number of runtimes',
                  'A Board can run inside of the browser, independent of any backend (e.g. Playground)',
                  'A Board can be managed by a remote instance which persists its state and requires the notion of a user',                  
                  'A Board defines a topology of how the runtimes are organized and their order',
                  'A Board is responsible for passing the output from one runtime to the next runtime',
                ],
                image: undefined,
                bottomDivider: true
              })
            }
            { 
              this.renderGroupItem({
                title: 'Runtime',
                details: [
                  'A Runtime belongs to exactly one board',
                  'A Runtime\'s lifetime ends when the lifetime of its parent Board ends',
                  'A Runtime can run inside of the browser or on a remote machine',
                  'Runtimes running in the browser and on any remote machine can be mixed within the same Board',
                  'A Runtime accepts data on its input, passes the data to the services it owns and manages and provides the result data on its output',
                  'A Runtime owns and manages an arbitrary number of services',
                  'A Runtime calls services in order from left to right providing the incoming data or the result of the previous service',
                ],
                image: undefined, 
                bottomDivider: true,
              }) 
            }
            { 
              this.renderGroupItem({
                title: 'Service',
                details: [
                  'Services are high level abstractions of complex logic',
                  'Services are supposed to feel simple and intuitive',
                  'Services have an input and an output',
                  'Services have a configuration that can be modified or retrieved at any time',
                  'A Service configuration can be understood as the mode of a Service',
                  'A Service may behave differently depending on its configuration.',
                  'A Service can generate spontaneously and by that, feed this data into the following Services',
                  'A Service can decide to stop further propagation and thus cancel further processing of the Runtime and the Board eventually',
                ],
                image: undefined,
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
        <div style={s(t.tc)}>
          <Link 
            to="/playground"
            style={s(t.uc, t.fs16, t.ls3, t.bo, t.nw)}
          >
            Visit Playground
          </Link>
        </div>
      </Template>
    );
  }
}