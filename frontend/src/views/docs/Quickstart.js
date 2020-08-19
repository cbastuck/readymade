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
      width: '80%',
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
          <Item.Header>{item.title}</Item.Header>
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
          color: '#1e70bf',
        }}
      > 
          {claim.s}{ claim.c ? ': ' : '' } 
        <span
          style={{
            fontStyle: 'italic',
            color: 'rgba(10,10,10,1)'
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
      fontSize: 21, 
      textAlign: 'left' 
    };
    
    return (
    <Container 
      textAlign="left" 
      style={{ 
        marginTop: 20, 
        marginBottom: 100,
        }}
    >
      <h1 style={{ 
        fontSize: 24, 
        marginBottom: 50, 
        textAlign: 'center',
      }}>
        Quickstarter
      </h1>

      <h2 style={sectionStyle}>Etiquette</h2>
      <div 
        style={{ 
          marginLeft: 20, 
          marginBottom: 30 
        }}
      >
        { this.renderClaim({ s: 'Make stupid things!', c: '' }) }
        { this.renderClaim({ s: 'Especially', c: '“Dance to all the wrong songs”', link: 'https://www.youtube.com/watch?v=NkAe30aEG5c', cite: 'Refused' }) }
        { this.renderClaim({ s: 'Reason', c: '“Wir können alles. Und Alles können wir sein”', link: 'https://www.youtube.com/watch?v=GLAHeIEzaC8&list=OLAK5uy_kSDoqpFk_Fw4-zSXVfo69Tf70B98iz14w', cite: 'Turbotstaat' }) }
        { this.renderClaim({ s: 'Remember', c: '“Nur weil es dumm aussieht, muss es das nicht sein”', link: 'https://www.youtube.com/watch?v=GLAHeIEzaC8&list=OLAK5uy_kSDoqpFk_Fw4-zSXVfo69Tf70B98iz14w', cite: 'Bratze' }) }
      </div>
      
      <h2 style={sectionStyle}>Stuff to know about</h2>
      <div style={{ textAlign: 'left', marginLeft: 20 }}>
        <Item.Group link>
          { this.renderGroupItem({
            title: 'Service',
            details: [
              'Services are units in a chain that do somethig with the data coming in.',
              'Services have an input and an output.',
              'The input accepts data, the output provides data to subsequent services.',
              'When services produce data, they inject data at their output.',
              'Services can produce data spontaneously whenever they want.'
            ],
            image: <p> → ☐ → </p>,
            bottomDivider: true
          }) }
          { this.renderGroupItem({
              title: 'Chain',
              details: [
                'Logic consists of chains of services.',
                'Data is flowing through services of the chain from left to right.',
                'Chains need a runtime to exist.'
              ],
              image: <p> → ☐ → ☐ → </p>,
              bottomDivider: true
            })
          }
          { this.renderGroupItem({
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