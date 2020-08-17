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

  renderQuickstart = () => {
    const sectionStyle = { 
      fontSize: 20, 
      textAlign: 'left' 
    };
    const itemImageStyle = {
      marginTop: 40, 
      minWidth: 150,
      marginLeft: 10,
    };
    const itemStyle={
      marginTop: 20,
      padding: 10,
      borderBottom: 'solid 1px gray',
    };
    return (
    <Container textAlign="left" style={{ marginTop: 20, marginBottom: 100 }}>
      <h1 style={{ fontSize: 22, marginBottom: 50, textAlign: 'center'}}>Quickstarter</h1>

      <h2 style={sectionStyle}>Preface</h2>
      <div style={{ textAlign: 'left', marginLeft: 20 }}>
        <div>Make stupid things!</div>
        <div style={{ fontStyle: 'italic' }}>Dance to all the wrong songs!</div>
        <div style={{ fontStyle: 'italic' }}>Wir können alles. Und Alles können wir sein!</div>
      </div>
      
      <h2 style={sectionStyle}>Terms and concepts</h2>
      <div style={{ width: '80%', margin: 'auto' }}>
        <Item.Group link>
          <Item style={itemStyle}>
            <div style={itemImageStyle}> ☐ → ☐ → ☐  </div>
            <Item.Content>
              <Item.Header>Chains</Item.Header>
              <Item.Description>
                <ul style={{ listStyle: 'none' }}>
                  <li>Logic consists of chains of services. </li>
                  <li>Data is flowing through services of the chain from left to right.</li>
                  <li>Chains need a runtime to exist.</li>
                </ul>
              </Item.Description>
            </Item.Content>
          </Item>

          <Item style={itemStyle}>
            <div style={itemImageStyle}> → ☐ →  </div>
            <Item.Content>
              <Item.Header>Service</Item.Header>
              <Item.Description>
              <ul style={{ listStyle: 'none' }}>
                <li>Services are units in a chain that do somethig with the data coming in.</li>
                <li>Services have an input and an output.</li>
                <li>The input accepts data, the output provides data to subsequent services.</li>
                <li>When services produce data, they inject data at their output.</li>
                <li>Services can produce data spontaneously whenever they want.</li>
              </ul>
              </Item.Description>
            </Item.Content>
          </Item>

          <Item style={itemStyle}>
            <div style={itemImageStyle}> 
              <p> ( ☐ → ☐ ) →</p>
              <p> → ( ☐ → ☐ ) </p>
            </div>
            <Item.Content>
              <Item.Header>Runtimes</Item.Header>
              <Item.Description>
              <ul style={{ listStyle: 'none' }}>
                <li>The runtime keeps services and chains together.</li>
                <li>The output of the last service in a runtime becomes the output of the whole runtime.</li>
                <li>Multiple runtimes can be chained after each other. </li>
                <li>The output of a runtome becomes gets feeded into the subsequent runtime.</li>
                <li>Injecting data into a runtime means calling the first service of the runtime with that data.</li>
                <li>The runtime defines the running order if the services.</li>
                <li>Runtimes can be living in the browser only or on a server. </li>
                <li>Runtimes living in the browser are only active while the browser is open.</li>
                <li>Runtimes living on a server are always on.</li>
              </ul>
                
              </Item.Description>
            </Item.Content>
          </Item>
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