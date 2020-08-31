import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Container,
  Breadcrumb,
} from 'semantic-ui-react'

import { AppConsumer } from '../../AppContext';
import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

export default class Template extends Component {
  renderBreadcrumbs = (title, isRoot) => {
    const breadcrumpStyle = {
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontSize: 11,
    };
    if (isRoot) {
      return false;
    }
    return (
      <div 
        style={{ 
          textAlign: 'left', 
          marginLeft: 5,
          marginTop: 15,
          width: 300
        }}
      >
        <Breadcrumb>
          <Breadcrumb.Section 
            link
          >
            <Link to="/docs">
              <span style={breadcrumpStyle}>
                Quickstarter
              </span>
            </Link>
          </Breadcrumb.Section><Breadcrumb.Divider /><Breadcrumb.Section link>
            <span style={breadcrumpStyle}>
              { title }
            </span>
          </Breadcrumb.Section>
        </Breadcrumb>
      </div>
    );
  }

  render() {
    const { children, title, isRoot } = this.props;
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext fetchData={!!appContext.user && !!appContext.user.username}>
              <BoardConsumer>
              {
                boardContext => (
                  <div style={{ height: '100%' }}>
                    <Toolbar 
                      savedBoards={boardContext.savedBoards}
                      onAction={boardContext.onAction}
                    />
                    <Container 
                      style={{ 
                        marginTop: 20, 
                        marginBottom: 50,
                        width: '70%'
                      }}
                    >
                      <h1 style={{ 
                        width: '100%',
                        fontSize: 20, 
                        textAlign: 'center',
                        letterSpacing: 8,
                        textTransform: 'uppercase',
                        margin: 0                        
                      }}>
                        { title }
                      </h1>
                      { this.renderBreadcrumbs(title, isRoot) }
                      { children }
                    </Container>
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