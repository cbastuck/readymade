import React, { Component } from 'react';
import { 
  Breadcrumb,
  Container,
  Image as ImageComponent, Item
} from 'semantic-ui-react'

import { AppConsumer } from '../../AppContext';
import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

export default class Quickstart extends Component {
  state = {
    
  };

  renderBreadcrumbs = () => {
    const { currentExample } = this.state;
    return (
      <div style={{ textAlign: 'left', marginLeft: 5 }}>
        <Breadcrumb>
          <Breadcrumb.Section 
            link
            onClick={() => this.setState({ currentExample: null })}
          >
            Examples
          </Breadcrumb.Section>
          <Breadcrumb.Divider />
          { 
            currentExample && 
              <Breadcrumb.Section link>
                  { currentExample.title }
              </Breadcrumb.Section>
          }
        </Breadcrumb>
      </div>
    );
  }

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
          <Item.Header style={{ fontSize: 16 }}>{item.title}</Item.Header>
          <Item.Description>
            {
              item.details.map((detail, idx) => 
                <div key={`detail-${item.title}-${idx}`}> {detail} </div>
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
          fontSize: 18,
          fontWeight: 'bold',
          textAlign: 'justify',
          margin: '9px 10px',
          color: claim.c ? 'black' : '#454f6d',
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
        <span
          style={{
            fontSize: 10
          }}
        >
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
      fontSize: 16, 
      textAlign: 'left',
      textTransform: 'uppercase',
    };
    
    return (
    <Container 
      style={{ 
        marginTop: 20, 
        marginBottom: 50,
        width: '60%'
      }}
    >
    { 
      <h1 style={{ 
        fontSize: 24, 
        textAlign: 'center',
      }}>
        Q U I C K S T A R T E R
      </h1>
    }

      <h2 style={sectionStyle}>E t i q u e t t e</h2>
      <div 
        style={{ 
          marginLeft: 20, 
          marginBottom: 50 
        }}
      >
        { this.renderClaim({ s: 'Make stupid things!', c: '' }) }
        { this.renderClaim({ s: 'In particular', c: '“Dance to all the wrong songs”', link: 'https://www.youtube.com/watch?v=NkAe30aEG5c', cite: 'Refused' }) }
        { this.renderClaim({ s: 'Once knobs are relevant', c: '“Wir können alles. Und Alles können wir sein”', link: 'https://www.youtube.com/watch?v=GLAHeIEzaC8', cite: 'Turbotstaat' }) }
        { this.renderClaim({ s: 'I agree to', c: '“Nur weil es dumm aussieht, muss es das nicht sein”', link: 'https://www.youtube.com/watch?v=IIw1nP4KEHs', cite: 'Bratze' }) }
      </div>
      
      <h2 style={sectionStyle}>S t u f f  t o  k n o w  a b o u t</h2>
      <div style={{ textAlign: 'left', marginLeft: 20 }}>
        <Item.Group link>
          { this.renderGroupItem({
            title: 'S E R V I C E',
            details: [
              'Services are units that generate data, modify data or just accept it.',
              'Services accept data at their input and provide data at their output.',
              'When services produce data, they sponateously inject that data at their output.',
              'Services accept a configuration that specifies the mode the are running in.',
              'Services can provide their current configuration to restore it later.'
            ],
            image: <p> → ☐ → </p>,
            bottomDivider: true
          }) }
          { this.renderGroupItem({
              title: 'C H A I N',
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
          { this.renderGroupItem({
              title: 'R U N T I M E',
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
              )
            }) 
          }
        </Item.Group>
      </div>
    </Container>
    );
  }

  render() {
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext
              fetchData={!!appContext.user && !!appContext.user.username}
            >
              <BoardConsumer>
              {
                boardContext => (
                  <div style={{ height: '100%' }}>
                    <Toolbar 
                      savedBoards={boardContext.savedBoards}
                      onAction={boardContext.onAction}
                    />
                    { this.renderQuickstart() }               
                  </div>
                )
              }
              </BoardConsumer>
              <Footer />
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}